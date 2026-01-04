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
      <section className="relative w-full flex items-center justify-center overflow-hidden py-8 md:py-16 pb-12 md:pb-20">
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
        
        <div className="relative z-10 w-full max-w-5xl 2xl:max-w-6xl mx-auto px-4 md:px-6 text-white">
          {/* Centered content container */}
          <div className="max-w-4xl 2xl:max-w-5xl mx-auto text-center">
            <div className="mb-4 md:mb-8 flex justify-center">
              <img src={vegaLogo} alt="Vega Company OS" className="h-32 md:h-56 object-contain drop-shadow-2xl" />
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 mb-4 md:mb-6">
              <Badge variant="secondary" className="bg-white/25 text-white border-white/40 px-3 md:px-4 py-1 md:py-1.5 text-xs md:text-sm font-medium backdrop-blur-sm">
                <Star className="h-3 w-3 mr-1.5 fill-current" />
                Your North Star
              </Badge>
              <Badge variant="secondary" className="bg-primary text-white px-3 md:px-4 py-1 md:py-1.5 text-xs md:text-sm font-medium">
                AI-Powered Company OS
              </Badge>
            </div>
            
            <p className="text-base md:text-xl text-white mb-3 md:mb-6 italic" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
              In 18,000 years, Vega will be the North Star. Today, it's yours.
            </p>
            
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4 md:mb-6" style={{ textShadow: '0 4px 16px rgba(0,0,0,0.9)' }}>
              <span className="text-white">
                Turn Strategy Into Action,
              </span>
              <br />
              <span className="text-purple-400 md:bg-gradient-to-r md:from-purple-400 md:to-pink-400 md:bg-clip-text md:text-transparent">
                Every Day.
              </span>
            </h1>
            
            <div className="bg-black/40 backdrop-blur-sm rounded-xl p-4 md:p-6 mb-4 md:mb-6 max-w-3xl mx-auto">
              <p className="text-base md:text-2xl text-white mb-3 md:mb-4 leading-relaxed">
                Strategy isn't about big plans—it's about the choices and risks that position you to win.
                Vega operationalizes your vision, connecting why to what to how to when.
              </p>
              
              <p className="text-sm md:text-lg text-white/90">
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
            
            <div className="flex flex-wrap justify-center gap-2 md:gap-4 mb-5 md:mb-8">
              <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-3 md:px-4 py-1.5 md:py-2">
                <CheckCircle2 className="h-3 md:h-4 w-3 md:w-4 text-green-400" />
                <span className="text-white text-xs md:text-sm font-medium">Viva Goals migration</span>
              </div>
              <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-3 md:px-4 py-1.5 md:py-2">
                <CheckCircle2 className="h-3 md:h-4 w-3 md:w-4 text-green-400" />
                <span className="text-white text-xs md:text-sm font-medium">M365 Copilot Agent</span>
              </div>
              <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-3 md:px-4 py-1.5 md:py-2">
                <CheckCircle2 className="h-3 md:h-4 w-3 md:w-4 text-green-400" />
                <span className="text-white text-xs md:text-sm font-medium">AI document analysis</span>
              </div>
            </div>
            
            <div className="flex flex-wrap justify-center gap-4 mb-2 md:mb-4">
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
                className="hidden md:inline-flex text-base px-8 bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 shadow-xl"
                data-testid="button-learn-more"
                onClick={() => document.getElementById('what-we-believe')?.scrollIntoView({ behavior: 'smooth' })}
              >
                See What We Believe
              </Button>
            </div>
            <p className="text-xs md:text-sm text-white/70 mb-0 md:mb-8">
              60-day trial. No credit card required. No risk.
            </p>
            
            {/* Microsoft badge - desktop only, moved to footer on mobile */}
            <div className="hidden md:flex items-center justify-center gap-4 mt-6">
              <img 
                src={microsoftPartnerBadge} 
                alt="Microsoft Preferred Content AI Partner" 
                className="h-36 md:h-40 object-contain drop-shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>
      
      <section className="relative bg-background py-8 md:py-16 px-4 md:px-6">
        <div className="max-w-6xl 2xl:max-w-7xl mx-auto">
          <div className="text-center mb-4 md:mb-8">
            <h2 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">See Vega in Action</h2>
            <p className="text-sm md:text-base text-muted-foreground">Hierarchical OKRs, Big Rocks, and Progress Tracking</p>
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
