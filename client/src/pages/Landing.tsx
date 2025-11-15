import { LandingHero } from "@/components/LandingHero";
import { FeaturesSection } from "@/components/FeaturesSection";
import { M365IntegrationSection } from "@/components/M365IntegrationSection";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SynozurLogo } from "@/components/SynozurLogo";

export default function Landing() {
  return (
    <div className="min-h-screen">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SynozurLogo variant="mark" className="h-8 w-8" />
            <span className="font-bold text-xl">Vega</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/dashboard">
              <Button variant="ghost" data-testid="button-nav-login">
                Login
              </Button>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="pt-16">
        <LandingHero />
        <FeaturesSection />
        <M365IntegrationSection />

        <section className="py-20 bg-primary text-primary-foreground">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Organization?</h2>
            <p className="text-xl mb-8 opacity-90">
              Join leading companies using Vega to align strategy and execution
            </p>
            <Button size="lg" variant="secondary" className="text-base px-8" data-testid="button-cta-bottom">
              Get Started Today
            </Button>
          </div>
        </section>

        <footer className="py-12 bg-background border-t">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <SynozurLogo variant="mark" className="h-8 w-8" />
                  <span className="font-bold text-lg">Vega</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Powered by The Synozur Alliance LLC
                </p>
                <a 
                  href="https://www.synozur.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline mt-1 inline-block"
                >
                  www.synozur.com
                </a>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Product</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#" className="hover:text-foreground">Features</a></li>
                  <li><a href="#" className="hover:text-foreground">Integrations</a></li>
                  <li><a href="#" className="hover:text-foreground">Pricing</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Company</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="https://www.synozur.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">About</a></li>
                  <li><a href="https://www.synozur.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Synozur.com</a></li>
                  <li><a href="https://www.synozur.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Contact</a></li>
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
            <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
              © 2025 The Synozur Alliance LLC. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
