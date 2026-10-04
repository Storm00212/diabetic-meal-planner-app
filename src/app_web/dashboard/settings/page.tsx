import { getCurrentUser } from "@/lib/auth";
import ProfileForm from "./components/ProfileForm";
import BudgetSetup from "./components/BudgetSetup";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = (await getCurrentUser())!;
  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold">Account Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProfileForm />
        <BudgetSetup />
      </div>
    </div>
  );
}
