import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, TrendingUp, Calendar, Building2, Sparkles } from "lucide-react";

const features = [
  {
    icon: Building2,
    title: "Foundations",
    description: "Define your mission, vision, and values with AI-powered guidance to build a solid organizational foundation.",
  },
  {
    icon: Target,
    title: "Strategy",
    description: "Create and manage strategies with intelligent drafting and collaborative planning tools.",
  },
  {
    icon: TrendingUp,
    title: "Planning",
    description: "Track OKRs, KPIs, and quarterly rocks with visual dashboards and Microsoft Planner integration.",
  },
  {
    icon: Calendar,
    title: "Focus Rhythm",
    description: "Organize weekly and monthly meetings with Outlook integration and AI-generated summaries.",
  },
  {
    icon: Sparkles,
    title: "AI Assistant",
    description: "Get contextual help and intelligent suggestions powered by advanced AI throughout your workflow.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 bg-background">
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-semibold mb-4">Powerful Modules for Modern Organizations</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-light">
            Everything you need to build, plan, and execute your company strategy in one integrated platform.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="hover-elevate" data-testid={`feature-card-${index}`}>
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
