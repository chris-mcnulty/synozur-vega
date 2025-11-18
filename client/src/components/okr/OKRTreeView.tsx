import { useState } from "react";
import { ChevronDown, ChevronRight, Target, TrendingUp, AlertCircle, CheckCircle, Clock, Pause, Ban, Plus, Edit2, Trash2, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KeyResult {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  progress: number;
  weight: number;
  status: string;
  isPromotedToKpi?: boolean;
}

interface BigRock {
  id: string;
  title: string;
  status: string;
  completionPercentage: number;
}

interface Objective {
  id: string;
  title: string;
  description: string;
  level: string;
  parentId?: string;
  progress: number;
  status: string;
  ownerEmail?: string;
  coOwnerIds?: string[];
  keyResults?: KeyResult[];
  bigRocks?: BigRock[];
  children?: Objective[];
}

interface OKRTreeViewProps {
  objectives: Objective[];
  onCreateObjective?: (parentId?: string) => void;
  onEditObjective?: (objective: Objective) => void;
  onDeleteObjective?: (id: string) => void;
  onCreateKeyResult?: (objectiveId: string) => void;
  onEditKeyResult?: (keyResult: KeyResult, objectiveId: string) => void;
  onDeleteKeyResult?: (id: string, objectiveId: string) => void;
  onPromoteKeyResult?: (keyResultId: string) => void;
  onCreateBigRock?: (objectiveId: string, keyResultId?: string) => void;
  onEditBigRock?: (bigRock: BigRock) => void;
  onDeleteBigRock?: (id: string) => void;
  onCheckIn?: (entityType: string, entityId: string) => void;
}

const statusColors = {
  not_started: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", icon: Clock },
  on_track: { bg: "bg-green-100 dark:bg-green-900/20", text: "text-green-600 dark:text-green-400", icon: CheckCircle },
  behind: { bg: "bg-yellow-100 dark:bg-yellow-900/20", text: "text-yellow-600 dark:text-yellow-400", icon: AlertCircle },
  at_risk: { bg: "bg-red-100 dark:bg-red-900/20", text: "text-red-600 dark:text-red-400", icon: AlertCircle },
  completed: { bg: "bg-blue-100 dark:bg-blue-900/20", text: "text-blue-600 dark:text-blue-400", icon: CheckCircle },
  postponed: { bg: "bg-orange-100 dark:bg-orange-900/20", text: "text-orange-600 dark:text-orange-400", icon: Pause },
  cancelled: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", icon: Ban },
};

const levelColors = {
  organization: "border-l-4 border-l-primary",
  team: "border-l-4 border-l-blue-500",
  individual: "border-l-4 border-l-green-500",
};

export function OKRTreeView({
  objectives,
  onCreateObjective,
  onEditObjective,
  onDeleteObjective,
  onCreateKeyResult,
  onEditKeyResult,
  onDeleteKeyResult,
  onPromoteKeyResult,
  onCreateBigRock,
  onEditBigRock,
  onDeleteBigRock,
  onCheckIn,
}: OKRTreeViewProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const toggleDetails = (id: string) => {
    const newExpanded = new Set(expandedDetails);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedDetails(newExpanded);
  };

  const renderObjectiveNode = (objective: Objective, depth: number = 0) => {
    const isExpanded = expandedNodes.has(objective.id);
    const showDetails = expandedDetails.has(objective.id);
    const hasChildren = objective.children && objective.children.length > 0;
    const statusConfig = statusColors[objective.status as keyof typeof statusColors] || statusColors.not_started;
    const StatusIcon = statusConfig.icon;

    return (
      <div key={objective.id} className={cn("mb-2", depth > 0 && "ml-8")}>
        <Card className={cn("p-4 hover-elevate", levelColors[objective.level as keyof typeof levelColors])}>
          {/* Header Row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start flex-1 gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => toggleNode(objective.id)}
                data-testid={`button-expand-${objective.id}`}
              >
                {hasChildren ? (
                  isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                ) : (
                  <div className="h-4 w-4" />
                )}
              </Button>

              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Target className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium text-lg">{objective.title}</h3>
                  <Badge variant="secondary" className="ml-2">
                    {objective.level}
                  </Badge>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge className={cn("gap-1", statusConfig.bg, statusConfig.text)}>
                          <StatusIcon className="h-3 w-3" />
                          {objective.status.replace("_", " ")}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>Current status of this objective</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {objective.keyResults && objective.keyResults.length > 0 && (
                    <Badge variant="outline" className="gap-1">
                      {objective.keyResults.length} KR{objective.keyResults.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {objective.bigRocks && objective.bigRocks.length > 0 && (
                    <Badge variant="outline" className="gap-1">
                      {objective.bigRocks.length} Big Rock{objective.bigRocks.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                {objective.description && (
                  <p className="text-sm text-muted-foreground mt-1">{objective.description}</p>
                )}

                <div className="flex items-center gap-4 mt-2">
                  {objective.ownerEmail && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      {objective.ownerEmail}
                    </div>
                  )}
                  {objective.coOwnerIds && objective.coOwnerIds.length > 0 && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {objective.coOwnerIds.length} co-owner{objective.coOwnerIds.length > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end gap-1">
                <span className="text-2xl font-bold">{objective.progress}%</span>
                <Progress value={objective.progress} className="w-24" />
              </div>
              
              <div className="flex gap-1">
                {onCreateKeyResult && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onCreateKeyResult(objective.id)}
                          data-testid={`button-add-kr-quick-${objective.id}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add Key Result</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {onCheckIn && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onCheckIn("objective", objective.id)}
                    data-testid={`button-checkin-${objective.id}`}
                  >
                    <TrendingUp className="h-4 w-4" />
                  </Button>
                )}
                {onEditObjective && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEditObjective(objective)}
                    data-testid={`button-edit-${objective.id}`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
                {onDeleteObjective && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDeleteObjective(objective.id)}
                    data-testid={`button-delete-${objective.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleDetails(objective.id)}
                  data-testid={`button-details-${objective.id}`}
                >
                  {showDetails ? "Hide" : "Show"} Details
                </Button>
              </div>
            </div>
          </div>

          {/* Details Section */}
          {showDetails && (
            <div className="mt-4 pt-4 border-t space-y-4">
              {/* Key Results */}
              {objective.keyResults && objective.keyResults.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">Key Results</h4>
                    {onCreateKeyResult && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCreateKeyResult(objective.id)}
                        data-testid={`button-add-kr-${objective.id}`}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Key Result
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {objective.keyResults.map((kr) => {
                      const krStatusConfig = statusColors[kr.status as keyof typeof statusColors] || statusColors.not_started;
                      return (
                        <div
                          key={kr.id}
                          className="flex items-center justify-between p-2 bg-secondary/20 rounded-md"
                          data-testid={`kr-item-${kr.id}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{kr.title}</span>
                              <Badge variant="outline" className="text-xs">
                                Weight: {kr.weight}%
                              </Badge>
                              {kr.isPromotedToKpi && (
                                <Badge variant="secondary" className="text-xs">
                                  KPI
                                </Badge>
                              )}
                              <Badge className={cn("text-xs", krStatusConfig.bg, krStatusConfig.text)}>
                                {kr.status.replace("_", " ")}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {kr.currentValue} / {kr.targetValue}
                              </span>
                              <Progress value={kr.progress} className="flex-1 max-w-xs h-2" />
                              <span className="text-xs font-medium">{kr.progress}%</span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {onPromoteKeyResult && !kr.isPromotedToKpi && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onPromoteKeyResult(kr.id)}
                                data-testid={`button-promote-kr-${kr.id}`}
                              >
                                Promote to KPI
                              </Button>
                            )}
                            {onCheckIn && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onCheckIn("key_result", kr.id)}
                                data-testid={`button-checkin-kr-${kr.id}`}
                              >
                                <TrendingUp className="h-3 w-3" />
                              </Button>
                            )}
                            {onEditKeyResult && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onEditKeyResult(kr, objective.id)}
                                data-testid={`button-edit-kr-${kr.id}`}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            )}
                            {onDeleteKeyResult && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onDeleteKeyResult(kr.id, objective.id)}
                                data-testid={`button-delete-kr-${kr.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Big Rocks */}
              {objective.bigRocks && objective.bigRocks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">Big Rocks (Initiatives)</h4>
                    {onCreateBigRock && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCreateBigRock(objective.id)}
                        data-testid={`button-add-bigrock-${objective.id}`}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Big Rock
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {objective.bigRocks.map((rock) => {
                      const rockStatusConfig = statusColors[rock.status as keyof typeof statusColors] || statusColors.not_started;
                      return (
                        <div
                          key={rock.id}
                          className="flex items-center justify-between p-2 bg-secondary/20 rounded-md"
                          data-testid={`bigrock-item-${rock.id}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{rock.title}</span>
                              <Badge className={cn("text-xs", rockStatusConfig.bg, rockStatusConfig.text)}>
                                {rock.status.replace("_", " ")}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Progress value={rock.completionPercentage} className="flex-1 max-w-xs h-2" />
                              <span className="text-xs font-medium">{rock.completionPercentage}%</span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {onCheckIn && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onCheckIn("big_rock", rock.id)}
                                data-testid={`button-checkin-bigrock-${rock.id}`}
                              >
                                <TrendingUp className="h-3 w-3" />
                              </Button>
                            )}
                            {onEditBigRock && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onEditBigRock(rock)}
                                data-testid={`button-edit-bigrock-${rock.id}`}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            )}
                            {onDeleteBigRock && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onDeleteBigRock(rock.id)}
                                data-testid={`button-delete-bigrock-${rock.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add buttons if no KRs or Big Rocks */}
              {(!objective.keyResults || objective.keyResults.length === 0) && onCreateKeyResult && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => onCreateKeyResult(objective.id)}
                  data-testid={`button-add-first-kr-${objective.id}`}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Key Result
                </Button>
              )}
              
              {(!objective.bigRocks || objective.bigRocks.length === 0) && onCreateBigRock && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => onCreateBigRock(objective.id)}
                  data-testid={`button-add-first-bigrock-${objective.id}`}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Big Rock
                </Button>
              )}
            </div>
          )}

          {/* Add Child Objective Button */}
          {onCreateObjective && objective.level !== "individual" && (
            <div className="mt-3 pt-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => onCreateObjective(objective.id)}
                data-testid={`button-add-child-${objective.id}`}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Child Objective
              </Button>
            </div>
          )}
        </Card>

        {/* Render children recursively */}
        {hasChildren && isExpanded && (
          <div className="mt-2">
            {objective.children!.map((child) => renderObjectiveNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Organize objectives into a tree structure
  const buildTree = (objectives: Objective[]): Objective[] => {
    const objectiveMap = new Map<string, Objective>();
    const rootObjectives: Objective[] = [];

    // First pass: create map of all objectives
    objectives.forEach((obj) => {
      objectiveMap.set(obj.id, { ...obj, children: [] });
    });

    // Second pass: build tree structure
    objectives.forEach((obj) => {
      const current = objectiveMap.get(obj.id)!;
      if (obj.parentId) {
        const parent = objectiveMap.get(obj.parentId);
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.push(current);
        } else {
          rootObjectives.push(current);
        }
      } else {
        rootObjectives.push(current);
      }
    });

    return rootObjectives;
  };

  const treeObjectives = buildTree(objectives);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">OKR Alignment</h2>
        {onCreateObjective && (
          <Button onClick={() => onCreateObjective()} data-testid="button-add-root-objective">
            <Plus className="h-4 w-4 mr-2" />
            Add Organization Objective
          </Button>
        )}
      </div>

      {treeObjectives.length === 0 ? (
        <Card className="p-8 text-center">
          <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No objectives yet</h3>
          <p className="text-muted-foreground mb-4">
            Start by creating your first organization-level objective
          </p>
          {onCreateObjective && (
            <Button onClick={() => onCreateObjective()} data-testid="button-create-first-objective">
              <Plus className="h-4 w-4 mr-2" />
              Create First Objective
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {treeObjectives.map((obj) => renderObjectiveNode(obj))}
        </div>
      )}
    </div>
  );
}