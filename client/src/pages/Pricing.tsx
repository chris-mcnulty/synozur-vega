import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { SynozurAppSwitcher } from "@/components/SynozurAppSwitcher";
import {
  CheckCircle2,
  X,
  Sparkles,
  Star,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Building2,
  Mail,
} from "lucide-react";
import { PRICING_PLANS, PRICING_FAQS, type PricingPlan } from "@/lib/pricing-plans";
import starTrailsBg from "@/assets/brand/AdobeStock_362805421_1767551096391.jpeg";
import synozurMark from "@/assets/brand/SynozurMark_color1400_1766606244412.png";

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function PlanCard({ plan }: { plan: PricingPlan }) {
  const isRecommended = plan.recommended;

  return (
    <div
      className={`relative flex flex-col rounded-md border bg-background/80 backdrop-blur-sm overflow-hidden transition-shadow ${
        isRecommended
          ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/30"
          : "border-border"
      }`}
      data-testid={`card-plan-${plan.planName}`}
    >
      {isRecommended && (
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
      )}

      <div className="p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">{plan.displayName}</h3>
          {plan.badge && (
            <Badge
              variant="default"
              className="text-[10px] px-2 py-0.5 flex items-center gap-1"
              data-testid={`badge-recommended-${plan.planName}`}
            >
              <Star className="h-3 w-3" />
              {plan.badge}
            </Badge>
          )}
        </div>

        {/* Price */}
        <div>
          <p className="text-2xl font-bold" data-testid={`text-price-${plan.planName}`}>
            {plan.price}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{plan.priceSub}</p>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">{plan.description}</p>

        {/* CTA */}
        {plan.planName === "trial" ? (
          <Button
            asChild
            variant={plan.ctaVariant}
            className="w-full"
            data-testid={`button-cta-${plan.planName}`}
          >
            <Link href={plan.ctaHref}>
              {plan.cta}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button
            asChild
            variant={plan.ctaVariant}
            className="w-full"
            data-testid={`button-cta-${plan.planName}`}
          >
            <a href={plan.ctaHref}>
              {plan.planName === "enterprise" ? (
                <Building2 className="mr-2 h-4 w-4" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              {plan.cta}
            </a>
          </Button>
        )}
      </div>

      {/* Feature list */}
      <div className="px-6 pb-6 flex-1">
        <ul className="space-y-0">
          {plan.features.map((f) => (
            <li
              key={f.label}
              className="flex items-start gap-2 py-1.5 border-b border-border/40 last:border-0"
            >
              {f.included ? (
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              ) : (
                <X className="h-4 w-4 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
              )}
              <span
                className={`text-sm leading-snug ${
                  f.included ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {f.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const slug = q.slice(0, 24).replace(/\s+/g, "-").toLowerCase();
  return (
    <div className="border-b border-border last:border-0" data-testid={`faq-item-${slug}`}>
      <button
        className="w-full flex items-center justify-between gap-4 py-4 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-testid={`button-faq-${slug}`}
      >
        <span className="font-medium text-sm">{q}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <p className="text-sm text-muted-foreground leading-relaxed pb-4">{a}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function Pricing() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <Helmet>
        <title>Pricing — Vega Company OS | Synozur</title>
        <meta
          name="description"
          content="Choose the Vega plan that fits your organization. Start with a free 30-day trial — no credit card required. Standard, Professional, and Enterprise plans for growing teams and large enterprises."
        />
        <meta property="og:title" content="Pricing — Vega Company OS" />
        <meta
          property="og:description"
          content="Start for free or contact our team for a plan tailored to your organization. Trial, Standard, Professional, and Enterprise tiers available."
        />
        <link rel="canonical" href="https://vega.synozur.com/pricing" />
      </Helmet>

      {/* ── Sticky Nav ── */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <nav
          className={`transition-all duration-200 border-b ${
            isScrolled
              ? "bg-background/95 backdrop-blur-md border-border"
              : "bg-white/95 dark:bg-black/50 backdrop-blur-sm border-transparent"
          }`}
        >
          <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <SynozurAppSwitcher currentApp="vega" />
              <img src={synozurMark} alt="Vega" className="h-8 object-contain" />
              <Link href="/">
                <span
                  className={`text-lg font-semibold cursor-pointer ${
                    isScrolled ? "text-foreground" : "text-foreground dark:text-white"
                  }`}
                  data-testid="link-logo-home"
                >
                  Vega
                </span>
              </Link>
              <Badge
                variant="secondary"
                className={`text-xs ${
                  isScrolled ? "" : "dark:bg-white/20 dark:text-white dark:border-white/30"
                }`}
              >
                Beta
              </Badge>
            </div>

            {/* Nav links */}
            <div className="hidden md:flex items-center gap-2">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className={isScrolled ? "" : "dark:text-white dark:hover:bg-white/10"}
                data-testid="link-nav-home"
              >
                <Link href="/">Home</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="font-semibold text-primary"
                data-testid="link-nav-pricing-active"
                disabled
              >
                Pricing
              </Button>
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-2 md:gap-3">
              <Button asChild size="sm" data-testid="button-nav-get-started">
                <Link href="/login?mode=signup">Get started</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                data-testid="button-nav-login"
                className={
                  isScrolled
                    ? ""
                    : "dark:border-white/30 dark:text-white dark:hover:bg-white/10"
                }
              >
                <Link href="/login">Log in</Link>
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </nav>
      </div>

      {/* ── Hero ── */}
      <div className="pt-16">
        <section
          className="relative w-full min-h-[40vh] flex items-center justify-center py-16 md:py-24"
          style={{
            backgroundImage: `url(${starTrailsBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/65 to-black/85" />
          <div className="relative z-10 text-center text-white max-w-3xl mx-auto px-4 md:px-6">
            <Badge
              variant="outline"
              className="mb-4 border-white/30 text-white/80 bg-white/10 backdrop-blur-sm"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Simple, transparent pricing
            </Badge>
            <h1
              className="text-3xl md:text-5xl font-semibold leading-tight mb-4"
              style={{ textShadow: "0 4px 16px rgba(0,0,0,0.9)" }}
              data-testid="heading-pricing-hero"
            >
              A plan for every stage of growth
            </h1>
            <p
              className="text-lg text-white/85 leading-relaxed"
              style={{ textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}
            >
              Start for free. Scale when you're ready. Every plan includes the full Vega
              platform — AI tools, Microsoft Entra SSO, and all five modules.
            </p>
          </div>
        </section>

        {/* ── Plan cards ── */}
        <section className="py-16 md:py-20 bg-background border-t" data-testid="section-plans">
          <div className="max-w-6xl mx-auto px-4 md:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {PRICING_PLANS.map((plan) => (
                <PlanCard key={plan.planName} plan={plan} />
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground mt-8">
              All prices in USD. Paid plans billed annually.{" "}
              <a
                href="mailto:sales@synozur.com"
                className="underline hover:text-foreground"
                data-testid="link-contact-sales-note"
              >
                Contact us
              </a>{" "}
              for volume discounts or multi-year terms.
            </p>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="py-16 bg-muted/30 border-t" data-testid="section-faq">
          <div className="max-w-2xl mx-auto px-4 md:px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-semibold">Frequently asked questions</h2>
              <p className="text-muted-foreground mt-3 text-sm">
                Still have questions?{" "}
                <a
                  href="mailto:sales@synozur.com"
                  className="text-primary hover:underline"
                  data-testid="link-faq-contact"
                >
                  Reach out to our team.
                </a>
              </p>
            </div>
            <div className="bg-background rounded-md border border-border px-6">
              {PRICING_FAQS.map((faq) => (
                <FAQItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="py-16 bg-background border-t" data-testid="section-bottom-cta">
          <div className="max-w-2xl mx-auto px-4 md:px-6 text-center">
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">
              Ready to put strategy to work?
            </h2>
            <p className="text-muted-foreground mb-8">
              Start your free 30-day trial today — no credit card, no sales call required.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="text-base px-8"
                data-testid="button-cta-bottom-trial"
              >
                <Link href="/login?mode=signup">
                  Start free trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="text-base px-8"
                data-testid="button-cta-bottom-sales"
              >
                <a href="mailto:sales@synozur.com?subject=Vega%20Pricing%20Question">
                  <Mail className="mr-2 h-5 w-5" />
                  Talk to sales
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="py-8 bg-background border-t">
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2026 The Synozur Alliance LLC. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <Link href="/">
                <span
                  className="hover:text-foreground cursor-pointer"
                  data-testid="link-footer-home"
                >
                  Home
                </span>
              </Link>
              <a
                href="https://www.synozur.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                Privacy
              </a>
              <a
                href="https://www.synozur.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                Terms
              </a>
              <a
                href="https://www.synozur.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                Synozur.com
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
