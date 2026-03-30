import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar, Users, ArrowLeft, Target, CheckCircle2, AlertTriangle,
  Link2, Clock, Zap, ChevronRight, X, Sparkles, Copy, ClipboardCheck,
  Plus, Save, Search, User, Flag, FileText, Pencil, PlayCircle,
  Compass, ArrowUpRight, MessageSquare, ChevronDown, ChevronUp, Maximize2, Minimize2,
} from "lucide-react";
import type { ActionItem, Meeting, Objective, KeyResult, BigRock, Strategy, Foundation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { format, formatDistanceToNow } from "date-fns";
import { getMeetingQuarterYear } from "@/lib/quarters";
import { SerialCheckInDialog } from "@/components/okr/SerialCheckInDialog";
import type { CheckInQueueItem } from "@/components/okr/SerialCheckInDialog";

function getStatusColor(status: string | null | undefined) {
  switch (status) {
    case "on_track": return "bg-green-500/20 text-green-700 dark:text-green-400";
    case "at_risk": return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
    case "behind": return "bg-red-500/20 text-red-700 dark:text-red-400";
    case "completed": return "bg-blue-500/20 text-blue-700 dark:text-blue-400";
    default: return "bg-muted text-muted-foreground";
  }
}

function progressColor(p: number) {
  if (p >= 70) return "bg-green-500";
  if (p >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function statusLabel(s: string | null | undefined) {
  if (!s) return "Not started";
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function MeetingDetail() {
  const [, params] = useRoute("/focus-rhythm/:meetingId");
  const meetingId = params?.meetingId;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  const [notesText, setNotesText] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInQueue, setCheckInQueue] = useState<CheckInQueueItem[]>([]);
  const [checkInIndex, setCheckInIndex] = useState(0);
  const [activeAgendaIdx, setActiveAgendaIdx] = useState(0);
  const [showAiPrep, setShowAiPrep] = useState(false);

  const { data: meeting, isLoading: meetingLoading } = useQuery<Meeting>({
    queryKey: ['/api/meeting', meetingId],
    queryFn: async () => {
      const res = await fetch(`/api/meeting/${meetingId}`);
      if (!res.ok) throw new Error('Meeting not found');
      return res.json();
    },
    enabled: !!meetingId,
  });

  const { quarter: meetingQuarter, year: meetingYear } = getMeetingQuarterYear(meeting?.date || null);

  const { data: objectives = [] } = useQuery<Objective[]>({
    queryKey: ['/api/okr/objectives', currentTenant?.id, meetingQuarter, meetingYear],
    queryFn: async () => {
      const params = new URLSearchParams({ tenantId: currentTenant!.id, year: String(meetingYear) });
      if (meetingQuarter != null) params.set('quarter', String(meetingQuarter));
      const res = await fetch(`/api/okr/objectives?${params}`);
      return res.json();
    },
    enabled: !!currentTenant?.id,
  });

  const { data: keyResults = [] } = useQuery<KeyResult[]>({
    queryKey: ['/api/okr/key-results', currentTenant?.id, meetingQuarter, meetingYear],
    queryFn: async () => {
      const params = new URLSearchParams({ tenantId: currentTenant!.id, year: String(meetingYear) });
      if (meetingQuarter != null) params.set('quarter', String(meetingQuarter));
      const res = await fetch(`/api/okr/key-results?${params}`);
      return res.json();
    },
    enabled: !!currentTenant?.id,
  });

  const { data: bigRocks = [] } = useQuery<BigRock[]>({
    queryKey: ['/api/okr/big-rocks', currentTenant?.id, meetingQuarter, meetingYear],
    queryFn: async () => {
      const params = new URLSearchParams({ tenantId: currentTenant!.id, year: String(meetingYear) });
      if (meetingQuarter != null) params.set('quarter', String(meetingQuarter));
      const res = await fetch(`/api/okr/big-rocks?${params}`);
      return res.json();
    },
    enabled: !!currentTenant?.id,
  });

  const { data: strategies = [] } = useQuery<Strategy[]>({
    queryKey: ['/api/strategies', currentTenant?.id],
    queryFn: async () => {
      const res = await fetch(`/api/strategies/${currentTenant!.id}`);
      return res.json();
    },
    enabled: !!currentTenant?.id,
  });

  const { data: foundation } = useQuery<Foundation>({
    queryKey: [`/api/foundations/${currentTenant?.id}`],
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
      recentCheckIns: Array<{ date: string; note: string; progressChange: number }>;
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

  useEffect(() => {
    if (meeting) setNotesText(meeting.summary || "");
  }, [meeting]);

  const linkedObjectives = useMemo(() =>
    objectives.filter(o => meeting?.linkedObjectiveIds?.includes(o.id)),
    [objectives, meeting?.linkedObjectiveIds]
  );
  const linkedKeyResults = useMemo(() =>
    keyResults.filter(kr => meeting?.linkedKeyResultIds?.includes(kr.id)),
    [keyResults, meeting?.linkedKeyResultIds]
  );
  const linkedBigRocks = useMemo(() =>
    bigRocks.filter(b => meeting?.linkedBigRockIds?.includes(b.id)),
    [bigRocks, meeting?.linkedBigRockIds]
  );

  const activeStrategies = useMemo(() =>
    strategies.filter(s => s.status !== 'completed' && s.status !== 'archived'),
    [strategies]
  );

  const annualGoals = useMemo(() =>
    (foundation?.annualGoals || []).filter((g: any) => g.year === meetingYear),
    [foundation, meetingYear]
  );

  const saveNotesMutation = useMutation({
    mutationFn: async (summary: string) => {
      return apiRequest("PATCH", `/api/meetings/${meetingId}`, { summary });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meeting', meetingId] });
      toast({ title: "Notes saved" });
    },
    onError: () => {
      toast({ title: "Error saving notes", variant: "destructive" });
    },
  });

  const startCheckIn = () => {
    const inferPace = (status: string | null | undefined): "ahead" | "on_track" | "behind" | "at_risk" | "no_data" => {
      if (status === "on_track") return "on_track";
      if (status === "at_risk") return "at_risk";
      if (status === "behind") return "behind";
      return "no_data";
    };
    const isActive = (s: string | null | undefined) => s !== "completed" && s !== "cancelled";
    const queue: CheckInQueueItem[] = [
      ...linkedBigRocks
        .filter(br => isActive(br.status))
        .map(br => ({
          id: br.id,
          title: br.title,
          type: "big_rock" as const,
          daysSince: null,
          progress: (br as any).completionPercentage ?? br.progress ?? 0,
          status: br.status ?? "in_progress",
          paceStatus: inferPace(br.status),
          entityData: br,
        })),
      ...linkedKeyResults
        .filter(kr => isActive(kr.status))
        .map(kr => ({
          id: kr.id,
          title: kr.title,
          type: "key_result" as const,
          daysSince: null,
          progress: kr.progress ?? 0,
          status: kr.status ?? "not_started",
          paceStatus: inferPace(kr.status),
          entityData: kr,
        })),
      ...linkedObjectives
        .filter(o => o.parentId != null && isActive(o.status))
        .map(o => ({
          id: o.id,
          title: o.title,
          type: "objective" as const,
          daysSince: null,
          progress: o.progress ?? 0,
          status: o.status ?? "not_started",
          paceStatus: inferPace(o.status),
          entityData: o,
        })),
      ...linkedObjectives
        .filter(o => o.parentId == null && isActive(o.status))
        .map(o => ({
          id: o.id,
          title: o.title,
          type: "objective" as const,
          daysSince: null,
          progress: o.progress ?? 0,
          status: o.status ?? "not_started",
          paceStatus: inferPace(o.status),
          entityData: o,
        })),
    ];
    if (queue.length === 0) {
      toast({ title: "No items to check in", description: "All linked items are completed." });
      return;
    }
    setCheckInQueue(queue);
    setCheckInIndex(0);
    setCheckInOpen(true);
  };

  const handleCopySummary = () => {
    if (!meeting) return;
    let brief = `${meeting.title}\n${'='.repeat(meeting.title.length)}\n\n`;
    if (meeting.date) brief += `Date: ${format(new Date(meeting.date), "PPPP")}\n`;
    if (meeting.facilitator) brief += `Facilitator: ${meeting.facilitator}\n`;
    if (meeting.attendees?.length) brief += `Attendees: ${meeting.attendees.join(', ')}\n`;
    brief += '\n';
    if (meeting.agenda?.length) {
      brief += `AGENDA\n${'─'.repeat(25)}\n`;
      let n = 0;
      meeting.agenda.forEach(item => {
        const isSection = item.startsWith('---') && item.endsWith('---');
        if (isSection) {
          brief += `\n${item.replace(/^---\s*/, '').replace(/\s*---$/, '').toUpperCase()}\n`;
        } else {
          n++;
          brief += `  ${n}. ${item.replace('[OKR] ', '')}\n`;
        }
      });
      brief += '\n';
    }
    if (linkedObjectives.length > 0) {
      brief += `OBJECTIVES\n${'─'.repeat(25)}\n`;
      linkedObjectives.forEach(o => brief += `- ${o.title} [${statusLabel(o.status)} - ${Math.round(o.progress || 0)}%]\n`);
      brief += '\n';
    }
    if (linkedKeyResults.length > 0) {
      brief += `KEY RESULTS\n${'─'.repeat(25)}\n`;
      linkedKeyResults.forEach(kr => brief += `- ${kr.title} [${statusLabel(kr.status)} - ${Math.round(kr.progress || 0)}%]\n`);
      brief += '\n';
    }
    if (linkedBigRocks.length > 0) {
      brief += `BIG ROCKS\n${'─'.repeat(25)}\n`;
      linkedBigRocks.forEach(br => brief += `- ${br.title} [${statusLabel(br.status)}]\n`);
      brief += '\n';
    }
    if (notesText) brief += `NOTES\n${'─'.repeat(25)}\n${notesText}\n\n`;
    brief += `---\nGenerated from Vega Company OS\n`;

    navigator.clipboard?.writeText(brief).then(() => {
      toast({ title: "Summary copied" });
    }).catch(() => {
      toast({ title: "Copy failed", variant: "destructive" });
    });
  };

  if (meetingLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="animate-pulse space-y-4 w-full max-w-4xl px-8">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="grid grid-cols-3 gap-6">
            <div className="h-64 bg-muted rounded col-span-2" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <h1 className="text-2xl font-semibold">Meeting Not Found</h1>
        <p className="text-muted-foreground">This meeting doesn't exist or has been deleted.</p>
        <Button onClick={() => setLocation('/focus-rhythm')} data-testid="button-back-not-found">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Focus Rhythm
        </Button>
      </div>
    );
  }

  const agenda = meeting.agenda || [];
  const linkedItemCount = linkedObjectives.length + linkedKeyResults.length + linkedBigRocks.length;

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'h-full'}`}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {!isFullscreen && (
            <Button variant="ghost" size="icon" onClick={() => setLocation('/focus-rhythm')} data-testid="button-back" aria-label="Back to Focus Rhythm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate" data-testid="text-meeting-title">{meeting.title}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <Badge variant="outline" className="text-xs">{meeting.meetingType || "Meeting"}</Badge>
              {meeting.date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(meeting.date), 'EEEE, MMM d, yyyy')}
                </span>
              )}
              {(meeting as any).meetingTime && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {(meeting as any).meetingTime}
                  {(meeting as any).duration && ` (${(meeting as any).duration}min)`}
                </span>
              )}
              {meeting.facilitator && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {meeting.facilitator}
                </span>
              )}
              {meeting.attendees && meeting.attendees.length > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          {linkedItemCount > 0 && (
            <Button variant="default" size="sm" onClick={startCheckIn} data-testid="button-check-in">
              <PlayCircle className="w-4 h-4 mr-1" />
              Check In ({linkedItemCount})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowAiPrep(!showAiPrep)} data-testid="button-ai-prep">
            <Sparkles className="w-4 h-4 mr-1" />
            AI Prep
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopySummary} data-testid="button-copy-summary">
            <Copy className="w-4 h-4 mr-1" />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              saveNotesMutation.mutate(notesText);
            }}
            disabled={saveNotesMutation.isPending}
            data-testid="button-save"
          >
            <Save className="w-4 h-4 mr-1" />
            {saveNotesMutation.isPending ? "Saving..." : "Save"}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} data-testid="button-fullscreen" aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* AI Prep Panel */}
      {showAiPrep && (
        <div className="border-b px-4 py-3 bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20 shrink-0">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                AI Meeting Prep
              </h3>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => refetchPrep()} disabled={prepLoading}>
                  {prepLoading ? "Analyzing..." : "Refresh"}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setShowAiPrep(false)} aria-label="Close AI Prep" data-testid="button-close-ai-prep">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {prepLoading ? (
              <div className="animate-pulse flex gap-4">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-4 bg-muted rounded w-1/4" />
              </div>
            ) : meetingPrep ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(meetingPrep.atRiskCount > 0 || meetingPrep.behindPaceCount > 0) && (
                  <div className="col-span-full flex items-center gap-3 p-2 rounded-lg bg-amber-100/80 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    {meetingPrep.atRiskCount} at-risk, {meetingPrep.behindPaceCount} behind pace
                  </div>
                )}
                {meetingPrep.suggestedTalkingPoints.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">Suggested Talking Points</h4>
                    <ul className="space-y-1">
                      {meetingPrep.suggestedTalkingPoints.slice(0, 4).map((pt, i) => (
                        <li key={i} className="text-sm flex items-start gap-1.5">
                          <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {meetingPrep.linkedOkrs.filter(o => o.needsDiscussion).length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">Needs Discussion</h4>
                    <div className="space-y-1">
                      {meetingPrep.linkedOkrs.filter(o => o.needsDiscussion).slice(0, 4).map((okr) => (
                        <div key={okr.id} className="text-sm p-1.5 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-xs px-1">{Math.round(okr.progress)}%</Badge>
                            <span className="truncate">{okr.title}</span>
                          </div>
                          {okr.discussionReason && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{okr.discussionReason}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Click Refresh to generate AI-powered meeting prep.</p>
            )}
          </div>
        </div>
      )}

      {/* Main Content — Two Columns */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr,380px] xl:grid-cols-[1fr,420px]">

        {/* Left Panel: Agenda + Notes */}
        <div className="flex flex-col min-h-0 border-r">
          {/* Agenda Section */}
          <div className="border-b px-5 py-3 shrink-0">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Agenda
            </h2>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-5 py-3">
              {agenda.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No agenda items for this meeting.</p>
              ) : (
                <div className="space-y-0.5">
                  {agenda.map((item, idx) => {
                    const isSection = item.startsWith('---') && item.endsWith('---');
                    const isOkrItem = item.startsWith('[OKR]');
                    const displayText = isOkrItem ? item.replace('[OKR] ', '') : item;
                    const sectionText = isSection ? item.replace(/^---\s*/, '').replace(/\s*---$/, '') : '';
                    const isActive = idx === activeAgendaIdx;

                    if (isSection) {
                      return (
                        <div key={idx} className="flex items-center gap-2 pt-4 pb-1">
                          <div className="h-px bg-border flex-1" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">{sectionText}</span>
                          <div className="h-px bg-border flex-1" />
                        </div>
                      );
                    }

                    return (
                      <button
                        key={idx}
                        className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-md transition-colors ${
                          isActive ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setActiveAgendaIdx(idx)}
                        data-testid={`agenda-item-${idx}`}
                      >
                        <span className={`text-xs font-medium mt-0.5 shrink-0 w-5 text-center rounded ${
                          isActive ? 'text-primary' : 'text-muted-foreground'
                        }`}>
                          {agenda.slice(0, idx + 1).filter(a => !a.startsWith('---')).length}
                        </span>
                        {isOkrItem ? (
                          <Target className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-primary' : 'text-primary/60'}`} />
                        ) : (
                          <ChevronRight className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        )}
                        <span className={`text-sm flex-1 ${isActive ? 'font-medium' : ''} ${isOkrItem ? 'text-primary' : ''}`}>
                          {displayText}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Notes Area */}
              <div className="mt-6 pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Meeting Notes
                  </h3>
                </div>
                <Textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Capture notes, decisions, and action items during the meeting..."
                  className="min-h-[200px] text-sm"
                  data-testid="textarea-notes"
                />
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel: Linked Items + Strategic Context */}
        <div className="flex flex-col min-h-0">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-5">

              {/* Linked Objectives */}
              {linkedObjectives.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-2">
                    <Target className="w-3.5 h-3.5" />
                    Objectives ({linkedObjectives.length})
                  </h3>
                  <div className="space-y-2">
                    {linkedObjectives.map(obj => (
                      <Card key={obj.id} className="p-3 hover-elevate cursor-pointer" data-testid={`linked-obj-${obj.id}`}>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-sm font-medium leading-snug flex-1">{obj.title}</p>
                          <Badge className={`${getStatusColor(obj.status)} text-xs shrink-0`} variant="secondary">
                            {statusLabel(obj.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${progressColor(obj.progress || 0)}`} style={{ width: `${Math.min(obj.progress || 0, 100)}%` }} />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground w-8 text-right">{Math.round(obj.progress || 0)}%</span>
                        </div>
                        {obj.lastCheckInNote && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic">
                            "{obj.lastCheckInNote}"
                            {obj.lastCheckInAt && (
                              <span className="ml-1 not-italic">— {formatDistanceToNow(new Date(obj.lastCheckInAt), { addSuffix: true })}</span>
                            )}
                          </p>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Key Results */}
              {linkedKeyResults.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Key Results ({linkedKeyResults.length})
                  </h3>
                  <div className="space-y-2">
                    {linkedKeyResults.map(kr => {
                      const parentObj = objectives.find(o => o.id === kr.objectiveId);
                      return (
                        <Card key={kr.id} className="p-3 hover-elevate cursor-pointer" data-testid={`linked-kr-${kr.id}`}>
                          {parentObj && (
                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1 truncate">
                              <Target className="w-3 h-3 shrink-0" />
                              {parentObj.title}
                            </p>
                          )}
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <p className="text-sm font-medium leading-snug flex-1">{kr.title}</p>
                            <Badge className={`${getStatusColor(kr.status)} text-xs shrink-0`} variant="secondary">
                              {statusLabel(kr.status)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${progressColor(kr.progress || 0)}`} style={{ width: `${Math.min(kr.progress || 0, 100)}%` }} />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground w-8 text-right">{Math.round(kr.progress || 0)}%</span>
                          </div>
                          {(kr as any).currentValue != null && (kr as any).targetValue != null && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {(kr as any).currentValue}{(kr as any).unit ? ` ${(kr as any).unit}` : ''} / {(kr as any).targetValue}{(kr as any).unit ? ` ${(kr as any).unit}` : ''}
                            </p>
                          )}
                          {kr.lastCheckInNote && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                              "{kr.lastCheckInNote}"
                              {kr.lastCheckInAt && (
                                <span className="ml-1 not-italic">— {formatDistanceToNow(new Date(kr.lastCheckInAt), { addSuffix: true })}</span>
                              )}
                            </p>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Linked Big Rocks */}
              {linkedBigRocks.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-2">
                    <Zap className="w-3.5 h-3.5" />
                    Big Rocks ({linkedBigRocks.length})
                  </h3>
                  <div className="space-y-2">
                    {linkedBigRocks.map(br => (
                      <Card key={br.id} className="p-3 hover-elevate cursor-pointer" data-testid={`linked-br-${br.id}`}>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-sm font-medium leading-snug flex-1">{br.title}</p>
                          <Badge className={`${getStatusColor(br.status)} text-xs shrink-0`} variant="secondary">
                            {statusLabel(br.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${progressColor((br as any).completionPercentage || 0)}`}
                              style={{ width: `${Math.min((br as any).completionPercentage || 0, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground w-8 text-right">{Math.round((br as any).completionPercentage || 0)}%</span>
                        </div>
                        {br.lastCheckInNote && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                            "{br.lastCheckInNote}"
                            {br.lastCheckInAt && (
                              <span className="ml-1 not-italic">— {formatDistanceToNow(new Date(br.lastCheckInAt), { addSuffix: true })}</span>
                              )}
                          </p>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {linkedItemCount === 0 && (
                <div className="text-center py-8">
                  <Link2 className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No linked OKRs or Big Rocks</p>
                  <p className="text-xs text-muted-foreground mt-1">Link items from the Focus Rhythm page to see them here</p>
                </div>
              )}

              {/* Strategic Context */}
              {(activeStrategies.length > 0 || annualGoals.length > 0) && (
                <div className="pt-3 border-t">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
                    <Compass className="w-3.5 h-3.5" />
                    Strategic Context
                  </h3>

                  {activeStrategies.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Active Strategies</p>
                      <div className="space-y-1.5">
                        {activeStrategies.slice(0, 5).map(s => (
                          <div key={s.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/40" data-testid={`strategy-${s.id}`}>
                            <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-snug">{s.title}</p>
                              {s.owner && <p className="text-xs text-muted-foreground">{s.owner}</p>}
                            </div>
                            {s.priority && (
                              <Badge variant="outline" className="text-xs shrink-0">{s.priority}</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {annualGoals.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Annual Goals ({meetingYear})</p>
                      <div className="space-y-1.5">
                        {annualGoals.slice(0, 5).map((goal: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-2 p-2 rounded-md bg-muted/40" data-testid={`goal-${idx}`}>
                            <Flag className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-snug">{goal.title}</p>
                              {goal.description && <p className="text-xs text-muted-foreground line-clamp-1">{goal.description}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Attendees */}
              {meeting.attendees && meeting.attendees.length > 0 && (
                <div className="pt-3 border-t">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-2">
                    <Users className="w-3.5 h-3.5" />
                    Attendees ({meeting.attendees.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {meeting.attendees.map((att, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {att}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Serial Check-In Dialog */}
      {checkInOpen && checkInQueue.length > 0 && (
        <SerialCheckInDialog
          open={checkInOpen}
          queue={checkInQueue}
          currentIndex={checkInIndex}
          bigRockTasksMap={{}}
          onAdvance={() => {
            const next = checkInIndex + 1;
            if (next >= checkInQueue.length) {
              setCheckInOpen(false);
              queryClient.invalidateQueries({ queryKey: ['/api/okr/objectives'] });
              queryClient.invalidateQueries({ queryKey: ['/api/okr/key-results'] });
              queryClient.invalidateQueries({ queryKey: ['/api/okr/big-rocks'] });
              toast({ title: "Check-ins complete", description: `Updated ${checkInQueue.length} items.` });
            } else {
              setCheckInIndex(next);
            }
          }}
          onPrev={() => {
            if (checkInIndex > 0) setCheckInIndex(checkInIndex - 1);
          }}
          onClose={() => {
            setCheckInOpen(false);
            queryClient.invalidateQueries({ queryKey: ['/api/okr/objectives'] });
            queryClient.invalidateQueries({ queryKey: ['/api/okr/key-results'] });
            queryClient.invalidateQueries({ queryKey: ['/api/okr/big-rocks'] });
          }}
          tenantId={currentTenant!.id}
          quarter={meetingQuarter ?? 1}
          year={meetingYear}
        />
      )}
    </div>
  );
}
