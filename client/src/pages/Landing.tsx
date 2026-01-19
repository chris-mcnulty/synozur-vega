import { LandingHero } from "@/components/LandingHero";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import microsoftPartnerBadgeWhite from "@assets/MSFT-CAPP-PREFERRED-White_1767641957468.png";
import microsoftPartnerBadgeBlack from "@assets/MSFT-CAPP-PREFERRED-BlackColor_1767641891731.png";
import vegaLogo from "@assets/VegaTight_1766605018223.png";
import synozurMark from "@assets/SynozurMark_color1400_1766606244412.png";
import synozurLogoColor from "@assets/SA-Logo-Horizontal-color_1768839624375.png";
import synozurLogoWhite from "@assets/SA-Logo-Horizontal-white_1768839624376.png";

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation('/dashboard');
    }
  }, [isAuthenticated, isLoading, setLocation]);

  useEffect(() => {
    const visitorId = localStorage.getItem('vega_visitor_id') || crypto.randomUUID();
    if (!localStorage.getItem('vega_visitor_id')) {
      localStorage.setItem('vega_visitor_id', visitorId);
    }
    fetch('/api/track/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: '/', visitorId }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      {/* Sticky Header */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <nav className={`transition-all duration-200 border-b ${isScrolled ? 'bg-background/95 backdrop-blur-md border-border' : 'bg-white/95 dark:bg-black/50 backdrop-blur-sm border-transparent'}`}>
          <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
            {/* Logo - Left */}
            <div className="flex items-center gap-2">
              <img src={synozurMark} alt="Vega" className="h-8 object-contain" />
              <span className={`text-lg font-semibold ${isScrolled ? 'text-foreground' : 'text-foreground dark:text-white'}`}>Vega</span>
              <Badge variant="secondary" className={`text-xs ${isScrolled ? '' : 'dark:bg-white/20 dark:text-white dark:border-white/30'}`}>Beta</Badge>
            </div>
            
            {/* Nav Links - Center (hidden on mobile) */}
            <div className="hidden md:flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className={isScrolled ? '' : 'dark:text-white dark:hover:bg-white/10'}
              >
                Features
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => document.getElementById('security')?.scrollIntoView({ behavior: 'smooth' })}
                className={isScrolled ? '' : 'dark:text-white dark:hover:bg-white/10'}
              >
                Security
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => document.getElementById('modules')?.scrollIntoView({ behavior: 'smooth' })}
                className={isScrolled ? '' : 'dark:text-white dark:hover:bg-white/10'}
              >
                Modules
              </Button>
            </div>
            
            {/* CTA + Theme - Right */}
            <div className="flex items-center gap-2 md:gap-3">
              <Link href="/login?mode=signup">
                <Button size="sm" data-testid="button-nav-get-started">
                  Get started
                </Button>
              </Link>
              <Link href="/login">
                <Button size="sm" variant="outline" data-testid="button-nav-login" className={isScrolled ? '' : 'dark:border-white/30 dark:text-white dark:hover:bg-white/10'}>
                  Log in
                </Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </nav>
        <AnnouncementBanner />
      </div>
      {/* Main Content - account for header + potential banner */}
      <div className="pt-16">
        <LandingHero />

        {/* From Synozur Section */}
        <section className="py-16 bg-muted/30 border-t">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-8">
              <img 
                src={synozurLogoColor} 
                alt="Synozur Alliance - The Transformation Company" 
                className="h-16 object-contain mx-auto block dark:hidden"
              />
              <img 
                src={synozurLogoWhite} 
                alt="Synozur Alliance - The Transformation Company" 
                className="h-16 object-contain mx-auto hidden dark:block"
              />
            </div>
            <div className="text-center space-y-4">
              <p className="text-lg text-foreground font-medium">
                Synozur – the transformation company – is proud to be a woman-owned advisory firm focused on transforming business for clients, making the desirable achievable. Built on our proven Company Operating System™, Vega was designed by former Microsoft Viva Goals product leadership.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Synozur helps clients reimagine how they do business today and evolve to succeed. Our empathetic approach is tailored to your unique journey, navigating the complexities of transformation and strategy with ease. We drive strategic leadership, culture change and design for business, technology, experiences, and market development.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Our consultants have decades of experience delivering global strategic advisory services that elevate you to achieve breakthrough innovation.
              </p>
              <div className="pt-4">
                <a 
                  href="https://www.synozur.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                >
                  Learn more about Synozur
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 bg-background border-t">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <div className="mb-4">
                  <img src={vegaLogo} alt="Vega Company OS" className="h-40 object-contain" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Designed by former Microsoft Viva product leadership
                </p>
                <img 
                  src={microsoftPartnerBadgeBlack} 
                  alt="Microsoft Preferred Content AI Partner" 
                  className="h-[7.5rem] object-contain block dark:hidden rounded"
                />
                <img 
                  src={microsoftPartnerBadgeWhite} 
                  alt="Microsoft Preferred Content AI Partner" 
                  className="h-[7.5rem] object-contain hidden dark:block"
                />
              </div>
              <div>
                <h4 className="font-semibold mb-3">Product</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#features" className="hover:text-foreground">Features</a></li>
                  <li><a href="#modules" className="hover:text-foreground">Modules</a></li>
                  <li><a href="#security" className="hover:text-foreground">Security</a></li>
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
                  <li><a href="https://www.synozur.com/terms" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Terms of Service</a></li>
                  <li><a href="https://www.synozur.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Security</a></li>
                </ul>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">© 2026 The Synozur Alliance LLC. All rights reserved.</p>
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
