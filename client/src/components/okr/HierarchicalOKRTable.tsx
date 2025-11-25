import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, ChevronDown, Target, TrendingUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface KeyResult {
  id: string;
  title: string;
  progress: number;
  status: string;
  ownerEmail?: string;
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
  onEditObjective?: (objective: HierarchyObjective) => void;
  onEditKeyResult?: (keyResult: KeyResult) => void;
  onAddChildObjective?: (parentId: string) => void;
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status?.toLowerCase()) {
    case "on_track":
    case "on track":
      return "default";
    case "at_risk":
    case "at risk":
      return "secondary";
    case "behind":
      return "destructive";
    default:
      return "outline";
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
    default:
      return status || "Not Set";
  }
}

function getQuarterLabel(quarter: number): string {
  if (quarter === 0) return "Annual";
  return `Q${quarter}`;
}

function ObjectiveRow({ 
  objective, 
  depth = 0,
  onEditObjective,
  onEditKeyResult,
  onAddChildObjective,
}: { 
  objective: HierarchyObjective; 
  depth?: number;
  onEditObjective?: (objective: HierarchyObjective) => void;
  onEditKeyResult?: (keyResult: KeyResult) => void;
  onAddChildObjective?: (parentId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Defensive programming: ensure arrays exist
  const keyResults = objective.keyResults || [];
  const childObjectives = objective.childObjectives || [];
  const hasChildren = childObjectives.length > 0 || keyResults.length > 0;

  return (
    <>
      <TableRow 
        className="hover-elevate"
        data-testid={`row-objective-${objective.id}`}
      >
        <TableCell className={cn("flex items-center gap-2", depth > 0 && "pl-8")}>
          {hasChildren ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              data-testid={`button-expand-${objective.id}`}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          ) : (
            <div className="w-5 flex-shrink-0" />
          )}
          <Target className="h-4 w-4 text-primary flex-shrink-0" />
          <span 
            className="font-medium cursor-pointer hover:underline" 
            onClick={() => onEditObjective?.(objective)}
          >
            {objective.title}
          </span>
        </TableCell>
        <TableCell data-testid={`text-owner-${objective.id}`}>
          {objective.ownerEmail ? (
            <span className="text-sm">{objective.ownerEmail.split('@')[0]}</span>
          ) : (
            <span className="text-sm text-muted-foreground">Unassigned</span>
          )}
        </TableCell>
        <TableCell data-testid={`text-level-${objective.id}`}>
          <Badge variant="outline" className="text-xs">
            {objective.level || 'Not Set'}
          </Badge>
        </TableCell>
        <TableCell data-testid={`badge-status-${objective.id}`}>
          <Badge variant={getStatusBadgeVariant(objective.status)}>
            {getStatusLabel(objective.status)}
          </Badge>
        </TableCell>
        <TableCell data-testid={`progress-${objective.id}`}>
          <div className="flex items-center gap-2">
            <Progress value={objective.progress} className="w-20" />
            <span className="text-sm text-muted-foreground w-12">{Math.round(objective.progress)}%</span>
          </div>
        </TableCell>
        <TableCell data-testid={`text-updated-${objective.id}`}>
          <span className="text-sm text-muted-foreground">
            {objective.lastUpdated ? format(new Date(objective.lastUpdated), 'MMM d, yyyy') : '-'}
          </span>
        </TableCell>
        <TableCell data-testid={`text-period-${objective.id}`}>
          <Badge variant="outline" className="text-xs">
            {getQuarterLabel(objective.quarter)} {objective.year}
          </Badge>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <>
          {keyResults.map((kr) => (
            <TableRow 
              key={kr.id} 
              className="hover-elevate bg-muted/30"
              data-testid={`row-keyresult-${kr.id}`}
            >
              <TableCell className={cn("flex items-center gap-2", "pl-12")}>
                <div className="w-5 flex-shrink-0" />
                <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span 
                  className="text-sm cursor-pointer hover:underline"
                  onClick={() => onEditKeyResult?.(kr)}
                >
                  {kr.title}
                </span>
              </TableCell>
              <TableCell data-testid={`text-owner-${kr.id}`}>
                {kr.ownerEmail ? (
                  <span className="text-sm">{kr.ownerEmail.split('@')[0]}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                )}
              </TableCell>
              <TableCell>-</TableCell>
              <TableCell data-testid={`badge-status-${kr.id}`}>
                <Badge variant={getStatusBadgeVariant(kr.status)} className="text-xs">
                  {getStatusLabel(kr.status)}
                </Badge>
              </TableCell>
              <TableCell data-testid={`progress-${kr.id}`}>
                <div className="flex items-center gap-2">
                  <Progress value={kr.progress} className="w-20" />
                  <span className="text-sm text-muted-foreground w-12">{Math.round(kr.progress)}%</span>
                </div>
              </TableCell>
              <TableCell>-</TableCell>
              <TableCell>-</TableCell>
            </TableRow>
          ))}

          {childObjectives.map((child) => (
            <ObjectiveRow
              key={child.id}
              objective={child}
              depth={depth + 1}
              onEditObjective={onEditObjective}
              onEditKeyResult={onEditKeyResult}
              onAddChildObjective={onAddChildObjective}
            />
          ))}
        </>
      )}
    </>
  );
}

export function HierarchicalOKRTable({ 
  objectives, 
  onEditObjective,
  onEditKeyResult,
  onAddChildObjective 
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
            <TableHead className="w-[10%]">Team/Level</TableHead>
            <TableHead className="w-[10%]">Status</TableHead>
            <TableHead className="w-[13%]">Progress</TableHead>
            <TableHead className="w-[10%]">Last Updated</TableHead>
            <TableHead className="w-[10%]">Time Period</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {objectives.map((objective) => (
            <ObjectiveRow
              key={objective.id}
              objective={objective}
              onEditObjective={onEditObjective}
              onEditKeyResult={onEditKeyResult}
              onAddChildObjective={onAddChildObjective}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
