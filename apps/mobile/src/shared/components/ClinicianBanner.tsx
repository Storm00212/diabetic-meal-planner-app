import React from "react";
import { Text, View } from "react-native";
import { clinicianBannerFor } from "@glucoplate/domain";

/**
 * The "consult your clinician" banner.
 *
 * Shown to users on the critical and high-risk diabetes ladders.
 */
export function ClinicianBanner({
  message,
}: {
  message?: string | null;
  className?: string;
}) {
  const text = message ?? null;
  if (!text) return null;

  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: "#fff1f2",
        borderColor: "#fecdd3",
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 18, lineHeight: 22 }}>⚠️</Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontWeight: "700", color: "#9f1239", marginBottom: 2 }}
        >
          Talk to your clinician first
        </Text>
        <Text style={{ color: "#9f1239", fontSize: 13, lineHeight: 18 }}>
          {text}
        </Text>
      </View>
    </View>
  );
}

export function ClinicianBannerForUser({
  user,
}: {
  user: { diabetesLevel?: string | null; needsClinicianReview?: boolean | null };
  className?: string;
}) {
  return <ClinicianBanner message={clinicianBannerFor(user)} />;
}
