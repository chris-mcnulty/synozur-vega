import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Shield, Lock, Users, FileCheck, CheckCircle2, X, Compass, Target, RefreshCcw, Layers, BarChart3, Calendar, Sparkles, Building2, Play } from "lucide-react";
import { Link } from "wouter";
import starTrailsBg from "@assets/AdobeStock_362805421_1767551096391.jpeg";
import lightBeamBg from "@assets/AdobeStock_167081726_1767551096392.jpeg";
import telescopeBg from "@assets/AdobeStock_1114783441_1767551096393.jpeg";
import vegaLogo from "@assets/VegaTight_1766605018223.png";
import vegaLogoWhite from "@assets/Vega_-_White_1767549184769.png";
import vegaScreenshot from "@assets/VegaSS3_1767556369927.jpg";

const trustBadges = [
  { icon: Shield, label: "SOC 2 Type II" },
  { icon: Lock, label: "Microsoft Entra SSO" },
  { icon: Users, label: "Role-based access" },
  { icon: FileCheck, label: "Audit trails" },
];

const onboardingSteps = [
  { step: 1, text: "Define 1–3 strategic priorities (with AI prompts)" },
  { step: 2, text: "Create your first OKRs" },
  { step: 3, text: "Link initiatives and meetings to what matters" },
  { step: 4, text: "See what's at risk—automatically" },
];

const outcomeCards = [
  {
    icon: Compass,
    title: "Align",
    description: "Connect mission, strategy, and priorities so everyone rows in the same direction.",
  },
  {
    icon: Target,
    title: "Execute",
    description: "Turn plans into weekly focus with OKRs, initiatives, and clear ownership.",
  },
  {
    icon: RefreshCcw,
    title: "Adjust",
    description: "Spot drift early with AI insights, check-ins, and decision logs.",
  },
];

const differentiators = [
  {
    title: "Not another dashboard",
    description: "One system that links strategy, OKRs, initiatives, and leadership rhythm.",
  },
  {
    title: "AI that supports—not replaces",
    description: "Recommendations and risk signals you control.",
  },
  {
    title: "Built for real adoption",
    description: "Cadence, meeting workflows, and accountability people actually use.",
  },
];

const forItems = [
  "CEOs & COOs scaling beyond ad-hoc leadership",
  "Strategy & Transformation leaders tired of slideware",
  "Consultants running multi-client operating cadences",
];

const notForItems = [
  "Task-only project management",
  "Individual productivity tracking",
  "Lightweight to-do apps",
];

const modules = [
  { icon: Building2, title: "Foundations", description: "Define mission, vision, values, and goals" },
  { icon: Compass, title: "Strategy", description: "Strategic priorities aligned to annual goals" },
  { icon: Target, title: "Planning (OKRs)", description: "Objectives, weighted key results, check-ins" },
  { icon: Calendar, title: "Focus Rhythm", description: "Meeting cadences, agendas, decisions, action items" },
  { icon: Sparkles, title: "AI Assistant", description: "At-risk detection, summaries, reporting exports" },
];

const securityBullets = [
  "SOC 2 Type II",
  "Encryption in transit and at rest",
  "Microsoft Entra SSO + RBAC",
  "Audit logging",
  "Multi-tenant isolation",
];

function CTAButton({ className = "" }: { className?: string }) {
  return (
    <div className={`text-center ${className}`}>
      <Link href="/login">
        <Button size="lg" className="text-base px-8" data-testid="button-cta-inline">
          Start a free trial
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </Link>
      <p className="text-sm text-muted-foreground mt-2">No credit card. Be set up in minutes.</p>
    </div>
  );
}

export function LandingHero() {
  return (
    <>
      {/* Hero Section */}
      <section 
        id="hero"
        className="relative w-full min-h-[85vh] flex items-center justify-center py-12 md:py-20"
        style={{ 
          backgroundImage: `url(${starTrailsBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
        
        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 md:px-6 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-6 md:mb-8 flex justify-center">
              {/* White logo on mobile for better contrast, regular logo on desktop */}
              <img src={vegaLogoWhite} alt="Vega Company OS" className="h-56 object-contain drop-shadow-2xl md:hidden" />
              <img src={vegaLogo} alt="Vega Company OS" className="hidden md:block h-80 object-contain drop-shadow-2xl" />
            </div>
            
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-semibold leading-tight mb-4 md:mb-6" style={{ textShadow: '0 4px 16px rgba(0,0,0,0.9)' }}>
              Turn strategy into action—every week, not once a year.
            </h1>
            
            <p className="text-lg md:text-xl text-white/90 mb-6 md:mb-8 max-w-3xl mx-auto leading-relaxed" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
              Vega is an AI-augmented Company Operating System™ that connects strategy, OKRs, and leadership cadence in one place.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-4">
              <Link href="/login">
                <Button
                  size="lg"
                  className="text-base px-8 shadow-xl w-full sm:w-auto"
                  data-testid="button-start-trial"
                >
                  Start a free trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 shadow-xl w-full sm:w-auto"
                data-testid="button-watch-demo"
                onClick={() => document.getElementById('screenshot-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Play className="mr-2 h-4 w-4" />
                Watch 2-minute walkthrough
              </Button>
            </div>
            <p className="text-sm text-white/70 mb-8">
              No credit card. Be set up in minutes.
            </p>
            
            {/* Trust Strip */}
            <div className="flex flex-wrap justify-center gap-3 md:gap-6">
              {trustBadges.map((badge, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2"
                  data-testid={`trust-badge-${index}`}
                >
                  <badge.icon className="h-4 w-4 text-white/80" />
                  <span className="text-white text-sm font-medium">{badge.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Company OS Credibility Blurb */}
      <section className="py-10 md:py-14 bg-background border-b">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Built on our proven Company Operating System™
          </p>
          <p className="text-base md:text-lg text-foreground/90 leading-relaxed mb-4">
            Vega is built on the Company Operating System™ created by Synozur and shaped by decades of strategy consulting work. It reflects how real leadership teams align strategy, planning, and execution—refined through hands-on work with dozens of organizations, from growing mid-market companies to complex global enterprises.
          </p>
          <p className="text-sm text-muted-foreground">
            See how this approach has been applied in practice:{" "}
            <a 
              href="https://www.synozur.com/case-studies/transforming-management-frameworks-at-microsoft" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              Microsoft management frameworks
            </a>
            {" • "}
            <a 
              href="https://www.synozur.com/case-studies/management-makeover-at-a-luxury-brand" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              Luxury brand leadership transformation
            </a>
          </p>
        </div>
      </section>

      {/* First 15 Minutes Section */}
      <section 
        className="relative py-16 md:py-24"
        style={{ 
          backgroundImage: `url(${lightBeamBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/80" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-white">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-semibold mb-4" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
              What you'll do in your first 15 minutes
            </h2>
          </div>
          
          <div className="space-y-4 mb-10">
            {onboardingSteps.map((item) => (
              <div 
                key={item.step} 
                className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-lg p-4"
                data-testid={`onboarding-step-${item.step}`}
              >
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold">
                  {item.step}
                </div>
                <span className="text-lg text-white">{item.text}</span>
              </div>
            ))}
          </div>
          
          <div className="text-center">
            <Link href="/login">
              <Button size="lg" className="text-base px-8" data-testid="button-cta-first15">
                Start free—no credit card
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Outcomes Section */}
      <section className="py-16 md:py-24 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">What You'll Achieve</Badge>
            <h2 className="text-3xl md:text-4xl font-semibold">Three outcomes that matter</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {outcomeCards.map((card, index) => (
              <Card key={index} className="hover-elevate" data-testid={`outcome-card-${index}`}>
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <card.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{card.title}</h3>
                  <p className="text-muted-foreground">{card.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <CTAButton className="mt-10" />
        </div>
      </section>

      {/* How Vega is Different */}
      <section id="features" className="py-16 md:py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Why Vega</Badge>
            <h2 className="text-3xl md:text-4xl font-semibold">How Vega is Different</h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
              Unlike generic tools, Vega codifies the Company OS developed by Synozur through real strategy and transformation work.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {differentiators.map((item, index) => (
              <Card key={index} className="hover-elevate" data-testid={`differentiator-card-${index}`}>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Who It's For / Not For */}
      <section className="py-16 md:py-24 bg-background">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-semibold">Is Vega right for you?</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card data-testid="who-for-card">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  Built for
                </h3>
                <ul className="space-y-3">
                  {forItems.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            
            <Card data-testid="who-not-for-card">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <X className="h-6 w-6 text-muted-foreground" />
                  Not designed for
                </h3>
                <ul className="space-y-3">
                  {notForItems.map((item, index) => (
                    <li key={index} className="flex items-start gap-3 text-muted-foreground">
                      <X className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
          
          <CTAButton className="mt-10" />
        </div>
      </section>

      {/* Modules Overview */}
      <section 
        id="modules" 
        className="relative py-16 md:py-24"
        style={{ 
          backgroundImage: `url(${telescopeBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/80 to-black/85" />
        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 mb-4">The Platform</Badge>
            <h2 className="text-3xl md:text-4xl font-semibold text-white" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
              Five integrated modules
            </h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {modules.map((module, index) => (
              <div 
                key={index}
                className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center text-white border border-white/20"
                data-testid={`module-card-${index}`}
              >
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <module.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold mb-1">{module.title}</h3>
                <p className="text-sm text-white/80">{module.description}</p>
              </div>
            ))}
          </div>
          
          {/* M365 Integration Callout */}
          <div className="mt-10 bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-white">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-white/80" />
                <span className="font-medium">Native Microsoft 365 integration</span>
              </div>
              <span className="hidden md:block text-white/40">|</span>
              <div className="flex flex-wrap justify-center gap-3 text-sm text-white/80">
                <span>Outlook Calendar</span>
                <span className="text-white/40">•</span>
                <span>Excel binding</span>
                <span className="text-white/40">•</span>
                <span>Planner sync</span>
                <span className="text-white/40">•</span>
                <span>Copilot Agent</span>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-10">
            <Link href="/login">
              <Button size="lg" variant="secondary" className="text-base px-8" data-testid="button-cta-modules">
                Start a free trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <p className="text-sm text-white/70 mt-2">No credit card. Be set up in minutes.</p>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-16 md:py-24 bg-card">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4">Enterprise Grade</Badge>
            <h2 className="text-3xl md:text-4xl font-semibold">Enterprise-ready by design</h2>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4">
            {securityBullets.map((item, index) => (
              <div 
                key={index}
                className="flex items-center gap-2 bg-muted rounded-full px-5 py-2.5"
                data-testid={`security-badge-${index}`}
              >
                <Shield className="h-4 w-4 text-primary" />
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshot Section */}
      <section id="screenshot-section" className="relative bg-background py-12 md:py-20 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6 md:mb-10">
            <h2 className="text-2xl md:text-3xl font-semibold mb-2">See Vega in Action</h2>
            <p className="text-muted-foreground">Hierarchical OKRs, Big Rocks, and Progress Tracking</p>
          </div>
          <div className="relative rounded-xl overflow-hidden shadow-2xl border">
            <img 
              src={vegaScreenshot} 
              alt="Vega OKR Planning - OKR Hierarchy and Progress Tracking" 
              className="w-full h-auto"
            />
          </div>
        </div>
      </section>

      {/* Final CTA Band */}
      <section className="py-16 md:py-20 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">Ready to turn strategy into action?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join leaders who align, execute, and adapt—every week.
          </p>
          <Link href="/login">
            <Button size="lg" variant="secondary" className="text-base px-8" data-testid="button-cta-final">
              Start a free trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="text-sm mt-4 opacity-70">
            No credit card. Be set up in minutes.
          </p>
        </div>
      </section>
    </>
  );
}
