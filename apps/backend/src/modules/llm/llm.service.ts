import Groq from "groq-sdk";
import { logger } from "../../lib/logger.js";
import { config } from "../../config.js";

const GROQ_API_KEY = config.groqApiKey;
const LLM_MODEL = config.llmModel ?? "llama-3.1-8b-instant";

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 5 * 60_000;

type CacheEntry = { value: string; expiresAt: number };
const responseCache = new Map<string, CacheEntry>();

const userRequestCounts = new Map<number, { count: number; windowStart: number }>();

function getUserRateLimit(userId: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = userRequestCounts.get(userId);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    userRequestCounts.set(userId, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0, resetAt: record.windowStart + RATE_LIMIT_WINDOW_MS };
  }

  record.count += 1;
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - record.count, resetAt: record.windowStart + RATE_LIMIT_WINDOW_MS };
}

function cacheKey(systemPrompt: string, userPrompt: string): string {
  return `${systemPrompt}|${userPrompt}`;
}

function getCached(key: string): string | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key: string, value: string): void {
  responseCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function stripEmojis(text: string): string {
  return text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  userId: number,
): Promise<{ text: string; fallback: boolean; tokensIn?: number; tokensOut?: number; latencyMs: number }> {
  const startedAt = Date.now();

  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const groq = new Groq({ apiKey: GROQ_API_KEY });

  const completion = await Promise.race([
    groq.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 300,
      top_p: 0.9,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Groq request timeout")), REQUEST_TIMEOUT_MS),
    ),
  ]);

  const latencyMs = Date.now() - startedAt;
  const text = completion.choices[0]?.message?.content ?? "";
  const tokensIn = completion.usage?.prompt_tokens;
  const tokensOut = completion.usage?.completion_tokens;

  return { text: stripEmojis(text), fallback: false, tokensIn, tokensOut, latencyMs };
}

function fallbackRecommendation(facts: string): string {
  const lines = facts.split("\n").filter(Boolean);
  if (lines.length === 0) return "No specific recommendation at this time.";
  return `Based on your data: ${lines.slice(0, 3).join("; ")}.`;
}

function fallbackAssistant(query: string): string {
  const q = query.toLowerCase();
  if (q.includes("budget") || q.includes("cost") || q.includes("kes") || q.includes("shilling")) {
    return "GlucoPlate helps you plan meals within your daily KES budget. Set your budget in Settings and the planner will pick affordable dishes.";
  }
  if (q.includes("carb") || q.includes("sugar") || q.includes("glucose")) {
    return "The planner respects your daily carb target. Add low-carb dishes like eggs, fish, or leafy greens to your bucket for better control.";
  }
  if (q.includes("gi") || q.includes("glycemic")) {
    return "Glycemic Index (GI) measures how fast a food raises blood sugar. GlucoPlate prioritises low-GI dishes (55 or below) for stable sugars.";
  }
  if (q.includes("weight") || q.includes("kg") || q.includes("track")) {
    return "Log your weight in the Health Hub to see trends. The app estimates weekly change based on your meal plan calories.";
  }
  if (q.includes("plan") || q.includes("meal") || q.includes("generate")) {
    return "Go to the Planner, set your budget and carb target, then tap Generate. You can swap dishes and save the plan.";
  }
  if (q.includes("premium") || q.includes("pay") || q.includes("mpesa")) {
    return "Premium unlocks weekly plans, analytics, and more AI features. Pay KSh 20 via M-Pesa in Settings.";
  }
  return "I can help with budgeting, carbs, GI, weight tracking, meal planning, and premium features. Ask me about any of these.";
}

function fallbackPopup(popupType: string, context: string): string {
  const fallbacks: Record<string, string> = {
    milestone: "Well done! You reached a new milestone. Keep going.",
    daily_challenge: "Today's challenge: log your weight and stay within your carb target.",
    tip: "Add more low-GI vegetables to your bucket for better sugar control.",
    recommendation: "Your plan looks good. Consider swapping a high-GI dish for a lower-GI option.",
  };
  return fallbacks[popupType] ?? "Here's a tip for your diabetes meal planning journey.";
}

export const llmService = {
  async generateRecommendation(
    userId: number,
    facts: string,
  ): Promise<{ text: string; fallback: boolean; latencyMs: number }> {
    const rateLimit = getUserRateLimit(userId);
    if (!rateLimit.allowed) {
      logger.warn("LLM rate limit exceeded", { userId });
      return { text: fallbackRecommendation(facts), fallback: true, latencyMs: 0 };
    }

    const key = cacheKey("recommendation", facts);
    const cached = getCached(key);
    if (cached) {
      logger.debug("LLM cache hit", { userId, type: "recommendation" });
      return { text: cached, fallback: false, latencyMs: 0 };
    }

    const systemPrompt = `You are GlucoPlate, a Kenyan diabetes meal planning assistant.
Write ONE short, practical recommendation (max 3 sentences, no emojis, no markdown).
Use the user's own numbers from the facts provided. Do not invent numbers.
Currency is KES. Tone: encouraging, clear, concise.
The facts include a "Medical advisory:" line — incorporate this brief advisory into your response.
Never give medical advice beyond meal planning and general diabetes awareness.`;

    const startedAt = Date.now();
    try {
      const result = await callGroq(systemPrompt, facts, userId);
      setCache(key, result.text);
      return { text: result.text, fallback: result.fallback, latencyMs: result.latencyMs };
    } catch (error) {
      logger.error("Groq recommendation failed", { userId, error: String(error) });
      return { text: fallbackRecommendation(facts), fallback: true, latencyMs: Date.now() - startedAt };
    }
  },

  async answerQuestion(
    userId: number,
    question: string,
    userProfile: { diabetesLevel: string; setting: string; needsClinicianReview: boolean },
  ): Promise<{ text: string; fallback: boolean; disclaimer: string; latencyMs: number }> {
    const rateLimit = getUserRateLimit(userId);
    if (!rateLimit.allowed) {
      logger.warn("LLM rate limit exceeded", { userId });
      return {
        text: fallbackAssistant(question),
        fallback: true,
        disclaimer: "Disclaimer: I am an AI, not a doctor. Please consult your healthcare provider.",
        latencyMs: 0,
      };
    }

    const key = cacheKey("assistant", question);
    const cached = getCached(key);
    if (cached) {
      logger.debug("LLM cache hit", { userId, type: "assistant" });
      return { text: cached, fallback: false, disclaimer: "", latencyMs: 0 };
    }

    const clinicianNote = userProfile.needsClinicianReview
      ? "The user is in a critical/high-risk category. Always include: 'Talk to your doctor or dietitian before making changes.'"
      : "";

    const systemPrompt = `You are GlucoPlate's in-app assistant ("Ask GlucoPlate").
Answer questions about the app's features, navigation, and basic Kenyan diet/diabetes meal planning.
REFUSE medication, insulin, dosing, and diagnosis questions. Redirect to a clinician.
App guide: GlucoPlate has 5 views — Today's Plate (generate daily plan), Dishes (manage your bucket), Plans (saved plans), Progress (weight tracking), Settings (budget, carb target, profile). The planner picks affordable, low-GI Kenyan dishes. Premium (KSh 20) unlocks weekly plans and analytics. M-Pesa sandbox for payments.
${clinicianNote}
Answer in 1-3 short sentences. No emojis. No markdown. Currency KES.`;

    try {
      const result = await callGroq(systemPrompt, question, userId);
      const disclaimer = "Disclaimer: I am an AI, not a doctor. Please consult your healthcare provider before making dietary changes.";
      const fullText = `${result.text}\n\n${disclaimer}`;
      setCache(key, fullText);
      return { text: result.text, fallback: result.fallback, disclaimer, latencyMs: result.latencyMs };
    } catch (error) {
      logger.error("Groq assistant failed", { userId, error: String(error) });
      return {
        text: fallbackAssistant(question),
        fallback: true,
        disclaimer: "Disclaimer: I am an AI, not a doctor. Please consult your healthcare provider.",
        latencyMs: 0,
      };
    }
  },

  async generatePopupCopy(
    userId: number,
    popupType: "milestone" | "daily_challenge" | "tip" | "recommendation",
    context: string,
  ): Promise<{ title: string; body: string; fallback: boolean; latencyMs: number }> {
    const rateLimit = getUserRateLimit(userId);
    if (!rateLimit.allowed) {
      logger.warn("LLM rate limit exceeded for popup", { userId });
      const fallback = fallbackPopup(popupType, context);
      return { title: popupType.replace("_", " "), body: fallback, fallback: true, latencyMs: 0 };
    }

    const key = cacheKey(`popup_${popupType}`, context);
    const cached = getCached(key);
    if (cached) {
      logger.debug("LLM cache hit", { userId, type: `popup_${popupType}` });
      const [title, ...bodyParts] = cached.split("\n");
      return { title: title || popupType, body: bodyParts.join("\n"), fallback: false, latencyMs: 0 };
    }

    const prompts: Record<string, string> = {
      milestone: `Write a short congratulatory popup for a milestone achieved. Context: ${context}. Max 2 sentences. No emojis. Encouraging tone.`,
      daily_challenge: `Write a daily challenge popup for a Kenyan diabetes meal planning app. Context: ${context}. One specific, achievable action. Max 2 sentences. No emojis.`,
      tip: `Write a practical Kenyan diet tip popup for diabetes management. Context: ${context}. One actionable tip. Max 2 sentences. No emojis.`,
      recommendation: `Write a personalized recommendation popup. Context: ${context}. One specific suggestion based on the user's data. Max 2 sentences. No emojis.`,
    };

    try {
      const result = await callGroq(
        "You are GlucoPlate. Write short, helpful popup copy for a Kenyan diabetes meal planning app. No emojis. No markdown. Max 2 sentences. Currency KES. Encouraging, clear tone.",
        prompts[popupType],
        userId,
      );
      const lines = result.text.split("\n").filter(Boolean);
      const title = lines[0]?.slice(0, 50) || popupType.replace("_", " ");
      const body = lines.slice(1).join(" ") || lines[0] || result.text;
      setCache(key, `${title}\n${body}`);
      return { title, body, fallback: result.fallback, latencyMs: result.latencyMs };
    } catch (error) {
      logger.error("Groq popup failed", { userId, error: String(error) });
      const fallback = fallbackPopup(popupType, context);
      return { title: popupType.replace("_", " "), body: fallback, fallback: true, latencyMs: 0 };
    }
  },

  getRateLimitStatus(userId: number) {
    return getUserRateLimit(userId);
  },

  clearCache(): void {
    responseCache.clear();
  },
};

let startedAt = Date.now();