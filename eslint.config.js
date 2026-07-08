import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
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
    // Not linted for accessibility in this pass:
    // - components/ui: vendored shadcn primitives (accessibility handled by Radix)
    // - admin surfaces: a later remediation pass per BACKLOG.md Feature #6
    ignores: [
      "client/src/components/ui/**",
      "client/src/pages/TenantAdmin.tsx",
      "client/src/pages/SystemAdmin.tsx",
      "client/src/pages/AIGroundingAdmin.tsx",
      "client/src/pages/Import.tsx",
      "client/src/pages/Trash.tsx",
      "client/src/pages/SearchAnalytics.tsx",
      "client/src/components/admin/**",
    ],
  },
  {
    files: ["client/src/**/*.{ts,tsx}"],
    // react-hooks is registered only so the codebase's existing
    // `eslint-disable react-hooks/*` directives resolve; its rules are left
    // off to keep this config strictly accessibility-focused.
    plugins: { "jsx-a11y": jsxA11y, "react-hooks": reactHooks },
    // Those react-hooks directives would otherwise report as "unused" since we
    // don't enable the rule; we don't manage disable directives here.
    linterOptions: { reportUnusedDisableDirectives: "off" },
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
