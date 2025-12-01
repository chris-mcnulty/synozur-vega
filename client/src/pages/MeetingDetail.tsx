import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Users, Pencil, ArrowLeft, Target, CheckCircle2, AlertTriangle, Link2, Clock, Zap, ChevronRight, X, Sparkles, Copy, ClipboardCheck, ExternalLink, Trash2, Plus, Save } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Meeting, Objective, KeyResult, BigRock } from "@shared/schema";
import { useTenant } from "@/contexts/TenantContext";
import { format } from "date-fns";

interface LinkedItemDisplayProps {
  objectives: Objective[];
  keyResults: KeyResult[];
  bigRocks: BigRock[];
  linkedObjectiveIds: string[];
  linkedKeyResultIds: string[];
  linkedBigRockIds: string[];
  onRemoveObjective: (id: string) => void;
  onRemoveKeyResult: (id: string) => void;
  onRemoveBigRock: (id: string) => void;
}

function getStatusColor(status: string | null) {
  switch (status) {
    case "on_track": return "bg-green-500/20 text-green-700 dark:text-green-400";
    case "at_risk": return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
    case "behind": return "bg-red-500/20 text-red-700 dark:text-red-400";
    case "completed": return "bg-blue-500/20 text-blue-700 dark:text-blue-400";
    default: return "bg-muted text-muted-foreground";
  }
}

function LinkedItemsDisplay({
  objectives,
  keyResults,
  bigRocks,
  linkedObjectiveIds,
  linkedKeyResultIds,
  linkedBigRockIds,
  onRemoveObjective,
  onRemoveKeyResult,
  onRemoveBigRock,
}: LinkedItemDisplayProps) {
  const linkedObjectives = objectives.filter(o => linkedObjectiveIds.includes(o.id));
  const linkedKeyResults = keyResults.filter(kr => linkedKeyResultIds.includes(kr.id));
  const linkedBigRocks = bigRocks.filter(br => linkedBigRockIds.includes(br.id));

  if (linkedObjectives.length === 0 && linkedKeyResults.length === 0 && linkedBigRocks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Link2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No linked items yet</p>
        <p className="text-sm mt-1">Use the checkboxes below to link OKRs and Big Rocks</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {linkedObjectives.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Linked Objectives ({linkedObjectives.length})
          </h4>
          <div className="space-y-2">
            {linkedObjectives.map(obj => (
              <Card key={obj.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getStatusColor(obj.status)} variant="secondary">
                        {obj.status?.replace('_', ' ') || 'Not started'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {Math.round(obj.progress || 0)}%
                      </span>
                    </div>
                    <p className="font-medium truncate">{obj.title}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveObjective(obj.id)}
                    data-testid={`button-remove-objective-${obj.id}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {linkedKeyResults.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Linked Key Results ({linkedKeyResults.length})
          </h4>
          <div className="space-y-2">
            {linkedKeyResults.map(kr => (
              <Card key={kr.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getStatusColor(kr.status)} variant="secondary">
                        {kr.status?.replace('_', ' ') || 'Not started'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {Math.round(kr.progress || 0)}%
                      </span>
                    </div>
                    <p className="font-medium truncate">{kr.title}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveKeyResult(kr.id)}
                    data-testid={`button-remove-keyresult-${kr.id}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {linkedBigRocks.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Linked Big Rocks ({linkedBigRocks.length})
          </h4>
          <div className="space-y-2">
            {linkedBigRocks.map(rock => (
              <Card key={rock.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getStatusColor(rock.status)} variant="secondary">
                        {rock.status?.replace('_', ' ') || 'Not started'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Q{rock.quarter}
                      </span>
                    </div>
                    <p className="font-medium truncate">{rock.title}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveBigRock(rock.id)}
                    data-testid={`button-remove-bigrock-${rock.id}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MeetingDetail() {
  const [, params] = useRoute("/focus-rhythm/:meetingId");
  const [, setLocation] = useLocation();
  const meetingId = params?.meetingId;
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  const [formData, setFormData] = useState({
    title: "",
    meetingType: "weekly",
    date: "",
    attendees: [] as string[],
    facilitator: "",
    agenda: [] as string[],
    summary: "",
    decisions: [] as string[],
    actionItems: [] as string[],
    risks: [] as string[],
    nextMeetingDate: "",
    linkedObjectiveIds: [] as string[],
    linkedKeyResultIds: [] as string[],
    linkedBigRockIds: [] as string[],
    meetingNotes: "",
  });

  const [newAgendaItem, setNewAgendaItem] = useState("");
  const [newDecision, setNewDecision] = useState("");
  const [newActionItem, setNewActionItem] = useState("");
  const [newRisk, setNewRisk] = useState("");
  const [newAttendee, setNewAttendee] = useState("");

  const { data: meeting, isLoading: meetingLoading } = useQuery<Meeting>({
    queryKey: ['/api/meeting', meetingId],
    queryFn: async () => {
      const res = await fetch(`/api/meeting/${meetingId}`);
      if (!res.ok) throw new Error('Meeting not found');
      return res.json();
    },
    enabled: !!meetingId,
  });

  const { data: objectives = [] } = useQuery<Objective[]>({
    queryKey: ['/api/okr/objectives', currentTenant?.id],
    queryFn: async () => {
      const res = await fetch(`/api/okr/objectives?tenantId=${currentTenant?.id}`);
      return res.json();
    },
    enabled: !!currentTenant?.id,
  });

  const { data: keyResults = [] } = useQuery<KeyResult[]>({
    queryKey: ['/api/okr/key-results', currentTenant?.id],
    queryFn: async () => {
      const res = await fetch(`/api/okr/key-results?tenantId=${currentTenant?.id}`);
      return res.json();
    },
    enabled: !!currentTenant?.id,
  });

  const { data: bigRocks = [] } = useQuery<BigRock[]>({
    queryKey: ['/api/okr/big-rocks', currentTenant?.id],
    queryFn: async () => {
      const res = await fetch(`/api/okr/big-rocks?tenantId=${currentTenant?.id}`);
      return res.json();
    },
    enabled: !!currentTenant?.id,
  });

  useEffect(() => {
    if (meeting) {
      setFormData({
        title: meeting.title || "",
        meetingType: meeting.meetingType || "weekly",
        date: meeting.date ? format(new Date(meeting.date), 'yyyy-MM-dd') : "",
        attendees: meeting.attendees || [],
        facilitator: meeting.facilitator || "",
        agenda: meeting.agenda || [],
        summary: meeting.summary || "",
        decisions: meeting.decisions || [],
        actionItems: meeting.actionItems || [],
        risks: meeting.risks || [],
        nextMeetingDate: meeting.nextMeetingDate ? format(new Date(meeting.nextMeetingDate), 'yyyy-MM-dd') : "",
        linkedObjectiveIds: meeting.linkedObjectiveIds || [],
        linkedKeyResultIds: meeting.linkedKeyResultIds || [],
        linkedBigRockIds: meeting.linkedBigRockIds || [],
        meetingNotes: meeting.meetingNotes || "",
      });
    }
  }, [meeting]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        date: data.date ? new Date(data.date).toISOString() : null,
        nextMeetingDate: data.nextMeetingDate ? new Date(data.nextMeetingDate).toISOString() : null,
      };
      return apiRequest("PATCH", `/api/meetings/${meetingId}`, payload);
    },
    onSuccess: () => {
      toast({ title: "Meeting updated", description: "Changes saved successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/meeting', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/focus-rhythm/${meetingId}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: "Meeting URL copied to clipboard" });
  };

  const addArrayItem = (field: 'agenda' | 'decisions' | 'actionItems' | 'risks' | 'attendees', value: string, setter: (v: string) => void) => {
    if (value.trim()) {
      setFormData(prev => ({
        ...prev,
        [field]: [...prev[field], value.trim()]
      }));
      setter("");
    }
  };

  const removeArrayItem = (field: 'agenda' | 'decisions' | 'actionItems' | 'risks' | 'attendees', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const toggleObjective = (id: string) => {
    setFormData(prev => ({
      ...prev,
      linkedObjectiveIds: prev.linkedObjectiveIds.includes(id)
        ? prev.linkedObjectiveIds.filter(i => i !== id)
        : [...prev.linkedObjectiveIds, id]
    }));
  };

  const toggleKeyResult = (id: string) => {
    setFormData(prev => ({
      ...prev,
      linkedKeyResultIds: prev.linkedKeyResultIds.includes(id)
        ? prev.linkedKeyResultIds.filter(i => i !== id)
        : [...prev.linkedKeyResultIds, id]
    }));
  };

  const toggleBigRock = (id: string) => {
    setFormData(prev => ({
      ...prev,
      linkedBigRockIds: prev.linkedBigRockIds.includes(id)
        ? prev.linkedBigRockIds.filter(i => i !== id)
        : [...prev.linkedBigRockIds, id]
    }));
  };

  if (meetingLoading) {
    return (
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="p-8">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-2xl font-semibold mb-4">Meeting Not Found</h1>
          <p className="text-muted-foreground mb-4">The meeting you're looking for doesn't exist or has been deleted.</p>
          <Button onClick={() => setLocation('/focus-rhythm')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Focus Rhythm
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setLocation('/focus-rhythm')} data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">{formData.title || "Untitled Meeting"}</h1>
              <div className="flex items-center gap-2 text-muted-foreground mt-1">
                <Badge variant="outline">{formData.meetingType}</Badge>
                {formData.date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(formData.date), 'MMM d, yyyy')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCopyLink} data-testid="button-copy-link">
              <ExternalLink className="w-4 h-4 mr-2" />
              Copy Link
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save">
              <Save className="w-4 h-4 mr-2" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Meeting Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="details" className="w-full">
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="agenda">Agenda</TabsTrigger>
                    <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="title">Meeting Title</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        data-testid="input-title"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="type">Meeting Type</Label>
                        <Select
                          value={formData.meetingType}
                          onValueChange={(value) => setFormData({ ...formData, meetingType: value })}
                        >
                          <SelectTrigger data-testid="select-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="annual">Annual</SelectItem>
                            <SelectItem value="ad-hoc">Ad-hoc</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="date">Date</Label>
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
                      <Label htmlFor="facilitator">Facilitator</Label>
                      <Input
                        id="facilitator"
                        value={formData.facilitator}
                        onChange={(e) => setFormData({ ...formData, facilitator: e.target.value })}
                        placeholder="Who is running this meeting?"
                        data-testid="input-facilitator"
                      />
                    </div>

                    <div>
                      <Label>Attendees</Label>
                      <div className="flex gap-2 mb-2">
                        <Input
                          value={newAttendee}
                          onChange={(e) => setNewAttendee(e.target.value)}
                          placeholder="Add attendee"
                          onKeyDown={(e) => e.key === 'Enter' && addArrayItem('attendees', newAttendee, setNewAttendee)}
                          data-testid="input-new-attendee"
                        />
                        <Button
                          variant="outline"
                          onClick={() => addArrayItem('attendees', newAttendee, setNewAttendee)}
                          data-testid="button-add-attendee"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {formData.attendees.map((attendee, idx) => (
                          <Badge key={idx} variant="secondary" className="gap-1">
                            <Users className="w-3 h-3" />
                            {attendee}
                            <button onClick={() => removeArrayItem('attendees', idx)} className="ml-1 hover:text-destructive">
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="summary">Summary</Label>
                      <Textarea
                        id="summary"
                        value={formData.summary}
                        onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                        placeholder="Brief summary of the meeting..."
                        rows={3}
                        data-testid="textarea-summary"
                      />
                    </div>

                    <div>
                      <Label htmlFor="nextMeetingDate">Next Meeting Date</Label>
                      <Input
                        id="nextMeetingDate"
                        type="date"
                        value={formData.nextMeetingDate}
                        onChange={(e) => setFormData({ ...formData, nextMeetingDate: e.target.value })}
                        data-testid="input-next-date"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="agenda" className="space-y-4 mt-4">
                    <div>
                      <Label>Agenda Items</Label>
                      <div className="flex gap-2 mb-2">
                        <Input
                          value={newAgendaItem}
                          onChange={(e) => setNewAgendaItem(e.target.value)}
                          placeholder="Add agenda item"
                          onKeyDown={(e) => e.key === 'Enter' && addArrayItem('agenda', newAgendaItem, setNewAgendaItem)}
                          data-testid="input-new-agenda"
                        />
                        <Button
                          variant="outline"
                          onClick={() => addArrayItem('agenda', newAgendaItem, setNewAgendaItem)}
                          data-testid="button-add-agenda"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {formData.agenda.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                            <span className="text-muted-foreground">{idx + 1}.</span>
                            <span className="flex-1">{item}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeArrayItem('agenda', idx)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        {formData.agenda.length === 0 && (
                          <p className="text-muted-foreground text-center py-4">No agenda items yet</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="outcomes" className="space-y-6 mt-4">
                    <div>
                      <Label>Decisions Made</Label>
                      <div className="flex gap-2 mb-2">
                        <Input
                          value={newDecision}
                          onChange={(e) => setNewDecision(e.target.value)}
                          placeholder="Add decision"
                          onKeyDown={(e) => e.key === 'Enter' && addArrayItem('decisions', newDecision, setNewDecision)}
                          data-testid="input-new-decision"
                        />
                        <Button
                          variant="outline"
                          onClick={() => addArrayItem('decisions', newDecision, setNewDecision)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {formData.decisions.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-green-500/10 rounded border border-green-500/20">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="flex-1">{item}</span>
                            <Button variant="ghost" size="icon" onClick={() => removeArrayItem('decisions', idx)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Action Items</Label>
                      <div className="flex gap-2 mb-2">
                        <Input
                          value={newActionItem}
                          onChange={(e) => setNewActionItem(e.target.value)}
                          placeholder="Add action item"
                          onKeyDown={(e) => e.key === 'Enter' && addArrayItem('actionItems', newActionItem, setNewActionItem)}
                          data-testid="input-new-action"
                        />
                        <Button
                          variant="outline"
                          onClick={() => addArrayItem('actionItems', newActionItem, setNewActionItem)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {formData.actionItems.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-blue-500/10 rounded border border-blue-500/20">
                            <ChevronRight className="w-4 h-4 text-blue-600" />
                            <span className="flex-1">{item}</span>
                            <Button variant="ghost" size="icon" onClick={() => removeArrayItem('actionItems', idx)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Risks & Concerns</Label>
                      <div className="flex gap-2 mb-2">
                        <Input
                          value={newRisk}
                          onChange={(e) => setNewRisk(e.target.value)}
                          placeholder="Add risk or concern"
                          onKeyDown={(e) => e.key === 'Enter' && addArrayItem('risks', newRisk, setNewRisk)}
                          data-testid="input-new-risk"
                        />
                        <Button
                          variant="outline"
                          onClick={() => addArrayItem('risks', newRisk, setNewRisk)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {formData.risks.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
                            <AlertTriangle className="w-4 h-4 text-yellow-600" />
                            <span className="flex-1">{item}</span>
                            <Button variant="ghost" size="icon" onClick={() => removeArrayItem('risks', idx)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="notes" className="space-y-4 mt-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <ClipboardCheck className="w-5 h-5 text-muted-foreground" />
                        <Label htmlFor="meetingNotes" className="text-base font-medium">Imported Meeting Notes</Label>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Paste auto-generated notes from Outlook Copilot or Teams here. These notes are available for AI analysis.
                      </p>
                      <Textarea
                        id="meetingNotes"
                        placeholder="Paste meeting notes from Outlook Copilot or Teams transcription here..."
                        value={formData.meetingNotes}
                        onChange={(e) => setFormData({ ...formData, meetingNotes: e.target.value })}
                        rows={15}
                        className="font-mono text-sm"
                        data-testid="textarea-meeting-notes"
                      />
                      {formData.meetingNotes && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {formData.meetingNotes.length} characters
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="w-5 h-5" />
                  Linked Items
                </CardTitle>
                <CardDescription>
                  OKRs and Big Rocks connected to this meeting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LinkedItemsDisplay
                  objectives={objectives}
                  keyResults={keyResults}
                  bigRocks={bigRocks}
                  linkedObjectiveIds={formData.linkedObjectiveIds}
                  linkedKeyResultIds={formData.linkedKeyResultIds}
                  linkedBigRockIds={formData.linkedBigRockIds}
                  onRemoveObjective={(id) => toggleObjective(id)}
                  onRemoveKeyResult={(id) => toggleKeyResult(id)}
                  onRemoveBigRock={(id) => toggleBigRock(id)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Add Links</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="objectives" className="w-full">
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="objectives" className="text-xs">Objectives</TabsTrigger>
                    <TabsTrigger value="keyresults" className="text-xs">Key Results</TabsTrigger>
                    <TabsTrigger value="bigrocks" className="text-xs">Big Rocks</TabsTrigger>
                  </TabsList>

                  <TabsContent value="objectives" className="mt-4">
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {objectives.map(obj => (
                          <div
                            key={obj.id}
                            className="flex items-center gap-2 p-2 rounded hover-elevate cursor-pointer"
                            onClick={() => toggleObjective(obj.id)}
                          >
                            <Checkbox
                              checked={formData.linkedObjectiveIds.includes(obj.id)}
                              onCheckedChange={() => toggleObjective(obj.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{obj.title}</p>
                              <div className="flex items-center gap-2">
                                <Badge className={`${getStatusColor(obj.status)} text-xs`} variant="secondary">
                                  {obj.status?.replace('_', ' ') || 'Not started'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                        {objectives.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">No objectives found</p>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="keyresults" className="mt-4">
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {keyResults.map(kr => (
                          <div
                            key={kr.id}
                            className="flex items-center gap-2 p-2 rounded hover-elevate cursor-pointer"
                            onClick={() => toggleKeyResult(kr.id)}
                          >
                            <Checkbox
                              checked={formData.linkedKeyResultIds.includes(kr.id)}
                              onCheckedChange={() => toggleKeyResult(kr.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{kr.title}</p>
                              <div className="flex items-center gap-2">
                                <Badge className={`${getStatusColor(kr.status)} text-xs`} variant="secondary">
                                  {kr.status?.replace('_', ' ') || 'Not started'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{Math.round(kr.progress || 0)}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {keyResults.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">No key results found</p>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="bigrocks" className="mt-4">
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {bigRocks.map(rock => (
                          <div
                            key={rock.id}
                            className="flex items-center gap-2 p-2 rounded hover-elevate cursor-pointer"
                            onClick={() => toggleBigRock(rock.id)}
                          >
                            <Checkbox
                              checked={formData.linkedBigRockIds.includes(rock.id)}
                              onCheckedChange={() => toggleBigRock(rock.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{rock.title}</p>
                              <div className="flex items-center gap-2">
                                <Badge className={`${getStatusColor(rock.status)} text-xs`} variant="secondary">
                                  {rock.status?.replace('_', ' ') || 'Not started'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">Q{rock.quarter}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {bigRocks.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">No big rocks found</p>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
