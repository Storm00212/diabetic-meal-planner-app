import { prisma } from "../../lib/prisma.js";
import { PLANNING_AID_NOTICE, clinicianBannerFor } from "@glucoplate/domain";
import { llmService } from "./llm.service.js";
import type { PublicUser } from "@glucoplate/types";

type WeightTrend = "losing" | "gaining" | "stable" | "unknown";
type CarbTrend = "under" | "over" | "at_limit" | "unknown";

function computeWeightTrend(logs: { weight: number; date: string }[]): WeightTrend {
  if (logs.length < 2) return "unknown";
  const sorted = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const first = sorted[0].weight;
  const last = sorted[sorted.length - 1].weight;
  const diff = last - first;
  if (diff <= -0.5) return "losing";
  if (diff >= 0.5) return "gaining";
  return "stable";
}

function computeCarbTrend(plans: { totalCarbs: number }[], carbTarget: number): CarbTrend {
  if (plans.length === 0) return "unknown";
  const recent = plans.slice(-7);
  const avgCarbs = recent.reduce((sum, p) => sum + p.totalCarbs, 0) / recent.length;
  const ratio = avgCarbs / carbTarget;
  if (ratio < 0.8) return "under";
  if (ratio > 1.0) return "over";
  return "at_limit";
}

function computeStreak(plans: { totalCarbs: number; planDate: string }[], carbTarget: number): number {
  if (plans.length === 0) return 0;
  const sorted = [...plans].sort((a, b) => new Date(b.planDate).getTime() - new Date(a.planDate).getTime());
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const plan of sorted) {
    if (plan.planDate === today || new Date(plan.planDate).getTime() === new Date(today).getTime() - streak * 86400000) {
      if (plan.totalCarbs <= carbTarget) {
        streak += 1;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return streak;
}

function computeBudgetStreak(plans: { totalCost: number; budget: number; planDate: string }[]): number {
  if (plans.length === 0) return 0;
  const sorted = [...plans].sort((a, b) => new Date(b.planDate).getTime() - new Date(a.planDate).getTime());
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const plan of sorted) {
    if (plan.planDate === today || new Date(plan.planDate).getTime() === new Date(today).getTime() - streak * 86400000) {
      if (plan.totalCost <= plan.budget) {
        streak += 1;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return streak;
}

export async function buildRecommendationFacts(userId: number): Promise<string> {
  const [user, weightLogs, plans] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.weightLog.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.mealPlan.findMany({ where: { userId }, orderBy: { planDate: "desc" }, take: 30 }),
  ]);

  if (!user) throw new Error("User not found");

  const weightTrend = computeWeightTrend(weightLogs.map(l => ({ weight: l.weight, date: l.date.toISOString().slice(0, 10) })));
  const carbTrend = computeCarbTrend(plans, user.dailyCarbTarget);
  const carbStreak = computeStreak(plans.map(p => ({ totalCarbs: p.totalCarbs, planDate: p.planDate.toISOString().slice(0, 10) })), user.dailyCarbTarget);
  const budgetStreak = computeBudgetStreak(plans.map(p => ({ totalCost: p.totalCost, budget: p.budget, planDate: p.planDate.toISOString().slice(0, 10) })));
  const planCount = plans.length;
  const recentPlan = plans[0];

  const lines: string[] = [];

  lines.push(`User: ${user.name}, ${user.setting}, ${user.diabetesLevel}`);
  lines.push(`Daily limits: ${user.dailyCarbTarget}g carbs, GI ≤ ${user.dailyGiLimit}, ${user.dailyCalorieLimit} kcal, KSh ${user.dailyBudget}/day`);
  lines.push(`Weight trend: ${weightTrend} (${weightLogs.length} logs)`);
  if (weightLogs.length > 0) {
    const latest = weightLogs[weightLogs.length - 1];
    lines.push(`Current weight: ${latest.weight} kg (target: ${user.targetWeight ?? "not set"} kg)`);
  }
  lines.push(`Carb trend (7 days): ${carbTrend}`);
  lines.push(`Carb streak: ${carbStreak} day(s) within target`);
  lines.push(`Budget streak: ${budgetStreak} day(s) within budget`);
  lines.push(`Total plans saved: ${planCount}`);

  if (recentPlan) {
    const overBudget = recentPlan.totalCost > recentPlan.budget;
    const overCarbs = recentPlan.totalCarbs > user.dailyCarbTarget;
    lines.push(`Latest plan: KSh ${recentPlan.totalCost.toFixed(2)}/${recentPlan.budget.toFixed(2)}, ${recentPlan.totalCarbs}g carbs, ${recentPlan.averageGi} avg GI`);
    if (overBudget) lines.push(`Note: Latest plan exceeds budget by KSh ${(recentPlan.totalCost - recentPlan.budget).toFixed(2)}`);
    if (overCarbs) lines.push(`Note: Latest plan exceeds carb target by ${recentPlan.totalCarbs - user.dailyCarbTarget}g`);
  }

  if (user.needsClinicianReview) {
    lines.push("SAFETY: User is in critical/high-risk category. Must include clinician notice.");
  }

  return lines.join("\n");
}

export async function generatePersonalisedRecommendation(userId: number): Promise<{
  text: string;
  fallback: boolean;
  facts: string;
  latencyMs: number;
}> {
  const facts = await buildRecommendationFacts(userId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const result = await llmService.generateRecommendation(userId, facts);

  await prisma.llmUsageLog.create({
    data: {
      userId,
      model: "llama-3.1-8b-instant",
      prompt: facts,
      response: result.text,
      fallback: result.fallback,
      latencyMs: result.latencyMs,
    },
  });

  return { ...result, facts };
}

function fallbackRecommendation(facts: string): string {
  const lines = facts.split("\n").filter(Boolean);
  if (lines.length === 0) return "No specific recommendation at this time.";
  return `Based on your data: ${lines.slice(0, 3).join("; ")}.`;
}