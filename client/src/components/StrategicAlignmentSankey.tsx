import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, CheckCircle, Target, Lightbulb, ArrowRight } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { useVocabulary } from "@/contexts/VocabularyContext";
import { sankey, sankeyLinkHorizontal, SankeyNode, SankeyLink } from "d3-sankey";
import { cn } from "@/lib/utils";
import type { Foundation, Strategy, Objective, KeyResult, BigRock } from "@shared/schema";

interface AlignmentData {
  foundation: Foundation | null;
  strategies: Strategy[];
  objectives: Objective[];
  keyResults: KeyResult[];
  bigRocks: BigRock[];
}

interface SankeyNodeData {
  id: string;
  name: string;
  type: "goal" | "strategy" | "objective" | "keyResult" | "bigRock";
  status?: string;
  progress?: number;
  layer: number;
}

interface SankeyLinkData {
  source: number;
  target: number;
  value: number;
  status?: string;
}

interface Recommendation {
  type: "gap" | "risk" | "success";
  message: string;
  action?: string;
  actionLink?: string;
}

const LAYER_COLORS: Record<string, string> = {
  goal: "#818CF8",
  strategy: "#60A5FA",
  objective: "#34D399",
  keyResult: "#FBBF24",
  bigRock: "#F472B6",
};

const STATUS_COLORS: Record<string, string> = {
  on_track: "#22C55E",
  at_risk: "#F59E0B",
  behind: "#EF4444",
  completed: "#6366F1",
  not_started: "#9CA3AF",
};

interface Props {
  year: number;
  quarter?: number;
}

export function StrategicAlignmentSankey({ year, quarter }: Props) {
  const { currentTenant } = useTenant();
  const { t } = useVocabulary();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<number | null>(null);

  const { data: alignmentData, isLoading } = useQuery<AlignmentData>({
    queryKey: ["/api/strategic-alignment", currentTenant?.id, year, quarter],
    queryFn: async () => {
      if (!currentTenant) return { foundation: null, strategies: [], objectives: [], keyResults: [], bigRocks: [] };
      const params = new URLSearchParams({
        year: String(year),
        ...(quarter && { quarter: String(quarter) }),
      });
      const res = await fetch(`/api/export/strategic-alignment?${params}`);
      if (!res.ok) throw new Error("Failed to fetch alignment data");
      return res.json();
    },
    enabled: !!currentTenant,
  });

  const { nodes, links, recommendations, width, height } = useMemo(() => {
    if (!alignmentData) {
      return { nodes: [], links: [], recommendations: [], width: 900, height: 400 };
    }

    const { foundation, strategies, objectives, keyResults, bigRocks } = alignmentData;
    const nodeList: SankeyNodeData[] = [];
    const linkList: SankeyLinkData[] = [];
    const recommendations: Recommendation[] = [];

    const goals = foundation?.annualGoals || [];
    const goalIdMap = new Map<string, number>();
    const strategyIdMap = new Map<string, number>();
    const objectiveIdMap = new Map<string, number>();
    const krIdMap = new Map<string, number>();

    goals.forEach((goal, idx) => {
      const nodeIdx = nodeList.length;
      goalIdMap.set(`goal-${idx}`, nodeIdx);
      nodeList.push({
        id: `goal-${idx}`,
        name: typeof goal === "string" ? goal : (goal as { goal?: string }).goal || `Goal ${idx + 1}`,
        type: "goal",
        layer: 0,
      });
    });

    strategies.forEach((strategy) => {
      const nodeIdx = nodeList.length;
      strategyIdMap.set(strategy.id, nodeIdx);
      nodeList.push({
        id: strategy.id,
        name: strategy.title,
        type: "strategy",
        status: strategy.status || undefined,
        layer: 1,
      });

      const linkedGoals = strategy.linkedGoals || [];
      if (linkedGoals.length === 0 && goals.length > 0) {
        linkList.push({ source: 0, target: nodeIdx, value: 1 });
      } else {
        linkedGoals.forEach((goalId: string) => {
          const goalIdx = parseInt(goalId);
          const sourceIdx = goalIdMap.get(`goal-${goalIdx}`);
          if (sourceIdx !== undefined) {
            linkList.push({ source: sourceIdx, target: nodeIdx, value: 1 });
          }
        });
      }
    });

    objectives.forEach((obj) => {
      const nodeIdx = nodeList.length;
      objectiveIdMap.set(obj.id, nodeIdx);
      nodeList.push({
        id: obj.id,
        name: obj.title,
        type: "objective",
        status: obj.status || undefined,
        progress: obj.progress || 0,
        layer: 2,
      });

      const linkedStrategies = obj.linkedStrategies || [];
      if (linkedStrategies.length > 0) {
        linkedStrategies.forEach((stratId: string) => {
          const strategyIdx = strategyIdMap.get(stratId);
          if (strategyIdx !== undefined) {
            linkList.push({ source: strategyIdx, target: nodeIdx, value: 1, status: obj.status || undefined });
          }
        });
      } else if (strategies.length > 0) {
        const firstStratIdx = nodeList.findIndex(n => n.type === "strategy");
        if (firstStratIdx >= 0) {
          linkList.push({ source: firstStratIdx, target: nodeIdx, value: 1, status: obj.status || undefined });
        }
      }
    });

    keyResults.forEach((kr) => {
      const nodeIdx = nodeList.length;
      krIdMap.set(kr.id, nodeIdx);
      const progress = kr.targetValue ? Math.min(100, ((kr.currentValue || 0) / kr.targetValue) * 100) : 0;
      nodeList.push({
        id: kr.id,
        name: kr.title,
        type: "keyResult",
        progress,
        layer: 3,
      });

      const objIdx = objectiveIdMap.get(kr.objectiveId);
      if (objIdx !== undefined) {
        linkList.push({ source: objIdx, target: nodeIdx, value: 1 });
      }
    });

    bigRocks.forEach((rock) => {
      const nodeIdx = nodeList.length;
      nodeList.push({
        id: rock.id,
        name: rock.title,
        type: "bigRock",
        status: rock.status || undefined,
        progress: rock.completionPercentage || 0,
        layer: 4,
      });

      if (rock.keyResultId) {
        const krIdx = krIdMap.get(rock.keyResultId);
        if (krIdx !== undefined) {
          linkList.push({ source: krIdx, target: nodeIdx, value: 1, status: rock.status || undefined });
        }
      } else if (rock.objectiveId) {
        const objIdx = objectiveIdMap.get(rock.objectiveId);
        if (objIdx !== undefined) {
          linkList.push({ source: objIdx, target: nodeIdx, value: 1, status: rock.status || undefined });
        }
      }
    });

    const strategiesWithoutObjectives = strategies.filter(
      (s) => !objectives.some((o) => (o.linkedStrategies || []).includes(s.id))
    );
    if (strategiesWithoutObjectives.length > 0) {
      recommendations.push({
        type: "gap",
        message: `${strategiesWithoutObjectives.length} ${strategiesWithoutObjectives.length === 1 ? "strategy has" : "strategies have"} no aligned ${t("objective", "plural").toLowerCase()}`,
        action: `Create ${t("objective", "plural").toLowerCase()} for these strategies`,
        actionLink: "/planning",
      });
    }

    const objectivesWithoutKRs = objectives.filter(
      (o) => !keyResults.some((kr) => kr.objectiveId === o.id)
    );
    if (objectivesWithoutKRs.length > 0) {
      recommendations.push({
        type: "gap",
        message: `${objectivesWithoutKRs.length} ${t("objective", "plural").toLowerCase()} ${objectivesWithoutKRs.length === 1 ? "has" : "have"} no ${t("keyResult", "plural").toLowerCase()}`,
        action: `Add ${t("keyResult", "plural").toLowerCase()} to measure progress`,
        actionLink: "/planning",
      });
    }

    const atRiskObjectives = objectives.filter((o) => o.status === "at_risk" || o.status === "behind");
    if (atRiskObjectives.length > 0) {
      recommendations.push({
        type: "risk",
        message: `${atRiskObjectives.length} ${t("objective", "plural").toLowerCase()} ${atRiskObjectives.length === 1 ? "is" : "are"} at risk or behind`,
        action: "Schedule review meetings",
        actionLink: "/focus-rhythm",
      });
    }

    const completedObjectives = objectives.filter((o) => o.status === "completed");
    if (completedObjectives.length > 0 && completedObjectives.length >= objectives.length * 0.5) {
      recommendations.push({
        type: "success",
        message: `${Math.round((completedObjectives.length / objectives.length) * 100)}% of ${t("objective", "plural").toLowerCase()} are completed!`,
        action: "Celebrate and plan next quarter",
      });
    }

    const height = Math.max(400, nodeList.length * 25);
    const width = 900;

    return { nodes: nodeList, links: linkList, recommendations, width, height };
  }, [alignmentData, t]);

  const sankeyData = useMemo(() => {
    if (nodes.length === 0 || links.length === 0) return null;

    const validLinks = links.filter(
      (link) => link.source < nodes.length && link.target < nodes.length && link.source !== link.target
    );

    if (validLinks.length === 0) return null;

    try {
      const sankeyGenerator = sankey<SankeyNodeData, SankeyLinkData>()
        .nodeWidth(20)
        .nodePadding(12)
        .extent([[50, 20], [width - 50, height - 20]]);

      const graph = sankeyGenerator({
        nodes: nodes.map((d) => ({ ...d })),
        links: validLinks.map((d) => ({ ...d })),
      });

      return graph;
    } catch (e) {
      console.error("Sankey generation error:", e);
      return null;
    }
  }, [nodes, links, width, height]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!sankeyData || sankeyData.nodes.length === 0) {
    const hasGoals = (alignmentData?.foundation?.annualGoals?.length ?? 0) > 0;
    const hasStrategies = (alignmentData?.strategies?.length || 0) > 0;
    const hasObjectives = (alignmentData?.objectives?.length || 0) > 0;
    
    let message = "No alignment data available. Add goals, strategies, and objectives to see the flow.";
    if (hasGoals || hasStrategies) {
      if (!hasObjectives) {
        message = `No ${t("objective", "plural").toLowerCase()} found for this quarter. Create ${t("objective", "plural").toLowerCase()} linked to strategies to see the alignment flow.`;
      } else {
        message = `Your goals, strategies, and ${t("objective", "plural").toLowerCase()} need to be linked together to visualize the flow. Edit items to add links.`;
      }
    }
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Strategic Alignment Flow
          </CardTitle>
          <CardDescription>Visualize how goals flow through strategies, objectives, and key results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>{message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const layerLabels = [
    { label: t("goal", "plural"), x: 60 },
    { label: t("strategy", "plural"), x: width * 0.25 },
    { label: t("objective", "plural"), x: width * 0.5 },
    { label: t("keyResult", "plural"), x: width * 0.75 },
    { label: t("bigRock", "plural"), x: width - 60 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Strategic Alignment Flow
        </CardTitle>
        <CardDescription>
          Visualize how annual goals cascade through strategies to objectives, key results, and execution
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 flex-wrap">
          {Object.entries(LAYER_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
              <span className="capitalize">
                {type === "keyResult" 
                  ? t("keyResult", "plural") 
                  : type === "bigRock" 
                    ? t("bigRock", "plural") 
                    : type === "objective"
                      ? t("objective", "plural")
                      : type === "strategy"
                        ? t("strategy", "plural")
                        : type === "goal"
                          ? t("goal", "plural")
                          : type}
              </span>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto border rounded-lg bg-muted/20">
          <svg width={width} height={height + 40} className="min-w-[900px]">
            <g transform="translate(0, 30)">
              {layerLabels.map((layer, idx) => (
                <text
                  key={idx}
                  x={layer.x}
                  y={-10}
                  textAnchor="middle"
                  className="fill-muted-foreground text-xs font-medium"
                >
                  {layer.label}
                </text>
              ))}

              {sankeyData.links.map((link, idx) => {
                const linkData = link as SankeyLink<SankeyNodeData, SankeyLinkData>;
                const isHovered = hoveredLink === idx || 
                  hoveredNode === (linkData.source as SankeyNode<SankeyNodeData, SankeyLinkData>).id ||
                  hoveredNode === (linkData.target as SankeyNode<SankeyNodeData, SankeyLinkData>).id;
                const status = (link as any).status;
                const color = status ? STATUS_COLORS[status] || "#9CA3AF" : "#9CA3AF";

                return (
                  <path
                    key={idx}
                    d={sankeyLinkHorizontal()(linkData) || ""}
                    fill="none"
                    stroke={color}
                    strokeWidth={Math.max(2, linkData.width || 1)}
                    strokeOpacity={isHovered ? 0.8 : 0.3}
                    onMouseEnter={() => setHoveredLink(idx)}
                    onMouseLeave={() => setHoveredLink(null)}
                    className="transition-opacity cursor-pointer"
                  />
                );
              })}

              {sankeyData.nodes.map((node) => {
                const nodeData = node as SankeyNode<SankeyNodeData, SankeyLinkData>;
                const isHovered = hoveredNode === nodeData.id;
                const nodeHeight = (nodeData.y1 || 0) - (nodeData.y0 || 0);
                const color = LAYER_COLORS[nodeData.type] || "#6B7280";

                return (
                  <g
                    key={nodeData.id}
                    onMouseEnter={() => setHoveredNode(nodeData.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={nodeData.x0}
                      y={nodeData.y0}
                      width={(nodeData.x1 || 0) - (nodeData.x0 || 0)}
                      height={nodeHeight}
                      fill={color}
                      opacity={isHovered ? 1 : 0.8}
                      rx={3}
                      className="transition-opacity"
                    />
                    {isHovered && (
                      <foreignObject
                        x={(nodeData.x0 || 0) + 25}
                        y={(nodeData.y0 || 0) - 5}
                        width={200}
                        height={60}
                        className="pointer-events-none"
                      >
                        <div className="bg-popover border rounded-md shadow-lg p-2 text-xs">
                          <div className="font-medium truncate">{nodeData.name}</div>
                          {nodeData.status && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {nodeData.status.replace("_", " ")}
                            </Badge>
                          )}
                          {nodeData.progress !== undefined && (
                            <div className="mt-1 text-muted-foreground">
                              Progress: {Math.round(nodeData.progress)}%
                            </div>
                          )}
                        </div>
                      </foreignObject>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Recommended Actions
            </h4>
            <div className="grid gap-2">
              {recommendations.map((rec, idx) => (
                <Alert
                  key={idx}
                  className={cn(
                    "py-2",
                    rec.type === "gap" && "border-amber-500/50 bg-amber-500/10",
                    rec.type === "risk" && "border-red-500/50 bg-red-500/10",
                    rec.type === "success" && "border-green-500/50 bg-green-500/10"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {rec.type === "gap" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                    {rec.type === "risk" && <AlertTriangle className="h-4 w-4 text-red-500" />}
                    {rec.type === "success" && <CheckCircle className="h-4 w-4 text-green-500" />}
                    <AlertDescription className="flex-1 text-sm">
                      {rec.message}
                    </AlertDescription>
                    {rec.action && (
                      <Button variant="ghost" size="sm" className="ml-auto shrink-0" asChild={!!rec.actionLink}>
                        {rec.actionLink ? (
                          <a href={rec.actionLink}>
                            {rec.action}
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </a>
                        ) : (
                          <>
                            {rec.action}
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </Alert>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
