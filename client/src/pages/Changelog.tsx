import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Wrench, Bug, Zap, Shield } from "lucide-react";
import { Link } from "wouter";

interface ChangelogEntry {
  date: string;
  items: {
    category: "feature" | "improvement" | "bugfix" | "performance" | "security";
    title: string;
    description?: string;
  }[];
}

const changelog: ChangelogEntry[] = [
  {
    date: "January 11, 2026",
    items: [
      {
        category: "improvement",
        title: "Privacy & Terms links on login",
        description: "Added links to privacy policy and terms of service on the login page"
      },
      {
        category: "improvement",
        title: "Social sharing preview",
        description: "Updated social sharing image with proper Vega branding"
      },
      {
        category: "performance",
        title: "Database performance indexes",
        description: "Added indexes for faster loading of OKRs, check-ins, and meetings"
      }
    ]
  },
  {
    date: "January 10, 2026",
    items: [
      {
        category: "feature",
        title: "AI Check-in Rewrite",
        description: "Use AI to improve your check-in notes with multiple modes: full rewrite, improve clarity, or make concise"
      },
      {
        category: "feature",
        title: "Delete Check-in",
        description: "You can now delete check-ins you've created. When deleted, progress reverts to the previous check-in's values"
      },
      {
        category: "improvement",
        title: "Excel auto-sync check-ins",
        description: "Excel auto-sync now creates proper check-in records with sync notes"
      },
      {
        category: "improvement",
        title: "AI pace awareness",
        description: "AI-powered check-in rewrite now considers your pace against the period timeline"
      }
    ]
  },
  {
    date: "January 9, 2026",
    items: [
      {
        category: "feature",
        title: "Executive Dashboard Personalization",
        description: "Customize which sections appear on your executive dashboard"
      },
      {
        category: "feature",
        title: "OKR Intelligence Phase 1",
        description: "Pace badges show whether you're on track, ahead, or behind schedule"
      },
      {
        category: "improvement",
        title: "Behind Pace alerts",
        description: "Executive Dashboard now shows Behind Pace alerts with severity sorting"
      }
    ]
  },
  {
    date: "December 31, 2025",
    items: [
      {
        category: "feature",
        title: "OKR Period Close-Out",
        description: "When checking in on past period items, choose to continue in a new period or close with notes"
      },
      {
        category: "feature",
        title: "OKR Cloning",
        description: "Clone objectives with various scope options and target quarter/year selection"
      }
    ]
  },
  {
    date: "December 15, 2025",
    items: [
      {
        category: "feature",
        title: "Public Beta Launch",
        description: "Company OS capabilities: OKR management, Strategy tools, Focus Rhythm, Microsoft 365 integration, AI-powered features, and multi-tenancy"
      }
    ]
  }
];

const categoryConfig = {
  feature: { icon: Sparkles, label: "New Feature", variant: "default" as const },
  improvement: { icon: Wrench, label: "Improvement", variant: "secondary" as const },
  bugfix: { icon: Bug, label: "Bug Fix", variant: "outline" as const },
  performance: { icon: Zap, label: "Performance", variant: "outline" as const },
  security: { icon: Shield, label: "Security", variant: "destructive" as const }
};

export default function Changelog() {
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
          <h1 className="text-2xl font-bold">Changelog</h1>
          <p className="text-muted-foreground text-sm">What's new in Vega</p>
        </div>
      </div>

      <div className="space-y-6">
        {changelog.map((entry, idx) => (
          <Card key={idx}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{entry.date}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {entry.items.map((item, itemIdx) => {
                const config = categoryConfig[item.category];
                const Icon = config.icon;
                return (
                  <div key={itemIdx} className="flex gap-3">
                    <Badge variant={config.variant} className="h-fit shrink-0">
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      {item.description && (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground">
          Have feedback? Contact us at{" "}
          <a href="mailto:Vega@synozur.com" className="text-primary hover:underline">
            Vega@synozur.com
          </a>
        </p>
      </div>
    </div>
  );
}
