import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "wouter";
import starTrailsBg from "@assets/AdobeStock_362805421_1763398687511.jpeg";

export function LandingHero() {
  return (
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: `url(${starTrailsBg})` }}
      />
      {/* Purple gradient overlay matching Vega branding */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-purple-900/30 to-background/80" />
      
      <div className="relative z-10 max-w-7xl 2xl:max-w-[1600px] mx-auto px-6 text-white">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium tracking-wide uppercase">AI-Powered Company OS</span>
          </div>
          <h1 className="text-7xl md:text-8xl font-bold leading-normal mb-8 pb-2 bg-gradient-to-r from-primary via-purple-400 to-secondary bg-clip-text text-transparent">
            Vega
          </h1>
          <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-6 bg-gradient-to-r from-white via-purple-200 to-primary bg-clip-text text-transparent">
            Your AI-Augmented Company OS
          </h2>
          <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed">
            Transform your organization with intelligent foundations, strategic planning, 
            and seamless M365 integration—all in one powerful platform.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/login">
              <Button
                size="lg"
                className="text-base px-8 shadow-xl"
                data-testid="button-start-now"
              >
                Start Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="text-base px-8 bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 shadow-xl"
              data-testid="button-learn-more"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Learn More
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
