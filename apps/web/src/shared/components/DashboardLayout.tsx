import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { useAuth } from "@/app/AuthProvider";
import { ClinicianBanner } from "./ClinicianBanner";
import { Icons, iconLabel } from "./Icons";
import { useTheme } from "./ThemeProvider";

const NAV: { href: string; label: string; iconKey: keyof typeof Icons }[] = [
  { href: "/dashboard", label: "Overview", iconKey: "bucket_card" },
  { href: "/dashboard/dishes", label: "My Bucket", iconKey: "bucket" },
  { href: "/dashboard/planner", label: "Meal Planner", iconKey: "planner" },
  { href: "/dashboard/plans", label: "Saved Plans", iconKey: "plans" },
  { href: "/dashboard/analytics", label: "Analytics", iconKey: "analytics" },
  { href: "/dashboard/health-hub", label: "Health Hub", iconKey: "health" },
  { href: "/dashboard/settings", label: "Settings", iconKey: "settings" },
];

/**
 * The signed-in shell: a sidebar, a mobile top bar and the routed page.
 */
export function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, banner, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);

  async function logout() {
    await signOut();
    navigate("/login");
  }

  const initials = (user?.name ?? "")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const pathname = location.pathname;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr] bg-slate-50 dark:bg-slate-900">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 lg:hidden min-h-[56px]">
        <div className="flex items-center gap-2 font-bold text-teal-700 dark:text-teal-400">
          <Logo />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 p-2.5 text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {theme === "light" ? (
              <Icons.themeDark size={20} strokeWidth={2} />
            ) : (
              <Icons.themeLight size={20} strokeWidth={2} />
            )}
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 p-2.5 text-slate-600 dark:text-slate-300 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Toggle menu"
          >
            <Icons.menu size={20} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`${
          open ? "block" : "hidden"
        } border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 lg:block`}
      >
        <div className="sticky top-0 flex h-full flex-col p-4 lg:h-screen">
          <div className="hidden items-center gap-2 px-2 py-3 text-xl font-bold text-teal-700 dark:text-teal-400 lg:flex">
            <Logo />
          </div>

          <nav className="mt-4 flex-1 space-y-1">
            {NAV.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              const NavIcon = Icons[item.iconKey];
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  aria-label={iconLabel(item.iconKey)}
                >
                  <span className="text-lg" aria-hidden="true">
                    <NavIcon size={20} strokeWidth={2} />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 p-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-600 text-sm font-semibold text-white">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {user?.name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="mt-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-600"
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 lg:p-8">
        {banner ? <ClinicianBanner message={banner} /> : null}
        <Outlet />
      </main>
    </div>
  );
}
