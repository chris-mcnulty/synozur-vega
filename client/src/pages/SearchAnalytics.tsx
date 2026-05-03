import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, AlertCircle, MousePointerClick, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, PERMISSIONS, type Role } from "@shared/rbac";

type Analytics = {
  days: number;
  totalQueries: number;
  totalNoResults: number;
  totalClicks: number;
  uniqueQueries: number;
  topQueries: { query: string; count: number; avgResults: number }[];
  noResultQueries: { query: string; count: number }[];
  clicksByEntityType: { resultType: string; count: number }[];
  queriesByDay: { date: string; count: number }[];
};

const RESULT_TYPE_LABELS: Record<string, string> = {
  objective: "Objectives",
  key_result: "Key Results",
  big_rock: "Big Rocks",
  strategy: "Strategies",
  meeting: "Meetings",
  team: "Teams",
  user: "People",
  support_ticket: "Support Tickets",
  grounding_document: "Grounding Docs",
  unknown: "Unknown",
};

function labelEntityType(t: string) {
  return RESULT_TYPE_LABELS[t] ?? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SearchAnalytics() {
  const { user } = useAuth();
  const [days, setDays] = useState("30");

  const canView = user ? hasPermission(user.role as Role, PERMISSIONS.MANAGE_TENANT_SETTINGS) : false;

  const { data, isLoading, error } = useQuery<Analytics>({
    queryKey: ["/api/admin/search-analytics", { days }],
    enabled: canView,
  });

  if (!canView) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>
              You need to be a tenant admin to view search analytics.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-search-analytics-title">
            Search Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            See what your team searches for, where they hit dead ends, and what they click.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Window:</span>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-36" data-testid="select-time-window">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 365 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Failed to load search analytics. Please try again later.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Search className="h-5 w-5 text-muted-foreground" />}
          label="Total searches"
          value={data?.totalQueries ?? 0}
          loading={isLoading}
          testId="stat-total-queries"
        />
        <SummaryCard
          icon={<BarChart3 className="h-5 w-5 text-muted-foreground" />}
          label="Unique queries"
          value={data?.uniqueQueries ?? 0}
          loading={isLoading}
          testId="stat-unique-queries"
        />
        <SummaryCard
          icon={<AlertCircle className="h-5 w-5 text-muted-foreground" />}
          label="No-result searches"
          value={data?.totalNoResults ?? 0}
          loading={isLoading}
          testId="stat-no-results"
        />
        <SummaryCard
          icon={<MousePointerClick className="h-5 w-5 text-muted-foreground" />}
          label="Result clicks"
          value={data?.totalClicks ?? 0}
          loading={isLoading}
          testId="stat-clicks"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top queries</CardTitle>
            <CardDescription>Most common searches in this window</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !data?.topQueries.length ? (
              <p className="text-sm text-muted-foreground">No searches recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Avg results</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topQueries.map((q) => (
                    <TableRow key={q.query} data-testid={`row-top-query-${q.query}`}>
                      <TableCell className="font-mono text-sm break-all">{q.query}</TableCell>
                      <TableCell className="text-right">{q.count}</TableCell>
                      <TableCell className="text-right">{q.avgResults}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dead-end queries</CardTitle>
            <CardDescription>
              Searches that returned zero results — opportunities for new content or better naming
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !data?.noResultQueries.length ? (
              <p className="text-sm text-muted-foreground">No dead-end searches yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead className="text-right">Times</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.noResultQueries.map((q) => (
                    <TableRow key={q.query} data-testid={`row-no-result-${q.query}`}>
                      <TableCell className="font-mono text-sm break-all">{q.query}</TableCell>
                      <TableCell className="text-right">{q.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Click-through by entity type</CardTitle>
            <CardDescription>Which kinds of results people open after searching</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !data?.clicksByEntityType.length ? (
              <p className="text-sm text-muted-foreground">No result clicks recorded yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.clicksByEntityType.map((c) => (
                  <Badge
                    key={c.resultType}
                    variant="secondary"
                    data-testid={`badge-clicks-${c.resultType}`}
                  >
                    {labelEntityType(c.resultType)}: {c.count}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  loading,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  testId: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-20 mt-2" />
        ) : (
          <div className="text-2xl font-semibold mt-1" data-testid={testId}>
            {value.toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
