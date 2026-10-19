import React from "react";
import { clinicianBannerFor } from "@glucoplate/domain";

/**
 * The "consult your clinician" banner.
 *
 * Shown to users on the critical and high-risk diabetes ladders, and to any
 * account explicitly flagged for clinical review. Renders on both the web app
 * (Tailwind) and the Expo app (inline styles, because React Native does not
 * understand Tailwind class names).
 */
export function ClinicianBanner({
  message,
  className = "",
}: {
  message?: string | null;
  className?: string;
}) {
  const text = message ?? null;
  if (!text) return null;

  return (
    <div
      role="alert"
      className={`mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 ${className}`}
      style={{
        backgroundColor: "#fff1f2",
        borderColor: "#fecdd3",
        borderRadius: 12,
        padding: "12px 16px",
        marginBottom: 16,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <span aria-hidden style={{ fontSize: 18, lineHeight: 22 }}>
        ⚠️
      </span>
      <div style={{ flex: 1 }}>
        <strong style={{ display: "block", fontWeight: 700, color: "#9f1239" }}>
          Talk to your clinician first
        </strong>
        <span style={{ color: "#9f1239" }}>{text}</span>
      </div>
    </div>
  );
}

/**
 * Convenience wrapper: resolves the banner from the signed-in user.
 */
export function ClinicianBannerForUser({
  user,
  className = "",
}: {
  user: { diabetesLevel?: string | null; needsClinicianReview?: boolean | null };
  className?: string;
}) {
  return (
    <ClinicianBanner message={clinicianBannerFor(user)} className={className} />
  );
}
