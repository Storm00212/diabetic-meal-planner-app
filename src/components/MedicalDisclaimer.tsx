import React from "react";

export const MedicalDisclaimer = ({ className = "" }: { className?: string }) => {
  return (
    <p className={`text-[10px] text-slate-400 italic ${className}`}>
      🩺 Disclaimer: This app is a planning aid, not medical advice. Please consult your doctor or dietitian before making dietary changes.
    </p>
  );
};
