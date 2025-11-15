import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Video, Users, Pencil, Trash2, Plus, Target } from "lucide-react";
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
import type { Meeting } from "@shared/schema";
import { format } from "date-fns";

const CURRENT_TENANT_ID = "f7229583-c9c9-4e80-88cf-5bbfd2819770";

const meetingTypes = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
  { value: "ad-hoc", label: "Ad-hoc" },
];

interface MeetingFormData {
  title: string;
  type: string;
  date: string;
  time: string;
  duration: number;
  attendees: string[];
  teamsLink: string;
  agenda: string[];
  outcomes: string;
  nextSteps: string;
}

export default function FocusRhythm() {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  const [formData, setFormData] = useState<MeetingFormData>({
    title: "",
    type: "weekly",
    date: "",
    time: "",
    duration: 60,
    attendees: [],
    teamsLink: "",
    agenda: [],
    outcomes: "",
    nextSteps: "",
  });

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: [`/api/meetings/${CURRENT_TENANT_ID}`],
  });

  const createMutation = useMutation({
    mutationFn: async (data: MeetingFormData) => {
      return apiRequest("POST", "/api/meetings", {
        tenantId: CURRENT_TENANT_ID,
        ...data,
        updatedBy: "Current User",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${CURRENT_TENANT_ID}`] });
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
        updatedBy: "Current User",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${CURRENT_TENANT_ID}`] });
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
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${CURRENT_TENANT_ID}`] });
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
      type: "weekly",
      date: "",
      time: "",
      duration: 60,
      attendees: [],
      teamsLink: "",
      agenda: [],
      outcomes: "",
      nextSteps: "",
    });
  };

  const openEditDialog = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setFormData({
      title: meeting.title,
      type: meeting.type || "weekly",
      date: meeting.date || "",
      time: meeting.time || "",
      duration: meeting.duration || 60,
      attendees: meeting.attendees || [],
      teamsLink: meeting.teamsLink || "",
      agenda: meeting.agenda || [],
      outcomes: meeting.outcomes || "",
      nextSteps: meeting.nextSteps || "",
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

  const [newAgendaItem, setNewAgendaItem] = useState("");
  const [newAttendee, setNewAttendee] = useState("");

  const addAgendaItem = () => {
    if (newAgendaItem.trim()) {
      setFormData({ ...formData, agenda: [...formData.agenda, newAgendaItem] });
      setNewAgendaItem("");
    }
  };

  const removeAgendaItem = (index: number) => {
    setFormData({
      ...formData,
      agenda: formData.agenda.filter((_, i) => i !== index),
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

  const filteredMeetings = selectedType === "all"
    ? meetings
    : meetings.filter(m => m.type === selectedType);

  const groupedMeetings = {
    all: meetings,
    weekly: meetings.filter(m => m.type === "weekly"),
    monthly: meetings.filter(m => m.type === "monthly"),
    quarterly: meetings.filter(m => m.type === "quarterly"),
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
              Manage your organizational meeting cadence and outcomes
            </p>
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
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
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
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 60 })}
                      data-testid="input-duration"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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

                  <div>
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      data-testid="input-time"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="teamsLink">Teams Link</Label>
                  <Input
                    id="teamsLink"
                    placeholder="https://teams.microsoft.com/..."
                    value={formData.teamsLink}
                    onChange={(e) => setFormData({ ...formData, teamsLink: e.target.value })}
                    data-testid="input-teams-link"
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
                  <Label>Agenda Items</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Enter agenda item"
                      value={newAgendaItem}
                      onChange={(e) => setNewAgendaItem(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addAgendaItem()}
                      data-testid="input-agenda-item"
                    />
                    <Button onClick={addAgendaItem} data-testid="button-add-agenda">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.agenda.map((item, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeAgendaItem(index)}
                        data-testid={`badge-agenda-${index}`}
                      >
                        {item} ×
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="outcomes">Outcomes</Label>
                  <Textarea
                    id="outcomes"
                    placeholder="Key outcomes and decisions..."
                    value={formData.outcomes}
                    onChange={(e) => setFormData({ ...formData, outcomes: e.target.value })}
                    rows={3}
                    data-testid="textarea-outcomes"
                  />
                </div>

                <div>
                  <Label htmlFor="nextSteps">Next Steps</Label>
                  <Textarea
                    id="nextSteps"
                    placeholder="Action items and next steps..."
                    value={formData.nextSteps}
                    onChange={(e) => setFormData({ ...formData, nextSteps: e.target.value })}
                    rows={3}
                    data-testid="textarea-next-steps"
                  />
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
        </div>

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
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
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
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 60 })}
                    data-testid="input-edit-duration"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    data-testid="input-edit-date"
                  />
                </div>

                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    data-testid="input-edit-time"
                  />
                </div>
              </div>

              <div>
                <Label>Teams Link</Label>
                <Input
                  value={formData.teamsLink}
                  onChange={(e) => setFormData({ ...formData, teamsLink: e.target.value })}
                  data-testid="input-edit-teams-link"
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
                <Label>Agenda Items</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Enter agenda item"
                    value={newAgendaItem}
                    onChange={(e) => setNewAgendaItem(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addAgendaItem()}
                    data-testid="input-edit-agenda"
                  />
                  <Button onClick={addAgendaItem} data-testid="button-edit-add-agenda">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.agenda.map((item, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeAgendaItem(index)}
                    >
                      {item} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Outcomes</Label>
                <Textarea
                  value={formData.outcomes}
                  onChange={(e) => setFormData({ ...formData, outcomes: e.target.value })}
                  rows={3}
                  data-testid="textarea-edit-outcomes"
                />
              </div>

              <div>
                <Label>Next Steps</Label>
                <Textarea
                  value={formData.nextSteps}
                  onChange={(e) => setFormData({ ...formData, nextSteps: e.target.value })}
                  rows={3}
                  data-testid="textarea-edit-next-steps"
                />
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
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch {
      return dateString;
    }
  };

  return (
    <Card className="hover-elevate" data-testid={`card-meeting-${meeting.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={getMeetingTypeVariant(meeting.type || "weekly")}>
                {meeting.type || "Weekly"}
              </Badge>
              {meeting.date && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(meeting.date)}
                  {meeting.time && ` at ${meeting.time}`}
                </span>
              )}
            </div>
            <CardTitle className="text-xl">{meeting.title}</CardTitle>
            {meeting.duration && (
              <CardDescription className="mt-1">
                Duration: {meeting.duration} minutes
              </CardDescription>
            )}
          </div>
          <div className="flex gap-2">
            {meeting.teamsLink && (
              <Button
                variant="ghost"
                size="icon"
                asChild
                data-testid={`button-teams-${meeting.id}`}
              >
                <a href={meeting.teamsLink} target="_blank" rel="noopener noreferrer">
                  <Video className="w-4 h-4" />
                </a>
              </Button>
            )}
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

        {meeting.agenda && meeting.agenda.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Agenda</h4>
            <ul className="space-y-1">
              {meeting.agenda.map((item, index) => (
                <li key={index} className="text-sm flex items-start gap-2">
                  <Target className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {meeting.outcomes && (
          <div>
            <h4 className="text-sm font-medium mb-1">Outcomes</h4>
            <p className="text-sm text-muted-foreground">{meeting.outcomes}</p>
          </div>
        )}

        {meeting.nextSteps && (
          <div>
            <h4 className="text-sm font-medium mb-1">Next Steps</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{meeting.nextSteps}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
