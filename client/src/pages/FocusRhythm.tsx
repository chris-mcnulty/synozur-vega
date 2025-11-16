import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Users, Pencil, Trash2, Plus, Target, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Meeting, Foundation } from "@shared/schema";
import { useTenant } from "@/contexts/TenantContext";
import { format } from "date-fns";
import { getCurrentQuarter, getQuarterDateRange } from "@/lib/quarters";

const meetingTypes = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
  { value: "ad-hoc", label: "Ad-hoc" },
];

interface MeetingFormData {
  title: string;
  meetingType: string;
  date: string;
  attendees: string[];
  summary: string;
  decisions: string[];
  actionItems: string[];
  nextMeetingDate: string;
}

export default function FocusRhythm() {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [selectedType, setSelectedType] = useState<string>("all");
  
  // Fetch foundation to get fiscal year start month
  const { data: foundation } = useQuery<Foundation>({
    queryKey: [`/api/foundations/${currentTenant.id}`],
  });
  
  const [quarter, setQuarter] = useState(1);
  const [year, setYear] = useState(new Date().getFullYear());
  
  // Set initial quarter/year based on tenant's fiscal year when foundation loads
  useEffect(() => {
    if (foundation) {
      const fiscalYearStartMonth = foundation.fiscalYearStartMonth || 1;
      const currentPeriod = getCurrentQuarter(fiscalYearStartMonth);
      setQuarter(currentPeriod.quarter);
      setYear(currentPeriod.year);
    }
  }, [foundation?.fiscalYearStartMonth]);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  const [formData, setFormData] = useState<MeetingFormData>({
    title: "",
    meetingType: "weekly",
    date: "",
    attendees: [],
    summary: "",
    decisions: [],
    actionItems: [],
    nextMeetingDate: "",
  });

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: [`/api/meetings/${currentTenant.id}`],
  });

  const createMutation = useMutation({
    mutationFn: async (data: MeetingFormData) => {
      return apiRequest("POST", "/api/meetings", {
        tenantId: currentTenant.id,
        ...data,
        date: data.date ? new Date(data.date).toISOString() : null,
        nextMeetingDate: data.nextMeetingDate ? new Date(data.nextMeetingDate).toISOString() : null,
        updatedBy: "Current User",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${currentTenant.id}`] });
      setCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Meeting Created",
        description: "Successfully created new meeting",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create meeting",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MeetingFormData> }) => {
      return apiRequest("PATCH", `/api/meetings/${id}`, {
        ...data,
        date: data.date ? new Date(data.date).toISOString() : undefined,
        nextMeetingDate: data.nextMeetingDate ? new Date(data.nextMeetingDate).toISOString() : undefined,
        updatedBy: "Current User",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${currentTenant.id}`] });
      setEditDialogOpen(false);
      setSelectedMeeting(null);
      toast({
        title: "Meeting Updated",
        description: "Successfully updated meeting",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update meeting",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/meetings/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${currentTenant.id}`] });
      setDeleteDialogOpen(false);
      setSelectedMeeting(null);
      toast({
        title: "Meeting Deleted",
        description: "Successfully deleted meeting",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete meeting",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      meetingType: "weekly",
      date: "",
      attendees: [],
      summary: "",
      decisions: [],
      actionItems: [],
      nextMeetingDate: "",
    });
  };

  const openEditDialog = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    const formatDateForInput = (date: Date | null) => {
      if (!date) return "";
      try {
        return format(new Date(date), "yyyy-MM-dd");
      } catch {
        return "";
      }
    };

    setFormData({
      title: meeting.title,
      meetingType: meeting.meetingType || "weekly",
      date: formatDateForInput(meeting.date),
      attendees: meeting.attendees || [],
      summary: meeting.summary || "",
      decisions: meeting.decisions || [],
      actionItems: meeting.actionItems || [],
      nextMeetingDate: formatDateForInput(meeting.nextMeetingDate),
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setDeleteDialogOpen(true);
  };

  const handleCreate = () => {
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a meeting title",
        variant: "destructive",
      });
      return;
    }
    if (!formData.date) {
      toast({
        title: "Validation Error",
        description: "Please select a meeting date",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedMeeting) return;
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a meeting title",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({
      id: selectedMeeting.id,
      data: formData,
    });
  };

  const handleDelete = () => {
    if (!selectedMeeting) return;
    deleteMutation.mutate(selectedMeeting.id);
  };

  const [newDecision, setNewDecision] = useState("");
  const [newActionItem, setNewActionItem] = useState("");
  const [newAttendee, setNewAttendee] = useState("");

  const addDecision = () => {
    if (newDecision.trim()) {
      setFormData({ ...formData, decisions: [...formData.decisions, newDecision] });
      setNewDecision("");
    }
  };

  const removeDecision = (index: number) => {
    setFormData({
      ...formData,
      decisions: formData.decisions.filter((_, i) => i !== index),
    });
  };

  const addActionItem = () => {
    if (newActionItem.trim()) {
      setFormData({ ...formData, actionItems: [...formData.actionItems, newActionItem] });
      setNewActionItem("");
    }
  };

  const removeActionItem = (index: number) => {
    setFormData({
      ...formData,
      actionItems: formData.actionItems.filter((_, i) => i !== index),
    });
  };

  const addAttendee = () => {
    if (newAttendee.trim()) {
      setFormData({ ...formData, attendees: [...formData.attendees, newAttendee] });
      setNewAttendee("");
    }
  };

  const removeAttendee = (index: number) => {
    setFormData({
      ...formData,
      attendees: formData.attendees.filter((_, i) => i !== index),
    });
  };

  const getMeetingTypeVariant = (type: string) => {
    switch (type) {
      case "weekly": return "default";
      case "monthly": return "secondary";
      case "quarterly": return "outline";
      case "annual": return "destructive";
      default: return "outline";
    }
  };

  // Filter meetings by quarter date range using tenant's fiscal year
  const fiscalYearStartMonth = foundation?.fiscalYearStartMonth || 1;
  const quarterRange = getQuarterDateRange(quarter, year, fiscalYearStartMonth);
  const meetingsInQuarter = meetings.filter(meeting => {
    if (!meeting.date) return false;
    const meetingDate = new Date(meeting.date);
    return meetingDate >= quarterRange.start && meetingDate <= quarterRange.end;
  });

  const filteredMeetings = selectedType === "all"
    ? meetingsInQuarter
    : meetingsInQuarter.filter(m => m.meetingType === selectedType);

  const groupedMeetings = {
    all: meetings,
    weekly: meetings.filter(m => m.meetingType === "weekly"),
    monthly: meetings.filter(m => m.meetingType === "monthly"),
    quarterly: meetings.filter(m => m.meetingType === "quarterly"),
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="grid gap-4 mt-8">
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-32 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Focus Rhythm</h1>
            <p className="text-muted-foreground mt-1">
              Meetings for Q{quarter} {year}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={quarter.toString()} onValueChange={(v) => setQuarter(parseInt(v))}>
              <SelectTrigger className="w-32" data-testid="select-quarter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Q1</SelectItem>
                <SelectItem value="2">Q2</SelectItem>
                <SelectItem value="3">Q3</SelectItem>
                <SelectItem value="4">Q4</SelectItem>
              </SelectContent>
            </Select>
            <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger className="w-32" data-testid="select-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-meeting">
              <Plus className="w-4 h-4 mr-2" />
              Schedule Meeting
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Schedule New Meeting</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Meeting Title *</Label>
                  <Input
                    id="title"
                    placeholder="E.g., Strategic Planning Review"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    data-testid="input-meeting-title"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type">Meeting Type</Label>
                    <Select
                      value={formData.meetingType}
                      onValueChange={(value) => setFormData({ ...formData, meetingType: value })}
                    >
                      <SelectTrigger data-testid="select-meeting-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {meetingTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      data-testid="input-date"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="nextMeetingDate">Next Meeting Date</Label>
                  <Input
                    id="nextMeetingDate"
                    type="date"
                    value={formData.nextMeetingDate}
                    onChange={(e) => setFormData({ ...formData, nextMeetingDate: e.target.value })}
                    data-testid="input-next-meeting-date"
                  />
                </div>

                <div>
                  <Label>Attendees</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Enter attendee name"
                      value={newAttendee}
                      onChange={(e) => setNewAttendee(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addAttendee()}
                      data-testid="input-attendee"
                    />
                    <Button onClick={addAttendee} data-testid="button-add-attendee">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.attendees.map((attendee, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeAttendee(index)}
                        data-testid={`badge-attendee-${index}`}
                      >
                        {attendee} ×
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="summary">Meeting Summary</Label>
                  <Textarea
                    id="summary"
                    placeholder="Key points and discussion summary..."
                    value={formData.summary}
                    onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                    rows={3}
                    data-testid="textarea-summary"
                  />
                </div>

                <div>
                  <Label>Key Decisions</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Enter a decision"
                      value={newDecision}
                      onChange={(e) => setNewDecision(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addDecision()}
                      data-testid="input-decision"
                    />
                    <Button onClick={addDecision} data-testid="button-add-decision">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.decisions.map((decision, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeDecision(index)}
                        data-testid={`badge-decision-${index}`}
                      >
                        {decision} ×
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Action Items</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Enter an action item"
                      value={newActionItem}
                      onChange={(e) => setNewActionItem(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addActionItem()}
                      data-testid="input-action-item"
                    />
                    <Button onClick={addActionItem} data-testid="button-add-action-item">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.actionItems.map((item, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeActionItem(index)}
                        data-testid={`badge-action-item-${index}`}
                      >
                        {item} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCreateDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  data-testid="button-save-meeting"
                >
                  {createMutation.isPending ? "Creating..." : "Create Meeting"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        <Tabs value={selectedType} onValueChange={setSelectedType} className="space-y-6">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">
              All Meetings ({meetings.length})
            </TabsTrigger>
            <TabsTrigger value="weekly" data-testid="tab-weekly">
              Weekly ({groupedMeetings.weekly.length})
            </TabsTrigger>
            <TabsTrigger value="monthly" data-testid="tab-monthly">
              Monthly ({groupedMeetings.monthly.length})
            </TabsTrigger>
            <TabsTrigger value="quarterly" data-testid="tab-quarterly">
              Quarterly ({groupedMeetings.quarterly.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedType} className="space-y-4">
            {filteredMeetings.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Meetings Scheduled</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Schedule your first meeting to get started
                  </p>
                  <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-meeting">
                    <Plus className="w-4 h-4 mr-2" />
                    Schedule Meeting
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredMeetings.map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    onEdit={openEditDialog}
                    onDelete={openDeleteDialog}
                    getMeetingTypeVariant={getMeetingTypeVariant}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Meeting</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Meeting Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  data-testid="input-edit-title"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Meeting Type</Label>
                  <Select
                    value={formData.meetingType}
                    onValueChange={(value) => setFormData({ ...formData, meetingType: value })}
                  >
                    <SelectTrigger data-testid="select-edit-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {meetingTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    data-testid="input-edit-date"
                  />
                </div>
              </div>

              <div>
                <Label>Next Meeting Date</Label>
                <Input
                  type="date"
                  value={formData.nextMeetingDate}
                  onChange={(e) => setFormData({ ...formData, nextMeetingDate: e.target.value })}
                  data-testid="input-edit-next-meeting-date"
                />
              </div>

              <div>
                <Label>Attendees</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Enter attendee name"
                    value={newAttendee}
                    onChange={(e) => setNewAttendee(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addAttendee()}
                    data-testid="input-edit-attendee"
                  />
                  <Button onClick={addAttendee} data-testid="button-edit-add-attendee">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.attendees.map((attendee, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeAttendee(index)}
                    >
                      {attendee} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Meeting Summary</Label>
                <Textarea
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  rows={3}
                  data-testid="textarea-edit-summary"
                />
              </div>

              <div>
                <Label>Key Decisions</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Enter a decision"
                    value={newDecision}
                    onChange={(e) => setNewDecision(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addDecision()}
                    data-testid="input-edit-decision"
                  />
                  <Button onClick={addDecision} data-testid="button-edit-add-decision">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.decisions.map((decision, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeDecision(index)}
                    >
                      {decision} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Action Items</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Enter an action item"
                    value={newActionItem}
                    onChange={(e) => setNewActionItem(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addActionItem()}
                    data-testid="input-edit-action-item"
                  />
                  <Button onClick={addActionItem} data-testid="button-edit-add-action-item">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.actionItems.map((item, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeActionItem(index)}
                    >
                      {item} ×
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setSelectedMeeting(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={updateMutation.isPending}
                data-testid="button-update-meeting"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Meeting</DialogTitle>
            </DialogHeader>
            <p>
              Are you sure you want to delete "{selectedMeeting?.title}"? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setSelectedMeeting(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete-meeting"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

interface MeetingCardProps {
  meeting: Meeting;
  onEdit: (meeting: Meeting) => void;
  onDelete: (meeting: Meeting) => void;
  getMeetingTypeVariant: (type: string) => "default" | "secondary" | "outline" | "destructive";
}

function MeetingCard({ meeting, onEdit, onDelete, getMeetingTypeVariant }: MeetingCardProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return "";
    try {
      return format(new Date(date), "MMM d, yyyy");
    } catch {
      return "";
    }
  };

  return (
    <Card className="hover-elevate" data-testid={`card-meeting-${meeting.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={getMeetingTypeVariant(meeting.meetingType || "weekly")}>
                {meeting.meetingType || "Weekly"}
              </Badge>
              {meeting.date && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(meeting.date)}
                </span>
              )}
            </div>
            <CardTitle className="text-xl">{meeting.title}</CardTitle>
            {meeting.nextMeetingDate && (
              <CardDescription className="mt-1">
                Next: {formatDate(meeting.nextMeetingDate)}
              </CardDescription>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(meeting)}
              data-testid={`button-edit-meeting-${meeting.id}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(meeting)}
              data-testid={`button-delete-meeting-${meeting.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {meeting.attendees && meeting.attendees.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Users className="w-4 h-4" />
              <span>Attendees ({meeting.attendees.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {meeting.attendees.map((attendee, index) => (
                <Badge key={index} variant="secondary">
                  {attendee}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {meeting.summary && (
          <div>
            <h4 className="text-sm font-medium mb-1">Summary</h4>
            <p className="text-sm text-muted-foreground">{meeting.summary}</p>
          </div>
        )}

        {meeting.decisions && meeting.decisions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Key Decisions</h4>
            <ul className="space-y-1">
              {meeting.decisions.map((decision, index) => (
                <li key={index} className="text-sm flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <span>{decision}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {meeting.actionItems && meeting.actionItems.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Action Items</h4>
            <ul className="space-y-1">
              {meeting.actionItems.map((item, index) => (
                <li key={index} className="text-sm flex items-start gap-2">
                  <Target className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
