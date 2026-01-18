import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle2, Clock, Sparkles, Target, Users, BarChart3, Puzzle, Database } from "lucide-react";
import { Link } from "wouter";

interface RoadmapItem {
  title: string;
  description: string;
  status: "completed" | "in_progress" | "planned";
  progress?: number;
  icon: typeof CheckCircle2;
}

interface RoadmapPhase {
  name: string;
  timeframe: string;
  items: RoadmapItem[];
}

const roadmap: RoadmapPhase[] = [
  {
    name: "Recently Completed",
    timeframe: "Q4 2025 - Q1 2026",
    items: [
      {
        title: "OKR Intelligence",
        description: "Pace tracking with on-track/ahead/behind indicators and velocity projections",
        status: "completed",
        icon: BarChart3
      },
      {
        title: "Executive Dashboard Personalization",
        description: "Customize which sections and metrics appear on your executive dashboard",
        status: "completed",
        icon: Target
      },
      {
        title: "OKR Period Close-Out",
        description: "Gracefully close or continue OKRs across periods with proper documentation",
        status: "completed",
        icon: CheckCircle2
      },
      {
        title: "Team Mode",
        description: "Simplified team-focused views with filtered OKRs and quick check-ins",
        status: "completed",
        icon: Users
      }
    ]
  },
  {
    name: "In Progress",
    timeframe: "Q1 2026",
    items: [
      {
        title: "M365 Copilot Agent",
        description: "Natural language interaction with Vega through Microsoft 365 Copilot",
        status: "in_progress",
        progress: 60,
        icon: Sparkles
      },
      {
        title: "Excel Data Binding",
        description: "Link Key Results directly to Excel cells for automatic progress updates",
        status: "in_progress",
        progress: 40,
        icon: Puzzle
      }
    ]
  },
  {
    name: "Coming Soon",
    timeframe: "Q2 2026",
    items: [
      {
        title: "Strategy Cascade Visualization",
        description: "Visual hierarchy showing how strategies flow down to objectives and actions",
        status: "planned",
        icon: Target
      },
      {
        title: "OKR Health Scoring",
        description: "AI-powered health assessments with predictive risk indicators",
        status: "planned",
        icon: BarChart3
      },
      {
        title: "Cross-Team Dependencies",
        description: "Track and visualize dependencies between team objectives",
        status: "planned",
        icon: Users
      },
      {
        title: "Power BI Data Pull",
        description: "Link Key Results to Power BI measures for automatic progress updates from your BI dashboards",
        status: "planned",
        icon: Database
      }
    ]
  }
];

const statusConfig = {
  completed: { label: "Completed", variant: "default" as const, className: "bg-green-600" },
  in_progress: { label: "In Progress", variant: "secondary" as const, className: "" },
  planned: { label: "Planned", variant: "outline" as const, className: "" }
};

export default function Roadmap() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/about">
          <Button variant="ghost" size="sm" data-testid="button-back-about">
            <ArrowLeft className="h-4 w-4 mr-1" />
            About
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Product Roadmap</h1>
          <p className="text-muted-foreground text-sm">What we're building next</p>
        </div>
      </div>

      <div className="space-y-8">
        {roadmap.map((phase, phaseIdx) => (
          <div key={phaseIdx} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{phase.name}</h2>
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {phase.timeframe}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {phase.items.map((item, itemIdx) => {
                const Icon = item.icon;
                const config = statusConfig[item.status];
                return (
                  <Card key={itemIdx} className="hover-elevate">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-md bg-primary/10">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <CardTitle className="text-base">{item.title}</CardTitle>
                        </div>
                        <Badge variant={config.variant} className={config.className}>
                          {config.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm">
                        {item.description}
                      </CardDescription>
                      {item.status === "in_progress" && item.progress !== undefined && (
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progress</span>
                            <span>{item.progress}%</span>
                          </div>
                          <Progress value={item.progress} className="h-1.5" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-6">
          <div className="text-center space-y-3">
            <Sparkles className="h-8 w-8 text-primary mx-auto" />
            <div>
              <h3 className="font-semibold">Have a feature request?</h3>
              <p className="text-sm text-muted-foreground">
                We'd love to hear your ideas for making Vega even better.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('mailto:Vega@synozur.com?subject=Feature Request', '_blank')}
              data-testid="button-feature-request"
            >
              Submit a Request
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
