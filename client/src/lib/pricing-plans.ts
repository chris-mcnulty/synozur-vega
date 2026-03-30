/**
 * Pricing plan definitions for the /pricing page.
 *
 * These plan names ('trial', 'standard', 'professional', 'enterprise') match
 * the service plan `name` field used by the backend (see shared/schema.ts →
 * servicePlans table and the 'trial' fallback in server/routes.ts).
 *
 * Schema-derived limits:
 *   - maxReadWriteUsers: displayed as the "read/write users" seat limit
 *   - maxReadOnlyUsers:  null → "Unlimited"
 *   - durationDays:     30 for Trial, null for paid plans (never expires)
 */

export type PricingFeature = {
  label: string;
  included: boolean;
};

export type PricingPlan = {
  /** Matches servicePlans.name in the DB */
  planName: string;
  displayName: string;
  badge?: string;
  price: string;
  priceSub: string;
  description: string;
  cta: string;
  ctaHref: string;
  ctaVariant: "default" | "outline";
  recommended?: boolean;
  /**
   * maxReadWriteUsers mirrors servicePlans.maxReadWriteUsers.
   * null = unlimited (Enterprise tier).
   */
  maxReadWriteUsers: number | null;
  /**
   * maxReadOnlyUsers mirrors servicePlans.maxReadOnlyUsers.
   * null = unlimited.
   */
  maxReadOnlyUsers: number | null;
  /**
   * durationDays mirrors servicePlans.durationDays.
   * 30 for Trial, null for paid (never expires).
   */
  durationDays: number | null;
  features: PricingFeature[];
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    planName: "trial",
    displayName: "Trial",
    price: "Free",
    priceSub: "30-day trial · no card required",
    description:
      "Explore every module of Vega with a single workspace. Ideal for evaluating the platform before committing.",
    cta: "Start free trial",
    ctaHref: "/login?mode=signup",
    ctaVariant: "outline",
    maxReadWriteUsers: 5,
    maxReadOnlyUsers: 0,
    durationDays: 30,
    features: [
      { label: "Up to 5 read/write users", included: true },
      { label: "Unlimited read-only users", included: false },
      { label: "Foundations module", included: true },
      { label: "Strategy module", included: true },
      { label: "Outcomes (OKRs)", included: true },
      { label: "Focus Rhythm & meetings", included: true },
      { label: "AI Chat Assistant", included: true },
      { label: "AI goal suggestions", included: true },
      { label: "Microsoft Entra SSO", included: true },
      { label: "Reporting & exports", included: false },
      { label: "Consulting mode", included: false },
      { label: "Multi-tenant management", included: false },
      { label: "Dedicated success manager", included: false },
      { label: "SLA guarantee", included: false },
    ],
  },
  {
    planName: "standard",
    displayName: "Standard",
    price: "Contact us",
    priceSub: "Annual subscription · per seat",
    description:
      "For growing teams that need the full Vega platform with reporting, integrations, and sustained support.",
    cta: "Contact sales",
    ctaHref:
      "mailto:sales@synozur.com?subject=Vega%20Standard%20Plan%20Inquiry",
    ctaVariant: "outline",
    maxReadWriteUsers: 25,
    maxReadOnlyUsers: null,
    durationDays: null,
    features: [
      { label: "Up to 25 read/write users", included: true },
      { label: "Unlimited read-only users", included: true },
      { label: "Foundations module", included: true },
      { label: "Strategy module", included: true },
      { label: "Outcomes (OKRs)", included: true },
      { label: "Focus Rhythm & meetings", included: true },
      { label: "AI Chat Assistant", included: true },
      { label: "AI goal suggestions", included: true },
      { label: "Microsoft Entra SSO", included: true },
      { label: "Reporting & exports", included: true },
      { label: "Consulting mode", included: false },
      { label: "Multi-tenant management", included: false },
      { label: "Dedicated success manager", included: false },
      { label: "SLA guarantee", included: false },
    ],
  },
  {
    planName: "professional",
    displayName: "Professional",
    badge: "Recommended",
    price: "Contact us",
    priceSub: "Annual subscription · per seat",
    description:
      "For organizations running strategy at scale — includes consulting mode, multi-tenant support, and unlimited read-only users.",
    cta: "Contact sales",
    ctaHref:
      "mailto:sales@synozur.com?subject=Vega%20Professional%20Plan%20Inquiry",
    ctaVariant: "default",
    recommended: true,
    maxReadWriteUsers: 100,
    maxReadOnlyUsers: null,
    durationDays: null,
    features: [
      { label: "Up to 100 read/write users", included: true },
      { label: "Unlimited read-only users", included: true },
      { label: "Foundations module", included: true },
      { label: "Strategy module", included: true },
      { label: "Outcomes (OKRs)", included: true },
      { label: "Focus Rhythm & meetings", included: true },
      { label: "AI Chat Assistant", included: true },
      { label: "AI goal suggestions", included: true },
      { label: "Microsoft Entra SSO", included: true },
      { label: "Reporting & exports", included: true },
      { label: "Consulting mode", included: true },
      { label: "Multi-tenant management", included: true },
      { label: "Dedicated success manager", included: false },
      { label: "SLA guarantee", included: false },
    ],
  },
  {
    planName: "enterprise",
    displayName: "Enterprise",
    price: "Custom",
    priceSub: "Tailored to your organization",
    description:
      "For large enterprises requiring unlimited users, a guaranteed SLA, and a dedicated Synozur success team.",
    cta: "Talk to enterprise sales",
    ctaHref:
      "mailto:enterprise@synozur.com?subject=Vega%20Enterprise%20Plan%20Inquiry",
    ctaVariant: "outline",
    maxReadWriteUsers: null,
    maxReadOnlyUsers: null,
    durationDays: null,
    features: [
      { label: "Unlimited read/write users", included: true },
      { label: "Unlimited read-only users", included: true },
      { label: "Foundations module", included: true },
      { label: "Strategy module", included: true },
      { label: "Outcomes (OKRs)", included: true },
      { label: "Focus Rhythm & meetings", included: true },
      { label: "AI Chat Assistant", included: true },
      { label: "AI goal suggestions", included: true },
      { label: "Microsoft Entra SSO", included: true },
      { label: "Reporting & exports", included: true },
      { label: "Consulting mode", included: true },
      { label: "Multi-tenant management", included: true },
      { label: "Dedicated success manager", included: true },
      { label: "SLA guarantee", included: true },
    ],
  },
];

export const PRICING_FAQS = [
  {
    q: "How long is the trial, and what happens when it ends?",
    a: "Your trial runs for 30 days from the moment you create an account — no credit card required. When it expires, your data is retained for 60 days while you decide on a paid plan. You will receive email reminders before and at expiry. Contact our team at any time to extend or convert your trial.",
  },
  {
    q: "How are seat limits counted?",
    a: "Seat limits apply to read/write users — people who can create and edit OKRs, strategies, and check-ins. Read-only users (who can view dashboards and reports but cannot make changes) are unlimited on Standard, Professional, and Enterprise plans.",
  },
  {
    q: "Where is my data stored, and can I choose a region?",
    a: "Vega is hosted on Microsoft Azure. Data residency defaults to the US (East) region. Enterprise plans can request a specific Azure region for data storage. All data is encrypted in transit and at rest, and Vega maintains SOC 2 Type II certification.",
  },
  {
    q: "Does Vega support Microsoft Entra (Azure AD) SSO?",
    a: "Yes — all plans, including the free trial, support Microsoft Entra Single Sign-On. Users can sign in with their existing corporate credentials, and tenant-level RBAC policies are enforced automatically.",
  },
  {
    q: "What is the billing cycle for paid plans?",
    a: "All paid plans are billed annually. We do not offer monthly billing at this time. Enterprise plans can be structured with custom payment terms including multi-year agreements.",
  },
  {
    q: "Can we run Vega for multiple client organizations?",
    a: "Yes — the Professional and Enterprise plans include multi-tenant management and consulting mode, which are purpose-built for advisory firms and consultants managing strategy across several client organizations from a single Vega instance.",
  },
];
