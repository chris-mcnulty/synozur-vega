import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  ChevronRight, 
  ChevronDown, 
  Target, 
  TrendingUp, 
  MoreHorizontal,
  Pencil,
  Plus,
  CheckCircle2,
  Trash2,
  FolderPlus,
  ArrowDownFromLine
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface KeyResult {
  id: string;
  title: string;
  description?: string;
  progress: number;
  status: string;
  ownerEmail?: string;
  targetValue?: number;
  currentValue?: number;
  startValue?: number;
  unit?: string;
  metricType?: string;
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
  ownerEmail?: string;
  quarter: number;
  year: number;
  keyResults: KeyResult[];
  childObjectives: HierarchyObjective[];
  linkedBigRocks: BigRock[];
  lastUpdated: Date | null;
}

interface HierarchicalOKRTableProps {
  objectives: HierarchyObjective[];
  onSelectObjective?: (objective: HierarchyObjective) => void;
  onSelectKeyResult?: (keyResult: KeyResult, parentObjective: HierarchyObjective) => void;
  onEditObjective?: (objective: HierarchyObjective) => void;
  onEditKeyResult?: (keyResult: KeyResult) => void;
  onAddChildObjective?: (parentId: string) => void;
  onAddKeyResult?: (objectiveId: string) => void;
  onCheckInObjective?: (objective: HierarchyObjective) => void;
  onCheckInKeyResult?: (keyResult: KeyResult) => void;
  onDeleteObjective?: (objectiveId: string) => void;
  onDeleteKeyResult?: (keyResultId: string) => void;
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

function getQuarterLabel(quarter: number): string {
  if (quarter === 0) return "Annual";
  return `Q${quarter}`;
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
  
  if (keyResults.length === 0 && childObjectives.length === 0) {
    return { status: objective.status || "not_started", isDerived: false };
  }
  
  if (!objective.status || objective.status === "not_started") {
    const derivedStatus = deriveStatusFromChildren(keyResults, childObjectives);
    if (derivedStatus) {
      return { status: derivedStatus, isDerived: true };
    }
  }
  
  return { status: objective.status || "not_started", isDerived: false };
}

function formatProgressText(progress: number, metricType?: string): string {
  if (metricType === "complete") {
    return progress >= 100 ? "Complete" : "In Progress";
  }
  return `${Math.round(progress)}%`;
}

function ObjectiveRow({ 
  objective, 
  depth = 0,
  onSelectObjective,
  onSelectKeyResult,
  onEditObjective,
  onEditKeyResult,
  onAddChildObjective,
  onAddKeyResult,
  onCheckInObjective,
  onCheckInKeyResult,
  onDeleteObjective,
  onDeleteKeyResult,
}: { 
  objective: HierarchyObjective; 
  depth?: number;
  onSelectObjective?: (objective: HierarchyObjective) => void;
  onSelectKeyResult?: (keyResult: KeyResult, parentObjective: HierarchyObjective) => void;
  onEditObjective?: (objective: HierarchyObjective) => void;
  onEditKeyResult?: (keyResult: KeyResult) => void;
  onAddChildObjective?: (parentId: string) => void;
  onAddKeyResult?: (objectiveId: string) => void;
  onCheckInObjective?: (objective: HierarchyObjective) => void;
  onCheckInKeyResult?: (keyResult: KeyResult) => void;
  onDeleteObjective?: (objectiveId: string) => void;
  onDeleteKeyResult?: (keyResultId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const keyResults = objective.keyResults || [];
  const childObjectives = objective.childObjectives || [];
  const hasChildren = childObjectives.length > 0 || keyResults.length > 0;

  return (
    <>
      <TableRow 
        className="hover-elevate group"
        data-testid={`row-objective-${objective.id}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <TableCell className={cn("py-3", depth > 0 && `pl-${8 + depth * 4}`)}>
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
            <Target className="h-4 w-4 text-primary flex-shrink-0" />
            <span 
              className="font-medium cursor-pointer hover:text-primary hover:underline truncate" 
              onClick={() => onSelectObjective?.(objective)}
              data-testid={`link-objective-${objective.id}`}
            >
              {objective.title}
            </span>
          </div>
        </TableCell>
        
        <TableCell className="py-3" data-testid={`text-owner-${objective.id}`}>
          {objective.ownerEmail ? (
            <span className="text-sm">{objective.ownerEmail.split('@')[0]}</span>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </TableCell>
        
        <TableCell className="py-3" data-testid={`cell-status-${objective.id}`}>
          {(() => {
            const { status: effectiveStatus, isDerived } = getEffectiveStatus(objective);
            return (
              <div className="flex flex-col gap-1">
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
                <div className="flex items-center gap-2">
                  <Progress value={objective.progress} className="w-16 h-1.5" />
                  <span className="text-xs text-muted-foreground">{Math.round(objective.progress)}%</span>
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
        
        <TableCell className="py-3">
          <div className={cn(
            "flex items-center gap-1 transition-opacity",
            isHovered ? "opacity-100" : "opacity-0"
          )}>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onCheckInObjective?.(objective)}
              title="Check-in"
              data-testid={`button-checkin-objective-${objective.id}`}
            >
              <CheckCircle2 className="h-4 w-4" />
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
                <DropdownMenuItem onClick={() => onEditObjective?.(objective)} data-testid={`menu-edit-${objective.id}`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAddChildObjective?.(objective.id)} data-testid={`menu-add-child-${objective.id}`}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Add Child Objective
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAddKeyResult?.(objective.id)} data-testid={`menu-add-kr-${objective.id}`}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Key Result
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCheckInObjective?.(objective)} data-testid={`menu-checkin-${objective.id}`}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Check-in
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDeleteObjective?.(objective.id)} 
                  className="text-destructive focus:text-destructive"
                  data-testid={`menu-delete-${objective.id}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
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
            />
          ))}

          {childObjectives.map((child) => (
            <ObjectiveRow
              key={child.id}
              objective={child}
              depth={depth + 1}
              onSelectObjective={onSelectObjective}
              onSelectKeyResult={onSelectKeyResult}
              onEditObjective={onEditObjective}
              onEditKeyResult={onEditKeyResult}
              onAddChildObjective={onAddChildObjective}
              onAddKeyResult={onAddKeyResult}
              onCheckInObjective={onCheckInObjective}
              onCheckInKeyResult={onCheckInKeyResult}
              onDeleteObjective={onDeleteObjective}
              onDeleteKeyResult={onDeleteKeyResult}
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
}: {
  keyResult: KeyResult;
  parentObjective: HierarchyObjective;
  depth: number;
  onSelectKeyResult?: (keyResult: KeyResult, parentObjective: HierarchyObjective) => void;
  onEditKeyResult?: (keyResult: KeyResult) => void;
  onCheckInKeyResult?: (keyResult: KeyResult) => void;
  onDeleteKeyResult?: (keyResultId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <TableRow 
      className="hover-elevate bg-muted/30 group"
      data-testid={`row-keyresult-${keyResult.id}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <TableCell className={cn("py-2", `pl-${12 + depth * 4}`)}>
        <div className="flex items-center gap-2">
          <div className="w-6 flex-shrink-0" />
          <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span 
            className="text-sm cursor-pointer hover:text-primary hover:underline truncate"
            onClick={() => onSelectKeyResult?.(keyResult, parentObjective)}
            data-testid={`link-keyresult-${keyResult.id}`}
          >
            {keyResult.title}
          </span>
        </div>
      </TableCell>
      
      <TableCell className="py-2" data-testid={`text-owner-${keyResult.id}`}>
        {keyResult.ownerEmail ? (
          <span className="text-sm">{keyResult.ownerEmail.split('@')[0]}</span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </TableCell>
      
      <TableCell className="py-2" data-testid={`cell-status-${keyResult.id}`}>
        <div className="flex flex-col gap-1">
          <Badge 
            variant="outline" 
            className={cn("text-xs w-fit", getStatusBadgeStyles(keyResult.status))}
          >
            <div className={cn("w-2 h-2 rounded-full mr-1.5", getStatusColor(keyResult.status))} />
            {getStatusLabel(keyResult.status)}
          </Badge>
          <div className="flex items-center gap-2">
            <Progress value={keyResult.progress} className="w-16 h-1.5" />
            <span className="text-xs text-muted-foreground">
              {formatProgressText(keyResult.progress, keyResult.metricType)}
            </span>
          </div>
          {keyResult.targetValue !== undefined && keyResult.unit && (
            <span className="text-xs text-muted-foreground">
              {keyResult.currentValue !== undefined ? `${keyResult.currentValue} / ` : ''}
              {keyResult.targetValue} {keyResult.unit}
            </span>
          )}
        </div>
      </TableCell>
      
      <TableCell className="py-2 text-sm text-muted-foreground">-</TableCell>
      
      <TableCell className="py-2">-</TableCell>
      
      <TableCell className="py-2">
        <div className={cn(
          "flex items-center gap-1 transition-opacity",
          isHovered ? "opacity-100" : "opacity-0"
        )}>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onCheckInKeyResult?.(keyResult)}
            title="Check-in"
            data-testid={`button-checkin-kr-${keyResult.id}`}
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
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
              <DropdownMenuItem onClick={() => onEditKeyResult?.(keyResult)} data-testid={`menu-edit-kr-${keyResult.id}`}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCheckInKeyResult?.(keyResult)} data-testid={`menu-checkin-kr-${keyResult.id}`}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Check-in
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDeleteKeyResult?.(keyResult.id)} 
                className="text-destructive focus:text-destructive"
                data-testid={`menu-delete-kr-${keyResult.id}`}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function HierarchicalOKRTable({ 
  objectives, 
  onSelectObjective,
  onSelectKeyResult,
  onEditObjective,
  onEditKeyResult,
  onAddChildObjective,
  onAddKeyResult,
  onCheckInObjective,
  onCheckInKeyResult,
  onDeleteObjective,
  onDeleteKeyResult,
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
            <TableHead className="w-[35%]">Title</TableHead>
            <TableHead className="w-[12%]">Owner</TableHead>
            <TableHead className="w-[18%]">Status & Progress</TableHead>
            <TableHead className="w-[10%]">Last Updated</TableHead>
            <TableHead className="w-[10%]">Time Period</TableHead>
            <TableHead className="w-[15%]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {objectives.map((objective) => (
            <ObjectiveRow
              key={objective.id}
              objective={objective}
              onSelectObjective={onSelectObjective}
              onSelectKeyResult={onSelectKeyResult}
              onEditObjective={onEditObjective}
              onEditKeyResult={onEditKeyResult}
              onAddChildObjective={onAddChildObjective}
              onAddKeyResult={onAddKeyResult}
              onCheckInObjective={onCheckInObjective}
              onCheckInKeyResult={onCheckInKeyResult}
              onDeleteObjective={onDeleteObjective}
              onDeleteKeyResult={onDeleteKeyResult}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
