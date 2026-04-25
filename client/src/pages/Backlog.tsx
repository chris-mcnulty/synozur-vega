import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Sparkles, Target, Users, BarChart3, Database, Shield,
  Bot, Puzzle, Layers, Palette, Briefcase, Lightbulb, Clock,
  BookOpen, Wrench, Map, Eye, Bug, Keyboard, LayoutDashboard, FileText,
  Workflow, CheckCircle2, AlertTriangle, GitBranch, GraduationCap,
  Network, Brain, Gauge, Search, ListChecks, MessageSquare, Zap
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

type Status = "completed" | "in_progress" | "proposed" | "future";
type Category = "ai" | "integration" | "ux" | "analytics" | "platform" | "business" | "design" | "bug" | "technical";

interface BacklogItem {
  title: string;
  description: string;
  status: Status;
  category: Category;
  effort?: string;
  priority?: string;
  icon: typeof Sparkles;
}

const backlogItems: BacklogItem[] = [
  {
    title: "RBAC Enforcement",
    description: "6-role permission system with fine-grained OKR permissions, ownership checks, and frontend permission-aware UI",
    status: "completed",
    category: "platform",
    icon: Shield
  },
  {
    title: "Microsoft 365 Multi-Tenant Integration",
    description: "Entra ID SSO, Outlook Calendar, SharePoint/OneDrive, Microsoft Planner with bidirectional task sync and independent OAuth",
    status: "completed",
    category: "integration",
    icon: Puzzle
  },
  {
    title: "OKR Intelligence & Pace Tracking",
    description: "On-track/ahead/behind indicators, velocity projections, behind-pace alerts, risk signals, and stale item detection",
    status: "completed",
    category: "analytics",
    icon: BarChart3
  },
  {
    title: "Big Rock Tasks & Planner Sync",
    description: "Task management for Big Rocks with status flow, assignee resolution, and Constellation-style Planner synchronization",
    status: "completed",
    category: "integration",
    icon: ListChecks
  },
  {
    title: "Help Chatbot & Support Ticket System",
    description: "AI-powered help assistant grounded on user guide documentation, with escalation to full support ticketing system",
    status: "completed",
    category: "ai",
    icon: Bot
  },
  {
    title: "Support Ticket Staff Enhancements",
    description: "Staff assignment dropdown with avatar display in ticket list, bidirectional reply email notifications, Pending compound filter, My Assigned stat card, and category-to-priority auto-defaults on new ticket form",
    status: "completed",
    category: "platform",
    icon: MessageSquare
  },
  {
    title: "Support Ticket Week 2",
    description: "Status history timeline, SLA response-time badges (time since creation / last staff reply / last user reply), bulk status change, resolution templates, and admin full-text search",
    status: "in_progress",
    category: "platform",
    effort: "1 week",
    priority: "Medium",
    icon: MessageSquare
  },
  {
    title: "Aurora UX Parity & Visual Polish",
    description: "Global rounded corners on all UI primitives, deep navy-purple dark mode palette with elevation hierarchy, purple-tinted shadows, and active sidebar gradient fill — aligned with Constellation brand standard",
    status: "completed",
    category: "design",
    icon: Palette
  },
  {
    title: "AI Check-in Note Rewriter",
    description: "AI-powered feature to rewrite check-in notes with professional tone, context awareness, and multiple rewrite modes",
    status: "completed",
    category: "ai",
    icon: Sparkles
  },
  {
    title: "Key Result Weighting",
    description: "Weight-based KR contribution with auto-balance, normalize, lock features, and weighted progress rollup",
    status: "completed",
    category: "analytics",
    icon: Gauge
  },
  {
    title: "Organized Navigation",
    description: "Collapsible sidebar sections with role-based visibility, smart auto-expand, and persistent state",
    status: "completed",
    category: "ux",
    icon: LayoutDashboard
  },
  {
    title: "OKR Period Close-Out & Cloning",
    description: "Close or continue OKRs across periods with mandatory notes, Pacific Time detection, and clone options",
    status: "completed",
    category: "platform",
    icon: CheckCircle2
  },
  {
    title: "Ambitions Module",
    description: "3-5 year strategic targets linking vision to annual goals with AI suggestions and status tracking",
    status: "completed",
    category: "platform",
    icon: Target
  },
  {
    title: "Reporting & Export",
    description: "PDF and PPTX export with AI period summaries, dynamic date selectors, and data import/export",
    status: "completed",
    category: "platform",
    icon: FileText
  },
  {
    title: "Job Scheduler Dashboard",
    description: "Central service for managing background jobs with registration, logging, pause/resume, and failure notifications",
    status: "completed",
    category: "platform",
    icon: Workflow
  },

  {
    title: "M365 Copilot Agent",
    description: "Natural language interaction with Vega through Microsoft 365 Copilot. OpenAPI spec, declarative manifest, and API plugin complete. OAuth setup pending.",
    status: "in_progress",
    category: "integration",
    effort: "Ongoing",
    priority: "High",
    icon: Sparkles
  },
  {
    title: "Excel Data Binding",
    description: "Link Key Results directly to Excel cells for automatic progress updates via Microsoft Graph API",
    status: "in_progress",
    category: "integration",
    effort: "2-3 weeks",
    priority: "High",
    icon: Puzzle
  },

  {
    title: "Meeting Prep AI",
    description: "Auto-generate meeting preparation summaries by analyzing linked OKRs, progress, blockers, and velocity before Focus Rhythm meetings",
    status: "proposed",
    category: "ai",
    effort: "1 week",
    priority: "High",
    icon: Bot
  },
  {
    title: "Predictive Analytics (Completion Forecast)",
    description: "Velocity-based OKR completion forecasting with confidence bands (low/mid/high), trend detection (accelerating/steady/decelerating), risk flagging, and probability distribution visualization on the Executive Dashboard",
    status: "completed",
    category: "analytics",
    icon: BarChart3
  },
  {
    title: "AI Tool Chaining",
    description: "Enable the AI assistant to combine multiple tool calls for complex queries like team health analysis, period comparisons, and priority recommendations",
    status: "proposed",
    category: "ai",
    effort: "1 week",
    priority: "Medium",
    icon: Sparkles
  },
  {
    title: "Contextual Breadcrumbs with Quick Actions",
    description: "Route-aware breadcrumb trail below the header with type icons, smart truncation for long paths, and quick-action menus on section-root segments",
    status: "completed",
    category: "ux",
    icon: Layers
  },
  {
    title: "Unified Time Period Selector",
    description: "Global time period component in header with consistent quarter/year selection across all modules, persistent selection, and quick shortcuts",
    status: "completed",
    category: "ux",
    effort: "1 week",
    priority: "High",
    icon: Clock
  },
  {
    title: "Streamlined OKR Creation Wizard",
    description: "Multi-step guided wizard: Objective > Key Results > Big Rocks > Review. Create a complete OKR hierarchy in one session with the UserPicker for owner assignment",
    status: "completed",
    category: "ux",
    effort: "2 weeks",
    priority: "High",
    icon: Lightbulb
  },
  {
    title: "User Lookup for Item Assignment",
    description: "Searchable user picker for assigning owners by name or email. Avatar initials, recent selections, manual email fallback, and tenant-scoped data boundary protection",
    status: "completed",
    category: "ux",
    effort: "1 week",
    priority: "High",
    icon: Search
  },
  {
    title: "Power BI / Fabric Data Pull",
    description: "Pull data from Power BI datasets and Microsoft Fabric to automatically update Key Result progress. Browse workspaces, bind measures, configure sync frequency",
    status: "proposed",
    category: "integration",
    effort: "3-4 weeks",
    priority: "Medium",
    icon: Database
  },
  {
    title: "Strategy Cascade Visualization",
    description: "Interactive Sankey diagram or tree showing how annual goals flow to strategies, objectives, KRs, and Big Rocks. Color-coded status, orphan detection, export support",
    status: "proposed",
    category: "analytics",
    effort: "2-3 weeks",
    priority: "Medium",
    icon: Target
  },
  {
    title: "Cross-Team Dependencies & Collaboration Hub",
    description: "Formal dependency tracking: blocking, contributing, informational types. Network graph visualization, request/accept workflow, discussion threads, and Focus Rhythm integration",
    status: "proposed",
    category: "analytics",
    effort: "2-3 weeks",
    priority: "Medium",
    icon: Network
  },
  {
    title: "OKR Health Scoring",
    description: "Real-time AI-powered quality scoring during OKR creation. Multi-factor: clarity, measurability, alignment, achievability, time-bound. With AI suggestions for improvement",
    status: "proposed",
    category: "ai",
    effort: "2 weeks",
    priority: "Medium",
    icon: BarChart3
  },
  {
    title: "Premium Feature Gating",
    description: "Feature entitlement system with enabled/upsell/hidden modes per service plan. Frontend gate component, upgrade modals, tenant admin overrides for demos",
    status: "proposed",
    category: "platform",
    effort: "2-3 weeks",
    priority: "Medium",
    icon: Shield
  },
  {
    title: "Consulting Partner Mode",
    description: "Differentiated features for consultants: multi-tenant oversight dashboard, automation cards, cross-client views, client health scoring, consultant-specific templates",
    status: "proposed",
    category: "business",
    effort: "3-4 weeks",
    priority: "Medium",
    icon: Briefcase
  },
  {
    title: "Tenant Snapshot & Recovery",
    description: "Daily automated backups with point-in-time recovery. Compressed and encrypted. Up to 90 days retention for premium. Selective restore by module with preview/dry-run",
    status: "proposed",
    category: "platform",
    effort: "3-4 weeks",
    priority: "Medium",
    icon: Shield
  },
  {
    title: "Objective Alignment Visual Indicator",
    description: "Viva Goals-style visual badges on aligned objectives. Hierarchy arrow with parent name on hover, quick alignment action, and alignment count badges",
    status: "proposed",
    category: "design",
    effort: "2-3 days",
    priority: "Low-Medium",
    icon: Layers
  },
  {
    title: "Governance & Audit Enhancements",
    description: "Full audit log for all changes, change approval workflows, version history, compliance reports, data retention policies, and GDPR/privacy controls",
    status: "proposed",
    category: "platform",
    effort: "4-5 weeks",
    priority: "Medium",
    icon: Shield
  },
  {
    title: "Strategic Alignment Mind Map",
    description: "Interactive visual graph (React Flow) showing how values, goals, strategies, objectives, KRs, and Big Rocks interconnect with drill-down",
    status: "proposed",
    category: "design",
    effort: "2-3 weeks",
    priority: "Medium",
    icon: GitBranch
  },
  {
    title: "Company OS Document Export",
    description: "Generate comprehensive single-document view of entire Company OS. Filterable by level, team, period, status. Markdown output with future PDF/PPTX support",
    status: "proposed",
    category: "platform",
    effort: "1-2 weeks",
    priority: "Medium",
    icon: FileText
  },
  {
    title: "Unified Relationships Panel",
    description: "Visual relationship graph tab on all entity detail views with quick link/unlink, relationship warnings, and AI suggestions for missing connections",
    status: "proposed",
    category: "design",
    effort: "2-3 weeks",
    priority: "Medium",
    icon: Network
  },
  {
    title: "Multi-Select Time Period Filter",
    description: "Standardized multi-select time period picker allowing simultaneous selection of multiple quarters/years. Viva Goals-style reference",
    status: "proposed",
    category: "ux",
    effort: "3-5 days",
    priority: "Medium",
    icon: Clock
  },
  {
    title: "Global Command Palette",
    description: "Power-user keyboard shortcut (Cmd+K / Ctrl+K) for fuzzy searching all entities, navigation shortcuts, and quick action commands. Uses cmdk package",
    status: "proposed",
    category: "ux",
    effort: "1 week",
    priority: "Medium",
    icon: Keyboard
  },
  {
    title: "Personalized Dashboard Widgets",
    description: "Drag-and-drop customizable dashboard with widget library (My OKRs, Team Health, At-Risk Items), role-based defaults, and pinned items",
    status: "proposed",
    category: "design",
    effort: "2 weeks",
    priority: "Medium",
    icon: LayoutDashboard
  },
  {
    title: "Progress Timeline & Activity Feed",
    description: "Interactive line charts for KR progress over time, global activity feed with filters, and sparkline mini-charts on objective cards",
    status: "proposed",
    category: "analytics",
    effort: "1-2 weeks",
    priority: "Medium",
    icon: BarChart3
  },
  {
    title: "MCP Server Enhancements",
    description: "Connection testing UI, usage analytics dashboard, per-key call limits, and additional MCP tools for creating OKRs and Big Rocks",
    status: "proposed",
    category: "technical",
    effort: "1-2 weeks",
    priority: "Low",
    icon: Wrench
  },
  {
    title: "Sector-Specific Playbooks",
    description: "Pre-built Company OS templates for different industries: SaaS, professional services, manufacturing, non-profit",
    status: "proposed",
    category: "business",
    effort: "2-3 weeks",
    priority: "Low",
    icon: BookOpen
  },
  {
    title: "Employee Experience & Engagement",
    description: "Gamification elements, personal OKR dashboards, progress notifications, push alerts, and future mobile app consideration",
    status: "proposed",
    category: "ux",
    effort: "3-4 weeks",
    priority: "Low",
    icon: Users
  },
  {
    title: "Support Ticket Planner Sync",
    description: "Optionally sync support tickets to a common Microsoft Planner plan across all tenants. Per-tenant opt-in, auto-create tasks on ticket creation, bidirectional status sync, and Constellation-style plan selection wizard",
    status: "proposed",
    category: "integration",
    effort: "2-3 weeks",
    priority: "Medium",
    icon: ListChecks
  },

  {
    title: "Probabilistic Outcome Forecasting",
    description: "Monte Carlo simulation-based OKR completion forecasting with confidence intervals, risk factor analysis, and scenario modeling",
    status: "future",
    category: "ai",
    effort: "4-6 weeks",
    priority: "High Impact",
    icon: Brain
  },
  {
    title: "Behavioral Science Integration",
    description: "Check-in streaks, habit scoring, nudge system, team accountability features, and behavioral pattern analysis for sustained engagement",
    status: "future",
    category: "ai",
    effort: "3-4 weeks",
    icon: Users
  },
  {
    title: "Organizational Network Intelligence",
    description: "Collaboration graph analysis, dependency risk scoring, meeting intelligence with ROI dashboard, and cross-team communication optimization",
    status: "future",
    category: "analytics",
    effort: "4-6 weeks",
    icon: Network
  },
  {
    title: "Automated Retrospectives",
    description: "AI-generated quarterly retrospectives: what worked, what didn't, data-driven recommendations, and anonymized cross-tenant benchmarking",
    status: "future",
    category: "ai",
    effort: "2-3 weeks",
    icon: BookOpen
  },
  {
    title: "Viva Goals Connectors: M365 In-Boundary",
    description: "Excel Online, Planner, and Teams connectors for automatic KR updates from Microsoft 365 data sources (3 integrations, parity with Viva Goals)",
    status: "proposed",
    category: "integration",
    effort: "2-3 weeks",
    priority: "Low",
    icon: Puzzle
  },
  {
    title: "Viva Goals Connectors: Cross-Boundary Microsoft",
    description: "Azure DevOps, Azure Data Explorer, Dynamics 365, MS SQL Server, Power BI, and Project for the Web connectors for KR data binding (6 integrations)",
    status: "proposed",
    category: "integration",
    effort: "4-6 weeks",
    priority: "Low",
    icon: Database
  },
  {
    title: "Viva Goals Connectors: Third-Party Data",
    description: "Amazon Redshift, Asana, BigQuery, Box, Domo, Favro, GitHub, GitLab, Google Sheets, HubSpot, Jira (Cloud/Server/Data Center), Looker, Mode, Monday.com, MySQL, PostgreSQL, ProjectPlace, Salesforce, Smartsheet, Snowflake, Tableau, Trello, Zendesk connectors (24 integrations)",
    status: "proposed",
    category: "integration",
    effort: "Ongoing",
    priority: "Low",
    icon: Database
  },
  {
    title: "Viva Goals Connectors: Third-Party Collaboration",
    description: "Slack integration for notifications, check-in reminders, and OKR updates directly in Slack channels (1 integration, parity with Viva Goals)",
    status: "proposed",
    category: "integration",
    effort: "1-2 weeks",
    priority: "Low",
    icon: MessageSquare
  },
  {
    title: "Bi-Directional Action Orchestration",
    description: "When KRs hit risk thresholds: auto-create Jira epics, send Slack notifications, add to meeting agendas, and trigger escalation workflows",
    status: "future",
    category: "integration",
    effort: "4-6 weeks",
    icon: Zap
  },
  {
    title: "Strategic Command Center",
    description: "Single executive pane: live metrics from all connected systems, OKR health pulse, risk dashboard, and automated board report generation",
    status: "future",
    category: "analytics",
    effort: "4-6 weeks",
    icon: Eye
  },
  {
    title: "Virtual Strategy Consultant",
    description: "AI-powered advisory: annual planning facilitation, OKR coaching, quarterly review guidance, and proactive strategic briefings with overnight change summaries",
    status: "future",
    category: "ai",
    effort: "4-6 weeks",
    icon: Sparkles
  },
  {
    title: "Self-Service Transformation Journeys",
    description: "Guided multi-week programs: First 90 Days with OKRs, Scaling Company-Wide, Turnaround for Broken OKRs, and Advanced Culture Transformation",
    status: "future",
    category: "business",
    effort: "4-6 weeks",
    icon: Map
  },
  {
    title: "Certification & Training Platform",
    description: "OKR Champion certification, executive briefing modules, manager coaching courses, and organizational capability tracking",
    status: "future",
    category: "business",
    effort: "6-8 weeks",
    icon: GraduationCap
  },
  {
    title: "Consultant Toolkit",
    description: "Client readiness assessments, diagnostic dashboards, intervention playbooks, before/after impact reporting, and template library for Synozur consultants",
    status: "future",
    category: "business",
    effort: "4-6 weeks",
    icon: Briefcase
  },
  {
    title: "Pattern Library",
    description: "Curated best practices from successful organizations: OKR templates by industry, Big Rock patterns, anti-patterns, and industry benchmarks",
    status: "future",
    category: "business",
    effort: "2-3 weeks",
    icon: BookOpen
  },
  {
    title: "Skill Gap Analysis",
    description: "Connect OKR outcomes to capability development: identify team strengths and growth areas, training ROI projections, and hiring recommendations",
    status: "future",
    category: "analytics",
    effort: "3-4 weeks",
    icon: Brain
  },

  {
    title: "Outcomes Page Black Screen with Excel Autosync",
    description: "Intermittent black screen on Outcomes page when Excel autosync is active. No error logs captured yet. Under investigation.",
    status: "proposed",
    category: "bug",
    priority: "Medium",
    icon: Bug
  },
  {
    title: "SharePoint Integration Limitations",
    description: "Sites.Selected permission limitations, URL resolution issues on certain formats, and drive discovery may miss some libraries",
    status: "proposed",
    category: "bug",
    priority: "Medium",
    icon: Bug
  },
  {
    title: "TypeScript Circular Reference in Schema",
    description: "Self-referencing types in shared/schema.ts cause implicit 'any' warnings. Does not affect runtime behavior.",
    status: "proposed",
    category: "technical",
    priority: "Low",
    icon: Wrench
  }
];

const statusConfig: Record<Status, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className: string }> = {
  completed: { label: "Completed", variant: "default", className: "bg-green-600 dark:bg-green-700" },
  in_progress: { label: "In Progress", variant: "secondary", className: "" },
  proposed: { label: "Proposed", variant: "outline", className: "" },
  future: { label: "Future Vision", variant: "outline", className: "border-dashed" }
};

const categoryConfig: Record<Category, { label: string; icon: typeof Sparkles }> = {
  ai: { label: "AI & Intelligence", icon: Sparkles },
  integration: { label: "Integrations", icon: Puzzle },
  ux: { label: "UX Enhancement", icon: Palette },
  analytics: { label: "Analytics", icon: BarChart3 },
  platform: { label: "Platform", icon: Wrench },
  business: { label: "Business", icon: Briefcase },
  design: { label: "Design", icon: Palette },
  bug: { label: "Known Issue", icon: Bug },
  technical: { label: "Technical", icon: Wrench }
};

export default function Backlog() {
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");
  const [filterCategory, setFilterCategory] = useState<Category | "all">("all");

  const filteredItems = backlogItems.filter(item => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterCategory !== "all" && item.category !== filterCategory) return false;
    return true;
  });

  const statusCounts: Record<Status, number> = {
    completed: backlogItems.filter(i => i.status === "completed").length,
    in_progress: backlogItems.filter(i => i.status === "in_progress").length,
    proposed: backlogItems.filter(i => i.status === "proposed").length,
    future: backlogItems.filter(i => i.status === "future").length,
  };

  const activeCategoryFilters = (Object.keys(categoryConfig) as Category[]).filter(c =>
    backlogItems.some(i => i.category === c && (filterStatus === "all" || i.status === filterStatus))
  );

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
          <h1 className="text-2xl font-bold" data-testid="text-backlog-title">Feature Backlog</h1>
          <p className="text-muted-foreground text-sm">Everything proposed, planned, and in progress — the full picture</p>
        </div>
        <Link href="/roadmap">
          <Button variant="outline" size="sm" data-testid="button-view-roadmap">
            <Target className="h-4 w-4 mr-1" />
            View Roadmap
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Lightbulb className="h-4 w-4 flex-shrink-0" />
            <span>This is the comprehensive backlog of all features, proposals, design work, and known issues. The <Link href="/roadmap" className="text-primary underline">Roadmap</Link> shows only committed deliverables.</span>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={filterStatus === "all" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setFilterStatus("all")}
                data-testid="filter-status-all"
              >
                All ({backlogItems.length})
              </Badge>
              {(Object.keys(statusConfig) as Status[]).map(s => (
                <Badge
                  key={s}
                  variant={filterStatus === s ? "default" : "outline"}
                  className={`cursor-pointer ${filterStatus === s ? statusConfig[s].className : ""}`}
                  onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
                  data-testid={`filter-status-${s}`}
                >
                  {statusConfig[s].label} ({statusCounts[s]})
                </Badge>
              ))}
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {activeCategoryFilters.map(c => {
                const CatIcon = categoryConfig[c].icon;
                const count = backlogItems.filter(i =>
                  i.category === c && (filterStatus === "all" || i.status === filterStatus)
                ).length;
                return (
                  <Badge
                    key={c}
                    variant={filterCategory === c ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setFilterCategory(filterCategory === c ? "all" : c)}
                    data-testid={`filter-category-${c}`}
                  >
                    <CatIcon className="h-3 w-3 mr-1" />
                    {categoryConfig[c].label} ({count})
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item, idx) => {
            const Icon = item.icon;
            const sConfig = statusConfig[item.status];
            const cConfig = categoryConfig[item.category];
            const CatIcon = cConfig.icon;
            return (
              <Card key={idx} className="hover-elevate" data-testid={`card-backlog-item-${idx}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-md bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <CardTitle className="text-base">{item.title}</CardTitle>
                    </div>
                    <Badge variant={sConfig.variant} className={sConfig.className}>
                      {sConfig.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm mb-3">
                    {item.description}
                  </CardDescription>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      <CatIcon className="h-3 w-3 mr-1" />
                      {cConfig.label}
                    </Badge>
                    {item.effort && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {item.effort}
                      </Badge>
                    )}
                    {item.priority && (
                      <Badge variant="outline" className="text-xs">
                        {item.priority}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No backlog items match the selected filters.</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => { setFilterStatus("all"); setFilterCategory("all"); }}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-6">
          <div className="text-center space-y-3">
            <MessageSquare className="h-8 w-8 text-primary mx-auto" />
            <div>
              <h3 className="font-semibold">Have an idea?</h3>
              <p className="text-sm text-muted-foreground">
                Suggest a feature and it will be added to the backlog for consideration.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('mailto:Vega@synozur.com?subject=Feature Suggestion', '_blank')}
              data-testid="button-suggest-feature"
            >
              Suggest a Feature
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
