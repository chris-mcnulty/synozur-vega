import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, CheckCircle2, Calendar } from "lucide-react";

const mockOKRs = [
  {
    id: "1",
    objective: "Increase Market Share",
    progress: 65,
    keyResults: [
      { text: "Acquire 500 new customers", progress: 70 },
      { text: "Achieve 95% customer satisfaction", progress: 60 },
      { text: "Launch in 3 new markets", progress: 65 },
    ],
  },
  {
    id: "2",
    objective: "Build World-Class Product",
    progress: 45,
    keyResults: [
      { text: "Ship 5 major features", progress: 40 },
      { text: "Reduce bugs by 50%", progress: 55 },
      { text: "Improve performance by 30%", progress: 40 },
    ],
  },
];

const mockKPIs = [
  { label: "Monthly Recurring Revenue", value: "$285K", change: "+12%" },
  { label: "Customer Churn Rate", value: "2.3%", change: "-0.5%" },
  { label: "Net Promoter Score", value: "68", change: "+5" },
];

const mockRocks = [
  { id: "1", title: "Complete Product Redesign", status: "in-progress" },
  { id: "2", title: "Hire 5 Engineers", status: "completed" },
  { id: "3", title: "Launch Marketing Campaign", status: "in-progress" },
  { id: "4", title: "Integrate Payment Gateway", status: "completed" },
];

export default function Planning() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Planning</h1>
          <p className="text-muted-foreground">
            Track OKRs, KPIs, and quarterly rocks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Planner Synced
          </Badge>
          <Button variant="outline" size="sm" className="gap-2" data-testid="button-sync-planner">
            <Calendar className="h-4 w-4" />
            Sync Now
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {mockKPIs.map((kpi, index) => (
          <Card key={index} data-testid={`kpi-card-${index}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold">{kpi.value}</span>
                <Badge
                  variant={kpi.change.startsWith("+") ? "default" : "secondary"}
                >
                  {kpi.change}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Objectives & Key Results</h2>
            <Button size="sm" className="gap-2" data-testid="button-add-okr">
              <Plus className="h-4 w-4" />
              Add OKR
            </Button>
          </div>
          {mockOKRs.map((okr) => (
            <Card key={okr.id} data-testid={`okr-card-${okr.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-lg">{okr.objective}</CardTitle>
                  <Badge variant="secondary">{okr.progress}%</Badge>
                </div>
                <Progress value={okr.progress} className="mt-2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {okr.keyResults.map((kr, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{kr.text}</span>
                        <span className="font-medium">{kr.progress}%</span>
                      </div>
                      <Progress value={kr.progress} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
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
                {mockRocks.map((rock) => (
                  <div
                    key={rock.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover-elevate"
                    data-testid={`rock-${rock.id}`}
                  >
                    {rock.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground shrink-0" />
                    )}
                    <span className={rock.status === "completed" ? "line-through text-muted-foreground" : ""}>
                      {rock.title}
                    </span>
                    {rock.status === "in-progress" && (
                      <Badge variant="secondary" className="ml-auto">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
