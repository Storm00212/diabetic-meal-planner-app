import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * One ESLint configuration for every workspace in the monorepo.
 *
 * The rules are deliberately close to the defaults so that a file behaves the
 * same whether it is a service, the web client or the mobile client.
 */
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.expo/**",
      "**/.next/**",
      "**/generated/**",
      "**/.pgdata/**",
      "**/*.d.ts",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },

  // The Expo client uses React Native globals.
  {
    files: ["apps/mobile/**/*.{ts,tsx}"],
    rules: {
      "no-undef": "off",
    },
  },

  // Build tooling is CommonJS, not ES modules.
  {
    files: [
      "**/babel.config.js",
      "**/metro.config.js",
      "**/tailwind.config.js",
      "**/postcss.config.js",
    ],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        module: "writable",
        require: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
