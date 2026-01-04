import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, Star } from "lucide-react";
import { Link } from "wouter";
import starTrailsBg from "@assets/AdobeStock_362805421_1763398687511.jpeg";
import microsoftPartnerBadge from "@assets/MSFT-CAPP-PREFERRED-White_1766339770092.png";
import vegaLogo from "@assets/VegaTight_1766605018223.png";
import vegaScreenshot from "@assets/VegaSS_1767053840858.jpg";

export function LandingHero() {
  return (
    <>
      <section className="relative w-full flex items-center justify-center overflow-hidden py-16 lg:py-24 min-h-[90vh] lg:min-h-[85vh]">
        <style>{`
          .hero-bg { background-size: 200% auto; }
          @media (min-width: 768px) {
            .hero-bg { background-size: cover; }
          }
        `}</style>
        <div
          className="hero-bg absolute inset-0 bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${starTrailsBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-background" />
        
        <div className="relative z-10 w-full max-w-7xl 2xl:max-w-[1600px] mx-auto px-6 text-white">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Column - Content */}
            <div className="order-1">
              <div className="mb-6">
                <img src={vegaLogo} alt="Vega Company OS" className="h-40 lg:h-48 object-contain drop-shadow-2xl" />
              </div>
              
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <Badge variant="secondary" className="bg-white/25 text-white border-white/40 px-3 py-1 text-sm font-medium backdrop-blur-sm">
                  <Star className="h-3 w-3 mr-1.5 fill-current" />
                  Your North Star
                </Badge>
                <Badge variant="secondary" className="bg-primary text-white px-3 py-1 text-sm font-medium">
                  AI-Powered Company OS
                </Badge>
              </div>
              
              <p className="text-base lg:text-lg text-white mb-4 italic" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                In 18,000 years, Vega will be the North Star. Today, it's yours.
              </p>
              
              <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight mb-5" style={{ textShadow: '0 4px 16px rgba(0,0,0,0.9)' }}>
                <span className="text-white">
                  Turn Strategy Into Action,
                </span>
                <br />
                <span className="text-purple-400 md:bg-gradient-to-r md:from-purple-400 md:to-pink-400 md:bg-clip-text md:text-transparent">
                  Every Day.
                </span>
              </h1>
              
              <div className="bg-black/40 backdrop-blur-sm rounded-xl p-5 mb-5">
                <p className="text-lg lg:text-xl text-white mb-3 leading-relaxed">
                  Strategy isn't about big plans—it's about the choices and risks that position you to win.
                  Vega operationalizes your vision, connecting why to what to how to when.
                </p>
                
                <p className="text-base text-white/90">
                  Built on the{" "}
                  <a 
                    href="https://www.synozur.com/solutions/company-os" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-white font-semibold underline underline-offset-4 decoration-2 hover:text-white/80"
                  >
                    Company OS™
                  </a>{" "}
                  framework by Synozur—the AI-augmented operating system for organizations that want to move together, confidently.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3 mb-6">
                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-white text-sm font-medium">Viva Goals migration</span>
                </div>
                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-white text-sm font-medium">M365 Copilot Agent</span>
                </div>
                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-white text-sm font-medium">AI document analysis</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4 mb-3">
                <Link href="/login">
                  <Button
                    size="lg"
                    className="text-base px-8 shadow-xl"
                    data-testid="button-start-now"
                  >
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base px-8 bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 shadow-xl"
                  data-testid="button-learn-more"
                  onClick={() => document.getElementById('what-we-believe')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  See What We Believe
                </Button>
              </div>
              <p className="text-sm text-white/70 mb-6">
                60-day trial. No credit card required. No risk.
              </p>
              
              <div className="flex items-center gap-4">
                <img 
                  src={microsoftPartnerBadge} 
                  alt="Microsoft Preferred Content AI Partner" 
                  className="h-28 lg:h-32 object-contain drop-shadow-lg"
                />
              </div>
            </div>
            
            {/* Right Column - Screenshot */}
            <div className="order-2 hidden lg:block">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-2xl blur-2xl" />
                <div className="relative rounded-xl overflow-hidden shadow-2xl border border-white/20 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                  <img 
                    src={vegaScreenshot} 
                    alt="Vega OKR Planning - OKR Hierarchy and Progress Tracking" 
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Mobile-only screenshot section */}
      <section className="relative bg-background py-12 px-6 lg:hidden">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold mb-2">See Vega in Action</h2>
            <p className="text-sm text-muted-foreground">Hierarchical OKRs, Big Rocks, and Progress Tracking</p>
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
    </>
  );
}
