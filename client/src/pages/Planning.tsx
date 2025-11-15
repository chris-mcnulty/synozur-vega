import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  TrendingUp,
  CheckCircle2,
  Calendar,
  Target,
  Link2,
  MessageSquare,
  Download,
  Upload,
  History,
  Edit,
  Sparkles,
  Users,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

type OKR = {
  id: string;
  objective: string;
  progress: number;
  department: string;
  assignedTo?: string;
  linkedGoals: string[];
  linkedStrategies: string[];
  keyResults: KeyResult[];
  checkIns: CheckIn[];
};

type KeyResult = {
  text: string;
  progress: number;
  target: string;
};

type KPI = {
  id: string;
  label: string;
  value: string;
  change: string;
  target: string;
  linkedGoals: string[];
  checkIns: CheckIn[];
};

type Rock = {
  id: string;
  title: string;
  status: "completed" | "in-progress" | "not-started";
  linkedGoals: string[];
  linkedStrategies: string[];
  owner: string;
};

type CheckIn = {
  date: string;
  value: number;
  notes: string;
  updatedBy: string;
};

type QuarterlyPlan = {
  period: string;
  year: number;
  quarter: number;
  okrs: OKR[];
  kpis: KPI[];
  rocks: Rock[];
  notes: string;
  updatedBy: string;
  updatedAt: string;
};

const availableGoals = [
  "Increase revenue by 30%",
  "Expand to new markets",
  "Improve customer satisfaction",
  "Launch innovative products",
  "Build high-performing teams",
  "Achieve operational excellence",
];

const availableStrategies = [
  "Launch New Product Line",
  "Expand Market Presence",
  "Improve Customer Retention",
];

const availablePeople = [
  "Sarah Chen",
  "Michael Torres",
  "Alex Kim",
  "Jordan Lee",
  "Taylor Swift",
];

const mockCheckIns: CheckIn[] = [
  { date: "2025-01-15", value: 65, notes: "On track, exceeded target", updatedBy: "Sarah Chen" },
  { date: "2025-01-08", value: 58, notes: "Good progress", updatedBy: "Sarah Chen" },
  { date: "2025-01-01", value: 50, notes: "Q1 kickoff", updatedBy: "Michael Torres" },
];

const mockOKRs: OKR[] = [
  {
    id: "1",
    objective: "Increase Market Share",
    progress: 65,
    department: "Sales",
    assignedTo: "Sarah Chen",
    linkedGoals: ["Increase revenue by 30%", "Expand to new markets"],
    linkedStrategies: ["Expand Market Presence"],
    keyResults: [
      { text: "Acquire 500 new customers", progress: 70, target: "500 customers" },
      { text: "Achieve 95% customer satisfaction", progress: 60, target: "95%" },
      { text: "Launch in 3 new markets", progress: 65, target: "3 markets" },
    ],
    checkIns: mockCheckIns,
  },
  {
    id: "2",
    objective: "Build World-Class Product",
    progress: 45,
    department: "Engineering",
    assignedTo: "Michael Torres",
    linkedGoals: ["Launch innovative products", "Achieve operational excellence"],
    linkedStrategies: ["Launch New Product Line"],
    keyResults: [
      { text: "Ship 5 major features", progress: 40, target: "5 features" },
      { text: "Reduce bugs by 50%", progress: 55, target: "50% reduction" },
      { text: "Improve performance by 30%", progress: 40, target: "30% improvement" },
    ],
    checkIns: mockCheckIns,
  },
  {
    id: "3",
    objective: "Improve Customer Retention",
    progress: 72,
    department: "Customer Success",
    assignedTo: "Alex Kim",
    linkedGoals: ["Improve customer satisfaction"],
    linkedStrategies: ["Improve Customer Retention"],
    keyResults: [
      { text: "Reduce churn to <2%", progress: 75, target: "2%" },
      { text: "Increase NPS to 70+", progress: 68, target: "70" },
      { text: "Launch loyalty program", progress: 80, target: "Launch" },
    ],
    checkIns: mockCheckIns,
  },
  {
    id: "4",
    objective: "Scale Marketing Operations",
    progress: 58,
    department: "Marketing",
    assignedTo: "Jordan Lee",
    linkedGoals: ["Expand to new markets", "Increase revenue by 30%"],
    linkedStrategies: ["Expand Market Presence"],
    keyResults: [
      { text: "Generate 10K qualified leads", progress: 60, target: "10K leads" },
      { text: "Achieve 5% conversion rate", progress: 55, target: "5%" },
      { text: "Launch 3 campaigns", progress: 60, target: "3 campaigns" },
    ],
    checkIns: mockCheckIns,
  },
];

const mockKPIs: KPI[] = [
  {
    id: "1",
    label: "Monthly Recurring Revenue",
    value: "$285K",
    change: "+12%",
    target: "$300K",
    linkedGoals: ["Increase revenue by 30%"],
    checkIns: mockCheckIns,
  },
  {
    id: "2",
    label: "Customer Churn Rate",
    value: "2.3%",
    change: "-0.5%",
    target: "<2%",
    linkedGoals: ["Improve customer satisfaction"],
    checkIns: mockCheckIns,
  },
  {
    id: "3",
    label: "Net Promoter Score",
    value: "68",
    change: "+5",
    target: "70+",
    linkedGoals: ["Improve customer satisfaction"],
    checkIns: mockCheckIns,
  },
];

const mockRocks: Rock[] = [
  {
    id: "1",
    title: "Complete Product Redesign",
    status: "in-progress",
    linkedGoals: ["Launch innovative products"],
    linkedStrategies: ["Launch New Product Line"],
    owner: "Design Team",
  },
  {
    id: "2",
    title: "Hire 5 Engineers",
    status: "completed",
    linkedGoals: ["Build high-performing teams"],
    linkedStrategies: [],
    owner: "HR Team",
  },
  {
    id: "3",
    title: "Launch Marketing Campaign",
    status: "in-progress",
    linkedGoals: ["Expand to new markets"],
    linkedStrategies: ["Expand Market Presence"],
    owner: "Marketing Team",
  },
  {
    id: "4",
    title: "Integrate Payment Gateway",
    status: "completed",
    linkedGoals: ["Achieve operational excellence"],
    linkedStrategies: [],
    owner: "Engineering Team",
  },
];

const mockQuarterlyPlans: QuarterlyPlan[] = [
  {
    period: "Q1 2025",
    year: 2025,
    quarter: 1,
    okrs: mockOKRs,
    kpis: mockKPIs,
    rocks: mockRocks,
    notes: "Focus on product innovation and market expansion with aggressive growth targets",
    updatedBy: "Sarah Chen",
    updatedAt: "2025-01-15",
  },
  {
    period: "Q4 2024",
    year: 2024,
    quarter: 4,
    okrs: mockOKRs.map(okr => ({ ...okr, progress: okr.progress - 20 })),
    kpis: mockKPIs,
    rocks: mockRocks.slice(0, 2),
    notes: "Year-end push for product completion and customer retention",
    updatedBy: "Michael Torres",
    updatedAt: "2024-12-31",
  },
];

export default function Planning() {
  const { toast } = useToast();
  const [okrs, setOkrs] = useState<OKR[]>(mockOKRs);
  const [kpis, setKpis] = useState<KPI[]>(mockKPIs);
  const [rocks, setRocks] = useState<Rock[]>(mockRocks);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [itemType, setItemType] = useState<"okr" | "kpi" | "rock">("okr");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedQuarter, setSelectedQuarter] = useState("");
  const [selectedOKRs, setSelectedOKRs] = useState<string[]>([]);
  const [selectedRocks, setSelectedRocks] = useState<string[]>([]);
  const [proposedOKRs, setProposedOKRs] = useState<string[]>([]);
  const [proposedRocks, setProposedRocks] = useState<string[]>([]);

  const groupedOKRs = okrs.reduce((acc, okr) => {
    if (!acc[okr.department]) {
      acc[okr.department] = [];
    }
    acc[okr.department].push(okr);
    return acc;
  }, {} as Record<string, OKR[]>);

  const exportToCSV = () => {
    const csvContent = [
      ["Type", "Title", "Progress/Value", "Target", "Linked Goals", "Linked Strategies"],
      ...okrs.map((okr) => [
        "OKR",
        okr.objective,
        `${okr.progress}%`,
        "-",
        okr.linkedGoals.join("; "),
        okr.linkedStrategies.join("; "),
      ]),
      ...kpis.map((kpi) => [
        "KPI",
        kpi.label,
        kpi.value,
        kpi.target,
        kpi.linkedGoals.join("; "),
        "-",
      ]),
      ...rocks.map((rock) => [
        "Rock",
        rock.title,
        rock.status,
        "-",
        rock.linkedGoals.join("; "),
        rock.linkedStrategies.join("; "),
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `planning_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: "Planning data exported to CSV",
    });
  };

  const openCheckInDialog = (item: any, type: "okr" | "kpi" | "rock") => {
    setSelectedItem(item);
    setItemType(type);
    setCheckInDialogOpen(true);
  };

  const openEditDialog = (item: any, type: "okr" | "kpi" | "rock") => {
    setSelectedItem(item);
    setItemType(type);
    setEditDialogOpen(true);
  };

  const startWizard = () => {
    setWizardStep(1);
    setSelectedQuarter("");
    setSelectedOKRs([]);
    setSelectedRocks([]);
    setProposedOKRs([]);
    setProposedRocks([]);
    setWizardOpen(true);
  };

  const nextWizardStep = () => {
    if (wizardStep >= 4) return;
    
    if (wizardStep === 1 && !selectedQuarter) {
      toast({
        title: "Quarter Required",
        description: "Please select a quarter before continuing",
        variant: "destructive",
      });
      return;
    }
    
    if (wizardStep === 2) {
      const aiProposedOKRs = [
        "Expand into Asia-Pacific region",
        "Launch mobile app v2.0",
        "Achieve ISO 27001 certification",
      ];
      const aiProposedRocks = [
        "Implement AI-powered analytics",
        "Open regional offices in APAC",
        "Complete security audit",
      ];
      setProposedOKRs(aiProposedOKRs);
      setProposedRocks(aiProposedRocks);
    }
    setWizardStep(wizardStep + 1);
  };

  const previousWizardStep = () => {
    if (wizardStep <= 1) return;
    setWizardStep(wizardStep - 1);
  };

  const completeWizard = () => {
    if (!selectedQuarter) {
      toast({
        title: "Quarter Required",
        description: "Please select a quarter before completing the plan",
        variant: "destructive",
      });
      return;
    }

    const totalOKRs = selectedOKRs.length + proposedOKRs.length;
    const totalRocks = selectedRocks.length + proposedRocks.length;
    
    toast({
      title: "Quarterly Plan Created",
      description: `Successfully created plan for ${selectedQuarter}${totalOKRs > 0 ? ` with ${totalOKRs} OKR${totalOKRs === 1 ? '' : 's'}` : ''}${totalRocks > 0 ? ` and ${totalRocks} Rock${totalRocks === 1 ? '' : 's'}` : ''}`,
    });
    setWizardOpen(false);
  };

  const toggleOKRSelection = (okrId: string) => {
    setSelectedOKRs(prev =>
      prev.includes(okrId) ? prev.filter(id => id !== okrId) : [...prev, okrId]
    );
  };

  const toggleRockSelection = (rockId: string) => {
    setSelectedRocks(prev =>
      prev.includes(rockId) ? prev.filter(id => id !== rockId) : [...prev, rockId]
    );
  };

  const toggleProposedOKR = (okr: string) => {
    setProposedOKRs(prev =>
      prev.includes(okr) ? prev.filter(o => o !== okr) : [...prev, okr]
    );
  };

  const toggleProposedRock = (rock: string) => {
    setProposedRocks(prev =>
      prev.includes(rock) ? prev.filter(r => r !== rock) : [...prev, rock]
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Tabs defaultValue="current" className="w-full">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">Planning</h1>
            <p className="text-muted-foreground">
              Track OKRs, KPIs, and quarterly rocks with goals and strategy alignment
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Planner Synced
            </Badge>
            <Button
              variant="default"
              size="sm"
              className="gap-2"
              onClick={startWizard}
              data-testid="button-quarterly-wizard"
            >
              <Sparkles className="h-4 w-4" />
              Quarterly Wizard
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={exportToCSV}
              data-testid="button-export-planning"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-sync-planner">
              <Calendar className="h-4 w-4" />
              Sync Planner
            </Button>
          </div>
        </div>

        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="current" data-testid="tab-current">
            Current Quarter
          </TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline">
            <History className="h-4 w-4 mr-2" />
            Quarterly/Annual View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-6">
          {/* KPIs Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Key Performance Indicators</h2>
              <Button size="sm" className="gap-2" data-testid="button-add-kpi">
                <Plus className="h-4 w-4" />
                Add KPI
              </Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {kpis.map((kpi) => (
                <Card
                  key={kpi.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => openEditDialog(kpi, "kpi")}
                  data-testid={`kpi-card-${kpi.id}`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {kpi.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-3xl font-bold">{kpi.value}</span>
                      <Badge variant={kpi.change.startsWith("+") ? "default" : "secondary"}>
                        {kpi.change}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Target: {kpi.target}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCheckInDialog(kpi, "kpi");
                        }}
                        data-testid={`button-checkin-kpi-${kpi.id}`}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Check-in
                      </Button>
                    </div>
                    {kpi.linkedGoals.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2 border-t">
                        {kpi.linkedGoals.map((goal, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            <Target className="h-3 w-3 mr-1" />
                            {goal}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* OKRs and Rocks Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* OKRs Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Objectives & Key Results</h2>
                <Button size="sm" className="gap-2" data-testid="button-add-okr">
                  <Plus className="h-4 w-4" />
                  Add OKR
                </Button>
              </div>
              {Object.entries(groupedOKRs).map(([department, deptOKRs]) => (
                <div key={department} className="space-y-3">
                  <div className="flex items-center gap-2 mt-4">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-lg">{department}</h3>
                    <Badge variant="outline" className="ml-2">
                      {deptOKRs.length} {deptOKRs.length === 1 ? 'OKR' : 'OKRs'}
                    </Badge>
                  </div>
                  {deptOKRs.map((okr) => (
                <Card
                  key={okr.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => openEditDialog(okr, "okr")}
                  data-testid={`okr-card-${okr.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{okr.objective}</CardTitle>
                        {okr.assignedTo && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Assigned to: {okr.assignedTo}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary">{okr.progress}%</Badge>
                    </div>
                    <Progress value={okr.progress} className="mt-2" />
                    <div className="flex justify-end mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCheckInDialog(okr, "okr");
                        }}
                        data-testid={`button-checkin-okr-${okr.id}`}
                      >
                        <Edit className="h-3 w-3 mr-2" />
                        Check-in
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {okr.keyResults.map((kr, index) => (
                        <div key={index} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{kr.text}</span>
                            <span className="font-medium">{kr.progress}%</span>
                          </div>
                          <Progress value={kr.progress} className="h-1.5" />
                          <div className="text-xs text-muted-foreground">Target: {kr.target}</div>
                        </div>
                      ))}
                    </div>
                    {(okr.linkedGoals.length > 0 || okr.linkedStrategies.length > 0) && (
                      <div className="pt-3 border-t space-y-2">
                        {okr.linkedGoals.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {okr.linkedGoals.map((goal, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                <Target className="h-3 w-3 mr-1" />
                                {goal}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {okr.linkedStrategies.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {okr.linkedStrategies.map((strategy, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                <Link2 className="h-3 w-3 mr-1" />
                                {strategy}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
                </div>
              ))}
            </div>

            {/* Rocks Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Quarterly Rocks</h2>
                <Button size="sm" className="gap-2" data-testid="button-add-rock">
                  <Plus className="h-4 w-4" />
                  Add Rock
                </Button>
              </div>
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {rocks.map((rock) => (
                      <Card
                        key={rock.id}
                        className="hover-elevate cursor-pointer"
                        onClick={() => openEditDialog(rock, "rock")}
                        data-testid={`rock-${rock.id}`}
                      >
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start gap-3">
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
                              <div className="flex items-start justify-between gap-2">
                                <span className={rock.status === "completed" ? "line-through text-muted-foreground" : "font-medium"}>
                                  {rock.title}
                                </span>
                                {rock.status === "in-progress" && (
                                  <Badge variant="secondary" className="text-xs">
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    Active
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Owner: {rock.owner}
                              </div>
                            </div>
                          </div>
                          {(rock.linkedGoals.length > 0 || rock.linkedStrategies.length > 0) && (
                            <div className="pl-8 flex flex-wrap gap-1">
                              {rock.linkedGoals.map((goal, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  <Target className="h-3 w-3 mr-1" />
                                  {goal}
                                </Badge>
                              ))}
                              {rock.linkedStrategies.map((strategy, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  <Link2 className="h-3 w-3 mr-1" />
                                  {strategy}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Planning Timeline</h2>
              <Badge variant="outline">{mockQuarterlyPlans.length} periods</Badge>
            </div>
            <div className="space-y-6">
              {mockQuarterlyPlans.map((plan, index) => (
                <Card key={index} data-testid={`timeline-plan-${index}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <CardTitle className="text-xl">{plan.period}</CardTitle>
                        <CardDescription className="mt-1">
                          Updated by {plan.updatedBy} on {plan.updatedAt}
                        </CardDescription>
                      </div>
                      <Badge variant={index === 0 ? "default" : "secondary"}>
                        {index === 0 ? "Current" : "Archive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {plan.notes && (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-sm font-medium mb-1">Period Overview:</p>
                        <p className="text-sm text-muted-foreground">{plan.notes}</p>
                      </div>
                    )}

                    {/* OKRs Summary */}
                    <div>
                      <h3 className="font-semibold mb-3">OKRs ({plan.okrs.length})</h3>
                      <div className="space-y-3">
                        {plan.okrs.map((okr) => (
                          <Card key={okr.id} className="bg-background">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-medium">{okr.objective}</h4>
                                <Badge variant="secondary">{okr.progress}%</Badge>
                              </div>
                              <Progress value={okr.progress} className="mb-2" />
                              <div className="flex flex-wrap gap-1">
                                {okr.linkedGoals.map((goal, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {goal}
                                  </Badge>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>

                    {/* Rocks Summary */}
                    <div>
                      <h3 className="font-semibold mb-3">Rocks ({plan.rocks.length})</h3>
                      <div className="flex flex-wrap gap-2">
                        {plan.rocks.map((rock) => (
                          <Badge
                            key={rock.id}
                            variant={rock.status === "completed" ? "default" : "secondary"}
                          >
                            {rock.status === "completed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {rock.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Check-in Dialog */}
      <Dialog open={checkInDialogOpen} onOpenChange={setCheckInDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Check-in: {selectedItem?.objective || selectedItem?.label || selectedItem?.title}</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-6 pt-4">
              <div>
                <Label htmlFor="checkin-value">Current Progress/Value</Label>
                <Input
                  id="checkin-value"
                  type="number"
                  placeholder={itemType === "okr" ? "Progress %" : "Value"}
                  data-testid="input-checkin-value"
                />
              </div>
              <div>
                <Label htmlFor="checkin-notes">Notes</Label>
                <Textarea
                  id="checkin-notes"
                  placeholder="Add notes about progress, blockers, or achievements..."
                  rows={4}
                  data-testid="input-checkin-notes"
                />
              </div>

              {/* Check-in History */}
              <div>
                <h3 className="font-semibold mb-3">Check-in History</h3>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {(selectedItem.checkIns || mockCheckIns).map((checkIn: CheckIn, idx: number) => (
                    <Card key={idx}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-sm font-medium">{checkIn.date}</p>
                            <p className="text-xs text-muted-foreground">by {checkIn.updatedBy}</p>
                          </div>
                          <Badge variant="secondary">{checkIn.value}%</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{checkIn.notes}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => {
                  toast({
                    title: "Check-in Saved",
                    description: "Progress has been updated",
                  });
                  setCheckInDialogOpen(false);
                }}
                data-testid="button-save-checkin"
              >
                Save Check-in
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit {itemType === "okr" ? "OKR" : itemType === "kpi" ? "KPI" : "Rock"}
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 pt-4">
              <div>
                <Label>Link to Goals (from Foundations)</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Connect to strategic goals
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableGoals.map((goal) => {
                    const isLinked = selectedItem.linkedGoals?.includes(goal);
                    return (
                      <Badge
                        key={goal}
                        variant={isLinked ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          const updated = isLinked
                            ? selectedItem.linkedGoals.filter((g: string) => g !== goal)
                            : [...(selectedItem.linkedGoals || []), goal];
                          setSelectedItem({ ...selectedItem, linkedGoals: updated });
                        }}
                      >
                        <Target className="h-3 w-3 mr-1" />
                        {goal}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {itemType !== "kpi" && (
                <div>
                  <Label>Link to Strategies</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Connect to strategic priorities
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availableStrategies.map((strategy) => {
                      const isLinked = selectedItem.linkedStrategies?.includes(strategy);
                      return (
                        <Badge
                          key={strategy}
                          variant={isLinked ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => {
                            const updated = isLinked
                              ? selectedItem.linkedStrategies.filter((s: string) => s !== strategy)
                              : [...(selectedItem.linkedStrategies || []), strategy];
                            setSelectedItem({ ...selectedItem, linkedStrategies: updated });
                          }}
                        >
                          <Link2 className="h-3 w-3 mr-1" />
                          {strategy}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {itemType === "okr" && (
                <div>
                  <Label htmlFor="assign-person">Assign To</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Assign this OKR to a team member
                  </p>
                  <Select
                    value={selectedItem.assignedTo || ""}
                    onValueChange={(value) =>
                      setSelectedItem({ ...selectedItem, assignedTo: value })
                    }
                  >
                    <SelectTrigger id="assign-person" data-testid="select-assigned-to">
                      <SelectValue placeholder="Select person..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePeople.map((person) => (
                        <SelectItem key={person} value={person}>
                          {person}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => {
                  toast({
                    title: "Changes Saved",
                    description: "Links updated successfully",
                  });
                  setEditDialogOpen(false);
                }}
                data-testid="button-save-edit"
              >
                Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quarterly Planning Wizard */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <DialogTitle>Quarterly Planning Wizard</DialogTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Step {wizardStep} of 4
            </p>
            <Progress value={(wizardStep / 4) * 100} className="mt-2" />
          </DialogHeader>

          <div className="space-y-6 pt-4">
            {/* Step 1: Select Quarter */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Select Quarter</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose the quarter you want to plan for
                  </p>
                  <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                    <SelectTrigger data-testid="select-quarter">
                      <SelectValue placeholder="Select a quarter..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Q2 2025">Q2 2025</SelectItem>
                      <SelectItem value="Q3 2025">Q3 2025</SelectItem>
                      <SelectItem value="Q4 2025">Q4 2025</SelectItem>
                      <SelectItem value="Q1 2026">Q1 2026</SelectItem>
                    </SelectContent>
                  </Select>
                  {!selectedQuarter && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Please select a quarter to continue
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => setWizardOpen(false)}
                    variant="outline"
                    data-testid="button-wizard-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={nextWizardStep}
                    disabled={!selectedQuarter}
                    data-testid="button-wizard-next-1"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Copy from Prior Quarter */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Copy from Prior Quarter</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Select OKRs and Rocks from Q1 2025{selectedQuarter ? ` to continue in ${selectedQuarter}` : ''}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-3">OKRs from Q1 2025</h4>
                  <div className="space-y-2">
                    {mockOKRs.map((okr) => (
                      <Card key={okr.id} className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedOKRs.includes(okr.id)}
                            onCheckedChange={() => toggleOKRSelection(okr.id)}
                            data-testid={`checkbox-okr-${okr.id}`}
                          />
                          <div className="flex-1">
                            <p className="font-medium">{okr.objective}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {okr.department} • Progress: {okr.progress}%
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Rocks from Q1 2025</h4>
                  <div className="space-y-2">
                    {mockRocks.map((rock) => (
                      <Card key={rock.id} className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedRocks.includes(rock.id)}
                            onCheckedChange={() => toggleRockSelection(rock.id)}
                            data-testid={`checkbox-rock-${rock.id}`}
                          />
                          <div className="flex-1">
                            <p className="font-medium">{rock.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Owner: {rock.owner} • Status: {rock.status}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between gap-2">
                  <Button
                    onClick={previousWizardStep}
                    variant="outline"
                    data-testid="button-wizard-back-2"
                  >
                    Back
                  </Button>
                  <Button onClick={nextWizardStep} data-testid="button-wizard-next-2">
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: AI Proposals */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    AI-Generated Proposals
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Based on your company's goals and prior quarter performance, we recommend:
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Proposed New OKRs</h4>
                  <div className="space-y-2">
                    {[
                      "Expand into Asia-Pacific region",
                      "Launch mobile app v2.0",
                      "Achieve ISO 27001 certification",
                    ].map((okr) => (
                      <Card key={okr} className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={proposedOKRs.includes(okr)}
                            onCheckedChange={() => toggleProposedOKR(okr)}
                            data-testid={`checkbox-proposed-okr-${okr}`}
                          />
                          <div className="flex-1">
                            <p className="font-medium">{okr}</p>
                            <Badge variant="secondary" className="mt-2">
                              <Sparkles className="h-3 w-3 mr-1" />
                              AI Suggested
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Proposed New Rocks</h4>
                  <div className="space-y-2">
                    {[
                      "Implement AI-powered analytics",
                      "Open regional offices in APAC",
                      "Complete security audit",
                    ].map((rock) => (
                      <Card key={rock} className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={proposedRocks.includes(rock)}
                            onCheckedChange={() => toggleProposedRock(rock)}
                            data-testid={`checkbox-proposed-rock-${rock}`}
                          />
                          <div className="flex-1">
                            <p className="font-medium">{rock}</p>
                            <Badge variant="secondary" className="mt-2">
                              <Sparkles className="h-3 w-3 mr-1" />
                              AI Suggested
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between gap-2">
                  <Button
                    onClick={previousWizardStep}
                    variant="outline"
                    data-testid="button-wizard-back-3"
                  >
                    Back
                  </Button>
                  <Button onClick={nextWizardStep} data-testid="button-wizard-next-3">
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Review & Finalize */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Review & Finalize</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Review your selections{selectedQuarter ? ` for ${selectedQuarter}` : ''}
                  </p>
                </div>

                <Card className="p-4 bg-muted/50">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Summary</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Quarter:</p>
                          <p className="font-medium">{selectedQuarter || 'Not selected'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total OKRs:</p>
                          <p className="font-medium">
                            {selectedOKRs.length + proposedOKRs.length}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">From Prior Quarter:</p>
                          <p className="font-medium">{selectedOKRs.length} OKRs</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Rocks:</p>
                          <p className="font-medium">
                            {selectedRocks.length + proposedRocks.length}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {selectedOKRs.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Continued OKRs</h4>
                    <div className="space-y-2">
                      {mockOKRs
                        .filter((okr) => selectedOKRs.includes(okr.id))
                        .map((okr) => (
                          <Card key={okr.id} className="p-3">
                            <p className="font-medium text-sm">{okr.objective}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {okr.department}
                            </p>
                          </Card>
                        ))}
                    </div>
                  </div>
                )}

                {proposedOKRs.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">New OKRs</h4>
                    <div className="space-y-2">
                      {proposedOKRs.map((okr) => (
                        <Card key={okr} className="p-3">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{okr}</p>
                            <Badge variant="secondary" className="text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              AI
                            </Badge>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {selectedRocks.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Continued Rocks</h4>
                    <div className="flex flex-wrap gap-2">
                      {mockRocks
                        .filter((rock) => selectedRocks.includes(rock.id))
                        .map((rock) => (
                          <Badge key={rock.id} variant="outline">
                            {rock.title}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}

                {proposedRocks.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">New Rocks</h4>
                    <div className="flex flex-wrap gap-2">
                      {proposedRocks.map((rock) => (
                        <Badge key={rock} variant="secondary">
                          <Sparkles className="h-3 w-3 mr-1" />
                          {rock}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between gap-2 pt-4">
                  <Button
                    onClick={previousWizardStep}
                    variant="outline"
                    data-testid="button-wizard-back-4"
                  >
                    Back
                  </Button>
                  <Button onClick={completeWizard} data-testid="button-wizard-complete">
                    Create Quarterly Plan
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
