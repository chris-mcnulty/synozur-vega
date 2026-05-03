import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Trash2, RotateCcw, AlertCircle, Target, KeyRound, Mountain, Map, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES, hasPermission, PERMISSIONS, type Role } from "@shared/rbac";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface TrashItem {
  id: string;
  title?: string;
  description?: string | null;
  deletedAt?: string | Date | null;
  deletedBy?: string | null;
  deletedByName?: string | null;
  deletedByEmail?: string | null;
  parentContext?: { type: string; id: string; title: string } | null;
  tenantId?: string;
}

interface TrashResponse {
  objectives: TrashItem[];
  keyResults: TrashItem[];
  bigRocks: TrashItem[];
  strategies: TrashItem[];
  ambitions: TrashItem[];
}

const RETENTION_DAYS = 30;

function daysUntilPurge(deletedAt: string | Date | null | undefined): number | null {
  if (!deletedAt) return null;
  const deletedTime = new Date(deletedAt).getTime();
  const purgeTime = deletedTime + RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const remainingMs = purgeTime - Date.now();
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

function formatDeletedDate(deletedAt: string | Date | null | undefined): string {
  if (!deletedAt) return "Unknown";
  const d = new Date(deletedAt);
  return d.toLocaleString();
}

function TrashItemRow({
  item,
  type,
  typeLabel,
  onRestore,
  isRestoring,
  onDeleteForever,
  isDeleting,
}: {
  item: TrashItem;
  type: string;
  typeLabel: string;
  onRestore: (type: string, id: string) => void;
  isRestoring: boolean;
  onDeleteForever: (type: string, id: string) => void;
  isDeleting: boolean;
}) {
  const remaining = daysUntilPurge(item.deletedAt);
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-md border p-4"
      data-testid={`row-trash-${type}-${item.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate" data-testid={`text-title-${item.id}`}>
            {item.title || "(untitled)"}
          </span>
          <Badge variant="secondary" data-testid={`badge-type-${item.id}`}>
            {typeLabel}
          </Badge>
        </div>
        {item.description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.description}</p>
        )}
        {item.parentContext && item.parentContext.title && (
          <p
            className="mt-1 text-xs text-muted-foreground"
            data-testid={`text-parent-context-${item.id}`}
          >
            Under {item.parentContext.type === 'keyResult' ? 'key result' : item.parentContext.type}
            : <span className="font-medium">{item.parentContext.title}</span>
          </p>
        )}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span data-testid={`text-deleted-at-${item.id}`}>
            Deleted: {formatDeletedDate(item.deletedAt)}
          </span>
          {(item.deletedByName || item.deletedByEmail) && (
            <span data-testid={`text-deleted-by-${item.id}`}>
              by {item.deletedByName || item.deletedByEmail}
            </span>
          )}
          {remaining !== null && (
            <span
              className={remaining <= 3 ? "text-destructive" : ""}
              data-testid={`text-purge-countdown-${item.id}`}
            >
              {remaining === 0
                ? "Will be permanently deleted soon"
                : `${remaining} day${remaining === 1 ? "" : "s"} until permanent deletion`}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onRestore(type, item.id)}
          disabled={isRestoring || isDeleting}
          data-testid={`button-restore-${type}-${item.id}`}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Restore
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="destructive"
              disabled={isRestoring || isDeleting}
              data-testid={`button-delete-forever-${type}-${item.id}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Forever
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent data-testid={`dialog-delete-forever-${type}-${item.id}`}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this {typeLabel.toLowerCase()} forever?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <span className="font-medium">{item.title || "(untitled)"}</span>
                {" "}and any related child items. This action is irreversible and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid={`button-cancel-delete-forever-${type}-${item.id}`}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDeleteForever(type, item.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid={`button-confirm-delete-forever-${type}-${item.id}`}
              >
                Delete Forever
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export default function Trash() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const userRole = user?.role as Role | undefined;
  const canManageTenant = userRole ? hasPermission(userRole, PERMISSIONS.MANAGE_TENANT_SETTINGS) : false;
  const isPlatformAdmin = userRole === ROLES.VEGA_ADMIN || userRole === ROLES.GLOBAL_ADMIN;
  const canAccess = canManageTenant || isPlatformAdmin;

  useEffect(() => {
    if (!authLoading && user && !canAccess) {
      toast({
        title: "Access denied",
        description: "You do not have permission to view the trash.",
        variant: "destructive",
      });
      setLocation("/dashboard");
    }
  }, [authLoading, user, canAccess, setLocation, toast]);

  const { data, isLoading, error } = useQuery<TrashResponse>({
    queryKey: ["/api/trash"],
    enabled: canAccess,
  });

  const restoreMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      const res = await apiRequest("POST", `/api/trash/${type}/${id}/restore`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trash"] });
      // Invalidate primary lists so restored items reappear in the app
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/foundations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okr"] });
      queryClient.invalidateQueries({ queryKey: ["/api/objectives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/big-rocks"] });
      toast({
        title: "Item restored",
        description: "The item has been restored successfully.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Restore failed",
        description: err?.message || "Failed to restore item",
        variant: "destructive",
      });
    },
  });

  const handleRestore = (type: string, id: string) => {
    restoreMutation.mutate({ type, id });
  };

  const deleteForeverMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      const res = await apiRequest("DELETE", `/api/trash/${type}/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trash"] });
      toast({
        title: "Item permanently deleted",
        description: "The item and any related child items have been permanently deleted.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Delete failed",
        description: err?.message || "Failed to permanently delete item",
        variant: "destructive",
      });
    },
  });

  const handleDeleteForever = (type: string, id: string) => {
    deleteForeverMutation.mutate({ type, id });
  };

  if (!canAccess) {
    return null;
  }

  const total =
    (data?.objectives.length || 0) +
    (data?.keyResults.length || 0) +
    (data?.bigRocks.length || 0) +
    (data?.strategies.length || 0) +
    (data?.ambitions.length || 0);

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Trash | Vega</title>
        <meta name="description" content="Recover or permanently delete soft-deleted strategic items." />
      </Helmet>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trash2 className="h-7 w-7" />
            Trash
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-trash-description">
            Items here can be restored. They are permanently deleted after {RETENTION_DAYS} days.
          </p>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>Failed to load trash items.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="pt-6 text-muted-foreground" data-testid="text-trash-loading">
            Loading trash items...
          </CardContent>
        </Card>
      )}

      {!isLoading && data && total === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Trash is empty</CardTitle>
            <CardDescription>
              No deleted strategic items to recover. Deleted objectives, key results, big rocks,
              strategies, and ambitions will appear here for {RETENTION_DAYS} days.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!isLoading && data && total > 0 && (
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-trash-all">
              All ({total})
            </TabsTrigger>
            <TabsTrigger value="objectives" data-testid="tab-trash-objectives">
              <Target className="h-4 w-4 mr-1" />
              Objectives ({data.objectives.length})
            </TabsTrigger>
            <TabsTrigger value="keyResults" data-testid="tab-trash-key-results">
              <KeyRound className="h-4 w-4 mr-1" />
              Key Results ({data.keyResults.length})
            </TabsTrigger>
            <TabsTrigger value="bigRocks" data-testid="tab-trash-big-rocks">
              <Mountain className="h-4 w-4 mr-1" />
              Big Rocks ({data.bigRocks.length})
            </TabsTrigger>
            <TabsTrigger value="strategies" data-testid="tab-trash-strategies">
              <Map className="h-4 w-4 mr-1" />
              Strategies ({data.strategies.length})
            </TabsTrigger>
            <TabsTrigger value="ambitions" data-testid="tab-trash-ambitions">
              <Sparkles className="h-4 w-4 mr-1" />
              Ambitions ({data.ambitions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-3 mt-4">
            {data.objectives.map((item) => (
              <TrashItemRow
                key={`o-${item.id}`}
                item={item}
                type="objective"
                typeLabel="Objective"
                onRestore={handleRestore}
                isRestoring={restoreMutation.isPending}
          onDeleteForever={handleDeleteForever}
          isDeleting={deleteForeverMutation.isPending}
              />
            ))}
            {data.keyResults.map((item) => (
              <TrashItemRow
                key={`k-${item.id}`}
                item={item}
                type="keyResult"
                typeLabel="Key Result"
                onRestore={handleRestore}
                isRestoring={restoreMutation.isPending}
          onDeleteForever={handleDeleteForever}
          isDeleting={deleteForeverMutation.isPending}
              />
            ))}
            {data.bigRocks.map((item) => (
              <TrashItemRow
                key={`b-${item.id}`}
                item={item}
                type="bigRock"
                typeLabel="Big Rock"
                onRestore={handleRestore}
                isRestoring={restoreMutation.isPending}
          onDeleteForever={handleDeleteForever}
          isDeleting={deleteForeverMutation.isPending}
              />
            ))}
            {data.strategies.map((item) => (
              <TrashItemRow
                key={`s-${item.id}`}
                item={item}
                type="strategy"
                typeLabel="Strategy"
                onRestore={handleRestore}
                isRestoring={restoreMutation.isPending}
          onDeleteForever={handleDeleteForever}
          isDeleting={deleteForeverMutation.isPending}
              />
            ))}
            {data.ambitions.map((item) => (
              <TrashItemRow
                key={`a-${item.id}`}
                item={item}
                type="ambition"
                typeLabel="Ambition"
                onRestore={handleRestore}
                isRestoring={restoreMutation.isPending}
          onDeleteForever={handleDeleteForever}
          isDeleting={deleteForeverMutation.isPending}
              />
            ))}
          </TabsContent>

          <TabsContent value="objectives" className="space-y-3 mt-4">
            {data.objectives.length === 0 ? (
              <p className="text-muted-foreground text-sm">No deleted objectives.</p>
            ) : (
              data.objectives.map((item) => (
                <TrashItemRow
                  key={item.id}
                  item={item}
                  type="objective"
                  typeLabel="Objective"
                  onRestore={handleRestore}
                  isRestoring={restoreMutation.isPending}
          onDeleteForever={handleDeleteForever}
          isDeleting={deleteForeverMutation.isPending}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="keyResults" className="space-y-3 mt-4">
            {data.keyResults.length === 0 ? (
              <p className="text-muted-foreground text-sm">No deleted key results.</p>
            ) : (
              data.keyResults.map((item) => (
                <TrashItemRow
                  key={item.id}
                  item={item}
                  type="keyResult"
                  typeLabel="Key Result"
                  onRestore={handleRestore}
                  isRestoring={restoreMutation.isPending}
          onDeleteForever={handleDeleteForever}
          isDeleting={deleteForeverMutation.isPending}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="bigRocks" className="space-y-3 mt-4">
            {data.bigRocks.length === 0 ? (
              <p className="text-muted-foreground text-sm">No deleted big rocks.</p>
            ) : (
              data.bigRocks.map((item) => (
                <TrashItemRow
                  key={item.id}
                  item={item}
                  type="bigRock"
                  typeLabel="Big Rock"
                  onRestore={handleRestore}
                  isRestoring={restoreMutation.isPending}
          onDeleteForever={handleDeleteForever}
          isDeleting={deleteForeverMutation.isPending}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="strategies" className="space-y-3 mt-4">
            {data.strategies.length === 0 ? (
              <p className="text-muted-foreground text-sm">No deleted strategies.</p>
            ) : (
              data.strategies.map((item) => (
                <TrashItemRow
                  key={item.id}
                  item={item}
                  type="strategy"
                  typeLabel="Strategy"
                  onRestore={handleRestore}
                  isRestoring={restoreMutation.isPending}
          onDeleteForever={handleDeleteForever}
          isDeleting={deleteForeverMutation.isPending}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="ambitions" className="space-y-3 mt-4">
            {data.ambitions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No deleted ambitions.</p>
            ) : (
              data.ambitions.map((item) => (
                <TrashItemRow
                  key={item.id}
                  item={item}
                  type="ambition"
                  typeLabel="Ambition"
                  onRestore={handleRestore}
                  isRestoring={restoreMutation.isPending}
          onDeleteForever={handleDeleteForever}
          isDeleting={deleteForeverMutation.isPending}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
