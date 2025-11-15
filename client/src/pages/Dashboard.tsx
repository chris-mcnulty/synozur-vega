import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Target,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Users,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";

type Quarter = {
  id: string;
  label: string;
  year: number;
  quarter: number;
  startDate: string;
  endDate: string;
};

type Foundation = {
  mission: string[];
  vision: string[];
  values: string[];
  annualGoals: string[];
};

type Strategy = {
  id: string;
  title: string;
  category: "critical" | "high" | "medium";
  progress: number;
};

type OKR = {
  id: string;
  objective: string;
  progress: number;
  department: string;
};

type Rock = {
  id: string;
  title: string;
  status: "completed" | "in-progress" | "not-started";
  owner: string;
};

type Metric = {
  id: string;
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
};

type Meeting = {
  id: string;
  title: string;
  frequency: string;
  nextDate: string;
};

const fiscalYears = [
  { id: "fy2025", label: "FY 2025 (Jan - Dec)", startMonth: 1 },
  { id: "fy2024", label: "FY 2024 (Jan - Dec)", startMonth: 1 },
];

const quarters: Quarter[] = [
  { id: "q1-2025", label: "Q1 2025", year: 2025, quarter: 1, startDate: "Jan 1", endDate: "Mar 31" },
  { id: "q2-2025", label: "Q2 2025", year: 2025, quarter: 2, startDate: "Apr 1", endDate: "Jun 30" },
  { id: "q3-2025", label: "Q3 2025", year: 2025, quarter: 3, startDate: "Jul 1", endDate: "Sep 30" },
  { id: "q4-2025", label: "Q4 2025", year: 2025, quarter: 4, startDate: "Oct 1", endDate: "Dec 31" },
  { id: "q4-2024", label: "Q4 2024", year: 2024, quarter: 4, startDate: "Oct 1", endDate: "Dec 31" },
];

const currentFoundations: Foundation = {
  mission: [
    "Empower organizations with AI-driven insights",
    "Transform strategy into actionable results",
  ],
  vision: [
    "A world where every organization operates with clarity",
    "Data-driven decision-making at every level",
  ],
  values: ["Innovation", "Integrity", "Collaboration", "Excellence", "Customer Success"],
  annualGoals: [
    "Increase revenue by 30%",
    "Expand to new markets",
    "Improve customer satisfaction",
  ],
};

const currentStrategies: Strategy[] = [
  { id: "1", title: "Launch New Product Line", category: "critical", progress: 65 },
  { id: "2", title: "Expand Market Presence", category: "high", progress: 72 },
  { id: "3", title: "Improve Customer Retention", category: "high", progress: 58 },
];

const currentOKRs: OKR[] = [
  { id: "1", objective: "Increase Market Share", progress: 65, department: "Sales" },
  { id: "2", objective: "Build World-Class Product", progress: 45, department: "Engineering" },
  { id: "3", objective: "Improve Customer Experience", progress: 78, department: "Customer Success" },
];

const currentRocks: Rock[] = [
  { id: "1", title: "Complete Product Redesign", status: "in-progress", owner: "Design Team" },
  { id: "2", title: "Hire 5 Engineers", status: "completed", owner: "HR Team" },
  { id: "3", title: "Launch Marketing Campaign", status: "in-progress", owner: "Marketing Team" },
  { id: "4", title: "Integrate Payment Gateway", status: "completed", owner: "Engineering Team" },
];

const currentMetrics: Metric[] = [
  { id: "1", label: "Monthly Recurring Revenue", value: "$285K", change: "+12%", trend: "up" },
  { id: "2", label: "Customer Churn Rate", value: "2.3%", change: "-0.5%", trend: "down" },
  { id: "3", label: "Net Promoter Score", value: "68", change: "+5", trend: "up" },
  { id: "4", label: "Feature Adoption Rate", value: "76%", change: "+8%", trend: "up" },
];

const upcomingMeetings: Meeting[] = [
  { id: "1", title: "Strategic Planning Review", frequency: "Weekly", nextDate: "Jan 20, 2025" },
  { id: "2", title: "Monthly Business Review", frequency: "Monthly", nextDate: "Jan 31, 2025" },
  { id: "3", title: "OKR Progress Check", frequency: "Bi-weekly", nextDate: "Jan 24, 2025" },
];

export default function Dashboard() {
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("fy2025");
  const [selectedQuarter, setSelectedQuarter] = useState("q1-2025");

  const currentQuarter = quarters.find((q) => q.id === selectedQuarter);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header with Quarter Selector */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-2">Company Operating System</h1>
          <p className="text-muted-foreground">
            Comprehensive view of foundations, strategies, planning, and focus for{" "}
            {currentQuarter?.label}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
            <SelectTrigger className="w-48" data-testid="select-fiscal-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fiscalYears.map((fy) => (
                <SelectItem key={fy.id} value={fy.id}>
                  {fy.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
            <SelectTrigger className="w-40" data-testid="select-quarter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {quarters.map((q) => (
                <SelectItem key={q.id} value={q.id}>
                  {q.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Period Overview Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-2">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-1">{currentQuarter?.label}</h2>
              <p className="text-muted-foreground">
                {currentQuarter?.startDate} - {currentQuarter?.endDate}
              </p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{currentStrategies.length}</p>
                <p className="text-sm text-muted-foreground">Active Strategies</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{currentOKRs.length}</p>
                <p className="text-sm text-muted-foreground">OKRs</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">
                  {currentRocks.filter((r) => r.status === "completed").length}/
                  {currentRocks.length}
                </p>
                <p className="text-sm text-muted-foreground">Rocks Complete</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Foundations Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Foundations (Evergreen)</h2>
          </div>
          <Link href="/foundations">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="link-foundations">
              View Details
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <div className="h-1 w-8 bg-primary rounded" />
                  Mission
                </h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {currentFoundations.mission.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <div className="h-1 w-8 bg-secondary rounded" />
                  Vision
                </h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {currentFoundations.vision.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-secondary mt-1.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="space-y-3">
              <h3 className="font-semibold">Core Values</h3>
              <div className="flex flex-wrap gap-2">
                {currentFoundations.values.map((value, idx) => (
                  <Badge key={idx} variant="secondary">
                    {value}
                  </Badge>
                ))}
              </div>
            </div>
            <Separator className="my-4" />
            <div className="space-y-3">
              <h3 className="font-semibold">Annual Goals (2025)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {currentFoundations.annualGoals.map((goal, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <Target className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{goal}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Strategies and Planning Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strategies Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Strategic Priorities</h2>
            </div>
            <Link href="/strategy">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="link-strategy">
                View Details
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="pt-6 space-y-4">
              {currentStrategies.map((strategy) => (
                <div key={strategy.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-medium text-sm">{strategy.title}</h3>
                    <Badge
                      variant={
                        strategy.category === "critical"
                          ? "destructive"
                          : strategy.category === "high"
                          ? "default"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      {strategy.category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={strategy.progress} className="flex-1" />
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {strategy.progress}%
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Quarterly Rocks */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Quarterly Rocks</h2>
            </div>
            <Link href="/planning">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="link-rocks">
                View Details
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="pt-6 space-y-3">
              {currentRocks.map((rock) => (
                <div key={rock.id} className="flex items-start gap-3">
                  {rock.status === "completed" ? (
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  ) : rock.status === "in-progress" ? (
                    <div className="h-5 w-5 rounded-full border-2 border-primary shrink-0 mt-0.5 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    </div>
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p
                      className={`text-sm ${
                        rock.status === "completed" ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {rock.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{rock.owner}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* OKRs and Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* OKRs by Department */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">OKRs by Department</h2>
            </div>
            <Link href="/planning">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="link-okrs">
                View Details
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="pt-6 space-y-4">
              {currentOKRs.map((okr) => (
                <div key={okr.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-sm">{okr.objective}</h3>
                      <p className="text-xs text-muted-foreground">{okr.department}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {okr.progress}%
                    </Badge>
                  </div>
                  <Progress value={okr.progress} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Key Metrics */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Key Metrics</h2>
            </div>
            <Link href="/planning">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="link-metrics">
                View Details
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {currentMetrics.map((metric) => (
              <Card key={metric.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
                      <p className="text-xl font-bold">{metric.value}</p>
                    </div>
                    <Badge variant={metric.trend === "up" ? "default" : "secondary"}>
                      {metric.change}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Focus Rhythm */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Focus Rhythm - Upcoming Meetings</h2>
          </div>
          <Link href="/focus-rhythm">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="link-focus">
              View Schedule
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {upcomingMeetings.map((meeting) => (
            <Card key={meeting.id} className="hover-elevate">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium text-sm mb-1">{meeting.title}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{meeting.frequency}</p>
                    <div className="flex items-center gap-1 text-xs">
                      <Calendar className="h-3 w-3" />
                      {meeting.nextDate}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
