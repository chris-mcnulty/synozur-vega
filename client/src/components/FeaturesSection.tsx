import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Target, 
  TrendingUp, 
  Calendar, 
  Building2, 
  Sparkles, 
  Rocket,
  BarChart3,
  FileText
} from "lucide-react";

const features = [
  {
    icon: Rocket,
    title: "Launchpad",
    description: "Upload any strategic document and let AI build your entire Company OS in minutes. PDF, Word, or text—Vega extracts mission, vision, values, goals, strategies, and OKRs automatically.",
    badge: "AI-Powered",
    badgeVariant: "default" as const,
  },
  {
    icon: Building2,
    title: "Foundations",
    description: "Define your mission, vision, and values with AI-powered suggestions. Track values alignment across all strategic initiatives and goals.",
    badge: null,
    badgeVariant: "secondary" as const,
  },
  {
    icon: Target,
    title: "Strategy",
    description: "Create and manage strategies linked to annual goals. AI drafting assistance and values alignment scoring help ensure strategic coherence.",
    badge: null,
    badgeVariant: "secondary" as const,
  },
  {
    icon: TrendingUp,
    title: "Planning",
    description: "Hierarchical OKRs with Key Results, Big Rocks, and weighted scoring. Bidirectional Microsoft Planner sync keeps tasks aligned with objectives.",
    badge: "M365 Integrated",
    badgeVariant: "outline" as const,
  },
  {
    icon: Calendar,
    title: "Focus Rhythm",
    description: "Meeting templates for weekly check-ins, monthly reviews, and quarterly planning. Outlook Calendar sync, auto-generated agendas, and decision/risk tracking.",
    badge: "M365 Integrated",
    badgeVariant: "outline" as const,
  },
  {
    icon: BarChart3,
    title: "Reporting",
    description: "Snapshot comparisons to track progress over time. Export to PDF or PowerPoint for board presentations. Visual dashboards for real-time insights.",
    badge: "New",
    badgeVariant: "default" as const,
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-background">
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-6">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">Complete Platform</Badge>
          <h2 className="text-4xl font-semibold mb-4">From Vision to Execution</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Six integrated modules that connect your organizational foundations 
            to daily execution—all enhanced with AI and M365 integration.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="hover-elevate relative" data-testid={`feature-card-${index}`}>
              {feature.badge && (
                <Badge 
                  variant={feature.badgeVariant} 
                  className="absolute top-4 right-4 text-xs"
                >
                  {feature.badge}
                </Badge>
              )}
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
        
        <div className="mt-16 text-center">
          <Card className="inline-block p-6 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-4">
              <Sparkles className="h-8 w-8 text-primary" />
              <div className="text-left">
                <h3 className="font-semibold text-lg">AI Assistant Throughout</h3>
                <p className="text-muted-foreground">
                  Get contextual help, intelligent suggestions, and natural language queries across every module.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
