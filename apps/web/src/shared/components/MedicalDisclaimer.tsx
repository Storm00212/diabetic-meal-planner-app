import React from "react";
import { PLANNING_AID_NOTICE } from "@glucoplate/domain";
import { Icons } from "./Icons";

/**
 * Standing reminder that GlucoPlate is a planning aid, not medical advice.
 * Shared by the web app and the Expo app.
 */
export const MedicalDisclaimer = ({ className = "" }: { className?: string }) => {
  return (
    <p
      className={`text-[10px] text-slate-400 italic dark:text-slate-500 ${className}`}
      style={{ color: "#94a3b8", fontSize: 10, fontStyle: "italic" }}
    >
      <Icons.stethoscope className="inline mr-1" size={10} strokeWidth={1.5} />{" "}
      {PLANNING_AID_NOTICE}
    </p>
  );
};
