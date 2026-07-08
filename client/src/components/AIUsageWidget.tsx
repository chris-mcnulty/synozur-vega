import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { Activity, TrendingUp, Cpu, DollarSign, RefreshCw, BarChart2, GitCompareArrows, Clock, AlertTriangle, Zap } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

type AIUsageLog = {
  id: string;
  createdAt: string;
  provider: string;
  model: string;
  feature: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCostMicrodollars: number;
  success: boolean;
  errorMessage?: string;
};

type UsageSummaryResponse = {
  currentPeriod: {
    requests: number;
    totalTokens: number;
    estimatedCostMicrodollars: number;
    byModel: Record<string, { requests: number; tokens: number; cost: number }>;
    byFeature: Record<string, { requests: number; tokens: number; cost: number }>;
  };
  historicalSummaries: Array<{
    id: string;
    periodStart: string;
    periodType: string;
    totalRequests: number;
    totalTokens: number;
    totalCostMicrodollars: number;
  }>;
  recentLogs: AIUsageLog[];
};

const formatCost = (microdollars: number) => {
  const dollars = microdollars / 1000000;
  if (dollars < 0.01) return `$${(dollars * 100).toFixed(3)}¢`;
  return `$${dollars.toFixed(4)}`;
};

const formatTokens = (tokens: number) => {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
};

const getModelDisplayName = (model: string) => {
  const modelMap: Record<string, string> = {
    "gpt-4": "GPT-4",
    "gpt-4-turbo": "GPT-4 Turbo",
    "gpt-4o": "GPT-4o",
    "gpt-5-mini": "GPT-5 Mini",
    "gpt-5": "GPT-5",
    "claude-sonnet-4": "Claude Sonnet 4",
    "claude-opus-4": "Claude Opus 4",
    "claude-opus-4-5": "Claude Opus 4.5",
    "claude-3.5-sonnet": "Claude 3.5 Sonnet",
    "claude-3.5-haiku": "Claude 3.5 Haiku",
    "claude-3-opus": "Claude 3 Opus",
    "claude-3-sonnet": "Claude 3 Sonnet",
    "claude-3-haiku": "Claude 3 Haiku",
    "replit-ai-unknown": "Replit AI",
  };
  return modelMap[model] || model;
};

const getFeatureDisplayName = (feature: string) => {
  const featureMap: Record<string, string> = {
    "CHAT": "AI Chat",
    "OKR_SUGGESTION": "OKR Suggestions",
    "BIG_ROCK_SUGGESTION": "Big Rock Suggestions",
    "MEETING_RECAP": "Meeting Recap",
    "STRATEGY_DRAFT": "Strategy Draft",
    "GENERAL": "General",
  };
  return featureMap[feature] || feature;
};

const getProviderBadgeVariant = (provider: string): "default" | "secondary" | "outline" => {
  switch (provider) {
    case "replit_ai": return "default";
    case "azure_openai": return "secondary";
    case "anthropic": return "outline";
    default: return "secondary";
  }
};

export function AIUsageWidget() {
  const [periodType, setPeriodType] = useState<"daily" | "monthly">("daily");
  
  const { data: usageData, isLoading, error, refetch } = useQuery<UsageSummaryResponse>({
    queryKey: ["/api/ai/usage/summary", { periodType }],
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card data-testid="ai-usage-widget">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            AI Usage Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Loading usage data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="ai-usage-widget">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            AI Usage Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Unable to load usage data. You may need admin permissions.
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentPeriod = usageData?.currentPeriod || {
    requests: 0,
    totalTokens: 0,
    estimatedCostMicrodollars: 0,
    byModel: {},
    byFeature: {},
  };

  const models = Object.entries(currentPeriod.byModel);
  const features = Object.entries(currentPeriod.byFeature);
  const recentLogs = usageData?.recentLogs || [];

  const totalModelRequests = models.reduce((sum, [, data]) => sum + data.requests, 0);

  return (
    <Card data-testid="ai-usage-widget">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            AI Usage Analytics
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={periodType} onValueChange={(v) => setPeriodType(v as "daily" | "monthly")}>
              <SelectTrigger className="w-28 h-8" data-testid="select-period-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              data-testid="button-refresh-usage"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <BarChart2 className="h-3 w-3" />
              Requests
            </div>
            <p className="text-2xl font-semibold" data-testid="stat-requests">
              {currentPeriod.requests}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <Cpu className="h-3 w-3" />
              Tokens
            </div>
            <p className="text-2xl font-semibold" data-testid="stat-tokens">
              {formatTokens(currentPeriod.totalTokens)}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <DollarSign className="h-3 w-3" />
              Est. Cost
            </div>
            <p className="text-2xl font-semibold" data-testid="stat-cost">
              {formatCost(currentPeriod.estimatedCostMicrodollars)}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <TrendingUp className="h-3 w-3" />
              Avg Tokens/Request
            </div>
            <p className="text-2xl font-semibold" data-testid="stat-avg-tokens">
              {currentPeriod.requests > 0 
                ? Math.round(currentPeriod.totalTokens / currentPeriod.requests) 
                : 0}
            </p>
          </div>
        </div>

        {models.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Usage by Model</h4>
            <div className="space-y-2">
              {models.map(([model, data]) => (
                <div key={model} className="space-y-1" data-testid={`model-usage-${model}`}>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{getModelDisplayName(model)}</span>
                      <Badge variant="secondary" className="text-xs">
                        {data.requests} requests
                      </Badge>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {formatTokens(data.tokens)} tokens | {formatCost(data.cost)}
                    </span>
                  </div>
                  <Progress 
                    value={totalModelRequests > 0 ? (data.requests / totalModelRequests) * 100 : 0} 
                    className="h-1.5"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {features.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Usage by Feature</h4>
            <div className="flex flex-wrap gap-2">
              {features.map(([feature, data]) => (
                <Badge 
                  key={feature} 
                  variant="outline" 
                  className="text-xs"
                  data-testid={`feature-usage-${feature}`}
                >
                  {getFeatureDisplayName(feature)}: {data.requests} ({formatTokens(data.tokens)})
                </Badge>
              ))}
            </div>
          </div>
        )}

        {recentLogs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recent Activity</h4>
            <div className="max-h-40 overflow-y-auto space-y-1.5">
              {recentLogs.slice(0, 5).map((log) => (
                <div 
                  key={log.id} 
                  className="flex items-center justify-between text-xs p-2 border rounded"
                  data-testid={`log-entry-${log.id}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={getProviderBadgeVariant(log.provider)}>
                      {getModelDisplayName(log.model)}
                    </Badge>
                    <span className="text-muted-foreground">
                      {getFeatureDisplayName(log.feature)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{formatTokens(log.totalTokens)} tokens</span>
                    <span>{log.latencyMs}ms</span>
                    <span>{formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentPeriod.requests === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No AI usage recorded for this period</p>
            <p className="text-xs mt-1">Usage will appear here as users interact with AI features</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PlatformAIUsageWidget() {
  const [periodType, setPeriodType] = useState<"daily" | "monthly">("daily");
  
  const { data: platformData, isLoading, error, refetch } = useQuery<{
    periodType: string;
    periodStart: string;
    totalRequests: number;
    totalTokens: number;
    totalCostMicrodollars: number;
    estimatedCostDollars: number;
    byTenant: Record<string, { requests: number; tokens: number; cost: number; tenantName?: string }>;
    byModel: Record<string, { requests: number; tokens: number; cost: number }>;
    byProvider: Record<string, { requests: number; tokens: number; cost: number }>;
  }>({
    queryKey: ["/api/ai/usage/platform", { periodType }],
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card data-testid="platform-ai-usage-widget">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            Platform-wide AI Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Loading platform usage data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="platform-ai-usage-widget">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            Platform-wide AI Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Unable to load platform usage data. System admin access required.
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalRequests = platformData?.totalRequests || 0;
  const totalTokens = platformData?.totalTokens || 0;
  const totalCost = platformData?.totalCostMicrodollars || 0;
  const byTenant = platformData?.byTenant || {};
  const byModel = platformData?.byModel || {};
  const byProvider = platformData?.byProvider || {};

  const tenants = Object.entries(byTenant);
  const models = Object.entries(byModel);
  const providers = Object.entries(byProvider);

  return (
    <Card data-testid="platform-ai-usage-widget">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            Platform-wide AI Usage
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={periodType} onValueChange={(v) => setPeriodType(v as "daily" | "monthly")}>
              <SelectTrigger className="w-28 h-8" data-testid="select-platform-period-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Today</SelectItem>
                <SelectItem value="monthly">This Month</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              data-testid="button-refresh-platform-usage"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <BarChart2 className="h-3 w-3" />
              Total Requests
            </div>
            <p className="text-2xl font-semibold" data-testid="platform-stat-requests">
              {totalRequests}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <Cpu className="h-3 w-3" />
              Total Tokens
            </div>
            <p className="text-2xl font-semibold" data-testid="platform-stat-tokens">
              {formatTokens(totalTokens)}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <DollarSign className="h-3 w-3" />
              Est. Platform Cost
            </div>
            <p className="text-2xl font-semibold" data-testid="platform-stat-cost">
              {formatCost(totalCost)}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <TrendingUp className="h-3 w-3" />
              Active Tenants
            </div>
            <p className="text-2xl font-semibold" data-testid="platform-stat-tenants">
              {tenants.length}
            </p>
          </div>
        </div>

        {providers.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Usage by Provider</h4>
            <div className="flex flex-wrap gap-2">
              {providers.map(([provider, data]) => (
                <Badge 
                  key={provider} 
                  variant={getProviderBadgeVariant(provider)}
                  data-testid={`provider-usage-${provider}`}
                >
                  {provider === "replit_ai" ? "Replit AI" : 
                   provider === "azure_openai" ? "Azure OpenAI" : 
                   provider === "anthropic" ? "Anthropic" : provider}: {data.requests} requests
                </Badge>
              ))}
            </div>
          </div>
        )}

        {models.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Usage by Model</h4>
            <div className="space-y-2">
              {models.map(([model, data]) => (
                <div key={model} className="space-y-1" data-testid={`platform-model-usage-${model}`}>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{getModelDisplayName(model)}</span>
                      <Badge variant="secondary" className="text-xs">
                        {data.requests} requests
                      </Badge>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {formatTokens(data.tokens)} tokens | {formatCost(data.cost)}
                    </span>
                  </div>
                  <Progress 
                    value={totalRequests > 0 ? (data.requests / totalRequests) * 100 : 0} 
                    className="h-1.5"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {tenants.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Usage by Tenant</h4>
            <div className="max-h-40 overflow-y-auto space-y-1.5">
              {tenants
                .sort((a, b) => b[1].requests - a[1].requests)
                .map(([tenantId, data]) => (
                <div 
                  key={tenantId} 
                  className="flex items-center justify-between text-xs p-2 border rounded"
                  data-testid={`tenant-usage-${tenantId}`}
                >
                  <span className="font-medium">
                    {data.tenantName || tenantId.substring(0, 8)}...
                  </span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{data.requests} requests</span>
                    <span>{formatTokens(data.tokens)} tokens</span>
                    <span>{formatCost(data.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalRequests === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No AI usage recorded for this period</p>
            <p className="text-xs mt-1">Platform-wide usage will appear as tenants use AI features</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type ModelComparisonData = {
  model: string;
  requests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCostMicrodollars: number;
  avgLatencyMs: number;
  avgTokensPerRequest: number;
  costPerRequest: number;
  errorRate: number;
  errors: number;
  dailyData: Array<{
    date: string;
    requests: number;
    tokens: number;
    cost: number;
    avgLatency: number;
  }>;
};

type ModelComparisonResponse = {
  days: number;
  startDate: string;
  models: ModelComparisonData[];
};

const getCostTierBadge = (costPerRequest: number) => {
  const dollars = costPerRequest / 1000000;
  if (dollars < 0.001) return { label: "Low", variant: "secondary" as const };
  if (dollars < 0.01) return { label: "Medium", variant: "outline" as const };
  return { label: "High", variant: "default" as const };
};

export function ModelComparisonWidget() {
  const [days, setDays] = useState<string>("30");

  const { data, isLoading, error, refetch } = useQuery<ModelComparisonResponse>({
    queryKey: ["/api/ai/usage/model-comparison", { days }],
    refetchInterval: 120000,
  });

  if (isLoading) {
    return (
      <Card data-testid="model-comparison-widget">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GitCompareArrows className="h-5 w-5 text-primary" />
            Model Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Loading model comparison data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="model-comparison-widget">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GitCompareArrows className="h-5 w-5 text-primary" />
            Model Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Unable to load comparison data. Platform admin access required.
          </div>
        </CardContent>
      </Card>
    );
  }

  const models = data?.models || [];
  const maxRequests = Math.max(...models.map(m => m.requests), 1);
  const maxCost = Math.max(...models.map(m => m.totalCostMicrodollars), 1);

  return (
    <Card data-testid="model-comparison-widget">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GitCompareArrows className="h-5 w-5 text-primary" />
              Model Comparison
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              Compare cost, speed, and usage across AI models over time
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-32 h-8" data-testid="select-comparison-days">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              data-testid="button-refresh-comparison"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {models.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <GitCompareArrows className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No model usage data for this time period</p>
            <p className="text-xs mt-1">As different models are used, comparison data will appear here</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-right">Cost/Request</TableHead>
                    <TableHead className="text-right">Avg Latency</TableHead>
                    <TableHead className="text-right">Tokens/Req</TableHead>
                    <TableHead className="text-right">Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map((model) => {
                    const costTier = getCostTierBadge(model.costPerRequest);
                    return (
                      <TableRow key={model.model} data-testid={`comparison-row-${model.model}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{getModelDisplayName(model.model)}</span>
                            <Badge variant={costTier.variant} className="text-xs">
                              {costTier.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{model.requests.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatTokens(model.totalTokens)}</TableCell>
                        <TableCell className="text-right">{formatCost(model.totalCostMicrodollars)}</TableCell>
                        <TableCell className="text-right">{formatCost(model.costPerRequest)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {model.avgLatencyMs > 0 ? `${model.avgLatencyMs}ms` : "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{model.avgTokensPerRequest.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {model.errors > 0 ? (
                            <div className="flex items-center justify-end gap-1">
                              <AlertTriangle className="h-3 w-3 text-destructive" />
                              <span className="text-destructive">{model.errorRate}%</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                Usage Distribution
              </h4>
              <div className="space-y-3">
                {models.map((model) => (
                  <div key={model.model} className="space-y-1" data-testid={`comparison-bar-${model.model}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{getModelDisplayName(model.model)}</span>
                      <span className="text-muted-foreground text-xs">
                        {model.requests} requests | {formatCost(model.totalCostMicrodollars)}
                      </span>
                    </div>
                    <div className="flex gap-1 h-2">
                      <div
                        className="bg-primary rounded-sm"
                        style={{ width: `${(model.requests / maxRequests) * 60}%` }}
                        title={`Requests: ${model.requests}`}
                      />
                      <div
                        className="bg-chart-2 rounded-sm"
                        style={{ width: `${(model.totalCostMicrodollars / maxCost) * 40}%` }}
                        title={`Cost: ${formatCost(model.totalCostMicrodollars)}`}
                      />
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-sm bg-primary" /> Requests
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-sm bg-chart-2" /> Cost
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {models.some(m => m.dailyData.length > 0) && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Daily Trend (Requests)
                </h4>
                <div className="space-y-3">
                  {models.filter(m => m.dailyData.length > 0).map((model) => {
                    const maxDailyRequests = Math.max(...model.dailyData.map(d => d.requests), 1);
                    return (
                      <div key={model.model} className="space-y-1" data-testid={`comparison-trend-${model.model}`}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{getModelDisplayName(model.model)}</span>
                          <span className="text-muted-foreground text-xs">
                            {model.dailyData.length} active days
                          </span>
                        </div>
                        <div className="flex items-end gap-px h-10">
                          {model.dailyData.map((day) => (
                            <div
                              key={day.date}
                              className="flex-1 bg-primary/70 rounded-t-sm min-w-[2px] max-w-[12px]"
                              style={{
                                height: `${Math.max((day.requests / maxDailyRequests) * 100, 4)}%`,
                              }}
                              title={`${day.date}: ${day.requests} requests, ${formatCost(day.cost)}`}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{model.dailyData[0]?.date || ""}</span>
                          <span>{model.dailyData[model.dailyData.length - 1]?.date || ""}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {models.length >= 2 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Quick Insights
                </h4>
                <div className="grid gap-3 md:grid-cols-2">
                  {(() => {
                    const cheapest = [...models].sort((a, b) => a.costPerRequest - b.costPerRequest)[0];
                    const fastest = [...models].filter(m => m.avgLatencyMs > 0).sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0];
                    const mostUsed = models[0];
                    const mostEfficient = [...models].sort((a, b) => {
                      const aEfficiency = a.avgTokensPerRequest > 0 ? a.costPerRequest / a.avgTokensPerRequest : Infinity;
                      const bEfficiency = b.avgTokensPerRequest > 0 ? b.costPerRequest / b.avgTokensPerRequest : Infinity;
                      return aEfficiency - bEfficiency;
                    })[0];

                    return [
                      cheapest && {
                        label: "Lowest Cost/Request",
                        model: getModelDisplayName(cheapest.model),
                        detail: formatCost(cheapest.costPerRequest),
                        icon: DollarSign,
                      },
                      fastest && {
                        label: "Fastest Avg Response",
                        model: getModelDisplayName(fastest.model),
                        detail: `${fastest.avgLatencyMs}ms`,
                        icon: Clock,
                      },
                      mostUsed && {
                        label: "Most Used",
                        model: getModelDisplayName(mostUsed.model),
                        detail: `${mostUsed.requests} requests`,
                        icon: BarChart2,
                      },
                      mostEfficient && {
                        label: "Best Cost Efficiency",
                        model: getModelDisplayName(mostEfficient.model),
                        detail: `${formatCost(mostEfficient.costPerRequest)}/req`,
                        icon: TrendingUp,
                      },
                    ].filter(Boolean).map((insight) => {
                      const InsightIcon = insight!.icon;
                      return (
                        <div key={insight!.label} className="flex items-center gap-3 p-3 border rounded-md">
                          <InsightIcon className="h-4 w-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">{insight!.label}</p>
                            <p className="text-sm font-medium truncate">{insight!.model}</p>
                            <p className="text-xs text-muted-foreground">{insight!.detail}</p>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
