import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import heroImage from "@assets/generated_images/Professional_workspace_hero_image_bcc74495.png";

export function LandingHero() {
  return (
    <section className="relative h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-6 text-white">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium tracking-wide uppercase">AI-Powered Company OS</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
            Your AI-Augmented Company OS
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed">
            Transform your organization with intelligent foundations, strategic planning, 
            and seamless M365 integration—all in one powerful platform.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button
              size="lg"
              className="text-base px-8"
              data-testid="button-start-now"
            >
              Start Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base px-8 bg-background/10 backdrop-blur-sm border-white/30 text-white hover:bg-background/20"
              data-testid="button-learn-more"
            >
              Learn More
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
