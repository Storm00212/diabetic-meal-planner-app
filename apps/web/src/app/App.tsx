import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./AuthProvider";
import { DashboardLayout } from "../shared/components/DashboardLayout";
import { AuthPage } from "../features/auth/AuthPage";
import { OverviewPage } from "../features/overview/OverviewPage";
import { DishesPage } from "../features/catalog/DishesPage";
import { PlannerPage } from "../features/planner/PlannerPage";
import { PlansPage } from "../features/plans/PlansPage";
import { AnalyticsPage } from "../features/analytics/AnalyticsPage";
import { HealthHubPage } from "../features/health/HealthHubPage";
import { SettingsPage } from "../features/settings/SettingsPage";

/** Sends an unauthenticated visitor to the login screen. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600" />
          <p className="mt-4 text-sm text-slate-500">Loading GlucoPlate…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

/** Sends a signed-in visitor away from the login screen. */
function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectIfSignedIn>
              <AuthPage />
            </RedirectIfSignedIn>
          }
        />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="dishes" element={<DishesPage />} />
          <Route path="planner" element={<PlannerPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="health-hub" element={<HealthHubPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
