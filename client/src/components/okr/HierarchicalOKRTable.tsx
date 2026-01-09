import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/hooks/use-permissions";
import { 
  ChevronRight, 
  ChevronDown, 
  Target, 
  Gauge, 
  MoreHorizontal,
  Pencil,
  Plus,
  CheckCircle2,
  Trash2,
  FolderPlus,
  ArrowDownFromLine,
  Lock,
  Unlock,
  Scale,
  FileSpreadsheet,
  AlertCircle,
  Link2,
  Copy,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Clock
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format, differenceInDays, endOfQuarter } from "date-fns";
import { CircularProgress } from "./CircularProgress";

interface KeyResult {
  id: string;
  title: string;
  description?: string;
  progress: number;
  status: string;
  ownerEmail?: string;
  ownerId?: string;
  createdBy?: string;
  targetValue?: number;
  currentValue?: number;
  startValue?: number;
  unit?: string;
  metricType?: string;
  weight?: number;
  isWeightLocked?: boolean;
  // Excel integration fields
  excelFileId?: string | null;
  excelFileName?: string | null;
  excelSheetName?: string | null;
  excelCellReference?: string | null;
  excelLastSyncAt?: string | null;
  excelSyncError?: string | null;
}

interface BigRock {
  id: string;
  title: string;
  status: string;
  completionPercentage: number;
}

interface HierarchyObjective {
  id: string;
  title: string;
  description: string;
  level: string;
  parentId?: string;
  progress: number;
  status: string;
  statusOverride?: string;
  ownerEmail?: string;
  ownerId?: string;
  createdBy?: string;
  quarter: number;
  year: number;
  teamId?: string;
  keyResults: KeyResult[];
  childObjectives: HierarchyObjective[];
  alignedObjectives?: HierarchyObjective[]; // Objectives that "ladder up" to this one
  isAligned?: boolean; // Flag indicating this objective is rendered as an aligned child
  linkedBigRocks: BigRock[];
  lastUpdated: Date | null;
}

interface Team {
  id: string;
  name: string;
}

interface HierarchicalOKRTableProps {
  objectives: HierarchyObjective[];
  teams?: Team[];
  onSelectObjective?: (objective: HierarchyObjective) => void;
  onSelectKeyResult?: (keyResult: KeyResult, parentObjective: HierarchyObjective) => void;
  onEditObjective?: (objective: HierarchyObjective) => void;
  onEditKeyResult?: (keyResult: KeyResult) => void;
  onAddChildObjective?: (parentId: string) => void;
  onAlignObjective?: (targetObjectiveId: string) => void; // Link an existing objective to this one
  onAddKeyResult?: (objectiveId: string) => void;
  onCheckInObjective?: (objective: HierarchyObjective) => void;
  onCheckInKeyResult?: (keyResult: KeyResult) => void;
  onDeleteObjective?: (objectiveId: string) => void;
  onDeleteKeyResult?: (keyResultId: string) => void;
  onCloseObjective?: (objectiveId: string) => void;
  onReopenObjective?: (objectiveId: string) => void;
  onCloseKeyResult?: (keyResultId: string) => void;
  onReopenKeyResult?: (keyResultId: string) => void;
  onCloneObjective?: (objective: HierarchyObjective) => void;
  onManageWeights?: (objectiveId: string) => void;
}

function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case "on_track":
    case "on track":
      return "bg-green-500";
    case "behind":
      return "bg-yellow-500";
    case "at_risk":
    case "at risk":
      return "bg-red-500";
    case "completed":
      return "bg-blue-500";
    case "not_started":
    case "not started":
    case "closed":
    default:
      return "bg-gray-400";
  }
}

function getStatusBadgeStyles(status: string): string {
  switch (status?.toLowerCase()) {
    case "on_track":
    case "on track":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800";
    case "behind":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800";
    case "at_risk":
    case "at risk":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
    case "completed":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800";
    case "not_started":
    case "not started":
    case "closed":
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800";
  }
}

function getStatusLabel(status: string): string {
  switch (status?.toLowerCase()) {
    case "on_track":
      return "On Track";
    case "at_risk":
      return "At Risk";
    case "behind":
      return "Behind";
    case "completed":
      return "Completed";
    case "closed":
      return "Closed";
    case "not_started":
      return "Not Started";
    default:
      return status || "Not Set";
  }
}

function getQuarterLabel(quarter: number | null | undefined): string {
  if (quarter === 0 || quarter === null || quarter === undefined) return "Annual";
  return `Q${quarter}`;
}

type PaceStatus = 'ahead' | 'on_track' | 'behind' | 'at_risk' | 'no_data' | 'completed';
type RiskSignal = 'stalled' | 'attention_needed' | 'accelerating' | 'none';

interface PaceInfo {
  status: PaceStatus;
  icon: typeof TrendingUp;
  projectedEndProgress: number;
  riskSignal: RiskSignal;
  percentageThrough: number;
  expectedProgress: number;
  isPeriodEnded: boolean;
}

function calculateSimplePace(progress: number, quarter: number, year: number, daysSinceLastCheckIn?: number | null): PaceInfo {
  const now = new Date();
  const quarterStartMonth = (quarter - 1) * 3;
  const startDate = new Date(year, quarterStartMonth, 1);
  const endDate = endOfQuarter(startDate);
  
  const totalDays = Math.max(1, differenceInDays(endDate, startDate));
  const elapsedDays = Math.max(0, Math.min(differenceInDays(now, startDate), totalDays));
  const isPeriodEnded = differenceInDays(now, startDate) > totalDays;
  
  const percentageThrough = isPeriodEnded ? 100 : (elapsedDays / totalDays) * 100;
  const expectedProgress = percentageThrough;
  const gap = progress - expectedProgress;
  const gapThreshold = 10;
  
  let projectedEndProgress = progress;
  if (!isPeriodEnded && percentageThrough > 0) {
    projectedEndProgress = Math.min((progress / percentageThrough) * 100, 200);
  }
  
  let riskSignal: RiskSignal = 'none';
  if (daysSinceLastCheckIn !== null && daysSinceLastCheckIn !== undefined && daysSinceLastCheckIn >= 14) {
    riskSignal = 'attention_needed';
  } else if (elapsedDays >= 30 && progress === 0) {
    riskSignal = 'stalled';
  }
  
  if (isPeriodEnded) {
    if (progress >= 100) return { status: 'completed', icon: CheckCircle2, projectedEndProgress: progress, riskSignal, percentageThrough, expectedProgress, isPeriodEnded };
    if (progress >= 70) return { status: 'on_track', icon: Minus, projectedEndProgress: progress, riskSignal, percentageThrough, expectedProgress, isPeriodEnded };
    return { status: 'behind', icon: TrendingDown, projectedEndProgress: progress, riskSignal, percentageThrough, expectedProgress, isPeriodEnded };
  }
  
  if (progress === 0 && elapsedDays < 14) return { status: 'no_data', icon: Clock, projectedEndProgress, riskSignal, percentageThrough, expectedProgress, isPeriodEnded };
  if (gap >= gapThreshold) return { status: 'ahead', icon: TrendingUp, projectedEndProgress, riskSignal, percentageThrough, expectedProgress, isPeriodEnded };
  if (gap <= -gapThreshold * 2) return { status: 'at_risk', icon: AlertTriangle, projectedEndProgress, riskSignal, percentageThrough, expectedProgress, isPeriodEnded };
  if (gap <= -gapThreshold) return { status: 'behind', icon: TrendingDown, projectedEndProgress, riskSignal, percentageThrough, expectedProgress, isPeriodEnded };
  return { status: 'on_track', icon: Minus, projectedEndProgress, riskSignal, percentageThrough, expectedProgress, isPeriodEnded };
}

function getPaceLabel(status: PaceStatus): string {
  const labels: Record<PaceStatus, string> = {
    ahead: 'Ahead',
    on_track: 'On Pace',
    behind: 'Behind',
    at_risk: 'At Risk',
    no_data: 'No Data',
    completed: 'Done',
  };
  return labels[status];
}

function getPaceBadgeStyles(status: PaceStatus): string {
  switch (status) {
    case 'ahead':
    case 'completed':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'on_track':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'behind':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'at_risk':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'no_data':
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function calculateObjectiveProgress(keyResults: KeyResult[], childObjectives: HierarchyObjective[]): number {
  // Calculate progress from Key Results based on their actual currentValue/targetValue
  const krProgressValues = keyResults.map(kr => {
    if (kr.targetValue && kr.targetValue > 0) {
      return {
        progress: Math.min(((kr.currentValue ?? 0) / kr.targetValue) * 100, 100),
        weight: kr.weight ?? (100 / keyResults.length)
      };
    }
    return { progress: kr.progress, weight: kr.weight ?? (100 / keyResults.length) };
  });

  // If there are Key Results, calculate weighted average
  if (krProgressValues.length > 0) {
    const totalWeight = krProgressValues.reduce((sum, kr) => sum + kr.weight, 0);
    if (totalWeight > 0) {
      return krProgressValues.reduce((sum, kr) => sum + (kr.progress * kr.weight / totalWeight), 0);
    }
  }

  // If no Key Results, fall back to child objectives
  if (childObjectives.length > 0) {
    const childProgress = childObjectives.map(obj => obj.progress);
    return childProgress.reduce((sum, p) => sum + p, 0) / childProgress.length;
  }

  return 0;
}

function deriveStatusFromChildren(keyResults: KeyResult[], childObjectives: HierarchyObjective[]): string {
  const allChildren = [
    ...keyResults.map(kr => kr.status),
    ...childObjectives.map(obj => obj.status),
  ];
  
  if (allChildren.length === 0) return "";
  
  const hasAtRisk = allChildren.some(s => s?.toLowerCase() === "at_risk" || s?.toLowerCase() === "at risk");
  const hasBehind = allChildren.some(s => s?.toLowerCase() === "behind");
  const allCompleted = allChildren.every(s => s?.toLowerCase() === "completed");
  const allOnTrack = allChildren.every(s => s?.toLowerCase() === "on_track" || s?.toLowerCase() === "on track");
  
  if (hasAtRisk) return "at_risk";
  if (hasBehind) return "behind";
  if (allCompleted) return "completed";
  if (allOnTrack) return "on_track";
  
  return "on_track";
}

function getEffectiveStatus(objective: HierarchyObjective): { status: string; isDerived: boolean } {
  const keyResults = objective.keyResults || [];
  const childObjectives = objective.childObjectives || [];
  const isManuallyOverridden = objective.statusOverride === 'true';
  
  if (isManuallyOverridden) {
    return { status: objective.status || "not_started", isDerived: false };
  }
  
  if (keyResults.length === 0 && childObjectives.length === 0) {
    return { status: objective.status || "not_started", isDerived: false };
  }
  
  const derivedStatus = deriveStatusFromChildren(keyResults, childObjectives);
  if (derivedStatus) {
    return { status: derivedStatus, isDerived: true };
  }
  
  return { status: objective.status || "not_started", isDerived: false };
}

function formatProgressText(
  progress: number, 
  metricType?: string, 
  unit?: string, 
  currentValue?: number
): string {
  if (metricType === "complete") {
    return progress >= 100 ? "Complete" : "In Progress";
  }
  // For percent-based metrics, show progress percentage
  if (unit === '%' || unit === 'percent') {
    if (progress > 100) {
      return "100%+";
    }
    return `${Math.round(progress)}%`;
  }
  // For number-based metrics, show current value
  if (currentValue !== undefined && currentValue !== null) {
    if (unit === '$' || unit === 'currency' || unit === 'USD') {
      return `$${currentValue.toLocaleString()}`;
    }
    if (unit && unit.toLowerCase() !== 'number') {
      return `${currentValue.toLocaleString()} ${unit}`;
    }
    return currentValue.toLocaleString();
  }
  // Fallback to percentage if no current value
  if (progress > 100) {
    return "100%+";
  }
  return `${Math.round(progress)}%`;
}

function ObjectiveRow({ 
  objective, 
  depth = 0,
  teams = [],
  onSelectObjective,
  onSelectKeyResult,
  onEditObjective,
  onEditKeyResult,
  onAddChildObjective,
  onAlignObjective,
  onAddKeyResult,
  onCheckInObjective,
  onCheckInKeyResult,
  onDeleteObjective,
  onDeleteKeyResult,
  onCloseObjective,
  onReopenObjective,
  onCloseKeyResult,
  onReopenKeyResult,
  onCloneObjective,
  onManageWeights,
}: { 
  objective: HierarchyObjective; 
  depth?: number;
  teams?: Team[];
  onSelectObjective?: (objective: HierarchyObjective) => void;
  onSelectKeyResult?: (keyResult: KeyResult, parentObjective: HierarchyObjective) => void;
  onEditObjective?: (objective: HierarchyObjective) => void;
  onEditKeyResult?: (keyResult: KeyResult) => void;
  onAddChildObjective?: (parentId: string) => void;
  onAlignObjective?: (targetObjectiveId: string) => void;
  onAddKeyResult?: (objectiveId: string) => void;
  onCheckInObjective?: (objective: HierarchyObjective) => void;
  onCheckInKeyResult?: (keyResult: KeyResult) => void;
  onDeleteObjective?: (objectiveId: string) => void;
  onDeleteKeyResult?: (keyResultId: string) => void;
  onCloseObjective?: (objectiveId: string) => void;
  onReopenObjective?: (objectiveId: string) => void;
  onCloseKeyResult?: (keyResultId: string) => void;
  onReopenKeyResult?: (keyResultId: string) => void;
  onCloneObjective?: (objective: HierarchyObjective) => void;
  onManageWeights?: (objectiveId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const permissions = usePermissions();
  
  // Check if user can modify this specific objective
  // Try by ID first, then fall back to email for backwards compatibility
  const canModify = permissions.canModifyOKR(objective.ownerId, objective.createdBy) || 
                    permissions.canModifyByEmail(objective.ownerEmail);
  const canDelete = permissions.canDeleteOKR;
  
  const keyResults = objective.keyResults || [];
  const childObjectives = objective.childObjectives || [];
  const alignedObjectives = objective.alignedObjectives || [];
  const hasChildren = childObjectives.length > 0 || keyResults.length > 0 || alignedObjectives.length > 0;
  const isAligned = objective.isAligned === true;

  return (
    <>
      <TableRow 
        className={cn("hover-elevate group", isAligned && "bg-purple-50/50 dark:bg-purple-900/10")}
        data-testid={`row-objective-${objective.id}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <TableCell className="py-3" style={{ paddingLeft: depth > 0 ? `${1 + depth * 1.5}rem` : undefined }}>
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                data-testid={`button-expand-${objective.id}`}
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            ) : (
              <div className="w-6 flex-shrink-0" />
            )}
            {isAligned ? (
              <Link2 className="h-4 w-4 text-purple-500 flex-shrink-0" />
            ) : (
              <Target className="h-4 w-4 text-primary flex-shrink-0" />
            )}
            <span 
              className="font-medium cursor-pointer hover:text-primary hover:underline truncate" 
              onClick={() => onSelectObjective?.(objective)}
              data-testid={`link-objective-${objective.id}`}
            >
              {objective.title}
            </span>
            {objective.level && (
              <Badge 
                variant="secondary" 
                className="text-xs flex-shrink-0"
                data-testid={`badge-level-${objective.id}`}
              >
                {objective.level === "organization" 
                  ? "Organization" 
                  : objective.level === "team" 
                    ? (objective.teamId && teams.find(t => t.id === objective.teamId)?.name) || "Team"
                    : objective.level}
              </Badge>
            )}
            {isAligned && (
              <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700">
                <Link2 className="h-3 w-3 mr-1" />
                Aligned
              </Badge>
            )}
          </div>
        </TableCell>
        
        <TableCell className="py-3" data-testid={`text-owner-${objective.id}`}>
          {objective.ownerEmail ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {objective.ownerEmail.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{objective.ownerEmail.split('@')[0]}</span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </TableCell>
        
        <TableCell className="py-3" data-testid={`cell-status-${objective.id}`}>
          {(() => {
            const { status: effectiveStatus, isDerived } = getEffectiveStatus(objective);
            // Calculate progress from Key Results if available, otherwise use stored progress
            const calculatedProgress = (objective.keyResults && objective.keyResults.length > 0) || 
                                       (objective.childObjectives && objective.childObjectives.length > 0)
              ? calculateObjectiveProgress(objective.keyResults || [], objective.childObjectives || [])
              : objective.progress;
            return (
              <div className="flex items-center gap-3">
                <CircularProgress 
                  progress={calculatedProgress} 
                  size={36} 
                  strokeWidth={3}
                  quarter={objective.quarter}
                  year={objective.year}
                />
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs w-fit", getStatusBadgeStyles(effectiveStatus))}
                    >
                      <div className={cn("w-2 h-2 rounded-full mr-1.5", getStatusColor(effectiveStatus))} />
                      {getStatusLabel(effectiveStatus)}
                    </Badge>
                    {isDerived && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <ArrowDownFromLine className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Status derived from children</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {calculatedProgress > 100 ? "100%+" : `${Math.round(calculatedProgress)}%`}
                  </span>
                  {objective.quarter > 0 && (() => {
                    const daysSinceLastCheckIn = objective.lastUpdated 
                      ? differenceInDays(new Date(), new Date(objective.lastUpdated))
                      : null;
                    const pace = calculateSimplePace(calculatedProgress, objective.quarter, objective.year, daysSinceLastCheckIn);
                    const PaceIcon = pace.icon;
                    return (
                      <div className="flex items-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge 
                                variant="outline" 
                                className={cn("text-xs px-1.5 py-0", getPaceBadgeStyles(pace.status))}
                                data-testid={`pace-badge-${objective.id}`}
                              >
                                <PaceIcon className="h-3 w-3 mr-0.5" />
                                {getPaceLabel(pace.status)}
                                {!pace.isPeriodEnded && pace.projectedEndProgress > 0 && 
                                 (pace.status === 'ahead' || pace.status === 'on_track') && (
                                  <span className="ml-1 opacity-75" data-testid={`pace-projection-${objective.id}`}>
                                    → {Math.round(pace.projectedEndProgress)}%
                                  </span>
                                )}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-1 text-xs">
                                <p className="font-medium">{getPaceLabel(pace.status)}</p>
                                <p className="text-muted-foreground">
                                  {Math.round(pace.percentageThrough)}% through period
                                </p>
                                <p className="text-muted-foreground">
                                  Expected: {Math.round(pace.expectedProgress)}% | Actual: {Math.round(calculatedProgress)}%
                                </p>
                                {!pace.isPeriodEnded && pace.projectedEndProgress > 0 && 
                                 (pace.status === 'ahead' || pace.status === 'on_track') && (
                                  <p className="font-medium">
                                    Projected end: {Math.round(pace.projectedEndProgress)}%
                                  </p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {pace.riskSignal === 'stalled' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="destructive" className="text-xs px-1.5 py-0" data-testid={`risk-stalled-${objective.id}`}>
                                  <AlertTriangle className="h-3 w-3 mr-0.5" />
                                  Stalled
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">No progress for 30+ days into period</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {pace.riskSignal === 'attention_needed' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="text-xs px-1.5 py-0 text-amber-600 dark:text-amber-400" data-testid={`risk-attention-${objective.id}`}>
                                  <Clock className="h-3 w-3 mr-0.5" />
                                  {daysSinceLastCheckIn}d
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">No check-in for {daysSinceLastCheckIn} days</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })()}
        </TableCell>
        
        <TableCell className="py-3 text-sm text-muted-foreground" data-testid={`text-updated-${objective.id}`}>
          {objective.lastUpdated ? format(new Date(objective.lastUpdated), 'MMM d') : '-'}
        </TableCell>
        
        <TableCell className="py-3" data-testid={`text-period-${objective.id}`}>
          <Badge variant="outline" className="text-xs">
            {getQuarterLabel(objective.quarter)} {objective.year}
          </Badge>
        </TableCell>
        
        <TableCell className="py-3 text-right">
          <div className={cn(
            "flex items-center justify-end gap-1 transition-opacity",
            isHovered ? "opacity-100" : "opacity-0"
          )}>
            {objective.status !== 'closed' && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => onCheckInObjective?.(objective)}
                  title="Check-in"
                  data-testid={`button-checkin-objective-${objective.id}`}
                >
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => onAddKeyResult?.(objective.id)}
                  title="Add Key Result"
                  data-testid={`button-add-kr-${objective.id}`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  data-testid={`button-menu-objective-${objective.id}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canModify && (
                  <DropdownMenuItem 
                    onClick={() => onEditObjective?.(objective)} 
                    data-testid={`menu-edit-${objective.id}`}
                    disabled={objective.status === 'closed'}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  onClick={() => onAddChildObjective?.(objective.id)} 
                  data-testid={`menu-add-child-${objective.id}`}
                  disabled={objective.status === 'closed'}
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Add Child Objective
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onAlignObjective?.(objective.id)} 
                  data-testid={`menu-align-${objective.id}`}
                  disabled={objective.status === 'closed'}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Link Existing Objective
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onAddKeyResult?.(objective.id)} 
                  data-testid={`menu-add-kr-${objective.id}`}
                  disabled={objective.status === 'closed'}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Key Result
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onCheckInObjective?.(objective)} 
                  data-testid={`menu-checkin-${objective.id}`}
                  disabled={objective.status === 'closed'}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                  Check-in
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onManageWeights?.(objective.id)} 
                  data-testid={`menu-weights-${objective.id}`}
                  disabled={objective.status === 'closed' || keyResults.length === 0}
                >
                  <Scale className="h-4 w-4 mr-2" />
                  Manage Weights
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onCloneObjective?.(objective)} 
                  data-testid={`menu-clone-${objective.id}`}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Clone
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {objective.status === 'closed' ? (
                  <DropdownMenuItem 
                    onClick={() => onReopenObjective?.(objective.id)} 
                    data-testid={`menu-reopen-${objective.id}`}
                  >
                    <Unlock className="h-4 w-4 mr-2" />
                    Reopen
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem 
                    onClick={() => onCloseObjective?.(objective.id)} 
                    data-testid={`menu-close-${objective.id}`}
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Close
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem 
                    onClick={() => onDeleteObjective?.(objective.id)} 
                    className="text-destructive focus:text-destructive"
                    data-testid={`menu-delete-${objective.id}`}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <>
          {keyResults.map((kr) => (
            <KeyResultRow 
              key={kr.id}
              keyResult={kr}
              parentObjective={objective}
              depth={depth + 1}
              onSelectKeyResult={onSelectKeyResult}
              onEditKeyResult={onEditKeyResult}
              onCheckInKeyResult={onCheckInKeyResult}
              onDeleteKeyResult={onDeleteKeyResult}
              onCloseKeyResult={onCloseKeyResult}
              onReopenKeyResult={onReopenKeyResult}
            />
          ))}

          {childObjectives.map((child) => (
            <ObjectiveRow
              key={child.id}
              objective={child}
              depth={depth + 1}
              teams={teams}
              onSelectObjective={onSelectObjective}
              onSelectKeyResult={onSelectKeyResult}
              onEditObjective={onEditObjective}
              onEditKeyResult={onEditKeyResult}
              onAddChildObjective={onAddChildObjective}
              onAlignObjective={onAlignObjective}
              onAddKeyResult={onAddKeyResult}
              onCheckInObjective={onCheckInObjective}
              onCheckInKeyResult={onCheckInKeyResult}
              onDeleteObjective={onDeleteObjective}
              onDeleteKeyResult={onDeleteKeyResult}
              onCloseObjective={onCloseObjective}
              onReopenObjective={onReopenObjective}
              onCloneObjective={onCloneObjective}
              onManageWeights={onManageWeights}
              onCloseKeyResult={onCloseKeyResult}
              onReopenKeyResult={onReopenKeyResult}
            />
          ))}
          
          {/* Render aligned objectives (virtual children that "ladder up" to this objective) */}
          {(objective.alignedObjectives || []).map((aligned) => (
            <ObjectiveRow
              key={`aligned-${aligned.id}`}
              objective={{ ...aligned, isAligned: true }}
              depth={depth + 1}
              teams={teams}
              onSelectObjective={onSelectObjective}
              onSelectKeyResult={onSelectKeyResult}
              onEditObjective={onEditObjective}
              onEditKeyResult={onEditKeyResult}
              onAddChildObjective={onAddChildObjective}
              onAlignObjective={onAlignObjective}
              onAddKeyResult={onAddKeyResult}
              onCheckInObjective={onCheckInObjective}
              onCheckInKeyResult={onCheckInKeyResult}
              onDeleteObjective={onDeleteObjective}
              onDeleteKeyResult={onDeleteKeyResult}
              onCloseObjective={onCloseObjective}
              onReopenObjective={onReopenObjective}
              onCloneObjective={onCloneObjective}
              onManageWeights={onManageWeights}
              onCloseKeyResult={onCloseKeyResult}
              onReopenKeyResult={onReopenKeyResult}
            />
          ))}
        </>
      )}
    </>
  );
}

function KeyResultRow({
  keyResult,
  parentObjective,
  depth,
  onSelectKeyResult,
  onEditKeyResult,
  onCheckInKeyResult,
  onDeleteKeyResult,
  onCloseKeyResult,
  onReopenKeyResult,
}: {
  keyResult: KeyResult;
  parentObjective: HierarchyObjective;
  depth: number;
  onSelectKeyResult?: (keyResult: KeyResult, parentObjective: HierarchyObjective) => void;
  onEditKeyResult?: (keyResult: KeyResult) => void;
  onCheckInKeyResult?: (keyResult: KeyResult) => void;
  onDeleteKeyResult?: (keyResultId: string) => void;
  onCloseKeyResult?: (keyResultId: string) => void;
  onReopenKeyResult?: (keyResultId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const permissions = usePermissions();
  
  // Check if user can modify this specific key result
  // Try by ID first, then fall back to owner email if key result has one
  const canModify = permissions.canModifyOKR(keyResult.ownerId, keyResult.createdBy) ||
                    permissions.canModifyByEmail((keyResult as any).ownerEmail);
  const canDelete = permissions.canDeleteOKR;

  return (
    <TableRow 
      className="hover-elevate bg-muted/30 group"
      data-testid={`row-keyresult-${keyResult.id}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <TableCell className="py-2" style={{ paddingLeft: `${1.5 + depth * 1.5}rem` }}>
        <div className="flex items-center gap-2">
          <div className="w-6 flex-shrink-0" />
          <Gauge className="h-4 w-4 text-primary flex-shrink-0" />
          <span 
            className="text-sm cursor-pointer hover:text-primary hover:underline truncate"
            onClick={() => onSelectKeyResult?.(keyResult, parentObjective)}
            data-testid={`link-keyresult-${keyResult.id}`}
          >
            {keyResult.title}
          </span>
          {keyResult.weight !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[10px] px-1.5 py-0 h-4 flex-shrink-0",
                      keyResult.isWeightLocked ? "border-amber-400 text-amber-600 dark:text-amber-400" : ""
                    )}
                    data-testid={`badge-weight-${keyResult.id}`}
                  >
                    {keyResult.isWeightLocked && <Lock className="h-2.5 w-2.5 mr-0.5" />}
                    {keyResult.weight}%
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    Weight: {keyResult.weight}%
                    {keyResult.isWeightLocked && " (locked)"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {keyResult.excelFileId && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[10px] px-1.5 py-0 h-4 flex-shrink-0",
                      keyResult.excelSyncError 
                        ? "border-red-400 text-red-600 dark:text-red-400" 
                        : "border-green-400 text-green-600 dark:text-green-400"
                    )}
                    data-testid={`badge-excel-${keyResult.id}`}
                  >
                    {keyResult.excelSyncError ? (
                      <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                    ) : (
                      <FileSpreadsheet className="h-2.5 w-2.5 mr-0.5" />
                    )}
                    Excel
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <p className="font-medium">{keyResult.excelFileName}</p>
                    <p className="text-muted-foreground">
                      {keyResult.excelSheetName}!{keyResult.excelCellReference}
                    </p>
                    {keyResult.excelLastSyncAt && (
                      <p className="text-muted-foreground mt-1">
                        Synced: {format(new Date(keyResult.excelLastSyncAt), "MMM d, h:mm a")}
                      </p>
                    )}
                    {keyResult.excelSyncError && (
                      <p className="text-red-500 mt-1">{keyResult.excelSyncError}</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </TableCell>
      
      <TableCell className="py-2" data-testid={`text-owner-${keyResult.id}`}>
        {keyResult.ownerEmail ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                {keyResult.ownerEmail.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">{keyResult.ownerEmail.split('@')[0]}</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </TableCell>
      
      <TableCell className="py-2" data-testid={`cell-status-${keyResult.id}`}>
        <div className="flex items-center gap-3">
          {(() => {
            // Calculate actual progress from currentValue and targetValue if available
            const calculatedProgress = keyResult.targetValue && keyResult.targetValue > 0 
              ? Math.min(((keyResult.currentValue ?? 0) / keyResult.targetValue) * 100, 100)
              : keyResult.progress;
            return (
              <CircularProgress 
                progress={calculatedProgress} 
                size={28} 
                strokeWidth={2.5}
                quarter={parentObjective.quarter}
                year={parentObjective.year}
              />
            );
          })()}
          <div className="flex flex-col gap-0.5">
            <Badge 
              variant="outline" 
              className={cn("text-xs w-fit", getStatusBadgeStyles(keyResult.status))}
            >
              <div className={cn("w-2 h-2 rounded-full mr-1.5", getStatusColor(keyResult.status))} />
              {getStatusLabel(keyResult.status)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatProgressText(keyResult.progress, keyResult.metricType, keyResult.unit, keyResult.currentValue)}
            </span>
            {keyResult.targetValue !== undefined && keyResult.unit && keyResult.unit.toLowerCase() !== 'number' && (
              <span className="text-[10px] text-muted-foreground">
                {keyResult.currentValue !== undefined ? `${keyResult.currentValue} / ` : ''}
                {keyResult.targetValue} {keyResult.unit}
              </span>
            )}
          </div>
        </div>
      </TableCell>
      
      <TableCell className="py-2 text-sm text-muted-foreground">-</TableCell>
      
      <TableCell className="py-2">-</TableCell>
      
      <TableCell className="py-2 text-right">
        <div className={cn(
          "flex items-center justify-end gap-1 transition-opacity",
          isHovered ? "opacity-100" : "opacity-0"
        )}>
          {keyResult.status !== 'closed' && parentObjective.status !== 'closed' && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onCheckInKeyResult?.(keyResult)}
              title="Check-in"
              data-testid={`button-checkin-kr-${keyResult.id}`}
            >
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                data-testid={`button-menu-kr-${keyResult.id}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canModify && (
                <DropdownMenuItem 
                  onClick={() => onEditKeyResult?.(keyResult)} 
                  data-testid={`menu-edit-kr-${keyResult.id}`}
                  disabled={keyResult.status === 'closed' || parentObjective.status === 'closed'}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={() => onCheckInKeyResult?.(keyResult)} 
                data-testid={`menu-checkin-kr-${keyResult.id}`}
                disabled={keyResult.status === 'closed' || parentObjective.status === 'closed'}
              >
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                Check-in
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {keyResult.status === 'closed' ? (
                <DropdownMenuItem 
                  onClick={() => onReopenKeyResult?.(keyResult.id)} 
                  data-testid={`menu-reopen-kr-${keyResult.id}`}
                  disabled={parentObjective.status === 'closed'}
                >
                  <Unlock className="h-4 w-4 mr-2" />
                  Reopen
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem 
                  onClick={() => onCloseKeyResult?.(keyResult.id)} 
                  data-testid={`menu-close-kr-${keyResult.id}`}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Close
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem 
                  onClick={() => onDeleteKeyResult?.(keyResult.id)} 
                  className="text-destructive focus:text-destructive"
                  data-testid={`menu-delete-kr-${keyResult.id}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function HierarchicalOKRTable({ 
  objectives,
  teams = [],
  onSelectObjective,
  onSelectKeyResult,
  onEditObjective,
  onEditKeyResult,
  onAddChildObjective,
  onAlignObjective,
  onAddKeyResult,
  onCheckInObjective,
  onCheckInKeyResult,
  onDeleteObjective,
  onDeleteKeyResult,
  onCloseObjective,
  onReopenObjective,
  onCloseKeyResult,
  onReopenKeyResult,
  onCloneObjective,
  onManageWeights,
}: HierarchicalOKRTableProps) {
  if (objectives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Target className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No objectives found</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Get started by creating your first objective for this period.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[42%]">Title</TableHead>
            <TableHead className="w-[10%]">Owner</TableHead>
            <TableHead className="w-[16%]">Status & Progress</TableHead>
            <TableHead className="w-[8%]">Updated</TableHead>
            <TableHead className="w-[9%]">Period</TableHead>
            <TableHead className="w-[15%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {objectives.map((objective) => (
            <ObjectiveRow
              key={objective.id}
              objective={objective}
              teams={teams}
              onSelectObjective={onSelectObjective}
              onSelectKeyResult={onSelectKeyResult}
              onEditObjective={onEditObjective}
              onEditKeyResult={onEditKeyResult}
              onAddChildObjective={onAddChildObjective}
              onAlignObjective={onAlignObjective}
              onAddKeyResult={onAddKeyResult}
              onCheckInObjective={onCheckInObjective}
              onCheckInKeyResult={onCheckInKeyResult}
              onDeleteObjective={onDeleteObjective}
              onDeleteKeyResult={onDeleteKeyResult}
              onCloseObjective={onCloseObjective}
              onReopenObjective={onReopenObjective}
              onCloneObjective={onCloneObjective}
              onCloseKeyResult={onCloseKeyResult}
              onReopenKeyResult={onReopenKeyResult}
              onManageWeights={onManageWeights}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
