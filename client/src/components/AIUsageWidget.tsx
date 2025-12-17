import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Activity, TrendingUp, Cpu, DollarSign, RefreshCw, BarChart2 } from "lucide-react";
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
    "gpt-4o-mini": "GPT-4o Mini",
    "gpt-5": "GPT-5",
    "claude-3-opus": "Claude 3 Opus",
    "claude-3-sonnet": "Claude 3 Sonnet",
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
    queryKey: ["/api/ai/usage/summary", periodType],
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
    queryKey: ["/api/ai/usage/platform", periodType],
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
