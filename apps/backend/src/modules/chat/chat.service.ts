import { PLANNING_AID_NOTICE } from "@glucoplate/domain";
import type { ChatResponse } from "@glucoplate/types";

/**
 * The chat pilot.
 *
 * This is a simulated pilot: a small phrase-matching knowledge base, not a
 * medical system. A real implementation would call a verified medical
 * retrieval system. The safety copy is the same everywhere in the app.
 */

/** Every chat answer carries this disclaimer. */
export const CHAT_DISCLAIMER =
  "Disclaimer: I am an AI, not a doctor. Please consult your healthcare provider before making dietary changes.";

/** The answer given when nothing in the knowledge base matches. */
export const NO_MATCH_ANSWER =
  "I couldn't find a specific medical citation for that. Please rephrase or consult your doctor.";

/**
 * The pilot's knowledge base.
 *
 * The order matters: the first entry whose key appears in the question wins,
 * so the more specific phrase ("glycemic index") is checked before "carbs".
 */
const MEDICAL_KNOWLEDGE: { key: string; answer: string }[] = [
  {
    key: "glycemic index",
    answer:
      "The Glycemic Index (GI) is a rating system for foods containing carbohydrates. It shows how quickly each food affects your blood glucose level. Low GI foods (55 or less) are generally preferred for diabetics.",
  },
  {
    key: "carbs",
    answer:
      "Carbohydrates are broken down into glucose, which raises blood sugar. Managing total carb intake is key to avoiding hyperglycemic spikes.",
  },
  {
    key: "weight loss",
    answer:
      "For diabetics, gradual weight loss is often recommended to improve insulin sensitivity. Consult your doctor for a safe target calorie deficit.",
  },
];

export const chatService = {
  /** Answers one question from the knowledge base. */
  answer(query: unknown): ChatResponse {
    const text = String(query ?? "").trim().toLowerCase();

    const match = MEDICAL_KNOWLEDGE.find((entry) => text.includes(entry.key));

    const answer = match
      ? `${match.answer}\n\nSource: Verified Medical Guidelines (Simulated)`
      : NO_MATCH_ANSWER;

    return {
      answer,
      disclaimer: CHAT_DISCLAIMER,
      notice: PLANNING_AID_NOTICE,
    };
  },
};
