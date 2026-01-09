import { useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TrendingUp, TrendingDown, Target, ChevronDown, ChevronRight, Building2, Users, Layers, FileText, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenant } from "@/contexts/TenantContext";

type LevelBreakdown = {
  organization: number;
  team: number;
  department: number;
};

type ValueDistribution = {
  valueTitle: string;
  valueDescription: string;
  objectiveCount: number;
  strategyCount: number;
  totalCount: number;
  levelBreakdown: LevelBreakdown;
  objectiveIds: string[];
};

type ValuesAnalytics = {
  distribution: ValueDistribution[];
  totalValues: number;
  totalObjectivesWithValues: number;
  totalStrategiesWithValues: number;
  aggregateLevelBreakdown: LevelBreakdown;
  tenantId?: string; // For debugging
  filters: {
    quarter: number | null;
    year: number | null;
  };
  summary: {
    mostUsedValue: string | null;
    leastUsedValue: string | null;
    averageUsage: number;
  };
};

type TaggedItems = {
  objectives: Array<{ id: string; title: string; level?: string }>;
  strategies: Array<{ id: string; title: string }>;
};

// Sub-component to fetch and display tagged items for an expanded value
function ExpandedValueItems({ valueTitle }: { valueTitle: string }) {
  const { currentTenant } = useTenant();
  
  const { data: items, isLoading } = useQuery<TaggedItems>({
    queryKey: [`/api/values/${encodeURIComponent(valueTitle)}/tagged-items`, { tenantId: currentTenant?.id }],
    enabled: !!currentTenant,
  });

  if (isLoading) {
    return <div className="text-xs text-muted-foreground py-1">Loading...</div>;
  }

  if (!items || (items.objectives.length === 0 && items.strategies.length === 0)) {
    return <div className="text-xs text-muted-foreground py-1">No items tagged</div>;
  }

  return (
    <div className="space-y-2">
      {items.objectives.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Target className="h-3 w-3" />
            Objectives
          </div>
          {items.objectives.map((obj) => (
            <div 
              key={obj.id} 
              className="text-xs pl-4 py-0.5 text-foreground"
              data-testid={`tagged-objective-${obj.id}`}
            >
              {obj.title}
              {obj.level && (
                <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0">
                  {obj.level}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
      {items.strategies.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Lightbulb className="h-3 w-3" />
            Strategies
          </div>
          {items.strategies.map((strat) => (
            <div 
              key={strat.id} 
              className="text-xs pl-4 py-0.5 text-foreground"
              data-testid={`tagged-strategy-${strat.id}`}
            >
              {strat.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ValuesAlignmentWidgetProps {
  quarter?: number;
  year?: number;
}

const levelIcons = {
  organization: Building2,
  team: Users,
  department: Layers,
};

const levelLabels = {
  organization: "Organization",
  team: "Team",
  department: "Department",
};

export function ValuesAlignmentWidget({ quarter, year }: ValuesAlignmentWidgetProps) {
  const [expandedValues, setExpandedValues] = useState<Set<string>>(new Set());
  const { currentTenant } = useTenant();

  // Build query params for filtering
  const queryParamsObj: Record<string, string> = {};
  if (quarter !== undefined) queryParamsObj.quarter = quarter.toString();
  if (year !== undefined) queryParamsObj.year = year.toString();

  // Build URL with query params if any
  const baseUrl = '/api/values/analytics/distribution';
  const queryString = Object.keys(queryParamsObj).length > 0 
    ? `?${new URLSearchParams(queryParamsObj).toString()}`
    : '';
  const url = `${baseUrl}${queryString}`;

  // Include tenant ID in query key so cache is invalidated when tenant switches
  const { data: analytics, isLoading, error } = useQuery<ValuesAnalytics>({
    queryKey: [url, { tenantId: currentTenant?.id }],
    retry: 1,
    enabled: !!currentTenant,
  });

  const toggleExpanded = (valueTitle: string) => {
    setExpandedValues(prev => {
      const next = new Set(prev);
      if (next.has(valueTitle)) {
        next.delete(valueTitle);
      } else {
        next.add(valueTitle);
      }
      return next;
    });
  };

  if (error) {
    return (
      <Card data-testid="card-values-alignment">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">Values Alignment</CardTitle>
          <Target className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add company values in the Foundations module to see how your OKRs and strategies align with what matters most.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card data-testid="card-values-alignment">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">Values Alignment</CardTitle>
          <Target className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading values analytics...</div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics || analytics.totalValues === 0) {
    return (
      <Card data-testid="card-values-alignment">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">Values Alignment</CardTitle>
          <Target className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No company values defined yet. Add values in the Foundations module to track alignment.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Safe destructuring with defaults
  const { 
    distribution = [], 
    summary = { mostUsedValue: null, leastUsedValue: null, averageUsage: 0 }, 
    aggregateLevelBreakdown = { organization: 0, team: 0, division: 0, individual: 0 }, 
    totalObjectivesWithValues = 0, 
    totalStrategiesWithValues = 0, 
    filters = { quarter: null, year: null } 
  } = analytics;
  
  const maxCount = Math.max(...distribution.map(d => d.totalCount), 1);

  // Calculate total for level breakdown percentages
  const totalLevelItems = aggregateLevelBreakdown 
    ? Object.values(aggregateLevelBreakdown).reduce((sum, count) => sum + count, 0)
    : 0;

  return (
    <Card data-testid="card-values-alignment">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold">Values Alignment</CardTitle>
          {filters.quarter && filters.year && (
            <Badge variant="outline" className="text-xs" data-testid="badge-time-filter">
              Q{filters.quarter} {filters.year}
            </Badge>
          )}
        </div>
        <Target className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          {summary.mostUsedValue && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                <span>Most Represented</span>
              </div>
              <Badge variant="secondary" className="text-xs" data-testid="badge-most-used-value">
                {summary.mostUsedValue}
              </Badge>
            </div>
          )}
          {summary.leastUsedValue && distribution.length > 1 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingDown className="h-3 w-3" />
                <span>Least Represented</span>
              </div>
              <Badge variant="outline" className="text-xs" data-testid="badge-least-used-value">
                {summary.leastUsedValue}
              </Badge>
            </div>
          )}
        </div>

        {/* Level Breakdown - Aggregate across all values */}
        {totalLevelItems > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Objectives by Level</div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(aggregateLevelBreakdown) as [string, number][])
                .filter(([level]) => level in levelIcons)
                .map(([level, count]) => {
                  const Icon = levelIcons[level as keyof typeof levelIcons];
                  const percentage = totalLevelItems > 0 ? Math.round((count / totalLevelItems) * 100) : 0;
                  return (
                    <div 
                      key={level} 
                      className="flex flex-col items-center p-2 rounded-md bg-secondary/50"
                      data-testid={`level-breakdown-${level}`}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground mb-1" />
                      <span className="text-lg font-semibold">{count}</span>
                      <span className="text-xs text-muted-foreground">{levelLabels[level as keyof typeof levelLabels]}</span>
                      <span className="text-xs text-muted-foreground">({percentage}%)</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Totals - More Prominent */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold" data-testid="text-total-objectives">
              {totalObjectivesWithValues}
            </div>
            <div className="text-xs text-muted-foreground">Objectives Tagged</div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold" data-testid="text-total-strategies">
              {totalStrategiesWithValues}
            </div>
            <div className="text-xs text-muted-foreground">Strategies Tagged</div>
          </div>
        </div>

        {/* Value Distribution Bars with Drill-down */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Distribution by Value</div>
          {distribution.map((value) => {
            const isExpanded = expandedValues.has(value.valueTitle);
            const hasItems = value.totalCount > 0;
            
            return (
              <Collapsible 
                key={value.valueTitle} 
                open={isExpanded}
                onOpenChange={() => toggleExpanded(value.valueTitle)}
              >
                <div 
                  className="space-y-1" 
                  data-testid={`value-distribution-${value.valueTitle}`}
                >
                  <CollapsibleTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="w-full h-auto p-1 justify-start hover-elevate"
                      data-testid={`button-expand-${value.valueTitle}`}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {hasItems ? (
                          isExpanded ? (
                            <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          )
                        ) : (
                          <div className="w-3" />
                        )}
                        <span className="font-medium truncate flex-1 text-left text-sm">{value.valueTitle}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                          <span data-testid={`text-objective-count-${value.valueTitle}`}>
                            {value.objectiveCount} obj
                          </span>
                          <span data-testid={`text-strategy-count-${value.valueTitle}`}>
                            {value.strategyCount} strat
                          </span>
                        </div>
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  
                  {/* Progress bar */}
                  <div className="h-2 bg-secondary rounded-full overflow-hidden ml-5">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(value.totalCount / maxCount) * 100}%` }}
                      data-testid={`progress-bar-${value.valueTitle}`}
                    />
                  </div>

                  {/* Expanded: Show actual objectives and strategies */}
                  <CollapsibleContent>
                    <div className="ml-5 mt-2 pl-2 border-l-2 border-muted">
                      <ExpandedValueItems valueTitle={value.valueTitle} />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>

        {/* Average Usage */}
        <div className="pt-2 border-t text-xs text-muted-foreground">
          Average: {summary.averageUsage} items per value
        </div>
      </CardContent>
    </Card>
  );
}
