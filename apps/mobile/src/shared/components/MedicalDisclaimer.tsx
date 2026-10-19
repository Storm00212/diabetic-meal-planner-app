import React from "react";
import { Text, View } from "react-native";
import { PLANNING_AID_NOTICE } from "@glucoplate/domain";

/**
 * Standing reminder that GlucoPlate is a planning aid, not medical advice.
 * Shared by every mobile screen.
 */
export const MedicalDisclaimer = ({ className = "" }: { className?: string }) => {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ color: "#94a3b8", fontSize: 10, fontStyle: "italic" }}>
        🩺 {PLANNING_AID_NOTICE}
      </Text>
    </View>
  );
};
