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
import { Calendar, Users, Pencil, ArrowLeft, Target, CheckCircle2, AlertTriangle, Link2, Clock, Zap, ChevronRight, X, Sparkles, Copy, ClipboardCheck, ExternalLink, Trash2, Plus, Save, Search, Send, ChevronUp, ChevronDown, User, Flag } from "lucide-react";
import type { ActionItem } from "@shared/schema";
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
import { useTimePeriod } from "@/contexts/TimePeriodContext";
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
  const { selectedQuarter: currentQuarter, year: globalYear } = useTimePeriod();

  const [formData, setFormData] = useState({
    title: "",
    meetingType: "weekly",
    date: "",
    meetingTime: "",
    duration: "" as string | number,
    attendees: [] as string[],
    facilitator: "",
    agenda: [] as string[],
    summary: "",
    decisions: [] as string[],
    actionItems: [] as ActionItem[],
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
  const [newActionAssignee, setNewActionAssignee] = useState("");
  const [newActionDueDate, setNewActionDueDate] = useState("");
  const [newActionPriority, setNewActionPriority] = useState<'high' | 'medium' | 'low' | ''>("");
  const [newRisk, setNewRisk] = useState("");
  const [newAttendee, setNewAttendee] = useState("");
  const [attendeeSearchOpen, setAttendeeSearchOpen] = useState(false);
  const [showAiPrep, setShowAiPrep] = useState(false);

  interface TenantMember {
    id: string;
    email: string;
    displayName: string;
    role: string;
  }

  const { data: tenantMembers = [] } = useQuery<TenantMember[]>({
    queryKey: ['/api/tenant-members'],
    enabled: !!currentTenant?.id,
  });

  interface MeetingPrepSummary {
    meetingTitle: string;
    meetingType: string | null;
    meetingDate: string | null;
    linkedOkrs: Array<{
      id: string;
      title: string;
      type: 'objective' | 'keyResult' | 'bigRock';
      progress: number;
      status: string | null;
      paceStatus: string;
      projectedProgress: number;
      recentCheckIns: Array<{
        date: string;
        note: string;
        progressChange: number;
      }>;
      needsDiscussion: boolean;
      discussionReason: string | null;
    }>;
    suggestedTalkingPoints: string[];
    atRiskCount: number;
    behindPaceCount: number;
  }

  const { data: meetingPrep, isLoading: prepLoading, refetch: refetchPrep } = useQuery<MeetingPrepSummary>({
    queryKey: ['/api/meetings', meetingId, 'prep'],
    queryFn: async () => {
      const res = await fetch(`/api/meetings/${meetingId}/prep`);
      if (!res.ok) throw new Error('Failed to fetch meeting prep');
      return res.json();
    },
    enabled: showAiPrep && !!meetingId,
  });

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
    queryKey: ['/api/okr/objectives', currentTenant?.id, currentQuarter?.quarter, globalYear],
    queryFn: async () => {
      const params = new URLSearchParams({ tenantId: currentTenant!.id, year: String(globalYear) });
      if (currentQuarter?.quarter != null && currentQuarter.quarter !== 0) {
        params.set('quarter', String(currentQuarter.quarter));
      }
      const res = await fetch(`/api/okr/objectives?${params}`);
      return res.json();
    },
    enabled: !!currentTenant?.id && !!currentQuarter,
  });

  const { data: keyResults = [] } = useQuery<KeyResult[]>({
    queryKey: ['/api/okr/key-results', currentTenant?.id, currentQuarter?.quarter, globalYear],
    queryFn: async () => {
      const params = new URLSearchParams({ tenantId: currentTenant!.id, year: String(globalYear) });
      if (currentQuarter?.quarter != null && currentQuarter.quarter !== 0) {
        params.set('quarter', String(currentQuarter.quarter));
      }
      const res = await fetch(`/api/okr/key-results?${params}`);
      return res.json();
    },
    enabled: !!currentTenant?.id && !!currentQuarter,
  });

  const { data: bigRocks = [] } = useQuery<BigRock[]>({
    queryKey: ['/api/okr/big-rocks', currentTenant?.id, currentQuarter?.quarter, globalYear],
    queryFn: async () => {
      const params = new URLSearchParams({ tenantId: currentTenant!.id, year: String(globalYear) });
      if (currentQuarter?.quarter != null && currentQuarter.quarter !== 0) {
        params.set('quarter', String(currentQuarter.quarter));
      }
      const res = await fetch(`/api/okr/big-rocks?${params}`);
      return res.json();
    },
    enabled: !!currentTenant?.id && !!currentQuarter,
  });

  useEffect(() => {
    if (meeting) {
      // Normalise actionItems: old string[] rows become ActionItem objects
      const rawActions = (meeting.actionItems || []) as unknown[];
      const normalisedActions: ActionItem[] = rawActions.map((item, i) => {
        if (typeof item === 'object' && item !== null && 'description' in item) {
          return item as ActionItem;
        }
        return {
          id: `legacy-${i}`,
          description: String(item),
          completed: false,
        };
      });

      setFormData({
        title: meeting.title || "",
        meetingType: meeting.meetingType || "weekly",
        date: meeting.date ? format(new Date(meeting.date), 'yyyy-MM-dd') : "",
        meetingTime: (meeting as any).meetingTime || "",
        duration: (meeting as any).duration || "",
        attendees: meeting.attendees || [],
        facilitator: meeting.facilitator || "",
        agenda: meeting.agenda || [],
        summary: meeting.summary || "",
        decisions: meeting.decisions || [],
        actionItems: normalisedActions,
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
        meetingTime: data.meetingTime || null,
        duration: data.duration !== "" ? Number(data.duration) : null,
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

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/focus-rhythm/${meetingId}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast({ title: "Link copied", description: "Meeting URL copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy to clipboard", variant: "destructive" });
    }
  };

  const handleCopySummary = () => {
    const linkedObjs = objectives.filter(o => formData.linkedObjectiveIds.includes(o.id));
    const linkedKRs = keyResults.filter(kr => formData.linkedKeyResultIds.includes(kr.id));
    const linkedRocks = bigRocks.filter(b => formData.linkedBigRockIds.includes(b.id));

    let brief = `${formData.title}\n`;
    brief += `${'='.repeat(formData.title.length)}\n\n`;

    if (formData.date) {
      brief += `Date: ${format(new Date(formData.date), "PPPP")}\n`;
    }
    if (formData.facilitator) {
      brief += `Facilitator: ${formData.facilitator}\n`;
    }
    if (formData.attendees.length > 0) {
      brief += `Attendees: ${formData.attendees.join(', ')}\n`;
    }
    brief += '\n';

    if (formData.agenda.length > 0) {
      brief += `AGENDA\n${'─'.repeat(25)}\n`;
      let itemNum = 0;
      formData.agenda.forEach(item => {
        const isSection = item.startsWith('---') && item.endsWith('---');
        const isOkrItem = item.startsWith('[OKR]');
        if (isSection) {
          const sectionText = item.replace(/^---\s*/, '').replace(/\s*---$/, '');
          brief += `\n${sectionText.toUpperCase()}\n`;
        } else {
          itemNum++;
          const displayText = isOkrItem ? item.replace('[OKR] ', '') : item;
          brief += `  ${itemNum}. ${displayText}\n`;
        }
      });
      brief += '\n';
    }

    if (linkedRocks.length > 0) {
      brief += `BIG ROCKS (Initiatives)\n${'─'.repeat(25)}\n`;
      linkedRocks.forEach(rock => {
        const statusLabel = rock.status === 'at_risk' ? 'AT RISK' : rock.status === 'behind' ? 'BEHIND' : rock.status === 'on_track' ? 'On Track' : rock.status === 'completed' ? 'Complete' : 'Not Started';
        brief += `- ${rock.title} [${statusLabel}]\n`;
        if (rock.description) brief += `  ${rock.description}\n`;
      });
      brief += '\n';
    }

    if (linkedObjs.length > 0) {
      brief += `OBJECTIVES\n${'─'.repeat(25)}\n`;
      linkedObjs.forEach(obj => {
        const progress = obj.progress?.toFixed(0) || 0;
        const statusLabel = obj.status === 'at_risk' ? 'AT RISK' : obj.status === 'behind' ? 'BEHIND' : obj.status === 'on_track' ? 'On Track' : obj.status === 'completed' ? 'Complete' : 'Not Started';
        brief += `- ${obj.title} [${statusLabel} - ${progress}%]\n`;
      });
      brief += '\n';
    }

    if (linkedKRs.length > 0) {
      brief += `KEY RESULTS\n${'─'.repeat(25)}\n`;
      linkedKRs.forEach(kr => {
        const progress = kr.progress?.toFixed(0) || 0;
        const statusLabel = kr.status === 'at_risk' ? 'AT RISK' : kr.status === 'behind' ? 'BEHIND' : kr.status === 'on_track' ? 'On Track' : kr.status === 'completed' ? 'Complete' : 'Not Started';
        brief += `- ${kr.title} [${statusLabel} - ${progress}%]\n`;
      });
      brief += '\n';
    }

    if (formData.summary) {
      brief += `OUTCOMES / SUMMARY\n${'─'.repeat(25)}\n`;
      brief += `${formData.summary}\n\n`;
    }

    if (formData.decisions.length > 0) {
      brief += `DECISIONS\n${'─'.repeat(25)}\n`;
      formData.decisions.forEach(d => { brief += `- ${d}\n`; });
      brief += '\n';
    }

    if (formData.actionItems.length > 0) {
      brief += `ACTION ITEMS\n${'─'.repeat(25)}\n`;
      formData.actionItems.forEach(a => {
        const status = a.completed ? '[✓]' : '[ ]';
        const priority = a.priority ? ` [${a.priority.toUpperCase()}]` : '';
        const assignee = a.assignee ? ` — ${a.assignee}` : '';
        const due = a.dueDate ? ` (due: ${a.dueDate})` : '';
        brief += `${status}${priority} ${a.description}${assignee}${due}\n`;
      });
      brief += '\n';
    }

    if (formData.risks.length > 0) {
      brief += `RISKS\n${'─'.repeat(25)}\n`;
      formData.risks.forEach(r => { brief += `- ${r}\n`; });
      brief += '\n';
    }

    if (formData.meetingNotes) {
      brief += `MEETING NOTES\n${'─'.repeat(25)}\n`;
      brief += `${formData.meetingNotes}\n\n`;
    }

    brief += `---\nGenerated from Vega Company OS\n`;

    const copyToClipboard = async (text: string) => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.left = '-9999px';
          textarea.style.top = '-9999px';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        toast({ title: "Summary copied", description: "Full meeting summary with linked items, outcomes, and action items" });
      } catch {
        toast({ title: "Copy failed", description: "Could not copy to clipboard", variant: "destructive" });
      }
    };
    copyToClipboard(brief);
  };

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/outlook/schedule-meeting", {
        meetingId,
        durationMinutes: 60,
      });
    },
    onSuccess: () => {
      toast({ title: "Scheduled in Outlook", description: "Meeting has been added to your Outlook calendar with all linked items" });
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to schedule meeting in Outlook";
      toast({ title: "Scheduling failed", description: message, variant: "destructive" });
    },
  });

  const addArrayItem = (field: 'agenda' | 'decisions' | 'risks' | 'attendees', value: string, setter: (v: string) => void) => {
    if (value.trim()) {
      setFormData(prev => ({
        ...prev,
        [field]: [...(prev[field] as string[]), value.trim()]
      }));
      setter("");
    }
  };

  const removeArrayItem = (field: 'agenda' | 'decisions' | 'risks' | 'attendees', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index)
    }));
  };

  const moveAgendaItem = (index: number, direction: 'up' | 'down') => {
    setFormData(prev => {
      const arr = [...prev.agenda];
      const swapIdx = direction === 'up' ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= arr.length) return prev;
      [arr[index], arr[swapIdx]] = [arr[swapIdx], arr[index]];
      return { ...prev, agenda: arr };
    });
  };

  const addActionItemEntry = () => {
    if (!newActionItem.trim()) return;
    const item: ActionItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      description: newActionItem.trim(),
      assignee: newActionAssignee.trim() || undefined,
      dueDate: newActionDueDate || undefined,
      priority: newActionPriority || undefined,
      completed: false,
    };
    setFormData(prev => ({ ...prev, actionItems: [...prev.actionItems, item] }));
    setNewActionItem("");
    setNewActionAssignee("");
    setNewActionDueDate("");
    setNewActionPriority("");
  };

  const removeActionItem = (id: string) => {
    setFormData(prev => ({ ...prev, actionItems: prev.actionItems.filter(a => a.id !== id) }));
  };

  const toggleActionItemDone = (id: string) => {
    setFormData(prev => ({
      ...prev,
      actionItems: prev.actionItems.map(a => a.id === id ? { ...a, completed: !a.completed } : a),
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
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              onClick={() => setShowAiPrep(!showAiPrep)}
              data-testid="button-ai-prep"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {showAiPrep ? "Hide AI Prep" : "AI Prep"}
            </Button>
            <Button variant="outline" onClick={handleCopySummary} data-testid="button-copy-summary">
              <Copy className="w-4 h-4 mr-2" />
              Copy Summary
            </Button>
            <Button 
              variant="outline" 
              onClick={() => scheduleMutation.mutate()} 
              disabled={scheduleMutation.isPending}
              data-testid="button-schedule-outlook"
            >
              <Send className="w-4 h-4 mr-2" />
              {scheduleMutation.isPending ? "Scheduling..." : "Schedule to Outlook"}
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save">
              <Save className="w-4 h-4 mr-2" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {showAiPrep && (
          <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-purple-200 dark:border-purple-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  AI Meeting Prep
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => refetchPrep()}
                  disabled={prepLoading}
                  data-testid="button-refresh-prep"
                >
                  {prepLoading ? "Loading..." : "Refresh"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {prepLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </div>
              ) : meetingPrep ? (
                <div className="space-y-4">
                  {(meetingPrep.atRiskCount > 0 || meetingPrep.behindPaceCount > 0) && (
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      <span className="text-sm font-medium">
                        {meetingPrep.atRiskCount} at-risk items, {meetingPrep.behindPaceCount} behind pace
                      </span>
                    </div>
                  )}
                  
                  {meetingPrep.suggestedTalkingPoints.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-purple-600" />
                        Suggested Talking Points
                      </h4>
                      <ul className="space-y-1">
                        {meetingPrep.suggestedTalkingPoints.map((point, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-muted-foreground">{i + 1}.</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {meetingPrep.linkedOkrs.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Target className="w-4 h-4 text-purple-600" />
                        Linked Items Status ({meetingPrep.linkedOkrs.length})
                      </h4>
                      <div className="space-y-2">
                        {meetingPrep.linkedOkrs.map((okr) => (
                          <div 
                            key={okr.id} 
                            className={`p-2 rounded-lg text-sm ${
                              okr.needsDiscussion 
                                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
                                : 'bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Badge variant={okr.paceStatus === 'at_risk' ? 'destructive' : okr.paceStatus === 'behind' ? 'secondary' : 'default'}>
                                  {okr.progress}%
                                </Badge>
                                <span className="font-medium truncate">{okr.title}</span>
                              </div>
                              <Badge variant="outline" className="shrink-0">
                                {okr.type === 'keyResult' ? 'KR' : okr.type === 'bigRock' ? 'BR' : 'Obj'}
                              </Badge>
                            </div>
                            {okr.discussionReason && (
                              <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {okr.discussionReason}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {meetingPrep.linkedOkrs.length === 0 && meetingPrep.suggestedTalkingPoints.length === 0 && (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      No linked items. Add objectives, key results, or big rocks to get AI-powered meeting prep.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Click Refresh to generate meeting prep.</p>
              )}
            </CardContent>
          </Card>
        )}

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

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="meetingTime">Start Time</Label>
                        <Input
                          id="meetingTime"
                          type="time"
                          value={formData.meetingTime}
                          onChange={(e) => setFormData({ ...formData, meetingTime: e.target.value })}
                          data-testid="input-meeting-time"
                        />
                      </div>
                      <div>
                        <Label htmlFor="duration">Duration</Label>
                        <Select
                          value={String(formData.duration || "")}
                          onValueChange={(v) => setFormData({ ...formData, duration: v })}
                        >
                          <SelectTrigger data-testid="select-duration">
                            <SelectValue placeholder="Select duration" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">15 min</SelectItem>
                            <SelectItem value="30">30 min</SelectItem>
                            <SelectItem value="45">45 min</SelectItem>
                            <SelectItem value="60">1 hour</SelectItem>
                            <SelectItem value="90">1.5 hours</SelectItem>
                            <SelectItem value="120">2 hours</SelectItem>
                            <SelectItem value="180">3 hours</SelectItem>
                            <SelectItem value="240">4 hours</SelectItem>
                            <SelectItem value="480">Full day (8 hr)</SelectItem>
                          </SelectContent>
                        </Select>
                        {formData.meetingTime && formData.duration && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Ends at{" "}
                            {(() => {
                              const [h, m] = formData.meetingTime.split(":").map(Number);
                              const endMin = h * 60 + m + Number(formData.duration);
                              return `${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
                            })()}
                          </p>
                        )}
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
                      <div className="relative mb-2">
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              value={newAttendee}
                              onChange={(e) => {
                                setNewAttendee(e.target.value);
                                setAttendeeSearchOpen(e.target.value.length > 0);
                              }}
                              onFocus={() => { if (newAttendee.length > 0) setAttendeeSearchOpen(true); }}
                              placeholder="Search by name or email..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const filteredMbrs = tenantMembers.filter(m => {
                                    const q = newAttendee.toLowerCase();
                                    return m.displayName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
                                  }).filter(m => !formData.attendees.includes(m.displayName + ' (' + m.email + ')') && !formData.attendees.includes(m.email));
                                  if (filteredMbrs.length > 0) {
                                    const member = filteredMbrs[0];
                                    const val = member.displayName + ' (' + member.email + ')';
                                    if (!formData.attendees.includes(val)) {
                                      setFormData(prev => ({ ...prev, attendees: [...prev.attendees, val] }));
                                    }
                                  } else if (newAttendee.trim()) {
                                    if (!formData.attendees.includes(newAttendee.trim())) {
                                      setFormData(prev => ({ ...prev, attendees: [...prev.attendees, newAttendee.trim()] }));
                                    }
                                  }
                                  setNewAttendee("");
                                  setAttendeeSearchOpen(false);
                                }
                                if (e.key === 'Escape') setAttendeeSearchOpen(false);
                              }}
                              className="pl-9"
                              data-testid="input-new-attendee"
                            />
                            {attendeeSearchOpen && (
                              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                {(() => {
                                  const q = newAttendee.toLowerCase();
                                  const filtered = tenantMembers.filter(m =>
                                    m.displayName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
                                  ).filter(m => !formData.attendees.includes(m.displayName + ' (' + m.email + ')') && !formData.attendees.includes(m.email));
                                  if (filtered.length > 0) {
                                    return filtered.slice(0, 8).map((member) => (
                                      <div
                                        key={member.id}
                                        className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          const val = member.displayName + ' (' + member.email + ')';
                                          if (!formData.attendees.includes(val)) {
                                            setFormData(prev => ({ ...prev, attendees: [...prev.attendees, val] }));
                                          }
                                          setNewAttendee("");
                                          setAttendeeSearchOpen(false);
                                        }}
                                        data-testid={`attendee-option-${member.id}`}
                                      >
                                        <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium truncate">{member.displayName}</div>
                                          <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                                        </div>
                                      </div>
                                    ));
                                  } else if (newAttendee.trim()) {
                                    return (
                                      <div
                                        className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          if (!formData.attendees.includes(newAttendee.trim())) {
                                            setFormData(prev => ({ ...prev, attendees: [...prev.attendees, newAttendee.trim()] }));
                                          }
                                          setNewAttendee("");
                                          setAttendeeSearchOpen(false);
                                        }}
                                        data-testid="attendee-option-custom"
                                      >
                                        <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                                        <span>Add "{newAttendee.trim()}"</span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => {
                              if (newAttendee.trim() && !formData.attendees.includes(newAttendee.trim())) {
                                setFormData(prev => ({ ...prev, attendees: [...prev.attendees, newAttendee.trim()] }));
                              }
                              setNewAttendee("");
                              setAttendeeSearchOpen(false);
                            }}
                            data-testid="button-add-attendee"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
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
                      <div className="flex gap-2 mb-3">
                        <Input
                          value={newAgendaItem}
                          onChange={(e) => setNewAgendaItem(e.target.value)}
                          placeholder="Add agenda item (or type --- Section Name --- for a header)"
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

                      <div className="space-y-1">
                        {formData.agenda.map((item, idx) => {
                          const isSection = item.startsWith('---') && item.endsWith('---');
                          const isOkrItem = item.startsWith('[OKR]');
                          const displayText = isOkrItem ? item.replace('[OKR] ', '') : item;
                          const sectionText = isSection ? item.replace(/^---\s*/, '').replace(/\s*---$/, '') : '';

                          if (isSection) {
                            return (
                              <div key={idx} className="flex items-center gap-1 py-2 mt-2 group">
                                <div className="h-px bg-border flex-1" />
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                                  {sectionText}
                                </span>
                                <div className="h-px bg-border flex-1" />
                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 ml-1">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveAgendaItem(idx, 'up')} disabled={idx === 0}><ChevronUp className="w-3 h-3" /></Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveAgendaItem(idx, 'down')} disabled={idx === formData.agenda.length - 1}><ChevronDown className="w-3 h-3" /></Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeArrayItem('agenda', idx)}><X className="w-3 h-3" /></Button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={idx} className={`flex items-center gap-2 p-2 rounded-md group hover:bg-muted/50 ${isOkrItem ? 'bg-primary/5 border border-primary/10' : ''}`}>
                              {isOkrItem ? (
                                <Target className="w-4 h-4 text-primary shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                              )}
                              <span className={`flex-1 text-sm ${isOkrItem ? 'text-primary font-medium' : ''}`}>
                                {displayText}
                              </span>
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveAgendaItem(idx, 'up')} disabled={idx === 0}><ChevronUp className="w-3 h-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveAgendaItem(idx, 'down')} disabled={idx === formData.agenda.length - 1}><ChevronDown className="w-3 h-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeArrayItem('agenda', idx)}><X className="w-3 h-3" /></Button>
                              </div>
                            </div>
                          );
                        })}
                        {formData.agenda.length === 0 && (
                          <p className="text-muted-foreground text-center py-8 text-sm">No agenda items yet. Add items above, or select a template when creating a meeting.</p>
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
                      {/* Add form */}
                      <div className="border rounded-md p-3 space-y-2 mb-3 bg-muted/30">
                        <Input
                          value={newActionItem}
                          onChange={(e) => setNewActionItem(e.target.value)}
                          placeholder="Describe the action item…"
                          onKeyDown={(e) => e.key === 'Enter' && addActionItemEntry()}
                          data-testid="input-new-action"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <div className="relative">
                            <User className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <Input
                              value={newActionAssignee}
                              onChange={(e) => setNewActionAssignee(e.target.value)}
                              placeholder="Assignee"
                              className="pl-7 text-sm"
                            />
                          </div>
                          <Input
                            type="date"
                            value={newActionDueDate}
                            onChange={(e) => setNewActionDueDate(e.target.value)}
                            className="text-sm"
                          />
                          <Select value={newActionPriority} onValueChange={(v) => setNewActionPriority(v as 'high' | 'medium' | 'low' | '')}>
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button size="sm" variant="outline" onClick={addActionItemEntry} className="w-full" data-testid="button-add-action">
                          <Plus className="w-4 h-4 mr-1" /> Add Action Item
                        </Button>
                      </div>

                      {/* List */}
                      <div className="space-y-2">
                        {formData.actionItems.map((item) => {
                          const priorityColors: Record<string, string> = {
                            high: "border-red-300 dark:border-red-700",
                            medium: "border-amber-300 dark:border-amber-700",
                            low: "border-blue-200 dark:border-blue-800",
                          };
                          const priorityBadgeColors: Record<string, string> = {
                            high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
                            medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
                            low: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
                          };
                          return (
                            <div
                              key={item.id}
                              className={`flex items-start gap-2 p-3 rounded-md border bg-card ${item.priority ? priorityColors[item.priority] : 'border-border'}`}
                            >
                              <button
                                onClick={() => toggleActionItemDone(item.id)}
                                className={`mt-0.5 h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors ${item.completed ? 'bg-green-500 border-green-500 text-white' : 'border-muted-foreground hover:border-primary'}`}
                                aria-label="Toggle complete"
                              >
                                {item.completed && <CheckCircle2 className="w-3 h-3" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                                  {item.description}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  {item.assignee && (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <User className="w-3 h-3" />{item.assignee}
                                    </span>
                                  )}
                                  {item.dueDate && (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Clock className="w-3 h-3" />{item.dueDate}
                                    </span>
                                  )}
                                  {item.priority && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityBadgeColors[item.priority]}`}>
                                      {item.priority}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeActionItem(item.id)}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          );
                        })}
                        {formData.actionItems.length === 0 && (
                          <p className="text-muted-foreground text-center py-4 text-sm">No action items yet</p>
                        )}
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
                                <span className="text-xs text-muted-foreground">
                                  {(obj as any).quarter === 0 ? 'Annual' : `Q${(obj as any).quarter}`} {(obj as any).year}
                                </span>
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
                                <span className="text-xs text-muted-foreground">
                                  {(kr as any).quarter === 0 ? 'Annual' : `Q${(kr as any).quarter}`} {(kr as any).year}
                                </span>
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
