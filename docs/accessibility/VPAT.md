# Accessibility Conformance Report — Vega Company OS

### Voluntary Product Accessibility Template® (VPAT®)

**Version 2.5 — Revised Section 508 Edition**

> ⚠️ **DRAFT — PRE-REMEDIATION BASELINE.** This report reflects the state of the product at the time of the July 2026 code audit, *before* the remediation described in `BACKLOG.md` (High Priority Feature #6) has been performed. Conformance levels below are expected to improve as each remediation phase lands. Do not distribute externally until Phase 4 (manual verification) is complete and this notice is removed.

---

## Product / Report Information

| Field | Value |
|-------|-------|
| **Name of Product / Version** | Vega — AI-Augmented Company OS Platform (web application) |
| **Report Date** | July 8, 2026 |
| **Product Description** | Responsive web application for aligning organizational strategy with execution: Foundations, Strategy, Planning/OKRs, Focus Rhythm meetings, and Reporting, with AI assistance. |
| **Contact Information** | accessibility contact — *to be supplied* |
| **Notes** | This report is scoped to the **authenticated core application** (Dashboards, Foundations, Strategy, Planning/OKRs, Focus Rhythm, Reporting, Settings) and the **public/marketing pages** (Landing, Pricing, Login, verify/forgot/reset password). Administrative surfaces (Tenant Admin, System Admin, AI Grounding, Import, Trash) and the embeddable public cards (`/embed/v1`) are **out of scope for this edition** and will be covered in a later revision. |
| **Evaluation Methods Used** | Manual static source review of the React/TypeScript client (`client/src`, 186 components), design-token review (`tailwind.config.ts`, `index.css`), and targeted pattern analysis (ripgrep). **Automated tooling (axe) and manual assistive-technology testing (NVDA, VoiceOver, keyboard-only) are planned for Phase 0 and Phase 4 and have not yet been performed.** Levels below are a source-audit estimate, not a verified AT result. |

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
| **1.1.1 Non-text Content** | Partially Supports | `<img>` elements all carry meaningful `alt` text. However, ~192 icon-only buttons lack an accessible name (S1), decorative icons inside headings are not `aria-hidden`, and Recharts charts have no text alternative (S5). |
| **1.2.1 Audio-only and Video-only (Prerecorded)** | Not Applicable | No prerecorded audio-only or video-only content in scope. |
| **1.2.2 Captions (Prerecorded)** | Not Applicable | No prerecorded multimedia with audio in scope. |
| **1.2.3 Audio Description or Media Alternative (Prerecorded)** | Not Applicable | No prerecorded synchronized media in scope. |
| **1.3.1 Info and Relationships** | Partially Supports | Real semantic headings (h1–h6) and landmark regions are used throughout. However, `<Label htmlFor>` on ~145 `SelectTrigger`s does not bind to the Radix trigger button, orphaning the labels (S2); validation errors are not programmatically associated with fields (S3); required fields are conveyed by a color-only `*`. |
| **1.3.2 Meaningful Sequence** | Supports | DOM order follows visual reading order; no CSS-driven reorder defects observed. |
| **1.3.3 Sensory Characteristics** | Supports | Instructions generally use text labels rather than shape/position alone. |
| **1.4.1 Use of Color** | Partially Supports | Required fields are indicated by a color-only asterisk, and over-target/negative meeting timers are conveyed by red text alone (`MeetingLive.tsx`). |
| **1.4.2 Audio Control** | Not Applicable | No automatically playing audio. |
| **2.1.1 Keyboard** | Partially Supports | Most controls are native/Radix and keyboard-operable. However, ~67 clickable `<div>`/`<span>` elements (including core OKR name spans that open detail panes) have no keyboard handler (S4), and `MeetingLive.tsx` intercepts bare Space/arrow/letter keys page-wide. |
| **2.1.2 No Keyboard Trap** | Supports | No keyboard traps identified. |
| **2.1.4 Character Key Shortcuts** | Does Not Support | `MeetingLive.tsx` registers single-character shortcuts (`p`/`d`/`r`/`a`) with no mechanism to turn off or remap; guarded against text-input focus but not otherwise scoped. |
| **2.2.1 Timing Adjustable** | Partially Supports | Live meeting timers can be paused by the user. Session-timeout behavior and any warning/extension mechanism have not been verified. |
| **2.2.2 Pause, Stop, Hide** | Partially Supports | Aurora background animations (blob, nebula-shimmer, infinite border-spin) run continuously with no pause control and do not honor `prefers-reduced-motion` (`index.css:416-527`). Scroll-reveal animations do honor reduced-motion. |
| **2.3.1 Three Flashes or Below Threshold** | Supports | No flashing content above threshold. |
| **2.4.1 Bypass Blocks** | Partially Supports | Landmark regions (`header`, `nav`, `main`) are present and provide a bypass mechanism for AT that supports landmarks, but there is no skip-to-content link and `<main>` has no `id` target (`App.tsx:475`). |
| **2.4.2 Page Titled** | Partially Supports | A static document title is always present, but only 3 of ~35 pages set a descriptive per-route `<title>` (`react-helmet-async` is already wired). |
| **2.4.3 Focus Order** | Partially Supports | Radix dialogs/sheets manage focus correctly. The custom AI Chat and Help panels are plain conditional `<div>`s that do not move focus in on open or restore it on close (`AIChatPanel.tsx`, `HelpChatPanel.tsx`). |
| **2.4.4 Link Purpose (In Context)** | Partially Supports | Text links are descriptive; icon-only controls without accessible names (S1) do not expose their purpose. |
| **2.5.1 Pointer Gestures** | Supports | No path-based or multipoint gestures required. |
| **2.5.2 Pointer Cancellation** | Supports | Activation occurs on up-event via standard controls. |
| **2.5.3 Label in Name** | Partially Supports | Where controls have visible text, the accessible name matches. Icon-only controls labeled via `title` only (S1) have no visible text label to match. |
| **2.5.4 Motion Actuation** | Not Applicable | No device-motion-actuated functionality. |
| **3.1.1 Language of Page** | Supports | `lang="en"` is set on the root `<html>` (`client/index.html`). |
| **3.2.1 On Focus** | Supports | No context change occurs on focus. |
| **3.2.2 On Input** | Supports | No unexpected context change on input. |
| **3.3.1 Error Identification** | Partially Supports | Errors are surfaced primarily via transient `toast()` notifications not tied to the offending field (S3); the accessible `Form`/`FormControl` primitive is adopted in only 2 files. |
| **3.3.2 Labels or Instructions** | Partially Supports | Many fields are labeled, but ~145 Selects have orphaned labels (S2), some search/file inputs are placeholder-only, and required state is color-only. |
| **4.1.1 Parsing** | Supports | Markup is generated by React; no duplicate-id or malformed-nesting defects observed. |
| **4.1.2 Name, Role, Value** | Partially Supports | Radix primitives expose correct name/role/value. Systemic gaps: nameless icon buttons (S1), nameless Selects (S2), and clickable non-interactive elements missing role/state (S4). |

### Table 2: Success Criteria, Level AA

| Criterion | Conformance Level | Remarks and Explanations |
|-----------|-------------------|--------------------------|
| **1.2.4 Captions (Live)** | Not Applicable | No live multimedia. |
| **1.2.5 Audio Description (Prerecorded)** | Not Applicable | No prerecorded synchronized media. |
| **1.3.4 Orientation** | Supports | Responsive layout; no orientation lock. |
| **1.3.5 Identify Input Purpose** | Partially Supports | `autocomplete` attributes are not consistently set on inputs that collect user information (e.g., name, email). Not yet verified across all in-scope forms. |
| **1.4.3 Contrast (Minimum)** | Not Evaluated | Design tokens appear plausible for AA but a measured contrast audit against the 4.5:1 / 3:1 thresholds has not yet been performed (planned Phase 3). |
| **1.4.4 Resize Text** | Partially Supports | The viewport meta sets `maximum-scale=1`, which suppresses pinch-zoom (`client/index.html:5`); browser text zoom may still function. To be corrected in Phase 1. |
| **1.4.5 Images of Text** | Supports | Text is rendered as live text with web fonts, not images. |
| **1.4.10 Reflow** | Partially Supports | Layout is responsive and mobile-adapted, but the `maximum-scale=1` restriction and behavior at 400% zoom have not been verified. |
| **1.4.11 Non-text Contrast** | Not Evaluated | UI-component and graphical-object contrast not yet measured; one control removes its focus indicator without replacement (`App.tsx:438`). |
| **1.4.12 Text Spacing** | Not Evaluated | Behavior under user text-spacing overrides not yet tested. |
| **1.4.13 Content on Hover or Focus** | Partially Supports | Radix tooltips are dismissable and hoverable; native `title` tooltips used on some icon controls are not dismissable/persistent per the criterion. |
| **2.4.5 Multiple Ways** | Supports | Global search, persistent sidebar navigation, and contextual breadcrumbs provide multiple ways to locate content. |
| **2.4.6 Headings and Labels** | Partially Supports | Headings are descriptive and well-structured; form labels are undermined by the orphaned-Select-label issue (S2). |
| **2.4.7 Focus Visible** | Partially Supports | Radix components provide focus-visible rings. The header search trigger removes its outline with no replacement (`App.tsx:438`); other custom controls not yet fully verified. |
| **3.1.2 Language of Parts** | Not Applicable | Content is English-only; no mixed-language passages. |
| **3.2.3 Consistent Navigation** | Supports | Navigation is consistent across routes via the shared app shell. |
| **3.2.4 Consistent Identification** | Partially Supports | Repeated icon-only controls are not consistently given the same accessible name (S1). |
| **3.3.3 Error Suggestion** | Partially Supports | Suggestions exist in some flows but, like error identification, are typically toast-only and not associated with the field (S3). |
| **3.3.4 Error Prevention (Legal, Financial, Data)** | Supports | Destructive actions use confirmation dialogs (Radix AlertDialog); soft-delete + 30-day trash provides reversal. |
| **4.1.3 Status Messages** | Partially Supports | Toast notifications announce via Radix's `role="status"`/`aria-live`. However, live meeting timers, check-in autosave status, notification-count changes, and streaming AI responses are not exposed through live regions. |

---

## Revised Section 508 Report

### Chapter 3: Functional Performance Criteria (FPC)

| Criterion | Conformance Level | Remarks and Explanations |
|-----------|-------------------|--------------------------|
| **302.1 Without Vision** | Partially Supports | Semantic structure and landmarks aid screen-reader use, but nameless icon buttons (S1), nameless Selects (S2), chart-only data (S5), missing live regions, and unmanaged focus in custom panels create barriers. |
| **302.2 With Limited Vision** | Not Evaluated | Zoom is restricted by `maximum-scale=1` (see 1.4.4); contrast not yet measured (1.4.3/1.4.11). |
| **302.3 Without Perception of Color** | Partially Supports | Some state (required fields, over-target timers) is conveyed by color alone (1.4.1). |
| **302.4 Without Hearing** | Supports | No information is conveyed by sound. |
| **302.5 With Limited Hearing** | Supports | No audio-dependent functionality. |
| **302.6 Without Speech** | Supports | No speech input is required. |
| **302.7 With Limited Manipulation** | Partially Supports | Most functionality is keyboard-operable, but clickable non-interactive elements (S4) require a pointer, and single-key shortcuts cannot be remapped. |
| **302.8 With Limited Reach and Strength** | Supports | No reach/strength-dependent interaction. |
| **302.9 With Limited Language, Cognitive, and Learning Abilities** | Partially Supports | Consistent navigation and plain-language help exist; continuously animated backgrounds without a reduced-motion path (2.2.2) may hinder some users. |

### Chapter 4: Hardware

**Not Applicable.** Vega is a web application and includes no hardware.

### Chapter 5: Software

Vega is web-based software; conformance is governed by the WCAG 2.1 tables above (per 508 502/504 mapping). The following interoperability items are noted:

| Criterion | Conformance Level | Remarks and Explanations |
|-----------|-------------------|--------------------------|
| **502.2.1 / 502.2.2 Interoperability with AT** | Partially Supports | Built on Radix UI, which exposes standard ARIA name/role/value/state; systemic custom-code gaps (S1–S5, live regions, focus management) reduce full AT interoperability. See WCAG 4.1.2 / 4.1.3. |
| **503.2–503.4 Applications / User Preferences** | Partially Supports | Respects browser/OS light-dark theme and honors `prefers-reduced-motion` for scroll reveals only, not for background animations. |

### Chapter 6: Support Documentation and Services

| Criterion | Conformance Level | Remarks and Explanations |
|-----------|-------------------|--------------------------|
| **602.2 Accessibility and Compatibility Features** | Not Evaluated | Whether product documentation describes accessibility/compatibility features has not been assessed for this edition. |
| **602.3 Electronic Support Documentation** | Not Evaluated | The in-app User Guide is HTML-based; its own conformance (heading levels, images) has not been formally evaluated. |
| **603.2 / 603.3 Support Services** | Not Evaluated | Accessibility of the support-ticket channel for users with disabilities has not been assessed. |

---

## Legal Disclaimer (Synozur)

This document is provided for informational purposes only and represents the current, pre-remediation assessment of the named product based on a source-code audit. It is not a warranty. Conformance claims will be revised following automated testing and manual assistive-technology verification (see remediation Phase 0 and Phase 4). The contents are subject to change without notice.
