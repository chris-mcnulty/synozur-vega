# Accessibility Conformance Report — Vega Company OS

### Voluntary Product Accessibility Template® (VPAT®)

**Version 2.5 — Revised Section 508 Edition**

> ⚠️ **DRAFT — POST-REMEDIATION, PENDING MANUAL AT VERIFICATION.** Code remediation Phases 0–3 from `BACKLOG.md` (High Priority Feature #6) are complete: guardrails/tooling, systemic keyboard/label sweeps, focus management, live regions, page titles, chart text alternatives, and measured contrast. Ratings below reflect the current code plus automated testing (axe-core, eslint-plugin-jsx-a11y, keyboard checks). **Formal assistive-technology passes (NVDA, JAWS, VoiceOver) by a human tester remain outstanding** — criteria whose confirmation depends on AT are marked accordingly. Do not distribute externally until those manual passes are complete and this notice is removed.

---

## Product / Report Information

| Field | Value |
|-------|-------|
| **Name of Product / Version** | Vega — AI-Augmented Company OS Platform (web application) |
| **Report Date** | July 23, 2026 |
| **Product Description** | Responsive web application for aligning organizational strategy with execution: Foundations, Strategy, Planning/OKRs, Focus Rhythm meetings, and Reporting, with AI assistance. |
| **Contact Information** | accessibility contact — *to be supplied* |
| **Notes** | This report is scoped to the **authenticated core application** (Dashboards, Foundations, Strategy, Planning/OKRs, Focus Rhythm, Reporting, Settings) and the **public/marketing pages** (Landing, Pricing, Login, verify/forgot/reset password). Administrative surfaces (Tenant Admin, System Admin, AI Grounding, Import, Trash) and the embeddable public cards (`/embed/v1`) are **out of scope for this edition** and will be covered in a later revision. |
| **Evaluation Methods Used** | Static source review of the React/TypeScript client (`client/src`, 186 components); design-token review (`tailwind.config.ts`, `index.css`); `eslint-plugin-jsx-a11y` (CI gate); and automated **axe-core** scans of the public routes via Playwright (built client). Manual assistive-technology testing (NVDA, JAWS, VoiceOver) has **not** yet been performed and is required to confirm AT-dependent criteria; those are noted in the Remarks. |

## Applicable Standards / Guidelines

| Standard / Guideline | Included In Report |
|----------------------|--------------------|
| Web Content Accessibility Guidelines 2.1 | Level A (Yes), Level AA (Yes), Level AAA (No) |
| Revised Section 508 standards — 36 CFR 1194 Appendix A (2017) | Yes |

**Target conformance for this product:** WCAG 2.1 Level AA. Revised Section 508 incorporates WCAG 2.0 Level A and AA by reference; targeting WCAG 2.1 AA satisfies and exceeds that bar.

## Terms

The terms used in the Conformance Level column are defined as follows:

- **Supports** — The functionality of the product has at least one method that meets the criterion without known defects, or meets it with equivalent facilitation.
- **Partially Supports** — Some functionality of the product does not meet the criterion.
- **Does Not Support** — The majority of product functionality does not meet the criterion.
- **Not Applicable** — The criterion is not relevant to the product.
- **Not Evaluated** — The product has not been evaluated against the criterion. (Used here only where verification requires measurement/AT testing not yet performed.)

---

## WCAG 2.1 Report

Where a criterion is only partially supported or not supported, the Remarks column cites the specific finding. Finding IDs (S1–S5) refer to the systemic issues catalogued in `BACKLOG.md` Feature #6.

### Table 1: Success Criteria, Level A

| Criterion | Conformance Level | Remarks and Explanations |
|-----------|-------------------|--------------------------|
| **1.1.1 Non-text Content** | Supports | `<img>` elements carry meaningful `alt` text; ~130 in-scope icon-only buttons were given `aria-label`s; Recharts charts now use `accessibilityLayer` with `role="img"`/`aria-label`. (Some purely decorative icons adjacent to text labels are not individually `aria-hidden` — cosmetic, not a barrier.) |
| **1.2.1 Audio-only and Video-only (Prerecorded)** | Not Applicable | No prerecorded audio-only or video-only content in scope. |
| **1.2.2 Captions (Prerecorded)** | Not Applicable | No prerecorded multimedia with audio in scope. |
| **1.2.3 Audio Description or Media Alternative (Prerecorded)** | Not Applicable | No prerecorded synchronized media in scope. |
| **1.3.1 Info and Relationships** | Supports | Real semantic headings (h1–h6) and landmark regions are used throughout; the ~90 in-scope `SelectTrigger`s now carry accessible names; color-only required `*` replaced with an `aria-hidden` marker + sr-only "(required)". (Per-field programmatic association of validation errors is a tracked follow-up — see 3.3.1.) |
| **1.3.2 Meaningful Sequence** | Supports | DOM order follows visual reading order; no CSS-driven reorder defects observed. |
| **1.3.3 Sensory Characteristics** | Supports | Instructions generally use text labels rather than shape/position alone. |
| **1.4.1 Use of Color** | Partially Supports | Required-field `*` now has an sr-only "(required)" text equivalent; over-target meeting timers carry text ("Over by…") and a minus sign, not color alone. **Documented exception:** some inline links on the marketing pages are distinguished from body text by color only (axe `link-in-text-block`); retained with the Aurora palette per brand decision (see 1.4.3). |
| **1.4.2 Audio Control** | Not Applicable | No automatically playing audio. |
| **2.1.1 Keyboard** | Supports | All in-scope clickable `<div>`/`<span>` elements (including the core OKR/KR name spans that open detail panes) were made operable with `role="button"`/`tabIndex`/Enter-Space handling; the `MeetingLive` key handler no longer intercepts keys when a control has focus. (Manual keyboard walkthrough recommended to confirm end-to-end tab order.) |
| **2.1.2 No Keyboard Trap** | Supports | No keyboard traps identified. |
| **2.1.4 Character Key Shortcuts** | Partially Supports | The `MeetingLive` single-character shortcuts (`p`/`d`/`r`/`a`) no longer fire when a form field or any interactive control (button/link/menuitem/contenteditable) has focus, so they no longer intercept keys destined for focused controls. A user-facing turn-off/remap mechanism is not yet provided. |
| **2.2.1 Timing Adjustable** | Partially Supports | Live meeting timers can be paused by the user. Session-timeout behavior and any warning/extension mechanism have not been verified. |
| **2.2.2 Pause, Stop, Hide** | Supports | A global `@media (prefers-reduced-motion: reduce)` reset in `index.css` neutralizes the continuous Aurora animations (blob, nebula-shimmer, infinite border-spin) and Tailwind `animate-*` utilities for users who request reduced motion. |
| **2.3.1 Three Flashes or Below Threshold** | Supports | No flashing content above threshold. |
| **2.4.1 Bypass Blocks** | Supports | A visually-hidden "Skip to main content" link is the first focusable element in the app shell and targets `<main id="main-content">`; landmark regions (`header`, `nav`, `main`) are also present. |
| **2.4.2 Page Titled** | Supports | Every in-scope route sets a descriptive per-route `<title>` (e.g. "Dashboard | Vega") via `react-helmet-async`. |
| **2.4.3 Focus Order** | Supports | Radix dialogs/sheets manage focus. The custom AI Chat and Help panels now use a shared `useDialogPanel` hook that moves focus into the panel on open, closes on Escape, and restores focus to the trigger on close (`role="dialog"`). (Manual AT pass recommended to confirm announcement order.) |
| **2.4.4 Link Purpose (In Context)** | Supports | Text links are descriptive and icon-only controls now expose their purpose via `aria-label`. |
| **2.5.1 Pointer Gestures** | Supports | No path-based or multipoint gestures required. |
| **2.5.2 Pointer Cancellation** | Supports | Activation occurs on up-event via standard controls. |
| **2.5.3 Label in Name** | Supports | Controls with visible text keep a matching accessible name; icon-only controls now have descriptive `aria-label`s consistent with their purpose. |
| **2.5.4 Motion Actuation** | Not Applicable | No device-motion-actuated functionality. |
| **3.1.1 Language of Page** | Supports | `lang="en"` is set on the root `<html>` (`client/index.html`). |
| **3.2.1 On Focus** | Supports | No context change occurs on focus. |
| **3.2.2 On Input** | Supports | No unexpected context change on input. |
| **3.3.1 Error Identification** | Partially Supports | Validation errors are announced via Radix toast (`role="status"`), so they reach assistive tech. However, in most useState-based forms the error is not yet programmatically tied to the offending field (`aria-invalid`/`aria-describedby`). Migrating these ~38 forms to the accessible `Form`/`FormControl` primitive is a tracked follow-up (BACKLOG Feature #6, Phase 2 deferral). |
| **3.3.2 Labels or Instructions** | Supports | Select triggers now carry accessible names, placeholder-only search inputs were given `aria-label`s, and required state has a text equivalent ("(required)"). |
| **4.1.1 Parsing** | Supports | Markup is generated by React; no duplicate-id or malformed-nesting defects observed. |
| **4.1.2 Name, Role, Value** | Supports | Radix primitives expose correct name/role/value; the systemic gaps are remediated in-scope: icon buttons and Select triggers have accessible names, clickable non-interactive elements have `role="button"` + keyboard support, and the incorrect `role="combobox"` on the Tenant/User pickers was corrected to disclosure buttons with `aria-expanded`. (AT spot-check recommended.) |

### Table 2: Success Criteria, Level AA

| Criterion | Conformance Level | Remarks and Explanations |
|-----------|-------------------|--------------------------|
| **1.2.4 Captions (Live)** | Not Applicable | No live multimedia. |
| **1.2.5 Audio Description (Prerecorded)** | Not Applicable | No prerecorded synchronized media. |
| **1.3.4 Orientation** | Supports | Responsive layout; no orientation lock. |
| **1.3.5 Identify Input Purpose** | Partially Supports | `autocomplete` attributes are not consistently set on inputs that collect user information (e.g., name, email). Not yet verified across all in-scope forms. |
| **1.4.3 Contrast (Minimum)** | Partially Supports | Measured with axe-core (dark theme). Most body text passes; a Pricing fine-print `/60`-opacity item (3.76) was fixed. **Documented exceptions (accepted brand decision):** white text on the primary-purple CTA button measures **4.33:1** (needs 4.5) on nav/pricing/login CTAs, and purple text links on the dark background measure **3.8–3.87:1**. Per the product's Aurora brand standard (`replit.md`), the palette is retained as-is; these specific, enumerated instances are recorded as known exceptions rather than remediated. |
| **1.4.4 Resize Text** | Supports | The `maximum-scale=1` viewport restriction was removed; the page supports pinch-zoom and browser text zoom to 200%. |
| **1.4.5 Images of Text** | Supports | Text is rendered as live text with web fonts, not images. |
| **1.4.10 Reflow** | Partially Supports | Layout is responsive and mobile-adapted, and the `maximum-scale=1` restriction was removed. Behavior at 400% zoom / 320 CSS px has not yet been manually verified across all in-scope pages. |
| **1.4.11 Non-text Contrast** | Partially Supports | The header-search control now has a visible focus ring (`focus-visible:ring`), and focus rings were added to newly-interactive elements. A full measured audit of all UI-component/graphical-object contrast (borders, icons, chart strokes) is not yet complete. |
| **1.4.12 Text Spacing** | Not Evaluated | Behavior under user text-spacing overrides not yet tested. |
| **1.4.13 Content on Hover or Focus** | Partially Supports | Radix tooltips are dismissable and hoverable; native `title` tooltips used on some icon controls are not dismissable/persistent per the criterion. |
| **2.4.5 Multiple Ways** | Supports | Global search, persistent sidebar navigation, and contextual breadcrumbs provide multiple ways to locate content. |
| **2.4.6 Headings and Labels** | Supports | Headings are descriptive and well-structured, and form controls (including Select triggers) now have accessible labels. |
| **2.4.7 Focus Visible** | Supports | Radix components provide focus-visible rings; the header-search trigger's missing ring was fixed, and newly-interactive elements (clickable rows, OKR name spans, skip link) were given `focus-visible:ring` indicators. |
| **3.1.2 Language of Parts** | Not Applicable | Content is English-only; no mixed-language passages. |
| **3.2.3 Consistent Navigation** | Supports | Navigation is consistent across routes via the shared app shell. |
| **3.2.4 Consistent Identification** | Supports | Repeated icon-only controls were given consistent, action-descriptive `aria-label`s during the label sweep. |
| **3.3.3 Error Suggestion** | Partially Supports | Suggestions exist in some flows but, like error identification, are typically toast-only and not associated with the field (S3). |
| **3.3.4 Error Prevention (Legal, Financial, Data)** | Supports | Destructive actions use confirmation dialogs (Radix AlertDialog); soft-delete + 30-day trash provides reversal. |
| **4.1.3 Status Messages** | Partially Supports | Toasts announce via Radix `role="status"`; the notification unread count is now in the bell's accessible name, check-in autosave announces "Draft saved" politely, and MeetingLive announces over-time/paused transitions. Streaming AI chat responses are still not exposed through a live region (tracked follow-up). |

---

## Revised Section 508 Report

### Chapter 3: Functional Performance Criteria (FPC)

| Criterion | Conformance Level | Remarks and Explanations |
|-----------|-------------------|--------------------------|
| **302.1 Without Vision** | Partially Supports | Semantic structure, landmarks, a skip link, per-route titles, icon/Select accessible names, chart `accessibilityLayer`, live regions, and managed panel focus now support screen-reader use. Confirmation pending a manual NVDA/JAWS/VoiceOver pass; streaming AI chat output is not yet announced. |
| **302.2 With Limited Vision** | Partially Supports | Pinch/text zoom restored (`maximum-scale=1` removed) and reduced-motion honored. Most text passes measured contrast; enumerated brand-purple exceptions remain (see 1.4.3). |
| **302.3 Without Perception of Color** | Partially Supports | Required fields and meeting-timer states now carry text equivalents; a documented exception remains for color-only inline links on the marketing pages (1.4.1). |
| **302.4 Without Hearing** | Supports | No information is conveyed by sound. |
| **302.5 With Limited Hearing** | Supports | No audio-dependent functionality. |
| **302.6 Without Speech** | Supports | No speech input is required. |
| **302.7 With Limited Manipulation** | Partially Supports | In-scope functionality is keyboard-operable (clickable rows/spans made operable; MeetingLive shortcuts no longer intercept focused controls). A user-facing mechanism to turn off/remap single-key shortcuts is not yet provided (2.1.4). |
| **302.8 With Limited Reach and Strength** | Supports | No reach/strength-dependent interaction. |
| **302.9 With Limited Language, Cognitive, and Learning Abilities** | Supports | Consistent navigation, plain-language help, and a `prefers-reduced-motion` path for the animated backgrounds. |

### Chapter 4: Hardware

**Not Applicable.** Vega is a web application and includes no hardware.

### Chapter 5: Software

Vega is web-based software; conformance is governed by the WCAG 2.1 tables above (per 508 502/504 mapping). The following interoperability items are noted:

| Criterion | Conformance Level | Remarks and Explanations |
|-----------|-------------------|--------------------------|
| **502.2.1 / 502.2.2 Interoperability with AT** | Partially Supports | Built on Radix UI (standard ARIA name/role/value/state); in-scope custom-code gaps were remediated (accessible names, focus management, live regions). Confirmation pending a manual AT pass; see WCAG 4.1.2 / 4.1.3. |
| **503.2–503.4 Applications / User Preferences** | Supports | Respects browser/OS light-dark theme and honors `prefers-reduced-motion` (scroll reveals and, as of Phase 1, the background animations). |

### Chapter 6: Support Documentation and Services

| Criterion | Conformance Level | Remarks and Explanations |
|-----------|-------------------|--------------------------|
| **602.2 Accessibility and Compatibility Features** | Not Evaluated | Whether product documentation describes accessibility/compatibility features has not been assessed for this edition. |
| **602.3 Electronic Support Documentation** | Not Evaluated | The in-app User Guide is HTML-based; its own conformance (heading levels, images) has not been formally evaluated. |
| **603.2 / 603.3 Support Services** | Not Evaluated | Accessibility of the support-ticket channel for users with disabilities has not been assessed. |

---

## Legal Disclaimer (Synozur)

This document is provided for informational purposes only and represents the current, pre-remediation assessment of the named product based on a source-code audit. It is not a warranty. Conformance claims will be revised following automated testing and manual assistive-technology verification (see remediation Phase 0 and Phase 4). The contents are subject to change without notice.
