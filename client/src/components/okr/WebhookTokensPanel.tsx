import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  KeyRound,
  Plus,
  Copy,
  RotateCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface WebhookTokenSummary {
  id: string;
  label: string;
  enabled: boolean;
  lastUsedAt: string | null;
  failureCount: number;
  successCount: number;
  createdAt: string;
  revokedAt: string | null;
}

interface IssuedTokenSecret {
  id: string;
  label: string;
  token: string;
  secret: string;
  url: string;
}

interface WebhookTokensPanelProps {
  keyResultId: string;
}

export function WebhookTokensPanel({ keyResultId }: WebhookTokensPanelProps) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [issued, setIssued] = useState<IssuedTokenSecret | null>(null);

  const tokensQuery = useQuery<WebhookTokenSummary[]>({
    queryKey: [`/api/okr/key-results/${keyResultId}/webhook-tokens`],
  });

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: [`/api/okr/key-results/${keyResultId}/webhook-tokens`],
    });

  const createMutation = useMutation({
    mutationFn: async (label: string) => {
      const res = await apiRequest(
        "POST",
        `/api/okr/key-results/${keyResultId}/webhook-tokens`,
        { label }
      );
      return (await res.json()) as IssuedTokenSecret;
    },
    onSuccess: (data) => {
      setIssued(data);
      setCreateOpen(false);
      setNewLabel("");
      refresh();
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't create token",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const rotateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/okr/webhook-tokens/${id}/rotate`, {});
      return (await res.json()) as IssuedTokenSecret;
    },
    onSuccess: (data) => {
      setIssued(data);
      refresh();
    },
    onError: (err: any) => {
      toast({ title: "Rotation failed", description: err?.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await apiRequest("PATCH", `/api/okr/webhook-tokens/${id}`, { enabled });
    },
    onSuccess: () => refresh(),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/okr/webhook-tokens/${id}`);
    },
    onSuccess: () => {
      refresh();
      toast({ title: "Token revoked" });
    },
  });

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied to clipboard` });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const tokens = tokensQuery.data ?? [];

  // KR-level "last auto-update" derived from token activity. Only successful
  // calls update lastUsedAt + successCount, so this surfaces the freshest
  // pace-derived auto-update without a separate KR fetch.
  const lastAutoUpdate = tokens
    .filter((t) => !t.revokedAt && t.successCount > 0 && t.lastUsedAt)
    .map((t) => new Date(t.lastUsedAt as string).getTime())
    .sort((a, b) => b - a)[0];
  const totalSuccess = tokens.reduce((acc, t) => acc + (t.successCount ?? 0), 0);
  const totalFailures = tokens.reduce((acc, t) => acc + (t.failureCount ?? 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Webhook Auto-Update
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                External systems can POST a new value to update this key result
                automatically. Each token has its own URL and HMAC secret.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              data-testid="button-create-webhook-token"
            >
              <Plus className="h-4 w-4 mr-1" /> New token
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tokens.length > 0 && (
            <div
              className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
              data-testid="text-kr-auto-update-summary"
            >
              <Activity className="h-3.5 w-3.5" />
              {lastAutoUpdate ? (
                <span>
                  Last auto-update {formatDistanceToNow(new Date(lastAutoUpdate), { addSuffix: true })}
                  {" "}
                  <Badge variant="outline" className="text-[10px] ml-1">via webhook</Badge>
                </span>
              ) : (
                <span>No successful auto-updates yet</span>
              )}
              <span aria-hidden>·</span>
              <span>{totalSuccess} ok</span>
              {totalFailures > 0 && <span className="text-destructive">{totalFailures} failed</span>}
            </div>
          )}
          {tokensQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No webhook tokens yet. Create one to start receiving auto-updates.
            </p>
          ) : (
            <div className="space-y-2">
              {tokens.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-md bg-muted/40"
                  data-testid={`row-webhook-token-${t.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate" data-testid={`text-token-label-${t.id}`}>
                        {t.label}
                      </span>
                      {t.revokedAt ? (
                        <Badge variant="outline" className="text-xs">Revoked</Badge>
                      ) : t.enabled ? (
                        <Badge variant="default" className="text-xs">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Disabled</Badge>
                      )}
                      {t.failureCount > 0 && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {t.failureCount} failures
                        </Badge>
                      )}
                      {t.successCount > 0 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {t.successCount} ok
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Created {format(new Date(t.createdAt), "MMM d, yyyy")}
                      {t.lastUsedAt
                        ? ` · last used ${format(new Date(t.lastUsedAt), "MMM d, yyyy HH:mm")}`
                        : " · never used"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {!t.revokedAt && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            toggleMutation.mutate({ id: t.id, enabled: !t.enabled })
                          }
                          disabled={toggleMutation.isPending}
                          data-testid={`button-toggle-token-${t.id}`}
                        >
                          {t.enabled ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rotateMutation.mutate(t.id)}
                          disabled={rotateMutation.isPending}
                          data-testid={`button-rotate-token-${t.id}`}
                        >
                          <RotateCw className="h-3 w-3 mr-1" /> Rotate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm("Revoke this token? External callers using it will start failing.")) {
                              revokeMutation.mutate(t.id);
                            }
                          }}
                          disabled={revokeMutation.isPending}
                          data-testid={`button-revoke-token-${t.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How-to */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">How to call</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>POST a JSON body to your token's URL. Sign the raw body with HMAC-SHA256 using the shared secret and pass it in the <code className="px-1 py-0.5 rounded bg-muted">X-Vega-Signature</code> header as <code>sha256=&lt;hex&gt;</code>.</p>
          <pre className="rounded bg-muted p-2 overflow-x-auto text-[11px] leading-snug">
{`curl -X POST "$URL" \\
  -H "Content-Type: application/json" \\
  -H "X-Vega-Signature: sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')" \\
  -d "$BODY"

# BODY = {"value": 42, "note": "from CI run #1234"}`}
          </pre>
          <p>Limits: 60 req/min per token, 1000 req/min per organization. Failed signatures and disabled tokens are recorded in the audit log.</p>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New webhook token</DialogTitle>
            <DialogDescription>
              Give this token a label so you can identify it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="webhook-label">Label</Label>
              <Input
                id="webhook-label"
                placeholder="e.g. Datadog metric, Snowflake nightly job"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                data-testid="input-token-label"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(newLabel.trim() || "Webhook")}
              disabled={createMutation.isPending}
              data-testid="button-confirm-create-token"
            >
              {createMutation.isPending ? "Creating…" : "Create token"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show secret ONCE dialog */}
      <Dialog open={!!issued} onOpenChange={(open) => !open && setIssued(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Save these credentials</DialogTitle>
            <DialogDescription>
              The secret is shown only once. Store it somewhere safe — you won't be able to
              retrieve it again.
            </DialogDescription>
          </DialogHeader>
          {issued && (
            <div className="space-y-3">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Anyone with the URL and secret can update this key result. Treat them like a password.
                </AlertDescription>
              </Alert>
              <div>
                <Label className="text-xs">Webhook URL</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={issued.url} className="font-mono text-xs" data-testid="text-issued-url" />
                  <Button size="icon" variant="outline" onClick={() => copy(issued.url, "URL")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Shared secret</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    readOnly
                    value={issued.secret}
                    className="font-mono text-xs"
                    data-testid="text-issued-secret"
                  />
                  <Button size="icon" variant="outline" onClick={() => copy(issued.secret, "Secret")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIssued(null)} data-testid="button-close-issued">
              I've saved them
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
