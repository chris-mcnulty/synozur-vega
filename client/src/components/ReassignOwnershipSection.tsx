import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Loader2, AlertTriangle, History, Users as UsersIcon } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ReassignmentAuditLog, ReassignmentCounts } from "@shared/schema";

type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  tenantId: string | null;
};

type SimpleItem = { id: string; title: string };
type TicketItem = { id: string; subject: string; ticketNumber: number };

type RoleKey =
  | "objectivesPrimary"
  | "objectivesCoOwner"
  | "objectivesCheckIn"
  | "keyResults"
  | "bigRocksOwner"
  | "bigRocksAccountable"
  | "ambitions"
  | "strategies"
  | "meetingsFacilitator"
  | "meetingsAttendee"
  | "supportTickets";

type OwnedItemsResponse = {
  counts: ReassignmentCounts;
  items: {
    objectivesPrimary: SimpleItem[];
    objectivesCoOwner: SimpleItem[];
    objectivesCheckIn: SimpleItem[];
    keyResults: SimpleItem[];
    bigRocksOwner: SimpleItem[];
    bigRocksAccountable: SimpleItem[];
    ambitions: SimpleItem[];
    strategies: SimpleItem[];
    meetingsFacilitator: SimpleItem[];
    meetingsAttendee: SimpleItem[];
    supportTickets: TicketItem[];
  };
};

const ROLE_LABELS: Array<[RoleKey, string]> = [
  ["objectivesPrimary", "Objectives (owner)"],
  ["objectivesCoOwner", "Objectives (co-owner)"],
  ["objectivesCheckIn", "Objectives (check-in owner)"],
  ["keyResults", "Key Results"],
  ["bigRocksOwner", "Big Rocks (owner)"],
  ["bigRocksAccountable", "Big Rocks (accountable)"],
  ["ambitions", "Ambitions"],
  ["strategies", "Strategies"],
  ["meetingsFacilitator", "Meetings (facilitator)"],
  ["meetingsAttendee", "Meetings (attendee)"],
  ["supportTickets", "Support Tickets"],
];

interface Props {
  users: User[];
  selectedTenantId: string;
}

export function ReassignOwnershipSection({ users, selectedTenantId }: Props) {
  const { toast } = useToast();
  const [fromUserId, setFromUserId] = useState<string>("");
  const [toUserId, setToUserId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [keepOriginalAsCoOwner, setKeepOriginalAsCoOwner] = useState<boolean>(true);
  // Map of role -> Set of selected entity ids. Defaults to ALL when items load.
  const [selectedIds, setSelectedIds] = useState<Record<RoleKey, Set<string>>>({
    objectivesPrimary: new Set(),
    objectivesCoOwner: new Set(),
    objectivesCheckIn: new Set(),
    keyResults: new Set(),
    bigRocksOwner: new Set(),
    bigRocksAccountable: new Set(),
    ambitions: new Set(),
    strategies: new Set(),
    meetingsFacilitator: new Set(),
    meetingsAttendee: new Set(),
    supportTickets: new Set(),
  });

  const tenantUsers = useMemo(() => {
    if (!selectedTenantId) return users;
    return users.filter(u => u.tenantId === selectedTenantId);
  }, [users, selectedTenantId]);

  const { data: ownedItems, isLoading: ownedLoading } = useQuery<OwnedItemsResponse>({
    queryKey: ["/api/users", fromUserId, "owned-items"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${fromUserId}/owned-items`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load owned items");
      return res.json();
    },
    enabled: !!fromUserId,
  });

  // When the inventory loads, default-select every item.
  useEffect(() => {
    if (!ownedItems) return;
    setSelectedIds({
      objectivesPrimary: new Set(ownedItems.items.objectivesPrimary.map(i => i.id)),
      objectivesCoOwner: new Set(ownedItems.items.objectivesCoOwner.map(i => i.id)),
      objectivesCheckIn: new Set(ownedItems.items.objectivesCheckIn.map(i => i.id)),
      keyResults: new Set(ownedItems.items.keyResults.map(i => i.id)),
      bigRocksOwner: new Set(ownedItems.items.bigRocksOwner.map(i => i.id)),
      bigRocksAccountable: new Set(ownedItems.items.bigRocksAccountable.map(i => i.id)),
      ambitions: new Set(ownedItems.items.ambitions.map(i => i.id)),
      strategies: new Set(ownedItems.items.strategies.map(i => i.id)),
      meetingsFacilitator: new Set(ownedItems.items.meetingsFacilitator.map(i => i.id)),
      meetingsAttendee: new Set(ownedItems.items.meetingsAttendee.map(i => i.id)),
      supportTickets: new Set(ownedItems.items.supportTickets.map(i => i.id)),
    });
  }, [ownedItems]);

  const { data: auditLogs = [], isLoading: auditLoading } = useQuery<ReassignmentAuditLog[]>({
    queryKey: ["/api/reassignment-audit-logs", selectedTenantId],
    queryFn: async () => {
      const url = selectedTenantId
        ? `/api/reassignment-audit-logs?tenantId=${selectedTenantId}`
        : "/api/reassignment-audit-logs";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load audit logs");
      return res.json();
    },
  });

  const reassignMutation = useMutation({
    mutationFn: async (payload: {
      fromUserId: string;
      toUserId: string;
      notes?: string;
      keepOriginalAsCoOwner: boolean;
      entityIds: Partial<Record<RoleKey, string[]>>;
    }) => {
      return await apiRequest("POST", "/api/users/reassign", payload);
    },
    onSuccess: async (response: any) => {
      const data = await response.json().catch(() => null);
      const total = data?.counts?.total ?? 0;
      toast({
        title: "Reassignment complete",
        description: total === 0
          ? "No items needed to be reassigned."
          : `${total} item${total === 1 ? "" : "s"} reassigned successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users", fromUserId, "owned-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reassignment-audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      setFromUserId("");
      setToUserId("");
      setNotes("");
      setConfirmOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Reassignment failed",
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });
      setConfirmOpen(false);
    },
  });

  const fromUser = tenantUsers.find(u => u.id === fromUserId);
  const toUser = tenantUsers.find(u => u.id === toUserId);

  // Counts from the *current selection* — drives preview/confirm/disabled state.
  const selectedCounts = useMemo<ReassignmentCounts>(() => {
    const c: ReassignmentCounts = {
      objectivesPrimary: selectedIds.objectivesPrimary.size,
      objectivesCoOwner: selectedIds.objectivesCoOwner.size,
      objectivesCheckIn: selectedIds.objectivesCheckIn.size,
      keyResults: selectedIds.keyResults.size,
      bigRocksOwner: selectedIds.bigRocksOwner.size,
      bigRocksAccountable: selectedIds.bigRocksAccountable.size,
      ambitions: selectedIds.ambitions.size,
      strategies: selectedIds.strategies.size,
      meetingsFacilitator: selectedIds.meetingsFacilitator.size,
      meetingsAttendee: selectedIds.meetingsAttendee.size,
      supportTickets: selectedIds.supportTickets.size,
      total: 0,
    };
    c.total =
      c.objectivesPrimary + c.objectivesCoOwner + c.objectivesCheckIn + c.keyResults +
      c.bigRocksOwner + c.bigRocksAccountable + c.ambitions + c.strategies +
      c.meetingsFacilitator + c.meetingsAttendee + c.supportTickets;
    return c;
  }, [selectedIds]);

  const totalSelected = selectedCounts.total;

  const canSubmit =
    !!fromUserId &&
    !!toUserId &&
    fromUserId !== toUserId &&
    totalSelected > 0 &&
    !reassignMutation.isPending;

  function toggleItem(role: RoleKey, id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev[role]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [role]: next };
    });
  }

  function setRoleAll(role: RoleKey, allIds: string[], checked: boolean) {
    setSelectedIds(prev => ({
      ...prev,
      [role]: checked ? new Set(allIds) : new Set(),
    }));
  }

  function handleConfirm() {
    if (!canSubmit) return;
    const entityIds: Partial<Record<RoleKey, string[]>> = {};
    (Object.keys(selectedIds) as RoleKey[]).forEach(role => {
      entityIds[role] = Array.from(selectedIds[role]);
    });
    reassignMutation.mutate({
      fromUserId,
      toUserId,
      notes: notes.trim() || undefined,
      keepOriginalAsCoOwner,
      entityIds,
    });
  }

  function formatDateTime(value: string | Date | null): string {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  }

  function renderItemGroup(role: RoleKey, label: string) {
    if (!ownedItems) return null;
    const list = ownedItems.items[role] as Array<SimpleItem | TicketItem>;
    if (list.length === 0) return null;
    const allIds = list.map(i => i.id);
    const selectedCount = selectedIds[role].size;
    const allSelected = selectedCount === allIds.length;
    const someSelected = selectedCount > 0 && !allSelected;
    return (
      <div key={role} className="border rounded-md" data-testid={`group-${role}`}>
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`group-check-${role}`}
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(v) => setRoleAll(role, allIds, !!v)}
              data-testid={`checkbox-group-${role}`}
            />
            <Label htmlFor={`group-check-${role}`} className="text-sm font-medium cursor-pointer">
              {label}
            </Label>
          </div>
          <Badge variant="secondary" data-testid={`badge-group-count-${role}`}>
            {selectedCount} / {allIds.length}
          </Badge>
        </div>
        <ScrollArea className="max-h-48">
          <ul className="divide-y">
            {list.map(item => {
              const title = "title" in item
                ? item.title
                : `#${(item as TicketItem).ticketNumber} — ${(item as TicketItem).subject}`;
              const checked = selectedIds[role].has(item.id);
              return (
                <li key={item.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <Checkbox
                    id={`item-${role}-${item.id}`}
                    checked={checked}
                    onCheckedChange={() => toggleItem(role, item.id)}
                    data-testid={`checkbox-item-${role}-${item.id}`}
                  />
                  <Label
                    htmlFor={`item-${role}-${item.id}`}
                    className="flex-1 cursor-pointer truncate"
                    title={title}
                  >
                    {title}
                  </Label>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </div>
    );
  }

  const hasObjectivesPrimarySelected = selectedIds.objectivesPrimary.size > 0;

  return (
    <div className="space-y-6">
      <Card data-testid="card-reassign-ownership">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UsersIcon className="h-5 w-5 text-primary" />
            Reassign Ownership
          </CardTitle>
          <CardDescription>
            Transfer all owned and co-owned items from one user to another in a single batch.
            This includes objectives, key results, big rocks, ambitions, strategies, meetings,
            and support tickets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedTenantId && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Select an organization</AlertTitle>
              <AlertDescription>
                Choose an organization from the filter above to perform a reassignment.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="select-from-user">From user</Label>
              <Select
                value={fromUserId}
                onValueChange={setFromUserId}
                disabled={!selectedTenantId || reassignMutation.isPending}
              >
                <SelectTrigger id="select-from-user" aria-label="From user" data-testid="select-from-user">
                  <SelectValue placeholder="Select source user" />
                </SelectTrigger>
                <SelectContent>
                  {tenantUsers.length === 0 && (
                    <SelectItem value="__empty__" disabled>
                      No users available
                    </SelectItem>
                  )}
                  {tenantUsers.map(u => (
                    <SelectItem key={u.id} value={u.id} data-testid={`option-from-${u.id}`}>
                      {u.name ? `${u.name} — ${u.email}` : u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="hidden md:flex items-center justify-center pb-2">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="select-to-user">To user</Label>
              <Select
                value={toUserId}
                onValueChange={setToUserId}
                disabled={!selectedTenantId || reassignMutation.isPending}
              >
                <SelectTrigger id="select-to-user" aria-label="To user" data-testid="select-to-user">
                  <SelectValue placeholder="Select destination user" />
                </SelectTrigger>
                <SelectContent>
                  {tenantUsers.length === 0 && (
                    <SelectItem value="__empty__" disabled>
                      No users available
                    </SelectItem>
                  )}
                  {tenantUsers
                    .filter(u => u.id !== fromUserId)
                    .map(u => (
                      <SelectItem key={u.id} value={u.id} data-testid={`option-to-${u.id}`}>
                        {u.name ? `${u.name} — ${u.email}` : u.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reassign-notes">Notes (optional)</Label>
            <Textarea
              id="reassign-notes"
              data-testid="input-reassign-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Reason for transfer (e.g. employee offboarding, role change)"
              rows={2}
              maxLength={2000}
              disabled={reassignMutation.isPending}
            />
          </div>

          {fromUserId && (
            <div
              className="rounded-md border p-4 space-y-3"
              data-testid="preview-owned-items"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  Items currently owned by {fromUser?.name || fromUser?.email}
                </h4>
                {ownedLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Badge data-testid="badge-total-count">{totalSelected} selected</Badge>
                )}
              </div>

              {ownedLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : !ownedItems || ownedItems.counts.total === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This user does not currently own any items.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Uncheck any items you do <strong>not</strong> want to transfer.
                  </p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {ROLE_LABELS.map(([role, label]) => renderItemGroup(role, label))}
                  </div>

                  {hasObjectivesPrimarySelected && (
                    <div className="flex items-start gap-2 pt-1 border-t">
                      <Checkbox
                        id="check-keep-original-co-owner"
                        checked={keepOriginalAsCoOwner}
                        onCheckedChange={(v) => setKeepOriginalAsCoOwner(!!v)}
                        data-testid="checkbox-keep-original-co-owner"
                      />
                      <div className="space-y-1">
                        <Label
                          htmlFor="check-keep-original-co-owner"
                          className="text-sm cursor-pointer"
                        >
                          Keep original owner as co-owner on transferred objectives
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Adds {fromUser?.name || fromUser?.email} to the co-owners list of each
                          objective whose primary owner you are transferring.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setFromUserId("");
                setToUserId("");
                setNotes("");
              }}
              disabled={reassignMutation.isPending}
              data-testid="button-clear-reassign"
            >
              Clear
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!canSubmit}
              data-testid="button-open-reassign-confirm"
            >
              {reassignMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Reassign Ownership
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-reassignment-audit-logs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-primary" />
            Reassignment History
          </CardTitle>
          <CardDescription>Recent ownership transfers performed by tenant administrators.</CardDescription>
        </CardHeader>
        <CardContent>
          {auditLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reassignments have been performed yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map(log => (
                  <TableRow key={log.id} data-testid={`row-audit-log-${log.id}`}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(log.createdAt as any)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{log.fromUserName || log.fromUserEmail}</div>
                      {log.fromUserName && (
                        <div className="text-xs text-muted-foreground">{log.fromUserEmail}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{log.toUserName || log.toUserEmail}</div>
                      {log.toUserName && (
                        <div className="text-xs text-muted-foreground">{log.toUserEmail}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.performedByName || log.performedByEmail}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {log.counts?.total ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={log.status === 'completed' ? 'secondary' : 'destructive'}
                        data-testid={`badge-status-${log.id}`}
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {log.notes || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent data-testid="dialog-confirm-reassign">
          <DialogHeader>
            <DialogTitle>Confirm reassignment</DialogTitle>
            <DialogDescription>
              This will transfer ownership of the selected items from one user to another. The change is
              recorded in the audit log and notifications will be sent to both users.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-md border p-3 text-sm">
              <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Transferring from</div>
              <div className="font-medium">{fromUser?.name || fromUser?.email}</div>
              {fromUser?.name && <div className="text-xs text-muted-foreground">{fromUser.email}</div>}
            </div>
            <div className="rounded-md border p-3 text-sm">
              <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Transferring to</div>
              <div className="font-medium">{toUser?.name || toUser?.email}</div>
              {toUser?.name && <div className="text-xs text-muted-foreground">{toUser.email}</div>}
            </div>
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Items to transfer</div>
              {totalSelected === 0 ? (
                <p className="text-sm text-muted-foreground">No items selected.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {ROLE_LABELS.map(([key, label]) => {
                    const n = selectedCounts[key] ?? 0;
                    if (n === 0) return null;
                    return (
                      <li key={key} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{n}</span>
                      </li>
                    );
                  })}
                  <li className="flex items-center justify-between border-t pt-1 mt-1 font-semibold">
                    <span>Total</span>
                    <span>{totalSelected}</span>
                  </li>
                </ul>
              )}
              {hasObjectivesPrimarySelected && keepOriginalAsCoOwner && (
                <p className="text-xs text-muted-foreground mt-2">
                  {fromUser?.name || fromUser?.email} will be kept as a co-owner on transferred objectives.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={reassignMutation.isPending}
              data-testid="button-cancel-reassign"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={reassignMutation.isPending || totalSelected === 0}
              data-testid="button-confirm-reassign"
            >
              {reassignMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
