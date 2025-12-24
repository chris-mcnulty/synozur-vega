import { LandingHero } from "@/components/LandingHero";
import { WhyVegaSection } from "@/components/WhyVegaSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { M365IntegrationSection } from "@/components/M365IntegrationSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SynozurLogo } from "@/components/SynozurLogo";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import microsoftPartnerBadge from "@assets/OIP_(1)_1766339770092.jpg";
import vegaLogo from "@assets/VegaTight_1766605018223.png";

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation('/dashboard');
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={vegaLogo} alt="Vega" className="h-8 object-contain" />
            <span className="text-lg font-semibold">Vega</span>
            <Badge variant="secondary" className="text-xs">Beta</Badge>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => document.getElementById('why-vega')?.scrollIntoView({ behavior: 'smooth' })}
              className="hidden md:inline-flex"
            >
              Why Vega
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="hidden md:inline-flex"
            >
              Features
            </Button>
            <Link href="/login">
              <Button data-testid="button-nav-login">
                Login
              </Button>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="pt-16">
        <LandingHero />
        <WhyVegaSection />
        <FeaturesSection />
        <M365IntegrationSection />

        <section className="py-20 bg-primary text-primary-foreground">
          <div className="max-w-4xl 2xl:max-w-5xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-semibold mb-4">Ready to Leave Viva Goals Behind?</h2>
            <p className="text-xl mb-8 opacity-90">
              Start your migration today. Import your existing OKRs or let AI build your Company OS from scratch.
            </p>
            <Link href="/login">
              <Button size="lg" variant="secondary" className="text-base px-8" data-testid="button-cta-bottom">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>

        <footer className="py-12 bg-background border-t">
          <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <div className="mb-4">
                  <img src={vegaLogo} alt="Vega Company OS" className="h-20 object-contain" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Powered by The Synozur Alliance LLC
                </p>
                <img 
                  src={microsoftPartnerBadge} 
                  alt="Microsoft Preferred Content AI Partner" 
                  className="h-20 object-contain rounded"
                />
              </div>
              <div>
                <h4 className="font-semibold mb-3">Product</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#features" className="hover:text-foreground">Features</a></li>
                  <li><a href="#why-vega" className="hover:text-foreground">Why Vega</a></li>
                  <li><a href="https://www.synozur.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Pricing</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Company</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="https://www.synozur.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">About Synozur</a></li>
                  <li><a href="https://www.synozur.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Contact</a></li>
                  <li><a href="https://www.synozur.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Blog</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Legal</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="https://www.synozur.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Privacy Policy</a></li>
                  <li><a href="https://www.synozur.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Terms of Service</a></li>
                  <li><a href="https://www.synozur.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Security</a></li>
                </ul>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                © 2025 The Synozur Alliance LLC. All rights reserved.
              </p>
              <a 
                href="https://www.synozur.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                www.synozur.com
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
