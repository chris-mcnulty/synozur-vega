import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Send, LifeBuoy, Clock, AlertCircle, CheckCircle2, MessageSquare, Eye, UserCheck, Filter, Search, History, FileText, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CANNED_RESPONSES } from "@shared/schema";

interface StaffUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface TicketListItem {
  id: string;
  ticketNumber: number;
  tenantId: string;
  userId: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TicketReply {
  id: string;
  ticketId: string;
  userId: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string; email: string };
}

interface TicketHistoryEntry {
  id: string;
  ticketId: string;
  userId: string | null;
  field: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string; email: string } | null;
}

interface TicketDetail {
  id: string;
  ticketNumber: number;
  tenantId: string;
  userId: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  metadata: object | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  replies: TicketReply[];
  history?: TicketHistoryEntry[];
  author: { id: string; email: string; firstName: string; lastName: string } | null;
  tenant: { id: string; name: string } | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "open":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-transparent";
    case "in_progress":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-transparent";
    case "resolved":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-transparent";
    case "closed":
      return "bg-muted text-muted-foreground border-transparent";
    default:
      return "";
  }
}

function getPriorityBadgeClass(priority: string) {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-transparent";
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-transparent";
    case "low":
      return "bg-muted text-muted-foreground border-transparent";
    default:
      return "";
  }
}

function getCategoryBadgeClass() {
  return "border-transparent";
}

function getStatusIcon(status: string) {
  switch (status) {
    case "open":
      return <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    case "in_progress":
      return <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
    case "resolved":
      return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
    case "closed":
      return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
    default:
      return null;
  }
}

function getStaffDisplayName(staff: StaffUser) {
  const name = `${staff.firstName || ''} ${staff.lastName || ''}`.trim();
  return name || staff.email;
}

function describeHistoryEntry(entry: TicketHistoryEntry, staffUsers: StaffUser[]): string {
  const fromLabel = entry.fromValue ? formatLabel(entry.fromValue) : "—";
  const toLabel = entry.toValue ? formatLabel(entry.toValue) : "—";
  if (entry.field === "assignedTo") {
    const fromUser = staffUsers.find((s) => s.id === entry.fromValue);
    const toUser = staffUsers.find((s) => s.id === entry.toValue);
    const fromName = fromUser ? getStaffDisplayName(fromUser) : entry.fromValue ? "Unknown" : "Unassigned";
    const toName = toUser ? getStaffDisplayName(toUser) : entry.toValue ? "Unknown" : "Unassigned";
    return `Assigned: ${fromName} → ${toName}`;
  }
  return `${formatLabel(entry.field)}: ${fromLabel} → ${toLabel}`;
}

export function AdminSupportTab() {
  const { toast } = useToast();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssignee, setBulkAssignee] = useState<string>("");

  const { data: staffUsers } = useQuery<StaffUser[]>({
    queryKey: ["/api/support/staff"],
  });

  const { data: currentUser } = useQuery<{ id: string }>({
    queryKey: ["/api/auth/me"],
  });

  const filters: Record<string, string> = {};
  if (statusFilter !== "all") filters.status = statusFilter;
  if (priorityFilter !== "all") filters.priority = priorityFilter;
  if (categoryFilter !== "all") filters.category = categoryFilter;
  if (assignedFilter !== "all" && assignedFilter !== "my_assigned") filters.assignedTo = assignedFilter;
  const trimmedQuery = searchQuery.trim();
  if (trimmedQuery) filters.q = trimmedQuery;

  const { data: tickets, isLoading } = useQuery<TicketListItem[]>({
    queryKey: ["/api/support/tickets", filters],
  });

  const displayedTickets = assignedFilter === "my_assigned" && currentUser
    ? tickets?.filter((t) => t.assignedTo === currentUser.id)
    : tickets;

  const openCount = tickets?.filter((t) => t.status === "open").length ?? 0;
  const inProgressCount = tickets?.filter((t) => t.status === "in_progress").length ?? 0;
  const pendingCount = openCount + inProgressCount;
  const myAssignedCount = currentUser
    ? tickets?.filter((t) => t.assignedTo === currentUser.id && (t.status === "open" || t.status === "in_progress")).length ?? 0
    : 0;

  const visibleIds = useMemo(() => (displayedTickets || []).map((t) => t.id), [displayedTickets]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && visibleIds.some((id) => selectedIds.has(id));

  const bulkUpdate = useMutation({
    mutationFn: async (payload: { status?: string; priority?: string; assignedTo?: string | null }) => {
      const res = await apiRequest("POST", "/api/support/tickets/bulk", {
        ticketIds: Array.from(selectedIds),
        ...payload,
      });
      return res.json();
    },
    onSuccess: (data: { updated: number; failed: number }) => {
      toast({
        title: "Bulk update complete",
        description: `${data.updated} ticket(s) updated${data.failed ? `, ${data.failed} failed` : ""}.`,
      });
      setSelectedIds(new Set());
      setBulkAssignee("");
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
    },
    onError: (err: Error) => {
      toast({ title: "Bulk update failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        visibleIds.forEach((id) => next.add(id));
      } else {
        visibleIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  if (selectedTicketId) {
    return (
      <TicketDetailView
        ticketId={selectedTicketId}
        onBack={() => setSelectedTicketId(null)}
        staffUsers={staffUsers || []}
      />
    );
  }

  const applyPreset = (preset: string) => {
    if (preset === "pending") {
      setStatusFilter("pending");
      setPriorityFilter("all");
      setCategoryFilter("all");
      setAssignedFilter("all");
    } else if (preset === "my_assigned") {
      setStatusFilter("pending");
      setPriorityFilter("all");
      setCategoryFilter("all");
      setAssignedFilter("my_assigned");
    } else if (preset === "all") {
      setStatusFilter("all");
      setPriorityFilter("all");
      setCategoryFilter("all");
      setAssignedFilter("all");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card
          data-testid="stat-card-total"
          className="cursor-pointer hover-elevate"
          onClick={() => applyPreset("all")}
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <LifeBuoy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-count">{tickets?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card
          data-testid="stat-card-pending"
          className="cursor-pointer hover-elevate"
          onClick={() => applyPreset("pending")}
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Filter className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="stat-pending-count">{pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Open + In Progress</p>
          </CardContent>
        </Card>
        <Card
          data-testid="stat-card-my-assigned"
          className="cursor-pointer hover-elevate"
          onClick={() => applyPreset("my_assigned")}
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Assigned</CardTitle>
            <UserCheck className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400" data-testid="stat-my-assigned-count">{myAssignedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Assigned to me</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-card-open">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="stat-open-count">{openCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search tickets by title, description, or replies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
              data-testid="input-ticket-search"
            />
            {searchQuery && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSearchQuery("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                data-testid="button-clear-search"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="min-w-[160px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter} data-testid="select-status-filter">
                <SelectTrigger data-testid="trigger-status-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending (Open + In Progress)</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Priority</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter} data-testid="select-priority-filter">
                <SelectTrigger data-testid="trigger-priority-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter} data-testid="select-category-filter">
                <SelectTrigger data-testid="trigger-category-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="feature_request">Feature Request</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="feedback">Feedback</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Assigned To</Label>
              <Select value={assignedFilter} onValueChange={setAssignedFilter} data-testid="select-assigned-filter">
                <SelectTrigger data-testid="trigger-assigned-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="my_assigned">My Assigned</SelectItem>
                  {staffUsers?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {getStaffDisplayName(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedIds.size > 0 && (
        <Card className="border-primary/50 bg-primary/5" data-testid="bulk-actions-bar">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Badge data-testid="badge-bulk-count">{selectedIds.size} selected</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  data-testid="button-clear-selection"
                >
                  Clear
                </Button>
              </div>
              <div className="h-6 w-px bg-border" />
              <Select
                onValueChange={(value) => {
                  if (value) bulkUpdate.mutate({ status: value });
                }}
                disabled={bulkUpdate.isPending}
              >
                <SelectTrigger className="w-[170px]" data-testid="select-bulk-status">
                  <SelectValue placeholder="Change status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={bulkAssignee}
                onValueChange={(value) => {
                  setBulkAssignee(value);
                  bulkUpdate.mutate({ assignedTo: value === "unassigned" ? null : value });
                }}
                disabled={bulkUpdate.isPending}
              >
                <SelectTrigger className="w-[200px]" data-testid="select-bulk-assignee">
                  <SelectValue placeholder="Reassign to..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {staffUsers?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {getStaffDisplayName(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="default"
                size="sm"
                onClick={() => bulkUpdate.mutate({ status: "closed" })}
                disabled={bulkUpdate.isPending}
                data-testid="button-bulk-close"
              >
                {bulkUpdate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Close selected
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !displayedTickets || displayedTickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <LifeBuoy className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground" data-testid="text-empty-admin-tickets">No tickets found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {trimmedQuery ? "Try a different search or clear filters." : "Adjust filters or wait for new tickets to arrive."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(checked) => toggleSelectAll(checked === true)}
              data-testid="checkbox-select-all"
              id="select-all-tickets"
            />
            <Label htmlFor="select-all-tickets" className="text-xs text-muted-foreground cursor-pointer">
              Select all on this page
            </Label>
          </div>
          {displayedTickets.map((ticket) => {
            const assignee = staffUsers?.find(s => s.id === ticket.assignedTo);
            const isChecked = selectedIds.has(ticket.id);
            return (
              <Card
                key={ticket.id}
                className="hover-elevate"
                data-testid={`card-admin-ticket-${ticket.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => toggleSelection(ticket.id, checked === true)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                      data-testid={`checkbox-ticket-${ticket.id}`}
                    />
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => setSelectedTicketId(ticket.id)}
                      data-testid={`ticket-row-${ticket.id}`}
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground font-mono" data-testid={`text-ticket-number-${ticket.id}`}>
                              #{ticket.ticketNumber}
                            </span>
                            <Badge className={getStatusBadgeClass(ticket.status)} data-testid={`badge-status-${ticket.id}`}>
                              {formatLabel(ticket.status)}
                            </Badge>
                            <Badge className={`text-xs ${getPriorityBadgeClass(ticket.priority)}`} data-testid={`badge-priority-${ticket.id}`}>
                              {formatLabel(ticket.priority)}
                            </Badge>
                            <Badge variant="outline" className={`text-xs ${getCategoryBadgeClass()}`} data-testid={`badge-category-${ticket.id}`}>
                              {formatLabel(ticket.category)}
                            </Badge>
                          </div>
                          <p className="font-medium truncate" data-testid={`text-ticket-subject-${ticket.id}`}>
                            {ticket.subject}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {assignee && (
                            <div className="flex items-center gap-1.5" data-testid={`assignee-badge-${ticket.id}`}>
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-[10px]">
                                  {(assignee.firstName?.[0] ?? '').toUpperCase()}{(assignee.lastName?.[0] ?? '').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-muted-foreground">{getStaffDisplayName(assignee)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span data-testid={`text-ticket-date-${ticket.id}`}>{formatDate(ticket.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TicketDetailView({ ticketId, onBack, staffUsers }: { ticketId: string; onBack: () => void; staffUsers: StaffUser[] }) {
  const { toast } = useToast();
  const [replyMessage, setReplyMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const { data: ticket, isLoading } = useQuery<TicketDetail>({
    queryKey: ["/api/support/tickets", ticketId],
  });

  const updateTicket = useMutation({
    mutationFn: async (updates: { status?: string; priority?: string; assignedTo?: string }) => {
      const res = await apiRequest("PATCH", `/api/support/tickets/${ticketId}`, updates);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Ticket updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addReply = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/support/tickets/${ticketId}/replies`, {
        message: replyMessage,
        isInternal,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reply added" });
      setReplyMessage("");
      setIsInternal(false);
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", ticketId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Ticket not found.
      </div>
    );
  }

  const authorName = ticket.author
    ? `${ticket.author.firstName} ${ticket.author.lastName}`.trim()
    : "Unknown";
  const authorEmail = ticket.author?.email ?? "N/A";
  const tenantName = ticket.tenant?.name ?? "Unknown Tenant";
  const currentAssignee = staffUsers.find(s => s.id === ticket.assignedTo);
  const history = ticket.history || [];

  const insertCannedResponse = (id: string) => {
    const tpl = CANNED_RESPONSES.find((t) => t.id === id);
    if (!tpl) return;
    setReplyMessage((prev) => (prev.trim() ? `${prev.trim()}\n\n${tpl.body}` : tpl.body));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-to-tickets">
          <ArrowLeft />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground font-mono" data-testid="text-detail-ticket-number">
              #{ticket.ticketNumber}
            </span>
            <Badge className={getStatusBadgeClass(ticket.status)} data-testid="badge-detail-status">
              {formatLabel(ticket.status)}
            </Badge>
          </div>
          <h2 className="text-xl font-semibold mt-1 truncate" data-testid="text-detail-subject">
            {ticket.subject}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap" data-testid="text-detail-description">
                {ticket.description}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Replies ({ticket.replies?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticket.replies && ticket.replies.length > 0 ? (
                ticket.replies.map((reply) => {
                  const replyName = reply.user
                    ? `${reply.user.firstName} ${reply.user.lastName}`.trim()
                    : "System";
                  const replyInitials = reply.user
                    ? `${reply.user.firstName?.[0] ?? ""}${reply.user.lastName?.[0] ?? ""}`.toUpperCase()
                    : "S";

                  return (
                    <div
                      key={reply.id}
                      className={`rounded-md p-3 ${
                        reply.isInternal
                          ? "bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800"
                          : "bg-muted/50"
                      }`}
                      data-testid={`reply-${reply.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs">{replyInitials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium" data-testid={`text-reply-author-${reply.id}`}>
                              {replyName}
                            </span>
                            {reply.isInternal && (
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-transparent text-xs" data-testid={`badge-internal-${reply.id}`}>
                                <Eye className="h-3 w-3 mr-1" />
                                Internal
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDate(reply.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap" data-testid={`text-reply-message-${reply.id}`}>
                            {reply.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-replies">
                  No replies yet
                </p>
              )}

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Quick reply templates
                  </Label>
                  <Select onValueChange={insertCannedResponse}>
                    <SelectTrigger className="w-[260px]" data-testid="select-canned-response">
                      <SelectValue placeholder="Insert template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CANNED_RESPONSES.map((tpl) => (
                        <SelectItem key={tpl.id} value={tpl.id} data-testid={`canned-${tpl.id}`}>
                          {tpl.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  placeholder="Write a reply..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="min-h-[80px]"
                  data-testid="textarea-reply"
                />
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="internal-note"
                      checked={isInternal}
                      onCheckedChange={(checked) => setIsInternal(checked === true)}
                      data-testid="checkbox-internal"
                    />
                    <Label htmlFor="internal-note" className="text-sm cursor-pointer">
                      Internal note (not visible to user)
                    </Label>
                  </div>
                  <Button
                    onClick={() => addReply.mutate()}
                    disabled={!replyMessage.trim() || addReply.isPending}
                    data-testid="button-send-reply"
                  >
                    {addReply.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Reply
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-history">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Status History ({history.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2" data-testid="text-no-history">
                  No status changes recorded yet.
                </p>
              ) : (
                <ol className="relative border-l border-border ml-2 space-y-4" data-testid="list-history">
                  {history.map((entry) => {
                    const actorName = entry.user
                      ? `${entry.user.firstName || ''} ${entry.user.lastName || ''}`.trim() || entry.user.email
                      : "System";
                    return (
                      <li key={entry.id} className="ml-4" data-testid={`history-${entry.id}`}>
                        <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                        <p className="text-sm font-medium" data-testid={`history-change-${entry.id}`}>
                          {describeHistoryEntry(entry, staffUsers)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <span data-testid={`history-actor-${entry.id}`}>{actorName}</span>
                          <span className="mx-1">·</span>
                          <span data-testid={`history-time-${entry.id}`}>{formatDateTime(entry.createdAt)}</span>
                        </p>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Tenant</Label>
                <p className="text-sm font-medium" data-testid="text-detail-tenant">{tenantName}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Submitted By</Label>
                <p className="text-sm font-medium" data-testid="text-detail-author">{authorName}</p>
                <p className="text-xs text-muted-foreground" data-testid="text-detail-email">{authorEmail}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Category</Label>
                <div className="mt-1">
                  <Badge variant="outline" data-testid="badge-detail-category">
                    {formatLabel(ticket.category)}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Assigned To</Label>
                <div className="mt-1 flex items-center gap-2" data-testid="text-detail-assignee">
                  {currentAssignee ? (
                    <>
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[10px]">
                          {(currentAssignee.firstName?.[0] ?? '').toUpperCase()}{(currentAssignee.lastName?.[0] ?? '').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{getStaffDisplayName(currentAssignee)}</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Unassigned</span>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Created</Label>
                <p className="text-sm" data-testid="text-detail-created">{formatDate(ticket.createdAt)}</p>
              </div>
              {ticket.resolvedAt && (
                <div>
                  <Label className="text-xs text-muted-foreground">Resolved</Label>
                  <p className="text-sm" data-testid="text-detail-resolved">{formatDate(ticket.resolvedAt)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
                <Select
                  value={ticket.status}
                  onValueChange={(value) => updateTicket.mutate({ status: value })}
                  data-testid="select-update-status"
                >
                  <SelectTrigger data-testid="trigger-update-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">
                      <div className="flex items-center gap-2">
                        {getStatusIcon("open")}
                        Open
                      </div>
                    </SelectItem>
                    <SelectItem value="in_progress">
                      <div className="flex items-center gap-2">
                        {getStatusIcon("in_progress")}
                        In Progress
                      </div>
                    </SelectItem>
                    <SelectItem value="resolved">
                      <div className="flex items-center gap-2">
                        {getStatusIcon("resolved")}
                        Resolved
                      </div>
                    </SelectItem>
                    <SelectItem value="closed">
                      <div className="flex items-center gap-2">
                        {getStatusIcon("closed")}
                        Closed
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Priority</Label>
                <Select
                  value={ticket.priority}
                  onValueChange={(value) => updateTicket.mutate({ priority: value })}
                  data-testid="select-update-priority"
                >
                  <SelectTrigger data-testid="trigger-update-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Assign To</Label>
                <Select
                  value={ticket.assignedTo || "unassigned"}
                  onValueChange={(value) => updateTicket.mutate({ assignedTo: value === "unassigned" ? "" : value })}
                  data-testid="select-update-assignee"
                >
                  <SelectTrigger data-testid="trigger-update-assignee">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {staffUsers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-3 w-3" />
                          {getStaffDisplayName(s)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
