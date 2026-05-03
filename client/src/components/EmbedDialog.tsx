import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { Copy, Code, Trash2, ExternalLink, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

type EmbedEntityType = "objective" | "key_result" | "big_rock" | "executive_dashboard";

interface EmbedDialogProps {
  open: boolean;
  onClose: () => void;
  entityType: EmbedEntityType;
  entityId: string | null;
  entityTitle: string;
}

type EmbedTokenRow = {
  id: string;
  entityType: string;
  entityId: string | null;
  label: string;
  tokenPrefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  accessCount: number;
  createdAt: string;
  revokedAt: string | null;
};

type IssuedToken = {
  token: string;
  embedPath: string;
  iframeSnippet: string;
  expiresAt: string | null;
};

export function EmbedDialog({ open, onClose, entityType, entityId, entityTitle }: EmbedDialogProps) {
  const { toast } = useToast();
  const permissions = usePermissions();

  const [label, setLabel] = useState(`${entityTitle} embed`);
  const [expiresInDays, setExpiresInDays] = useState<string>("30");
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const qKey = entityId
    ? ["/api/embed-tokens", entityType, entityId]
    : ["/api/embed-tokens", entityType];

  const tokensQuery = useQuery<EmbedTokenRow[]>({
    queryKey: qKey,
    queryFn: async () => {
      const params = new URLSearchParams({ entityType });
      if (entityId) params.set("entityId", entityId);
      const res = await fetch(`/api/embed-tokens?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load embed tokens");
      return res.json();
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const expiresAt =
        expiresInDays === "none" || !expiresInDays
          ? null
          : new Date(Date.now() + parseInt(expiresInDays, 10) * 86400000).toISOString();
      const body: Record<string, unknown> = { entityType, label, expiresAt };
      if (entityId) body.entityId = entityId;
      const res = await apiRequest("POST", "/api/embed-tokens", body);
      if (!res.ok) throw new Error("Failed to create embed token");
      return res.json();
    },
    onSuccess: (data) => {
      setIssued({ token: data.token, embedPath: data.embedPath, iframeSnippet: data.iframeSnippet, expiresAt: data.expiresAt });
      queryClient.invalidateQueries({ queryKey: qKey });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create embed", description: err?.message || "Unknown error", variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/embed-tokens/${id}`);
      if (!res.ok) throw new Error("Failed to revoke token");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qKey });
      toast({ title: "Embed revoked" });
    },
    onError: (err: any) => {
      toast({ title: "Revoke failed", description: err?.message || "Unknown error", variant: "destructive" });
    },
  });

  function copy(text: string, field: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }

  const activeTokens = (tokensQuery.data ?? []).filter((t) => !t.revokedAt);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const expiryOptions = [
    { value: "1", label: "1 day" },
    { value: "7", label: "7 days" },
    { value: "30", label: "30 days" },
    ...(permissions.isAdmin ? [{ value: "none", label: "No expiry" }] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setIssued(null); } }}>
      <DialogContent className="max-w-lg" data-testid="dialog-embed">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-4 w-4 text-primary" />
            Embed: {entityTitle}
          </DialogTitle>
          <DialogDescription>
            Generate an iframe URL to embed this live card in SharePoint, Galaxy portals, or any intranet.
          </DialogDescription>
        </DialogHeader>

        {issued ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Embed token created
            </div>
            {issued.expiresAt && (
              <p className="text-xs text-muted-foreground">
                Expires {format(new Date(issued.expiresAt), "MMM d, yyyy")}
              </p>
            )}

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Embed URL</Label>
              <div className="flex gap-2">
                <Input value={`${origin}${issued.embedPath}`} readOnly className="font-mono text-xs" data-testid="text-embed-url" />
                <Button size="icon" variant="outline" onClick={() => copy(`${origin}${issued.embedPath}`, "url")} data-testid="button-copy-embed-url">
                  {copiedField === "url" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="outline" asChild>
                  <a href={issued.embedPath} target="_blank" rel="noopener noreferrer" data-testid="link-open-embed">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">iframe snippet</Label>
              <div className="flex gap-2">
                <Input value={issued.iframeSnippet.replace(issued.embedPath, `${origin}${issued.embedPath}`)} readOnly className="font-mono text-xs" data-testid="text-embed-snippet" />
                <Button size="icon" variant="outline" onClick={() => copy(issued.iframeSnippet.replace(issued.embedPath, `${origin}${issued.embedPath}`), "snippet")} data-testid="button-copy-snippet">
                  {copiedField === "snippet" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <p className="text-xs text-amber-600 dark:text-amber-400">
              Copy the snippet now — the token will not be shown again.
            </p>

            <div className="flex justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => setIssued(null)} data-testid="button-create-another-embed">
                Create another
              </Button>
              <Button size="sm" onClick={onClose} data-testid="button-embed-done">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="embed-label" className="text-sm">Label</Label>
              <Input
                id="embed-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. SharePoint widget"
                data-testid="input-embed-label"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="embed-expiry" className="text-sm">Expiry</Label>
              <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                <SelectTrigger id="embed-expiry" data-testid="select-embed-expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {expiryOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!permissions.isAdmin && (
                <p className="text-xs text-muted-foreground">Maximum 30 days for your role.</p>
              )}
            </div>

            <Button
              className="w-full"
              onClick={() => createMutation.mutate()}
              disabled={!label.trim() || createMutation.isPending}
              data-testid="button-create-embed"
            >
              {createMutation.isPending ? "Creating…" : "Generate embed link"}
            </Button>

            {activeTokens.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Active embeds for this item</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {activeTokens.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-md border bg-muted/30"
                      data-testid={`row-existing-embed-${t.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{t.label}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="font-mono text-[10px] text-muted-foreground">{t.tokenPrefix}</span>
                          {t.expiresAt ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              Exp {format(new Date(t.expiresAt), "MMM d")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">No expiry</Badge>
                          )}
                          {t.accessCount > 0 && (
                            <span className="text-[10px] text-muted-foreground">{t.accessCount} views</span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => revokeMutation.mutate(t.id)}
                        disabled={revokeMutation.isPending}
                        data-testid={`button-revoke-embed-${t.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
