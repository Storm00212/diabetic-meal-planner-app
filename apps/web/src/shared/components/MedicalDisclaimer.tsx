import React from "react";
import { PLANNING_AID_NOTICE } from "@glucoplate/domain";

/**
 * Standing reminder that GlucoPlate is a planning aid, not medical advice.
 * Shared by the web app and the Expo app.
 */
export const MedicalDisclaimer = ({ className = "" }: { className?: string }) => {
  return (
    <p
      className={`text-[10px] text-slate-400 italic ${className}`}
      style={{ color: "#94a3b8", fontSize: 10, fontStyle: "italic" }}
    >
      🩺 {PLANNING_AID_NOTICE}
    </p>
  );
};
