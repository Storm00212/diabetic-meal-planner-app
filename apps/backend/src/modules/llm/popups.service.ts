import { prisma } from "../../lib/prisma.js";
import { llmService } from "./llm.service.js";

export type PopupType = "milestone" | "daily_challenge" | "tip" | "recommendation";

export type PopupTrigger =
  | { type: "milestone"; key: string }
  | { type: "daily_challenge" }
  | { type: "tip" }
  | { type: "recommendation" };

export type Popup = {
  id: string;
  type: PopupType;
  title: string;
  body: string;
  fallback: boolean;
  dismissible: true;
  stoppable: true;
  createdAt: string;
};

const MIN_INTERVAL_MS = 10 * 60 * 1000;
const DAILY_CHALLENGE_HOUR = 9;

function popupStorageKey(userId: number): string {
  return `glucoplate:popups:${userId}`;
}

function lastShownKey(userId: number): string {
  return `glucoplate:last_popup:${userId}`;
}

function stoppedTypesKey(userId: number): string {
  return `glucoplate:stopped_popups:${userId}`;
}

function dailyChallengeDateKey(userId: number): string {
  return `glucoplate:daily_challenge:${userId}`;
}

async function getStoppedTypes(userId: number): Promise<Set<PopupType>> {
  const data = await prisma.user.findUnique({
    where: { id: userId },
    select: { dislikes: true },
  });
  const stopped = (data?.dislikes ?? "").split(",").filter(t => ["milestone", "daily_challenge", "tip", "recommendation"].includes(t));
  return new Set(stopped as PopupType[]);
}

async function setStoppedType(userId: number, type: PopupType, stopped: boolean): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { dislikes: true } });
  const current = new Set((user?.dislikes ?? "").split(",").filter(Boolean));
  if (stopped) current.add(type); else current.delete(type);
  await prisma.user.update({
    where: { id: userId },
    data: { dislikes: [...current].join(",") },
  });
}

async function getLastShown(userId: number): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { allergies: true } });
  const stored = (user?.allergies ?? "").match(/lastPopup:(\d+)/);
  return stored ? parseInt(stored[1], 10) : null;
}

async function setLastShown(userId: number, timestamp: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { allergies: true } });
  const current = (user?.allergies ?? "").replace(/lastPopup:\d+,?/g, "").replace(/^,|,$/g, "");
  const updated = current ? `${current},lastPopup:${timestamp}` : `lastPopup:${timestamp}`;
  await prisma.user.update({ where: { id: userId }, data: { allergies: updated } });
}

async function getDailyChallengeShown(userId: number): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { region: true } });
  const stored = (user?.region ?? "").match(/dailyChallenge:(\d{4}-\d{2}-\d{2})/);
  return stored ? stored[1] : null;
}

async function setDailyChallengeShown(userId: number, date: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { region: true } });
  const current = (user?.region ?? "").replace(/dailyChallenge:\d{4}-\d{2}-\d{2},?/g, "").replace(/^,|,$/g, "");
  const updated = current ? `${current},dailyChallenge:${date}` : `dailyChallenge:${date}`;
  await prisma.user.update({ where: { id: userId }, data: { region: updated } });
}

function buildMilestoneContext(userId: number, key: string): string {
  const messages: Record<string, string> = {
    first_plan: "User saved their first meal plan.",
    first_weight: "User logged their first weight entry.",
    streak_3_days: "User stayed within carb target for 3 consecutive days.",
    streak_7_days: "User stayed within carb target for 7 consecutive days.",
    budget_met: "User kept a daily plan within budget.",
    plan_streak_5: "User saved plans for 5 consecutive days.",
  };
  return messages[key] || `User achieved milestone: ${key}`;
}

export async function checkAndGeneratePopups(
  userId: number,
  trigger: PopupTrigger,
): Promise<Popup | null> {
  const stoppedTypes = await getStoppedTypes(userId);
  if (stoppedTypes.has(trigger.type)) return null;

  const lastShown = await getLastShown(userId);
  const now = Date.now();
  if (lastShown && now - lastShown < MIN_INTERVAL_MS) {
    return null;
  }

  if (trigger.type === "daily_challenge") {
    const today = new Date().toISOString().slice(0, 10);
    const lastChallenge = await getDailyChallengeShown(userId);
    if (lastChallenge === today) return null;
    const hour = new Date().getHours();
    if (hour < DAILY_CHALLENGE_HOUR) return null;
  }

  const context = trigger.type === "milestone" ? buildMilestoneContext(userId, trigger.key) : "";
  const result = await llmService.generatePopupCopy(userId, trigger.type, context);

  const popup: Popup = {
    id: `popup_${trigger.type}_${Date.now()}`,
    type: trigger.type,
    title: result.title,
    body: result.body,
    fallback: result.fallback,
    dismissible: true,
    stoppable: true,
    createdAt: new Date().toISOString(),
  };

  await setLastShown(userId, now);
  if (trigger.type === "daily_challenge") {
    await setDailyChallengeShown(userId, new Date().toISOString().slice(0, 10));
  }

  return popup;
}

export async function getStoppedPopupTypes(userId: number): Promise<PopupType[]> {
  const stopped = await getStoppedTypes(userId);
  return [...stopped];
}

export async function togglePopupType(userId: number, type: PopupType, stopped: boolean): Promise<void> {
  await setStoppedType(userId, type, stopped);
}

export async function generatePeriodicTip(userId: number): Promise<Popup | null> {
  return checkAndGeneratePopups(userId, { type: "tip" });
}

export async function generateRecommendationPopup(userId: number): Promise<Popup | null> {
  return checkAndGeneratePopups(userId, { type: "recommendation" });
}