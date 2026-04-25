import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, CheckCircle2, Clock, Sparkles, Target, Users, BarChart3,
  Puzzle, Database, Shield, Calendar, Bot, Ticket, Briefcase, Layers,
  FileText, ListChecks, ClipboardList, SlidersHorizontal,
  Wand2, Navigation, UserSearch, LayoutDashboard
} from "lucide-react";
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
        title: "OKR Intelligence & Pace Tracking",
        description: "On-track/ahead/behind indicators, velocity projections, behind-pace alerts, and risk signals on dashboards",
        status: "completed",
        icon: BarChart3
      },
      {
        title: "Executive & Team Dashboards",
        description: "Advanced analytics with velocity projections, weekly execution focus, and quarterly period filtering",
        status: "completed",
        icon: Target
      },
      {
        title: "Microsoft 365 Integration",
        description: "Entra ID SSO, Outlook Calendar, SharePoint/OneDrive, and Microsoft Planner with bidirectional task sync",
        status: "completed",
        icon: Puzzle
      },
      {
        title: "Big Rock Tasks & Planner Sync",
        description: "Task management for Big Rocks with status flow, assignee resolution, and Constellation-style Planner synchronization",
        status: "completed",
        icon: ListChecks
      },
      {
        title: "Ambitions Module",
        description: "3-5 year strategic targets linking vision to annual goals with AI suggestions and status tracking",
        status: "completed",
        icon: Layers
      },
      {
        title: "Help Chatbot & Support Tickets",
        description: "AI-powered help assistant grounded on documentation, with escalation to a full support ticket system",
        status: "completed",
        icon: Bot
      },
      {
        title: "OKR Period Close-Out & Cloning",
        description: "Gracefully close or continue OKRs across periods with mandatory notes and cloning options",
        status: "completed",
        icon: CheckCircle2
      },
      {
        title: "AI-Powered Tools",
        description: "OKR drafting, check-in note rewriting, parent objective summary drafting, and AI usage tracking",
        status: "completed",
        icon: Sparkles
      },
      {
        title: "RBAC & Multi-Tenancy",
        description: "6-role permission system with fine-grained OKR permissions, multi-tenant data isolation, and team management",
        status: "completed",
        icon: Shield
      },
      {
        title: "Focus Rhythm & Meetings",
        description: "Meeting management with OKR linking, decisions/risks tracking, and meeting templates",
        status: "completed",
        icon: Calendar
      },
      {
        title: "Job Scheduler Dashboard",
        description: "Central service for background jobs with logging, pause/resume, and failure notifications",
        status: "completed",
        icon: ClipboardList
      },
      {
        title: "Reporting & Export",
        description: "PDF and PPTX export with AI period summaries, dynamic date selectors, and import/export capabilities",
        status: "completed",
        icon: FileText
      },
      {
        title: "M365 Copilot Agent",
        description: "Natural language interaction with Vega through Microsoft 365 Copilot and Copilot Studio using Entra JWT authentication and REST-based tool actions",
        status: "completed",
        icon: Sparkles
      },
      {
        title: "Unified Time Period Selector",
        description: "Global quarter/year picker in the header with persistent selection, multi-period support, and quick shortcuts — synced consistently across all modules",
        status: "completed",
        icon: SlidersHorizontal
      },
      {
        title: "OKR Creation Wizard",
        description: "Multi-step wizard (Objective → Key Results → Big Rocks → Review) with tenant-scoped draft auto-save and resume — build a complete OKR hierarchy in one session",
        status: "completed",
        icon: Wand2
      },
      {
        title: "Contextual Breadcrumbs",
        description: "Route-aware breadcrumb trail below the header with type icons, smart truncation for long paths, and quick-action menus on section-root segments",
        status: "completed",
        icon: Navigation
      },
      {
        title: "User Lookup for Item Assignment",
        description: "Searchable user picker with avatar initials, recent selections, and manual email fallback — tenant-scoped for secure assignment",
        status: "completed",
        icon: UserSearch
      },
      {
        title: "Aurora UX Parity & Visual Polish",
        description: "Global rounded corners on all UI primitives, deep navy-purple dark mode palette with clear elevation hierarchy, purple-tinted shadows, and active sidebar gradient fill — aligned with Constellation brand standard",
        status: "completed",
        icon: Sparkles
      },
      {
        title: "Predictive Analytics (Completion Forecast)",
        description: "Velocity-based OKR completion forecasting with confidence bands (low/mid/high), trend detection (accelerating/steady/decelerating), risk flagging, and probability distribution visualization on the Executive Dashboard",
        status: "completed",
        icon: BarChart3
      },
      {
        title: "Support Ticket Staff Enhancements",
        description: "Staff assignment dropdown with avatar display, bidirectional reply email notifications, Pending compound filter (open + in_progress), My Assigned stat card and filter, and category-to-priority auto-defaults on new tickets",
        status: "completed",
        icon: Ticket
      }
    ]
  },
  {
    name: "In Progress",
    timeframe: "Q2 2026",
    items: [
      {
        title: "Excel Data Binding",
        description: "Link Key Results directly to Excel cells for automatic progress updates via Microsoft Graph",
        status: "in_progress",
        progress: 40,
        icon: Puzzle
      },
      {
        title: "Support Ticket Week 2",
        description: "Status history timeline, SLA response-time badges, bulk status change, resolution templates, and admin full-text search — building on the completed Week 1 staff enhancements",
        status: "in_progress",
        progress: 0,
        icon: Ticket
      }
    ]
  },
  {
    name: "Committed Next",
    timeframe: "Q2 2026",
    items: [
      {
        title: "Executive Dashboard Personalization",
        description: "Saved widget layout, pinned metrics, and configurable dashboard sections so each executive sees the data most relevant to them",
        status: "planned",
        icon: LayoutDashboard
      },
      {
        title: "Copilot Agent Write Actions",
        description: "Extend the M365 Copilot Agent with write capabilities — update key result progress, add check-in notes, and change big rock status directly from natural language conversation",
        status: "planned",
        icon: Bot
      },
      {
        title: "Meeting Prep AI",
        description: "Auto-generate meeting preparation summaries by analyzing linked OKRs before Focus Rhythm meetings",
        status: "planned",
        icon: Briefcase
      },
      {
        title: "Premium Feature Gating",
        description: "Feature entitlement system to gate premium features by service plan tier",
        status: "planned",
        icon: Shield
      }
    ]
  }
];

const statusConfig = {
  completed: { label: "Completed", variant: "default" as const, className: "bg-green-600" },
  in_progress: { label: "In Progress", variant: "secondary" as const, className: "" },
  planned: { label: "Committed", variant: "outline" as const, className: "" }
};

export default function Roadmap() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/about">
          <Button variant="ghost" size="sm" data-testid="button-back-about">
            <ArrowLeft className="h-4 w-4 mr-1" />
            About
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold" data-testid="text-roadmap-title">Product Roadmap</h1>
          <p className="text-muted-foreground text-sm">What we've built and what we're committed to delivering next</p>
        </div>
        <Link href="/backlog">
          <Button variant="outline" size="sm" data-testid="button-view-backlog">
            <Ticket className="h-4 w-4 mr-1" />
            View Backlog
          </Button>
        </Link>
      </div>

      <div className="space-y-8">
        {roadmap.map((phase, phaseIdx) => (
          <div key={phaseIdx} className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
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
                  <Card key={itemIdx} className="hover-elevate" data-testid={`card-roadmap-item-${phaseIdx}-${itemIdx}`}>
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
                We'd love to hear your ideas. Feature requests are tracked in our backlog.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('mailto:Vega@synozur.com?subject=Feature Request', '_blank')}
                data-testid="button-feature-request"
              >
                Submit a Request
              </Button>
              <Link href="/backlog">
                <Button variant="ghost" size="sm" data-testid="button-browse-backlog">
                  Browse Backlog
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
