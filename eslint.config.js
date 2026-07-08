import jsxA11y from "eslint-plugin-jsx-a11y";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

// Accessibility-focused ESLint config.
//
// This project historically had no ESLint setup. Rather than turn on the full
// TypeScript/React rule sets (which would flood the tree with unrelated
// findings), this config is intentionally scoped to jsx-a11y so it acts purely
// as an accessibility guardrail for the client. It backs the Section 508 /
// WCAG 2.1 AA remediation tracked in BACKLOG.md (Feature #6).
export default [
  {
    files: ["client/src/**/*.{ts,tsx}"],
    plugins: { "jsx-a11y": jsxA11y },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: { ...globals.browser },
    },
    settings: {
      // Teach jsx-a11y about our wrapper components so element-based rules
      // (label association, control types) apply to the shadcn primitives too.
      "jsx-a11y": {
        components: {
          Button: "button",
          IconButton: "button",
          Input: "input",
          Textarea: "textarea",
          Label: "label",
          Image: "img",
        },
      },
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // The label/control association in this codebase frequently uses Radix
      // triggers whose id binding jsx-a11y cannot statically follow; keep it on
      // as a warning so it surfaces without blocking unrelated work.
      "jsx-a11y/label-has-associated-control": "warn",
    },
  },
];
