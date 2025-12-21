import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import starTrailsBg from "@assets/AdobeStock_362805421_1763398687511.jpeg";
import microsoftPartnerBadge from "@assets/MicrosoftCAPPPreferredTrans_1766339770091.png";

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
          <div className="flex flex-wrap items-center gap-4 mb-8">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 px-4 py-1.5 text-sm">
              Viva Goals Alternative
            </Badge>
            <Badge variant="secondary" className="bg-primary/80 text-white px-4 py-1.5 text-sm">
              AI-Powered
            </Badge>
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
            <span className="bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">
              The OKR Platform
            </span>
            <br />
            <span className="bg-gradient-to-r from-primary via-purple-400 to-secondary bg-clip-text text-transparent">
              Microsoft Should Have Built
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed max-w-3xl">
            Vega picks up where Viva Goals left off—with AI-powered strategic planning, 
            seamless M365 integration, and the flexibility modern organizations demand.
          </p>
          
          <div className="flex flex-wrap gap-3 mb-10">
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span>Migrate from Viva Goals in minutes</span>
            </div>
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span>Native M365 Copilot Agent</span>
            </div>
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span>AI document-to-OKR generator</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 mb-12">
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
              onClick={() => document.getElementById('why-vega')?.scrollIntoView({ behavior: 'smooth' })}
            >
              See How We Compare
            </Button>
          </div>
          
          <div className="flex items-center gap-6">
            <img 
              src={microsoftPartnerBadge} 
              alt="Microsoft Preferred Content AI Partner" 
              className="h-12 md:h-16 object-contain"
            />
            <div className="text-white/70 text-sm">
              <span className="block font-medium text-white/90">Microsoft Preferred Partner</span>
              Content AI Solutions
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
