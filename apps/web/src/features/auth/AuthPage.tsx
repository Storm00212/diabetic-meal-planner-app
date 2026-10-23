import { AuthForm } from "./AuthForm";
import { Icons } from "@/shared/components/Icons";

/**
 * The sign-in screen: a brand panel on the left, the form on the right.
 */
export function AuthPage() {
  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Brand / hero side */}
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-teal-600 via-emerald-600 to-green-700 p-12 text-white">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-xl font-bold">
            <Icons.bucket_card className="text-3xl" /> GlucoPlate
          </div>
        </div>
        <div className="relative z-10 max-w-md space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Eat well. Stay stable. Spend smart.
          </h1>
          <p className="text-emerald-50/90 text-lg">
            Build a bucket of dishes you can afford, and let GlucoPlate allocate
            a diabetes-friendly meal plan for your morning, afternoon and evening
            — all within your daily budget and carb target.
          </p>
          <ul className="space-y-3 text-emerald-50/90">
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15">
                <Icons.budget size={20} strokeWidth={2} />
              </span>
              Plans that respect your budget
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15">
                <Icons.carbs size={20} strokeWidth={2} />
              </span>
              Low glycemic-index prioritisation
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15">
                <Icons.analytics size={20} strokeWidth={2} />
              </span>
              Track carbs, calories & cost
            </li>
          </ul>
        </div>
        <div className="relative z-10 text-sm text-emerald-50/70">
          A model app for diabetic meal planning.
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
      </section>

      {/* Form side */}
      <section className="flex items-center justify-center p-6 sm:p-12">
        <AuthForm />
      </section>
    </main>
  );
}
