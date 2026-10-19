import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { useAuth } from "@/app/AuthProvider";
import { ClinicianBanner } from "./ClinicianBanner";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "🏠" },
  { href: "/dashboard/dishes", label: "My Bucket", icon: "🧺" },
  { href: "/dashboard/planner", label: "Meal Planner", icon: "🍽️" },
  { href: "/dashboard/plans", label: "Saved Plans", icon: "📅" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "📊" },
  { href: "/dashboard/health-hub", label: "Health Hub", icon: "🏥" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
];

/**
 * The signed-in shell: a sidebar, a mobile top bar and the routed page.
 */
export function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, banner, signOut } = useAuth();
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
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2 font-bold text-teal-700">
          <Logo />
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-slate-300 p-2 text-slate-600"
          aria-label="Toggle menu"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`${
          open ? "block" : "hidden"
        } border-r border-slate-200 bg-white lg:block`}
      >
        <div className="sticky top-0 flex h-full flex-col p-4 lg:h-screen">
          <div className="hidden items-center gap-2 px-2 py-3 text-xl font-bold text-teal-700 lg:flex">
            <Logo />
          </div>

          <nav className="mt-4 flex-1 space-y-1">
            {NAV.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-teal-50 text-teal-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-600 text-sm font-semibold text-white">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {user?.name}
                </p>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        {banner ? <ClinicianBanner message={banner} /> : null}
        <Outlet />
      </main>
    </div>
  );
}
