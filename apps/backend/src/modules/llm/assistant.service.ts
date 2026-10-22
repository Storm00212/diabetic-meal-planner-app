import { prisma } from "../../lib/prisma.js";
import { llmService } from "./llm.service.js";
import type { PublicUser } from "@glucoplate/types";

const APP_GUIDE = `
GlucoPlate App Guide:
- Today's Plate (Planner): Generate a daily meal plan with morning, afternoon, evening slots. Set budget and carb target. Swap dishes for cheaper/lower-GI options. Save plan.
- Dishes: Manage your personal bucket of dishes. Add/edit/delete dishes. View shared Kenyan catalogue (95+ dishes). Filter by meal time, search by name.
- Plans: View saved daily plans. See budget/carb progress bars. Mark meals as eaten/skipped. Delete plans.
- Progress (Health Hub): Log weight, see current vs target. Weight trend estimate. Ask GlucoPlate assistant.
- Settings: Update name, daily budget, carb target. Portion profile (age, height, weight, sex, activity) for personalised calorie/macro targets. Premium upgrade via M-Pesa (KSh 20, sandbox).
- Safety: Planning aid notice always shown. Critical/high-risk users see clinician banner. No medical advice.
- Currency: KES (KSh).
- Demo mode: One-click login for 5 personas (student/healthy, child/prediabetes, working-class/type2-controlled, elderly/type2-high-risk, rural-farmer/critical).
`;

export async function answerQuestion(
  userId: number,
  question: string,
): Promise<{ answer: string; disclaimer: string; fallback: boolean; latencyMs: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const profile = {
    diabetesLevel: user.diabetesLevel,
    setting: user.setting,
    needsClinicianReview: user.needsClinicianReview,
  };

  const result = await llmService.answerQuestion(userId, question, profile);

  await prisma.llmUsageLog.create({
    data: {
      userId,
      model: "llama-3.1-8b-instant",
      prompt: question,
      response: result.text,
      fallback: result.fallback,
      latencyMs: result.latencyMs,
    },
  });

  return { answer: result.text, disclaimer: result.disclaimer, fallback: result.fallback, latencyMs: result.latencyMs };
}