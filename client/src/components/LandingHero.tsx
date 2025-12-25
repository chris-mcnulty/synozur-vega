import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, Star } from "lucide-react";
import { Link } from "wouter";
import starTrailsBg from "@assets/AdobeStock_362805421_1763398687511.jpeg";
import microsoftPartnerBadge from "@assets/MSFT-CAPP-PREFERRED-White_1766339770092.png";
import vegaLogo from "@assets/VegaTight_1766605018223.png";

export function LandingHero() {
  return (
    <section className="relative min-h-screen w-full flex items-center justify-center overflow-hidden py-20">
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: `url(${starTrailsBg})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/50 via-purple-900/40 to-background/90" />
      
      <div className="relative z-10 max-w-7xl 2xl:max-w-[1600px] mx-auto px-6 text-white">
        <div className="max-w-4xl">
          <div className="mb-8">
            <img src={vegaLogo} alt="Vega Company OS" className="h-56 object-contain drop-shadow-xl" />
          </div>
          
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 px-4 py-1.5 text-sm">
              <Star className="h-3 w-3 mr-1.5 fill-current" />
              Your North Star
            </Badge>
            <Badge variant="secondary" className="bg-primary/80 text-white px-4 py-1.5 text-sm">
              AI-Powered Company OS
            </Badge>
          </div>
          
          <p className="text-lg md:text-xl text-white/90 mb-6 italic drop-shadow-md">
            In 18,000 years, Vega will be the North Star. Today, it's yours.
          </p>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            <span className="text-white drop-shadow-lg">
              Turn Strategy Into Action,
            </span>
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-xl">
              Every Day.
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-white/90 mb-4 leading-relaxed max-w-3xl drop-shadow-md">
            Strategy isn't about big plans—it's about the choices and risks that position you to win.
            Vega operationalizes your vision, connecting why to what to how to when.
          </p>
          
          <p className="text-lg text-white/90 mb-8 max-w-3xl drop-shadow-md">
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
          
          <div className="flex flex-wrap gap-3 mb-10">
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span>Viva Goals migration in minutes</span>
            </div>
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span>Native M365 Copilot Agent</span>
            </div>
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span>AI document-to-Company OS</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 mb-4">
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
          <p className="text-sm text-white/70 mb-8">
            60-day trial. No credit card required. No risk.
          </p>
          
          <div className="flex items-center gap-4">
            <img 
              src={microsoftPartnerBadge} 
              alt="Microsoft Preferred Content AI Partner" 
              className="h-36 md:h-40 object-contain drop-shadow-lg"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
