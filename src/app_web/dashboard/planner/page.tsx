import { getCurrentUser } from "@/lib/auth";
import PlannerClient from "./PlannerClient";

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  const user = (await getCurrentUser())!;
  return (
    <PlannerClient
      defaultBudget={user.dailyBudget}
      defaultCarbTarget={user.dailyCarbTarget}
    />
  );
}
