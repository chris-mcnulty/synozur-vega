import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Compass, Target, Brain, Shield } from "lucide-react";

const pillars = [
  {
    icon: Compass,
    title: "Clarity & Alignment",
    description: "A Company OS Dashboard plus Foundations and Strategy modules that unify long-term goals and values with quarterly focus. Everyone sees the same North Star.",
    highlight: "Unify choices around what matters most",
  },
  {
    icon: Target,
    title: "Execution & Cadence",
    description: "Planning and Focus Rhythm create the heartbeat of your organization—weekly priorities, check-ins, and progress tracking that make outcomes inevitable.",
    highlight: "Weekly rhythm that makes progress inevitable",
  },
  {
    icon: Brain,
    title: "Intelligence with Empathy",
    description: "AI guidance grounded in your context and Synozur's transformation frameworks—supporting smarter choices while honoring human judgment.",
    highlight: "AI that supports decisions, not replaces them",
  },
  {
    icon: Shield,
    title: "Enterprise-grade Trust",
    description: "Modern open stack with secure identity (Microsoft Entra SSO) and compliance designed to scale with your organization.",
    highlight: "Security and scale for serious organizations",
  },
];

export function WhatWeBelieveSection() {
  return (
    <section id="what-we-believe" className="py-20 bg-background">
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-6">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">Our Philosophy</Badge>
          <h2 className="text-4xl font-semibold mb-6">What We Believe</h2>
          <div className="max-w-3xl mx-auto space-y-4">
            <p className="text-xl text-muted-foreground leading-relaxed">
              Strategy only matters when it's lived daily. Leaders need a single, human-centered way 
              to align purpose, priorities, and performance—so teams move together, confidently, 
              toward outcomes that matter.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Vega exists to create that rhythm: a unified operating system that keeps strategy on track, 
              teams in sync, and progress visible at every step.
            </p>
          </div>
        </div>
        
        <div className="mb-12 text-center">
          <h3 className="text-2xl font-semibold mb-2">Our Promise</h3>
          <p className="text-xl text-primary font-medium">
            Turn strategy into action, every day.
          </p>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            We operationalize your vision—connecting why (mission, values) to what (priorities), 
            how (OKRs, initiatives), and when (meetings, check-ins)—with embedded AI that 
            augments decision-making without sidelining human judgment.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pillars.map((pillar, index) => (
            <Card key={index} className="hover-elevate" data-testid={`pillar-card-${index}`}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <pillar.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold mb-2">{pillar.title}</h4>
                    <p className="text-sm text-primary font-medium mb-2">{pillar.highlight}</p>
                    <p className="text-muted-foreground">{pillar.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
