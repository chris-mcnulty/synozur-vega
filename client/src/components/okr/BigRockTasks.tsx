import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Calendar,
  User,
  CheckCircle2,
  Circle,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import type { BigRockTask } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { UserPicker } from "@/components/UserPicker";

interface BigRockTasksProps {
  bigRockId: string;
  canModify: boolean;
}

type TaskStatus = 'open' | 'in_progress' | 'completed';

const statusConfig: Record<TaskStatus, { label: string; icon: any; color: string }> = {
  open: { label: 'Open', icon: Circle, color: 'bg-gray-400' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'bg-blue-500' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'bg-green-500' },
};

export function BigRockTasks({ bigRockId, canModify }: BigRockTasksProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<BigRockTask | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'open' as TaskStatus,
    assigneeEmail: '',
    dueDate: '',
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const currentUserEmail = user?.email;

  const { data: tasks = [], isLoading } = useQuery<BigRockTask[]>({
    queryKey: [`/api/okr/big-rocks/${bigRockId}/tasks`],
  });
  
  // Check if user can update a specific task (owner or assignee)
  const canUpdateTask = (task: BigRockTask): boolean => {
    if (canModify) return true; // Owner can update all
    if (!currentUserEmail) return false;
    return task.assigneeEmail === currentUserEmail;
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest('POST', `/api/okr/big-rocks/${bigRockId}/tasks`, {
        title: data.title,
        description: data.description || null,
        status: data.status,
        assigneeEmail: data.assigneeEmail || null,
        dueDate: data.dueDate || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/big-rocks/${bigRockId}/tasks`] });
      queryClient.invalidateQueries({ queryKey: ['/api/okr/big-rocks/task-counts'] });
      setCreateDialogOpen(false);
      resetForm();
      toast({ title: 'Task created', description: 'The task has been added.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: Partial<typeof formData> }) => {
      const res = await apiRequest('PATCH', `/api/okr/big-rocks/${bigRockId}/tasks/${taskId}`, {
        title: data.title,
        description: data.description || null,
        status: data.status,
        assigneeEmail: data.assigneeEmail || null,
        dueDate: data.dueDate || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/big-rocks/${bigRockId}/tasks`] });
      setEditDialogOpen(false);
      setSelectedTask(null);
      resetForm();
      toast({ title: 'Task updated', description: 'The task has been updated.' });
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
      toast({ title: 'Task deleted', description: 'The task has been removed.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const statusToggleMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatus }) => {
      const res = await apiRequest('PATCH', `/api/okr/big-rocks/${bigRockId}/tasks/${taskId}`, { status });
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

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      status: 'open',
      assigneeEmail: '',
      dueDate: '',
    });
  };

  const openEditDialog = (task: BigRockTask) => {
    setSelectedTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      status: (task.status as TaskStatus) || 'open',
      assigneeEmail: task.assigneeEmail || '',
      dueDate: task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : '',
    });
    setEditDialogOpen(true);
  };

  const handleStatusCycle = (task: BigRockTask) => {
    const statusOrder: TaskStatus[] = ['open', 'in_progress', 'completed'];
    const currentIndex = statusOrder.indexOf(task.status as TaskStatus);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
    statusToggleMutation.mutate({ taskId: task.id, status: nextStatus });
  };

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const totalCount = tasks.length;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium">Tasks</CardTitle>
          {totalCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {completedCount}/{totalCount}
            </Badge>
          )}
        </div>
        {canModify && (
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => setCreateDialogOpen(true)}
            data-testid="button-add-task"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-4">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No tasks yet. {canModify && 'Add tasks to break down this rock.'}
          </div>
        ) : (
          <div className="space-y-2">
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
                    disabled={!taskCanBeUpdated || statusToggleMutation.isPending}
                    className="mt-0.5 flex-shrink-0"
                    data-testid={`button-toggle-status-${task.id}`}
                  >
                    <StatusIcon className={`w-4 h-4 ${task.status === 'completed' ? 'text-green-500' : task.status === 'in_progress' ? 'text-blue-500' : 'text-muted-foreground'}`} />
                  </Button>
                  
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                      {task.title}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {task.assigneeEmail && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {task.assigneeEmail}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(task.dueDate), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </div>

                  {canModify && (
                    <div className="flex gap-1 invisible group-hover:visible">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditDialog(task)}
                        data-testid={`button-edit-task-${task.id}`}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => { setSelectedTask(task); setDeleteDialogOpen(true); }}
                        data-testid={`button-delete-task-${task.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>Create a new task for this rock</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="taskTitle">Title *</Label>
              <Input
                id="taskTitle"
                placeholder="Task title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                data-testid="input-task-title"
              />
            </div>
            <div>
              <Label htmlFor="taskDescription">Description</Label>
              <Textarea
                id="taskDescription"
                placeholder="Optional description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="input-task-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="taskStatus">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: TaskStatus) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger data-testid="select-task-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="taskDueDate">Due Date</Label>
                <Input
                  id="taskDueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  data-testid="input-task-due-date"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="taskAssignee">Assignee</Label>
              <UserPicker
                value={formData.assigneeEmail}
                onChange={(email) => setFormData({ ...formData, assigneeEmail: email })}
                placeholder="Select assignee..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={() => createMutation.mutate(formData)} 
              disabled={!formData.title.trim() || createMutation.isPending}
              data-testid="button-save-task"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editTaskTitle">Title *</Label>
              <Input
                id="editTaskTitle"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                data-testid="input-edit-task-title"
              />
            </div>
            <div>
              <Label htmlFor="editTaskDescription">Description</Label>
              <Textarea
                id="editTaskDescription"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="input-edit-task-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editTaskStatus">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: TaskStatus) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger data-testid="select-edit-task-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="editTaskDueDate">Due Date</Label>
                <Input
                  id="editTaskDueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  data-testid="input-edit-task-due-date"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="editTaskAssignee">Assignee</Label>
              <UserPicker
                value={formData.assigneeEmail}
                onChange={(email) => setFormData({ ...formData, assigneeEmail: email })}
                placeholder="Select assignee..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setSelectedTask(null); resetForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedTask && updateMutation.mutate({ taskId: selectedTask.id, data: formData })} 
              disabled={!formData.title.trim() || updateMutation.isPending}
              data-testid="button-update-task"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
