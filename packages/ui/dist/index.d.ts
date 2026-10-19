/**
 * @glucoplate/ui
 *
 * Platform-neutral design tokens.
 *
 * The web app maps these into its Tailwind theme; the mobile app maps them
 * into its React Native theme. One source of truth for colour, spacing and
 * typography means the two clients cannot drift apart.
 */
export declare const palette: {
    readonly brand: {
        readonly 50: "#f0fdfa";
        readonly 100: "#ccfbf1";
        readonly 200: "#99f6e4";
        readonly 300: "#5eead4";
        readonly 400: "#2dd4bf";
        readonly 500: "#14b8a6";
        readonly 600: "#0d9488";
        readonly 700: "#0f766e";
        readonly 800: "#115e59";
        readonly 900: "#134e4a";
    };
    readonly emerald: {
        readonly 100: "#d1fae5";
        readonly 500: "#10b981";
        readonly 600: "#059669";
        readonly 700: "#047857";
    };
    readonly rose: {
        readonly 100: "#ffe4e6";
        readonly 500: "#f43f5e";
        readonly 600: "#e11d48";
        readonly 700: "#be123c";
        readonly 800: "#9f1239";
    };
    readonly amber: {
        readonly 100: "#fef3c7";
        readonly 700: "#b45309";
    };
    readonly slate: {
        readonly 50: "#f8fafc";
        readonly 100: "#f1f5f9";
        readonly 200: "#e2e8f0";
        readonly 300: "#cbd5e1";
        readonly 400: "#94a3b8";
        readonly 500: "#64748b";
        readonly 600: "#475569";
        readonly 700: "#334155";
        readonly 800: "#1e293b";
        readonly 900: "#0f172a";
    };
    readonly white: "#ffffff";
};
export declare const spacing: {
    readonly xs: 4;
    readonly sm: 8;
    readonly md: 12;
    readonly lg: 16;
    readonly xl: 24;
    readonly "2xl": 32;
    readonly "3xl": 48;
};
export declare const radii: {
    readonly sm: 6;
    readonly md: 8;
    readonly lg: 12;
    readonly xl: 16;
    readonly pill: 999;
};
/** The Tailwind theme extension the web app applies. */
export declare const tailwindTheme: {
    readonly colors: {
        readonly brand: {
            readonly 50: "#f0fdfa";
            readonly 100: "#ccfbf1";
            readonly 200: "#99f6e4";
            readonly 300: "#5eead4";
            readonly 400: "#2dd4bf";
            readonly 500: "#14b8a6";
            readonly 600: "#0d9488";
            readonly 700: "#0f766e";
            readonly 800: "#115e59";
            readonly 900: "#134e4a";
        };
    };
    readonly borderRadius: {
        readonly md: "8px";
        readonly lg: "12px";
        readonly xl: "16px";
    };
};
/** The React Native theme object the mobile app applies. */
export declare const nativeTheme: {
    readonly colors: {
        readonly brand: "#0d9488";
        readonly brandLight: "#ccfbf1";
        readonly brandDark: "#115e59";
        readonly success: "#059669";
        readonly successLight: "#d1fae5";
        readonly danger: "#e11d48";
        readonly dangerLight: "#ffe4e6";
        readonly warning: "#b45309";
        readonly warningLight: "#fef3c7";
        readonly text: "#0f172a";
        readonly textMuted: "#64748b";
        readonly border: "#e2e8f0";
        readonly surface: "#ffffff";
        readonly background: "#f8fafc";
    };
    readonly spacing: {
        readonly xs: 4;
        readonly sm: 8;
        readonly md: 12;
        readonly lg: 16;
        readonly xl: 24;
        readonly "2xl": 32;
        readonly "3xl": 48;
    };
    readonly radius: {
        readonly sm: 6;
        readonly md: 8;
        readonly lg: 12;
        readonly xl: 16;
        readonly pill: 999;
    };
};
/**
 * The badge styles for a glycemic index band, in a form both platforms can
 * render (a background colour and a text colour).
 */
export declare const giBandStyles: {
    readonly low: {
        readonly background: "#d1fae5";
        readonly text: "#047857";
        readonly label: "Low GI";
    };
    readonly medium: {
        readonly background: "#fef3c7";
        readonly text: "#b45309";
        readonly label: "Medium GI";
    };
    readonly high: {
        readonly background: "#ffe4e6";
        readonly text: "#be123c";
        readonly label: "High GI";
    };
};
export type GiBandKey = keyof typeof giBandStyles;
export declare function giBandKey(gi: number): GiBandKey;
//# sourceMappingURL=index.d.ts.map