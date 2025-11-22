import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Target, AlertCircle } from "lucide-react";

type ValueDistribution = {
  valueTitle: string;
  valueDescription: string;
  objectiveCount: number;
  strategyCount: number;
  totalCount: number;
};

type ValuesAnalytics = {
  distribution: ValueDistribution[];
  totalValues: number;
  summary: {
    mostUsedValue: string | null;
    leastUsedValue: string | null;
    averageUsage: number;
  };
};

export function ValuesAlignmentWidget() {
  const { data: analytics, isLoading, error } = useQuery<ValuesAnalytics>({
    queryKey: ['/api/values/analytics/distribution'],
    retry: 1,
  });

  if (error) {
    return (
      <Card data-testid="card-values-alignment">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">Values Alignment</CardTitle>
          <Target className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Unable to load values analytics</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card data-testid="card-values-alignment">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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

  const { distribution, summary } = analytics;
  const maxCount = Math.max(...distribution.map(d => d.totalCount), 1);

  return (
    <Card data-testid="card-values-alignment">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Values Alignment</CardTitle>
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

        {/* Value Distribution Bars */}
        <div className="space-y-3">
          <div className="text-xs font-medium text-muted-foreground">Distribution</div>
          {distribution.map((value) => (
            <div key={value.valueTitle} className="space-y-1" data-testid={`value-distribution-${value.valueTitle}`}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium truncate flex-1">{value.valueTitle}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span data-testid={`text-objective-count-${value.valueTitle}`}>
                    {value.objectiveCount} obj
                  </span>
                  <span data-testid={`text-strategy-count-${value.valueTitle}`}>
                    {value.strategyCount} strat
                  </span>
                </div>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(value.totalCount / maxCount) * 100}%` }}
                  data-testid={`progress-bar-${value.valueTitle}`}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Average Usage */}
        <div className="pt-2 border-t text-xs text-muted-foreground">
          Average: {summary.averageUsage} items per value
        </div>
      </CardContent>
    </Card>
  );
}
