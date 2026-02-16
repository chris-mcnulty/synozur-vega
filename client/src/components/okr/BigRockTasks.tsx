import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Plus, 
  Trash2, 
  Calendar,
  User,
  CheckCircle2,
  Circle,
  Clock,
  RefreshCw,
  ArrowUpFromLine,
  ArrowDownToLine,
  Link2,
  Loader2,
  X,
  CalendarPlus,
} from "lucide-react";
import { format } from "date-fns";
import type { BigRockTask } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { UserPicker } from "@/components/UserPicker";

interface BigRockTasksProps {
  bigRockId: string;
  canModify: boolean;
  plannerMapped?: boolean;
}

type TaskStatus = 'open' | 'in_progress' | 'completed';

const statusConfig: Record<TaskStatus, { label: string; icon: any; color: string }> = {
  open: { label: 'Open', icon: Circle, color: 'text-muted-foreground' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'text-blue-500' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-green-500' },
};

function InlineEditableTitle({ 
  value, 
  onSave, 
  disabled, 
  completed 
}: { 
  value: string; 
  onSave: (val: string) => void; 
  disabled: boolean; 
  completed: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setDraft(value);
    }
    setEditing(false);
  };

  if (editing && !disabled) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        className="h-7 text-sm px-1 py-0"
        data-testid="input-inline-task-title"
      />
    );
  }

  return (
    <span
      className={`text-sm cursor-text rounded px-1 -mx-1 hover:bg-muted/50 transition-colors ${completed ? 'line-through text-muted-foreground' : ''} ${disabled ? 'cursor-default' : ''}`}
      onClick={() => !disabled && setEditing(true)}
      data-testid="text-task-title"
    >
      {value}
    </span>
  );
}

function InlineAssigneePicker({
  value,
  onSave,
  disabled,
  taskId,
}: {
  value: string | null;
  onSave: (email: string) => void;
  disabled: boolean;
  taskId?: string;
}) {
  if (disabled) {
    if (!value) return null;
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <User className="w-3 h-3" />
        {value.split('@')[0]}
      </span>
    );
  }

  return (
    <div className="inline-flex" data-testid={`inline-assignee-picker-${taskId || 'new'}`}>
      <UserPicker
        value={value || ''}
        onChange={(email) => onSave(email || '')}
        placeholder="Assign..."
        className="h-6 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 px-1 min-w-0 w-auto"
      />
    </div>
  );
}

function InlineDatePicker({
  value,
  onSave,
  onClear,
  disabled,
}: {
  value: Date | string | null;
  onSave: (date: string) => void;
  onClear: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dateStr = value ? format(new Date(value), 'yyyy-MM-dd') : '';
  const displayStr = value ? format(new Date(value), 'MMM d') : '';

  if (disabled) {
    if (!value) return null;
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Calendar className="w-3 h-3" />
        {displayStr}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded px-1 -mx-1 hover:bg-muted/50"
          data-testid="button-inline-date"
        >
          {value ? (
            <>
              <Calendar className="w-3 h-3" />
              {displayStr}
            </>
          ) : (
            <>
              <CalendarPlus className="w-3 h-3" />
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">Date</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start" side="bottom">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateStr}
            onChange={(e) => {
              if (e.target.value) {
                onSave(e.target.value);
                setOpen(false);
              }
            }}
            className="h-8 text-sm"
            data-testid="input-inline-date"
          />
          {value && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => { onClear(); setOpen(false); }}
              className="h-8 w-8 text-muted-foreground"
              data-testid="button-clear-date"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function BigRockTasks({ bigRockId, canModify, plannerMapped }: BigRockTasksProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<BigRockTask | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const quickAddRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const currentUserEmail = user?.email;

  const { data: tasks = [], isLoading } = useQuery<BigRockTask[]>({
    queryKey: [`/api/okr/big-rocks/${bigRockId}/tasks`],
  });

  const canUpdateTask = (task: BigRockTask): boolean => {
    if (canModify) return true;
    if (!currentUserEmail) return false;
    return task.assigneeEmail === currentUserEmail;
  };

  const updateField = useCallback((taskId: string, field: string, value: any) => {
    updateMutation.mutate({ taskId, data: { [field]: value } });
  }, []);

  const createMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest('POST', `/api/okr/big-rocks/${bigRockId}/tasks`, {
        title,
        status: 'open',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/big-rocks/${bigRockId}/tasks`] });
      queryClient.invalidateQueries({ queryKey: ['/api/okr/big-rocks/task-counts'] });
      setQuickAddTitle('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: Record<string, any> }) => {
      const res = await apiRequest('PATCH', `/api/okr/big-rocks/${bigRockId}/tasks/${taskId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/big-rocks/${bigRockId}/tasks`] });
      queryClient.invalidateQueries({ queryKey: ['/api/okr/big-rocks/task-counts'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest('DELETE', `/api/okr/big-rocks/${bigRockId}/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/big-rocks/${bigRockId}/tasks`] });
      queryClient.invalidateQueries({ queryKey: ['/api/okr/big-rocks/task-counts'] });
      setDeleteDialogOpen(false);
      setSelectedTask(null);
      toast({ title: 'Task deleted' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const syncTasksMutation = useMutation({
    mutationFn: async (direction: 'push' | 'pull' | 'both') => {
      const res = await apiRequest('POST', `/api/planner/bigrock/${bigRockId}/sync-tasks`, { direction });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/big-rocks/${bigRockId}/tasks`] });
      queryClient.invalidateQueries({ queryKey: ['/api/okr/big-rocks/task-counts'] });
      const msgs: string[] = [];
      if (data.push) msgs.push(`Pushed: ${data.push.created} created, ${data.push.updated} updated`);
      if (data.pull) msgs.push(`Pulled: ${data.pull.created} created, ${data.pull.updated} updated`);
      toast({ title: 'Sync complete', description: msgs.join('. ') || 'Tasks synchronized.' });
    },
    onError: (error: any) => {
      toast({ title: 'Sync failed', description: error.message, variant: 'destructive' });
    },
  });

  const pushSingleTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest('POST', `/api/planner/bigrock/${bigRockId}/push-task/${taskId}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/big-rocks/${bigRockId}/tasks`] });
      toast({ title: 'Task synced', description: `Task ${data.action} in Planner.` });
    },
    onError: (error: any) => {
      toast({ title: 'Sync failed', description: error.message, variant: 'destructive' });
    },
  });

  const handleStatusCycle = (task: BigRockTask) => {
    const statusOrder: TaskStatus[] = ['open', 'in_progress', 'completed'];
    const currentIndex = statusOrder.indexOf(task.status as TaskStatus);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
    updateField(task.id, 'status', nextStatus);
  };

  const handleQuickAdd = () => {
    const title = quickAddTitle.trim();
    if (!title) return;
    createMutation.mutate(title);
  };

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const totalCount = tasks.length;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium">Tasks</CardTitle>
          {totalCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {completedCount}/{totalCount}
            </Badge>
          )}
          {plannerMapped && (
            <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate">
              <Link2 className="w-3 h-3 mr-1" />
              Planner
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {plannerMapped && canModify && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncTasksMutation.mutate('both')}
              disabled={syncTasksMutation.isPending}
              data-testid="button-sync-tasks"
            >
              {syncTasksMutation.isPending ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3 mr-1" />
              )}
              Sync Plan
            </Button>
          )}
        </div>
      </CardHeader>
      {plannerMapped && canModify && (
        <div className="px-6 pb-2 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Planner:</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => syncTasksMutation.mutate('push')}
            disabled={syncTasksMutation.isPending}
            data-testid="button-push-tasks"
          >
            <ArrowUpFromLine className="w-3 h-3 mr-1" />
            Push to Plan
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => syncTasksMutation.mutate('pull')}
            disabled={syncTasksMutation.isPending}
            data-testid="button-pull-tasks"
          >
            <ArrowDownToLine className="w-3 h-3 mr-1" />
            Pull from Plan
          </Button>
        </div>
      )}
      <CardContent className="space-y-1">
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-4">Loading tasks...</div>
        ) : tasks.length === 0 && !canModify ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No tasks yet.
          </div>
        ) : (
          <>
            {tasks.map((task) => {
              const status = statusConfig[task.status as TaskStatus] || statusConfig.open;
              const StatusIcon = status.icon;
              const taskCanBeUpdated = canUpdateTask(task);
              return (
                <div
                  key={task.id}
                  className="flex items-start gap-2 p-2 rounded-md bg-muted/30 group"
                  data-testid={`task-item-${task.id}`}
                >
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleStatusCycle(task)}
                    disabled={!taskCanBeUpdated || updateMutation.isPending}
                    className="mt-0.5 flex-shrink-0 h-6 w-6"
                    title={`Status: ${status.label}. Click to change.`}
                    data-testid={`button-toggle-status-${task.id}`}
                  >
                    <StatusIcon className={`w-4 h-4 ${status.color}`} />
                  </Button>
                  
                  <div className="flex-1 min-w-0">
                    <InlineEditableTitle
                      value={task.title}
                      onSave={(title) => updateField(task.id, 'title', title)}
                      disabled={!taskCanBeUpdated}
                      completed={task.status === 'completed'}
                    />
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <InlineAssigneePicker
                        value={task.assigneeEmail}
                        onSave={(email) => updateField(task.id, 'assigneeEmail', email || null)}
                        disabled={!taskCanBeUpdated}
                        taskId={task.id}
                      />
                      <InlineDatePicker
                        value={task.dueDate}
                        onSave={(date) => updateField(task.id, 'dueDate', date)}
                        onClear={() => updateField(task.id, 'dueDate', null)}
                        disabled={!taskCanBeUpdated}
                      />
                    </div>
                  </div>

                  <div className="flex gap-1 items-center flex-shrink-0">
                    {plannerMapped && task.plannerTaskId && (
                      <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate">
                        <Link2 className="w-3 h-3" />
                      </Badge>
                    )}
                    {taskCanBeUpdated && (
                      <div className="flex gap-1 invisible group-hover:visible">
                        {plannerMapped && !task.plannerTaskId && canModify && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => pushSingleTaskMutation.mutate(task.id)}
                            disabled={pushSingleTaskMutation.isPending}
                            title="Push to Planner"
                            data-testid={`button-push-task-${task.id}`}
                          >
                            <ArrowUpFromLine className="w-3 h-3" />
                          </Button>
                        )}
                        {canModify && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => { setSelectedTask(task); setDeleteDialogOpen(true); }}
                            data-testid={`button-delete-task-${task.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {canModify && (
          <div className="flex items-center gap-2 pt-1">
            <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Input
              ref={quickAddRef}
              value={quickAddTitle}
              onChange={(e) => setQuickAddTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuickAdd();
              }}
              placeholder="Add a task..."
              className="h-7 text-sm border-0 shadow-none bg-transparent focus-visible:ring-0 px-1"
              disabled={createMutation.isPending}
              data-testid="input-quick-add-task"
            />
            {quickAddTitle.trim() && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleQuickAdd}
                disabled={createMutation.isPending}
                className="h-7 px-2 text-xs"
                data-testid="button-quick-add-task"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  'Add'
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedTask?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setSelectedTask(null); }}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedTask && deleteMutation.mutate(selectedTask.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-task"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
