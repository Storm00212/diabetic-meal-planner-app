import React from "react";
import { motion } from "framer-motion";

export const Logo = () => {
  return (
    <motion.div
      className="flex items-center gap-2 cursor-pointer"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-teal-600"
      >
        {/* Plate */}
        <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
        <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />

        {/* Leaf/Spark (Glucose health) */}
        <motion.path
          d="M16 8C16 8 18 12 16 14C14 12 16 8 16 8Z"
          fill="currentColor"
          animate={{
            fill: ["#0d9488", "#2dd4bf", "#0d9488"],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear"
          }}
        />

        {/* Utensils */}
        <path d="M8 12L10 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 12L22 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-xl font-bold tracking-tight text-slate-900">
        Gluco<span className="text-teal-600">Plate</span>
      </span>
    </motion.div>
  );
};
