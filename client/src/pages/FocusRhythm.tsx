import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Users, Pencil, Trash2, Plus, Target, CheckCircle2, FileText, AlertTriangle, AlertCircle, Link2, Clock, Zap, ChevronRight, ChevronDown, X, Sparkles, Search, Copy, ClipboardCheck, ExternalLink, Mail, RefreshCw, Cloud, CloudOff, CalendarCheck, Loader2, PlayCircle } from "lucide-react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import type { Meeting, Foundation, Objective, KeyResult, BigRock, MeetingTemplate, ActionItem } from "@shared/schema";
import { MEETING_TEMPLATES } from "@shared/schema";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { getQuarterDateRange, getMeetingQuarterYear } from "@/lib/quarters";
import { hasPermission, PERMISSIONS, ROLES, type Role } from "@shared/rbac";
import { useTimePeriod } from "@/contexts/TimePeriodContext";
import { SerialCheckInDialog, type CheckInQueueItem } from "@/components/okr/SerialCheckInDialog";
import { ScheduleToOutlookDialog } from "@/components/meetings/ScheduleToOutlookDialog";

interface MeetingFormData {
  title: string;
  meetingType: string;
  templateId: string;
  date: string;
  attendees: string[];
  facilitator: string;
  agenda: string[];
  summary: string;
  decisions: string[];
  actionItems: ActionItem[];
  risks: string[];
  nextMeetingDate: string;
  linkedObjectiveIds: string[];
  linkedKeyResultIds: string[];
  linkedBigRockIds: string[];
  meetingNotes: string;
  isRecurring: boolean;
  recurrencePattern: string;
  recurrenceEndDate: string;
}

const initialFormData: MeetingFormData = {
  title: "",
  meetingType: "weekly",
  templateId: "",
  date: "",
  attendees: [],
  facilitator: "",
  agenda: [],
  summary: "",
  decisions: [],
  actionItems: [],
  risks: [],
  nextMeetingDate: "",
  linkedObjectiveIds: [],
  linkedKeyResultIds: [],
  linkedBigRockIds: [],
  meetingNotes: "",
  isRecurring: false,
  recurrencePattern: "",
  recurrenceEndDate: "",
};

function TemplateSelector({ onSelect }: { onSelect: (template: MeetingTemplate) => void }) {
  const countOkrItems = (agenda: string[]) => {
    return agenda.filter(item => item.startsWith('[OKR]')).length;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {MEETING_TEMPLATES.map((template) => {
        const okrCount = countOkrItems(template.defaultAgenda);
        const hasOkrSection = okrCount > 0;
        
        return (
          <Card 
            key={template.id} 
            className="cursor-pointer hover-elevate transition-all"
            onClick={() => onSelect(template)}
            data-testid={`template-${template.id}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {template.cadence}
                  </Badge>
                  {hasOkrSection && (
                    <Badge variant="default" className="text-xs bg-primary/10 text-primary border-primary/20">
                      <Target className="w-3 h-3 mr-1" />
                      OKR Check-in
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {template.defaultDuration} min
                </div>
              </div>
              <CardTitle className="text-lg mt-2">{template.name}</CardTitle>
              <CardDescription className="text-sm">
                {template.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium">Agenda:</span> {template.defaultAgenda.length} items
                </span>
                {okrCount > 0 && (
                  <span className="text-primary">
                    <Target className="w-3 h-3 inline mr-1" />
                    {okrCount} OKR items
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
      <Card 
        className="cursor-pointer hover-elevate transition-all border-dashed"
        onClick={() => onSelect({ 
          id: 'custom', 
          name: 'Custom Meeting', 
          cadence: 'weekly', 
          defaultDuration: 60, 
          defaultAgenda: [], 
          suggestedAttendees: [], 
          description: 'Create a custom meeting' 
        })}
        data-testid="template-custom"
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs">custom</Badge>
          </div>
          <CardTitle className="text-lg mt-2">Custom Meeting</CardTitle>
          <CardDescription className="text-sm">
            Create a meeting from scratch
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Plus className="w-3 h-3" />
            Start with a blank template
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface OKRLinkingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkedObjectiveIds: string[];
  linkedKeyResultIds: string[];
  linkedBigRockIds: string[];
  onSave: (objectiveIds: string[], keyResultIds: string[], bigRockIds: string[]) => void;
  tenantId: string;
  quarter?: number;
  year?: number;
  fallbackQuarter?: number;
  fallbackYear?: number;
}

function getQuarterLabel(quarter: number | null | undefined, year: number | null | undefined): string {
  if (quarter === 0) return `Annual ${year ?? ''}`.trim();
  if (quarter) return `Q${quarter} ${year ?? ''}`.trim();
  return year ? String(year) : '';
}

function sortByPeriod<T extends { quarter?: number | null; year?: number | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const yearDiff = (b.year ?? 0) - (a.year ?? 0);
    if (yearDiff !== 0) return yearDiff;
    const aq = a.quarter ?? 999;
    const bq = b.quarter ?? 999;
    return aq - bq;
  });
}

function OKRLinkingModal({ 
  open, 
  onOpenChange, 
  linkedObjectiveIds, 
  linkedKeyResultIds, 
  linkedBigRockIds, 
  onSave,
  tenantId,
  quarter,
  year,
  fallbackQuarter,
  fallbackYear,
}: OKRLinkingModalProps) {
  const [selectedObjectives, setSelectedObjectives] = useState<string[]>(linkedObjectiveIds);
  const [selectedKeyResults, setSelectedKeyResults] = useState<string[]>(linkedKeyResultIds);
  const [selectedBigRocks, setSelectedBigRocks] = useState<string[]>(linkedBigRockIds);
  const [searchQuery, setSearchQuery] = useState('');
  
  const effectiveYear = year ?? fallbackYear;
  // Do not filter by quarter in the linking modal — show all annual AND quarterly
  // objectives for the year so users aren't blocked by their global period mode.
  const periodParams = effectiveYear ? `&year=${effectiveYear}` : '';
  
  const { data: rawObjectives = [] } = useQuery<Objective[]>({
    queryKey: ['/api/okr/objectives', tenantId, effectiveYear],
    queryFn: async () => {
      const res = await fetch(`/api/okr/objectives?tenantId=${tenantId}${periodParams}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && !!tenantId,
  });
  const objectives = sortByPeriod(rawObjectives);
  
  const { data: rawBigRocks = [] } = useQuery<BigRock[]>({
    queryKey: ['/api/okr/big-rocks', tenantId, effectiveYear],
    queryFn: async () => {
      const res = await fetch(`/api/okr/big-rocks?tenantId=${tenantId}${periodParams}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && !!tenantId,
  });
  const bigRocks = sortByPeriod(rawBigRocks);
  
  const { data: hierarchyData } = useQuery<any[]>({
    queryKey: ['/api/okr/hierarchy', tenantId, effectiveYear],
    queryFn: async () => {
      const res = await fetch(`/api/okr/hierarchy?tenantId=${tenantId}${periodParams}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && !!tenantId,
  });

  const { data: teams = [] } = useQuery<any[]>({
    queryKey: ['/api/okr/teams', tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/okr/teams?tenantId=${tenantId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && !!tenantId,
  });
  const teamMap = Object.fromEntries(teams.map((t: any) => [t.id, t.name]));
  
  const keyResults: KeyResult[] = hierarchyData?.flatMap((obj: any) => obj.keyResults || []) || [];
  // Map KR id → parent objective title for context display
  const krParentMap: Record<string, string> = {};
  (hierarchyData || []).forEach((obj: any) => {
    (obj.keyResults || []).forEach((kr: any) => { krParentMap[kr.id] = obj.title; });
  });
  
  useEffect(() => {
    setSelectedObjectives(linkedObjectiveIds);
    setSelectedKeyResults(linkedKeyResultIds);
    setSelectedBigRocks(linkedBigRockIds);
  }, [linkedObjectiveIds, linkedKeyResultIds, linkedBigRockIds]);

  // Reset search when modal opens
  useEffect(() => { if (open) setSearchQuery(''); }, [open]);

  const q = searchQuery.toLowerCase();
  const rawFilteredObjectives = q ? objectives.filter(o => o.title.toLowerCase().includes(q) || o.ownerEmail?.toLowerCase().includes(q)) : objectives;
  const filteredKeyResults = q ? keyResults.filter(kr => kr.title.toLowerCase().includes(q) || krParentMap[kr.id]?.toLowerCase().includes(q)) : keyResults;
  const filteredBigRocks = q ? bigRocks.filter(b => b.title.toLowerCase().includes(q)) : bigRocks;

  const filteredObjectives = useMemo(() => {
    const list = rawFilteredObjectives;
    const idSet = new Set(list.map(o => o.id));
    const roots: typeof list = [];
    const childrenOf: Record<string, typeof list> = {};
    for (const o of list) {
      const pid = (o as any).parentId;
      if (!pid || !idSet.has(pid)) {
        roots.push(o);
      } else {
        (childrenOf[pid] ??= []).push(o);
      }
    }
    const result: typeof list = [];
    const addWithChildren = (obj: (typeof list)[0], depth: number) => {
      (obj as any)._depth = depth;
      result.push(obj);
      for (const child of childrenOf[obj.id] || []) {
        addWithChildren(child, depth + 1);
      }
    };
    for (const root of roots) addWithChildren(root, 0);
    return result;
  }, [rawFilteredObjectives]);

  const levelLabel = (level?: string | null) => {
    if (level === 'organization') return 'Org';
    if (level === 'team') return 'Team';
    if (level === 'individual') return 'Individual';
    return level ?? '';
  };
  const statusColor = (status?: string | null) => {
    if (status === 'on_track' || status === 'completed') return 'text-green-600 dark:text-green-400';
    if (status === 'at_risk') return 'text-amber-600 dark:text-amber-400';
    if (status === 'behind') return 'text-red-500 dark:text-red-400';
    return 'text-muted-foreground';
  };
  
  const toggleObjective = (id: string) => {
    setSelectedObjectives(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };
  
  const toggleKeyResult = (id: string) => {
    setSelectedKeyResults(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };
  
  const toggleBigRock = (id: string) => {
    setSelectedBigRocks(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };
  
  const handleSave = () => {
    onSave(selectedObjectives, selectedKeyResults, selectedBigRocks);
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Link OKRs &amp; Big Rocks</DialogTitle>
          <DialogDescription>
            Select objectives, key results, and initiatives to discuss in this meeting
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search by title, owner, or parent…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            data-testid="input-okr-search"
          />
        </div>
        
        <Tabs defaultValue="objectives" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-3 w-full shrink-0">
            <TabsTrigger value="objectives" data-testid="tab-link-objectives">
              Objectives {selectedObjectives.length > 0 && <span className="ml-1 text-xs opacity-70">({selectedObjectives.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="keyresults" data-testid="tab-link-keyresults">
              Key Results {selectedKeyResults.length > 0 && <span className="ml-1 text-xs opacity-70">({selectedKeyResults.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="bigrocks" data-testid="tab-link-bigrocks">
              Big Rocks {selectedBigRocks.length > 0 && <span className="ml-1 text-xs opacity-70">({selectedBigRocks.length})</span>}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="objectives" className="flex-1 mt-3 min-h-0">
            <ScrollArea className="h-72 rounded-md border">
              {filteredObjectives.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-20 text-sm text-muted-foreground gap-1">
                  <Target className="w-4 h-4" />
                  {q ? 'No objectives match your search' : 'No objectives found for this period'}
                </div>
              ) : filteredObjectives.map((obj) => {
                const depth = (obj as any)._depth || 0;
                return (
                <label
                  key={obj.id}
                  className="flex items-start gap-3 py-2.5 hover:bg-muted/50 cursor-pointer border-b last:border-0"
                  style={{ paddingLeft: `${12 + depth * 20}px`, paddingRight: 12 }}
                  data-testid={`row-objective-${obj.id}`}
                >
                  <Checkbox
                    checked={selectedObjectives.includes(obj.id)}
                    onCheckedChange={() => toggleObjective(obj.id)}
                    className="mt-0.5 shrink-0"
                    data-testid={`checkbox-objective-${obj.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-snug">
                      {depth > 0 && <span className="text-muted-foreground mr-1">↳</span>}
                      {obj.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-muted-foreground">{getQuarterLabel(obj.quarter, obj.year)}</span>
                      {obj.level && <span className="text-xs text-muted-foreground">{levelLabel(obj.level)}</span>}
                      {obj.teamId && teamMap[obj.teamId] && <span className="text-xs text-muted-foreground">{teamMap[obj.teamId]}</span>}
                      {obj.ownerEmail && !obj.teamId && <span className="text-xs text-muted-foreground truncate max-w-[160px]">{obj.ownerEmail}</span>}
                      <span className={`text-xs font-medium ${statusColor(obj.status)}`}>
                        {obj.progress != null ? `${obj.progress.toFixed(0)}%` : ''}{obj.status ? ` · ${obj.status.replace(/_/g, ' ')}` : ''}
                      </span>
                    </div>
                  </div>
                </label>
              );
              })}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="keyresults" className="flex-1 mt-3 min-h-0">
            <ScrollArea className="h-72 rounded-md border">
              {filteredKeyResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-20 text-sm text-muted-foreground gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {q ? 'No key results match your search' : 'No key results found'}
                </div>
              ) : filteredKeyResults.map((kr) => (
                <label
                  key={kr.id}
                  className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer border-b last:border-0"
                  data-testid={`row-keyresult-${kr.id}`}
                >
                  <Checkbox
                    checked={selectedKeyResults.includes(kr.id)}
                    onCheckedChange={() => toggleKeyResult(kr.id)}
                    className="mt-0.5 shrink-0"
                    data-testid={`checkbox-keyresult-${kr.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-snug">{kr.title}</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      {krParentMap[kr.id] && <span className="text-xs text-muted-foreground truncate max-w-xs">{krParentMap[kr.id]}</span>}
                      {(kr.currentValue != null || kr.targetValue != null) && (
                        <span className="text-xs text-muted-foreground">
                          {kr.currentValue ?? '—'} / {kr.targetValue ?? '—'}{kr.unit ? ` ${kr.unit}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="bigrocks" className="flex-1 mt-3 min-h-0">
            <ScrollArea className="h-72 rounded-md border">
              {filteredBigRocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-20 text-sm text-muted-foreground gap-1">
                  <Target className="w-4 h-4" />
                  {q ? 'No big rocks match your search' : 'No big rocks found for this period'}
                </div>
              ) : filteredBigRocks.map((rock) => (
                <label
                  key={rock.id}
                  className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer border-b last:border-0"
                  data-testid={`row-bigrock-${rock.id}`}
                >
                  <Checkbox
                    checked={selectedBigRocks.includes(rock.id)}
                    onCheckedChange={() => toggleBigRock(rock.id)}
                    className="mt-0.5 shrink-0"
                    data-testid={`checkbox-bigrock-${rock.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-snug">{rock.title}</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-muted-foreground">{getQuarterLabel(rock.quarter, rock.year)}</span>
                      {rock.ownerEmail && <span className="text-xs text-muted-foreground truncate max-w-[160px]">{rock.ownerEmail}</span>}
                      {rock.status && <span className={`text-xs font-medium ${statusColor(rock.status)}`}>{rock.status.replace(/_/g, ' ')}</span>}
                    </div>
                  </div>
                </label>
              ))}
            </ScrollArea>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} data-testid="button-save-links">
            Save Links
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


interface MeetingCardProps {
  meeting: Meeting;
  onEdit: (meeting: Meeting) => void;
  onDelete: (meeting: Meeting) => void;
  canDelete: boolean;
  objectives: Objective[];
  keyResults: KeyResult[];
  bigRocks: BigRock[];
  onCopyBrief: (meeting: Meeting) => void;
  outlookConnected?: boolean;
  onSyncToOutlook?: (meetingId: string, startDateTime?: string, durationMinutes?: number, meetingTime?: string) => void;
  onSendSummary?: (meetingId: string) => void;
  isSyncing?: boolean;
  isSendingSummary?: boolean;
  tenantId?: string;
  userId?: string;
  userEmail?: string;
  quarter?: number | null;
  year?: number;
}

function MeetingCard({ meeting, onEdit, onDelete, canDelete, objectives, keyResults, bigRocks, onCopyBrief, outlookConnected, onSyncToOutlook, onSendSummary, isSyncing, isSendingSummary, tenantId, userId, userEmail, quarter, year }: MeetingCardProps) {
  const { toast } = useToast();
  const linkedObjectives = objectives.filter(o => 
    meeting.linkedObjectiveIds?.includes(o.id)
  );
  const linkedKeyResults = keyResults.filter(kr => 
    meeting.linkedKeyResultIds?.includes(kr.id)
  );
  const linkedBigRocks = bigRocks.filter(b => 
    meeting.linkedBigRockIds?.includes(b.id)
  );

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [checkInQueueOpen, setCheckInQueueOpen] = useState(false);
  const [checkInQueue, setCheckInQueue] = useState<CheckInQueueItem[]>([]);
  const [checkInQueueIndex, setCheckInQueueIndex] = useState(0);
  const [linkedItemsExpanded, setLinkedItemsExpanded] = useState(false);

  const linkedItemCount = linkedObjectives.length + linkedKeyResults.length + linkedBigRocks.length;

  const startMeetingCheckIn = () => {
    // Bottom-up: Big Rocks → Key Results → Child Objectives → Root Objectives
    const queue: CheckInQueueItem[] = [
      ...linkedBigRocks
        .filter(br => br.status !== "completed" && br.status !== "cancelled")
        .map(br => ({
          id: br.id,
          title: br.title,
          type: "big_rock" as const,
          daysSince: null,
          progress: (br as any).completionPercentage ?? br.progress ?? 0,
          status: br.status ?? "in_progress",
          paceStatus: "no_data" as const,
          entityData: br,
        })),
      ...linkedKeyResults
        .filter(kr => kr.status !== "completed" && kr.status !== "cancelled")
        .map(kr => ({
          id: kr.id,
          title: kr.title,
          type: "key_result" as const,
          daysSince: null,
          progress: kr.progress ?? 0,
          status: kr.status ?? "in_progress",
          paceStatus: "no_data" as const,
          entityData: kr,
        })),
      // Child objectives before root objectives
      ...linkedObjectives
        .filter(o => o.status !== "completed" && o.status !== "cancelled" && (o as any).parentId)
        .map(o => ({
          id: o.id,
          title: o.title,
          type: "objective" as const,
          daysSince: null,
          progress: o.progress ?? 0,
          status: o.status ?? "in_progress",
          paceStatus: "no_data" as const,
          entityData: o,
        })),
      ...linkedObjectives
        .filter(o => o.status !== "completed" && o.status !== "cancelled" && !(o as any).parentId)
        .map(o => ({
          id: o.id,
          title: o.title,
          type: "objective" as const,
          daysSince: null,
          progress: o.progress ?? 0,
          status: o.status ?? "in_progress",
          paceStatus: "no_data" as const,
          entityData: o,
        })),
    ];
    if (queue.length === 0) return;
    setCheckInQueue(queue);
    setCheckInQueueIndex(0);
    setCheckInQueueOpen(true);
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
  
  return (
    <Card data-testid={`meeting-card-${meeting.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={getMeetingTypeVariant(meeting.meetingType || '')}>
                {meeting.meetingType}
              </Badge>
              {meeting.templateId && meeting.templateId !== 'custom' && (
                <Badge variant="outline" className="text-xs">
                  <FileText className="w-3 h-3 mr-1" />
                  Template
                </Badge>
              )}
              {(meeting as any).syncStatus === 'synced' && (
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                  <Cloud className="w-3 h-3 mr-1" />
                  Outlook
                </Badge>
              )}
              {(meeting as any).syncStatus === 'error' && (
                <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/30">
                  <CloudOff className="w-3 h-3 mr-1" />
                  Sync Error
                </Badge>
              )}
              {(meeting as any).summaryEmailStatus === 'sent' && (
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
                  <Mail className="w-3 h-3 mr-1" />
                  Summary Sent
                </Badge>
              )}
              {meeting.isRecurring && (
                <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/30">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  {meeting.recurrencePattern || 'Recurring'}
                </Badge>
              )}
            </div>
            <Link href={`/focus-rhythm/${meeting.id}`}>
              <CardTitle className="mt-2 text-xl hover:text-primary cursor-pointer transition-colors">
                {meeting.title}
              </CardTitle>
            </Link>
            <CardDescription className="mt-1">
              <div className="flex items-center gap-4 flex-wrap">
                {meeting.date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(meeting.date), "PPP")}
                  </span>
                )}
                {meeting.facilitator && (
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {meeting.facilitator}
                  </span>
                )}
              </div>
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Link href={`/focus-rhythm/${meeting.id}`}>
              <Button 
                variant="ghost" 
                size="icon"
                title="Open meeting dashboard"
                data-testid={`button-open-meeting-${meeting.id}`}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              title={outlookConnected ? "Schedule in Outlook" : "Connect Outlook in Settings to schedule"}
              data-testid={`button-schedule-outlook-${meeting.id}`}
              onClick={() => {
                if (outlookConnected) {
                  setScheduleDialogOpen(true);
                } else {
                  toast({
                    title: "Outlook not connected",
                    description: "Go to Settings → M365 Integration to connect your Outlook account.",
                    variant: "destructive",
                  });
                }
              }}
            >
              <CalendarCheck className={`w-4 h-4 ${!outlookConnected ? "opacity-40" : ""}`} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => onCopyBrief(meeting)}
              title="Copy meeting brief"
              data-testid={`button-copy-brief-${meeting.id}`}
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => onEdit(meeting)}
              data-testid={`button-edit-meeting-${meeting.id}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            {canDelete && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => onDelete(meeting)}
                data-testid={`button-delete-meeting-${meeting.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {(linkedObjectives.length > 0 || linkedKeyResults.length > 0 || linkedBigRocks.length > 0) && (
          <div className="space-y-2">
            {/* Collapsed summary row — always visible */}
            <button
              className="w-full flex items-center gap-3 p-2 rounded-md hover-elevate text-left"
              onClick={() => setLinkedItemsExpanded(prev => !prev)}
              data-testid={`button-toggle-linked-items-${meeting.id}`}
            >
              <div className="flex items-center gap-2 flex-1 flex-wrap">
                {linkedObjectives.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Target className="w-3.5 h-3.5" />
                    {linkedObjectives.length} {linkedObjectives.length === 1 ? 'objective' : 'objectives'}
                  </span>
                )}
                {linkedKeyResults.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {linkedKeyResults.length} {linkedKeyResults.length === 1 ? 'key result' : 'key results'}
                  </span>
                )}
                {linkedBigRocks.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Zap className="w-3.5 h-3.5" />
                    {linkedBigRocks.length} {linkedBigRocks.length === 1 ? 'big rock' : 'big rocks'}
                  </span>
                )}
                {/* Mini aggregate progress bar */}
                {(() => {
                  const allProgresses = [
                    ...linkedObjectives.map(o => o.progress || 0),
                    ...linkedKeyResults.map(kr => kr.progress || 0),
                    ...linkedBigRocks.map(br => br.completionPercentage || 0),
                  ];
                  const avg = allProgresses.length > 0 ? Math.round(allProgresses.reduce((a, b) => a + b, 0) / allProgresses.length) : 0;
                  const barColor = avg >= 70 ? 'bg-green-500' : avg >= 40 ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <div className="flex items-center gap-1.5 ml-1">
                      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(avg, 100)}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{avg}%</span>
                    </div>
                  );
                })()}
              </div>
              {linkedItemsExpanded
                ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              }
            </button>

            {/* Expanded full list */}
            {linkedItemsExpanded && (
              <div className="space-y-2 pt-1">
                {linkedObjectives.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-medium">Linked Objectives</div>
                    {linkedObjectives.map(obj => {
                      const progress = obj.progress || 0;
                      const statusColor = progress >= 70 ? 'text-green-600' : progress >= 40 ? 'text-amber-600' : 'text-red-600';
                      const bgColor = progress >= 70 ? 'bg-green-500' : progress >= 40 ? 'bg-amber-500' : 'bg-red-500';
                      return (
                        <div key={obj.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                          <Target className="w-4 h-4 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{obj.title}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div className={`h-full ${bgColor} transition-all`} style={{ width: `${Math.min(progress, 100)}%` }} />
                              </div>
                              <span className={`text-xs font-medium ${statusColor}`}>{progress}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {linkedKeyResults.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-medium">Linked Key Results</div>
                    {linkedKeyResults.map(kr => {
                      const progress = kr.progress || 0;
                      const statusColor = progress >= 70 ? 'text-green-600' : progress >= 40 ? 'text-amber-600' : 'text-red-600';
                      const bgColor = progress >= 70 ? 'bg-green-500' : progress >= 40 ? 'bg-amber-500' : 'bg-red-500';
                      return (
                        <div key={kr.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{kr.title}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div className={`h-full ${bgColor} transition-all`} style={{ width: `${Math.min(progress, 100)}%` }} />
                              </div>
                              <span className={`text-xs font-medium ${statusColor}`}>{progress}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {linkedBigRocks.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-medium">Linked Big Rocks</div>
                    {linkedBigRocks.map(rock => {
                      const progress = rock.completionPercentage || 0;
                      const statusColor = progress >= 70 ? 'text-green-600' : progress >= 40 ? 'text-amber-600' : 'text-red-600';
                      const bgColor = progress >= 70 ? 'bg-green-500' : progress >= 40 ? 'bg-amber-500' : 'bg-red-500';
                      return (
                        <div key={rock.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                          <Zap className="w-4 h-4 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{rock.title}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div className={`h-full ${bgColor} transition-all`} style={{ width: `${Math.min(progress, 100)}%` }} />
                              </div>
                              <span className={`text-xs font-medium ${statusColor}`}>{progress}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {meeting.summary && (
          <div>
            <div className="text-sm font-medium mb-1">Summary</div>
            <p className="text-sm text-muted-foreground">{meeting.summary}</p>
          </div>
        )}
        
        {meeting.agenda && meeting.agenda.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-1">Agenda</div>
            <ul className="text-sm text-muted-foreground space-y-1">
              {meeting.agenda
                .filter(item => !(item.startsWith('---') && item.endsWith('---')))
                .slice(0, 3)
                .map((item, i) => {
                  const isOkr = item.startsWith('[OKR]');
                  const text = isOkr ? item.replace('[OKR] ', '') : item;
                  return (
                    <li key={i} className="flex items-start gap-2">
                      {isOkr
                        ? <Target className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary" />
                        : <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      }
                      {text}
                    </li>
                  );
                })}
              {meeting.agenda.filter(i => !(i.startsWith('---') && i.endsWith('---'))).length > 3 && (
                <li className="text-xs text-muted-foreground">
                  +{meeting.agenda.filter(i => !(i.startsWith('---') && i.endsWith('---'))).length - 3} more items
                </li>
              )}
            </ul>
          </div>
        )}
        
        <div className="flex flex-wrap gap-4 text-sm">
          {meeting.decisions && meeting.decisions.length > 0 && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              {meeting.decisions.length} decision{meeting.decisions.length !== 1 ? 's' : ''}
            </div>
          )}
          {meeting.actionItems && meeting.actionItems.length > 0 && (
            <div className="flex items-center gap-1">
              <Target className="w-4 h-4 text-blue-500" />
              {meeting.actionItems.length} action item{meeting.actionItems.length !== 1 ? 's' : ''}
            </div>
          )}
          {meeting.risks && meeting.risks.length > 0 && (
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              {meeting.risks.length} risk{meeting.risks.length !== 1 ? 's' : ''}
            </div>
          )}
          {meeting.attendees && meeting.attendees.length > 0 && (
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="pt-0 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {meeting.nextMeetingDate && (
            <span className="text-xs text-muted-foreground">Next meeting: {format(new Date(meeting.nextMeetingDate), "PPP")}</span>
          )}
          {linkedItemCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={startMeetingCheckIn}
              data-testid={`button-checkin-meeting-${meeting.id}`}
            >
              <PlayCircle className="w-4 h-4 mr-1.5" />
              Check In ({linkedItemCount} item{linkedItemCount !== 1 ? "s" : ""})
            </Button>
          )}
        </div>
        
        {outlookConnected && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScheduleDialogOpen(true)}
              disabled={isSyncing}
              data-testid={`button-sync-outlook-${meeting.id}`}
            >
              {isSyncing ? (
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Cloud className="w-4 h-4 mr-1" />
              )}
              {(meeting as any).syncStatus === 'synced' ? 'Re-sync to Outlook' : 'Schedule to Outlook'}
            </Button>
            {meeting.summary && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSendSummary?.(meeting.id)}
                disabled={isSendingSummary}
                data-testid={`button-send-summary-${meeting.id}`}
              >
                {isSendingSummary ? (
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 mr-1" />
                )}
                Send Summary
              </Button>
            )}
          </div>
        )}
      </CardFooter>
      <ScheduleToOutlookDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        meeting={meeting}
        onConfirm={(startDateTime, durationMinutes, meetingTime) => {
          onSyncToOutlook?.(meeting.id, startDateTime, durationMinutes, meetingTime);
        }}
        isSyncing={isSyncing}
      />
      {checkInQueueOpen && checkInQueue.length > 0 && (
        <SerialCheckInDialog
          open={checkInQueueOpen}
          queue={checkInQueue}
          currentIndex={checkInQueueIndex}
          bigRockTasksMap={{}}
          onAdvance={() => {
            const next = checkInQueueIndex + 1;
            if (next >= checkInQueue.length) {
              setCheckInQueueOpen(false);
            } else {
              setCheckInQueueIndex(next);
            }
          }}
          onPrev={() => setCheckInQueueIndex(i => Math.max(0, i - 1))}
          onClose={() => setCheckInQueueOpen(false)}
          tenantId={tenantId ?? ""}
          userId={userId}
          userEmail={userEmail}
          quarter={quarter ?? 1}
          year={year ?? new Date().getFullYear()}
        />
      )}
    </Card>
  );
}

export default function FocusRhythm() {
  const { toast } = useToast();
  const { currentTenant, isLoading: tenantLoading } = useTenant();
  const { user } = useAuth();
  const userRole = (user?.role || ROLES.TENANT_USER) as Role;
  const canDeleteMeeting = hasPermission(userRole, PERMISSIONS.DELETE_MEETING);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [linkingModalOpen, setLinkingModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [outlookImportDialogOpen, setOutlookImportDialogOpen] = useState(false);
  const [aiRecapResult, setAiRecapResult] = useState<{
    actionItems: Array<{ description: string; assignee?: string; dueDate?: string; priority?: string }>;
    decisions: Array<{ description: string; rationale?: string; owner?: string }>;
    blockers: Array<{ description: string; impact?: string; suggestedResolution?: string }>;
    summary: string;
    keyTakeaways: string[];
  } | null>(null);
  const [isAnalyzingNotes, setIsAnalyzingNotes] = useState(false);
  const [isGeneratingAgenda, setIsGeneratingAgenda] = useState(false);
  
  const { quarter, year, isAnnual } = useTimePeriod();
  const [openQuarters, setOpenQuarters] = useState<number[]>([1, 2, 3, 4]);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [listScheduleOpen, setListScheduleOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [newlyCreatedMeetingId, setNewlyCreatedMeetingId] = useState<string | null>(null);
  const [postCreateScheduleOpen, setPostCreateScheduleOpen] = useState(false);
  const [postCreateMeetingData, setPostCreateMeetingData] = useState<Meeting | null>(null);
  const [formData, setFormData] = useState<MeetingFormData>(initialFormData);
  const [newAttendeeInput, setNewAttendeeInput] = useState("");
  const [newAgendaInput, setNewAgendaInput] = useState("");
  const [newDecisionInput, setNewDecisionInput] = useState("");
  const [newActionInput, setNewActionInput] = useState("");
  const [newRiskInput, setNewRiskInput] = useState("");
  const [attendeeSearchOpen, setAttendeeSearchOpen] = useState(false);
  
  const { data: foundation } = useQuery<Foundation>({
    queryKey: [`/api/foundations/${currentTenant?.id}`],
    enabled: !!currentTenant?.id,
  });
  
  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: [`/api/meetings/${currentTenant?.id}`],
    enabled: !!currentTenant?.id,
  });
  
  const { data: objectives = [] } = useQuery<Objective[]>({
    queryKey: ['/api/okr/objectives', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const res = await fetch(`/api/okr/objectives?tenantId=${currentTenant.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentTenant?.id,
  });
  
  const { data: bigRocks = [] } = useQuery<BigRock[]>({
    queryKey: ['/api/okr/big-rocks', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const res = await fetch(`/api/okr/big-rocks?tenantId=${currentTenant.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentTenant?.id,
  });

  const { data: allHierarchyData } = useQuery<any[]>({
    queryKey: ['/api/okr/hierarchy', currentTenant?.id, 'all'],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const res = await fetch(`/api/okr/hierarchy?tenantId=${currentTenant.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentTenant?.id,
  });
  const keyResults: KeyResult[] = allHierarchyData?.flatMap((obj: any) => obj.keyResults || []) || [];
  
  const { data: outlookStatus } = useQuery<{ connected: boolean; user: { displayName: string; email: string } | null }>({
    queryKey: ['/api/m365/status'],
    staleTime: 0,
    queryFn: async () => {
      const res = await fetch('/api/m365/status');
      if (res.status === 401) {
        return { connected: false, user: null };
      }
      if (!res.ok) {
        return { connected: false, user: null };
      }
      return res.json();
    },
  });
  
  const { data: calendarEvents = [], isLoading: calendarEventsLoading } = useQuery<any[]>({
    queryKey: ['/api/m365/calendar/events'],
    enabled: outlookStatus?.connected && outlookImportDialogOpen,
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);
      const res = await fetch(`/api/m365/calendar/events?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
      if (!res.ok) return [];
      return res.json();
    },
  });
  
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

  const syncToOutlookMutation = useMutation({
    mutationFn: async ({ meetingId, startDateTime, durationMinutes, meetingTime }: { meetingId: string; startDateTime?: string; durationMinutes?: number; meetingTime?: string }) => {
      const body: Record<string, any> = {};
      if (durationMinutes) body.durationMinutes = durationMinutes;
      if (startDateTime) body.startDateTime = startDateTime;
      if (meetingTime) body.meetingTime = meetingTime;
      const res = await apiRequest('POST', `/api/m365/meetings/${meetingId}/sync`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${currentTenant?.id}`] });
      toast({ title: "Scheduled to Outlook", description: "Meeting has been added to your Outlook calendar." });
    },
    onError: (error: any) => {
      toast({ title: "Sync Failed", description: error.message || "Failed to schedule meeting to Outlook.", variant: "destructive" });
    },
  });
  
  const sendSummaryMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      const res = await apiRequest('POST', `/api/m365/meetings/${meetingId}/send-summary`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${currentTenant?.id}`] });
      toast({ title: "Summary Sent", description: `Email sent to ${data.recipientCount} recipients.` });
    },
    onError: (error: any) => {
      toast({ title: "Email Failed", description: error.message || "Failed to send meeting summary.", variant: "destructive" });
    },
  });

  const dateToNoonISO = (dateStr: string | undefined | null) => {
    if (!dateStr) return null;
    return new Date(`${dateStr}T12:00:00`).toISOString();
  };

  const createMutation = useMutation({
    mutationFn: async (data: MeetingFormData) => {
      const seriesId = data.isRecurring ? crypto.randomUUID() : undefined;
      const res = await apiRequest("POST", "/api/meetings", {
        tenantId: currentTenant?.id,
        ...data,
        date: dateToNoonISO(data.date),
        nextMeetingDate: dateToNoonISO(data.nextMeetingDate),
        recurrenceEndDate: dateToNoonISO(data.recurrenceEndDate),
        recurrencePattern: data.recurrencePattern || null,
        seriesId,
        updatedBy: "Current User",
      });
      return res.json();
    },
    onSuccess: (created: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${currentTenant?.id}`] });
      setCreateDialogOpen(false);
      setShowTemplateSelector(false);
      resetForm();
      if (outlookStatus?.connected && created?.id) {
        setNewlyCreatedMeetingId(created.id);
        setPostCreateMeetingData(created as Meeting);
      } else {
        toast({
          title: "Meeting Created",
          description: "Successfully created new meeting",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error Creating Meeting",
        description: error?.message?.includes('409') || error?.message?.includes('unique')
          ? "A meeting with this title and date already exists."
          : (error?.message || "Failed to create meeting"),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MeetingFormData> }) => {
      return apiRequest("PATCH", `/api/meetings/${id}`, {
        ...data,
        date: data.date ? dateToNoonISO(data.date) : undefined,
        nextMeetingDate: data.nextMeetingDate ? dateToNoonISO(data.nextMeetingDate) : undefined,
        recurrenceEndDate: data.recurrenceEndDate ? dateToNoonISO(data.recurrenceEndDate) : undefined,
        recurrencePattern: data.recurrencePattern || null,
        updatedBy: "Current User",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${currentTenant?.id}`] });
      setEditDialogOpen(false);
      setSelectedMeeting(null);
      toast({
        title: "Meeting Updated",
        description: "Successfully updated meeting",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error Saving Meeting",
        description: error?.message?.includes('403')
          ? "You don't have permission to edit this meeting."
          : (error?.message || "Failed to update meeting"),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/meetings/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${currentTenant?.id}`] });
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

  // Wait for tenant to load - placed AFTER all hooks
  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show message if user has no tenant access
  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Organization Access</h2>
          <p className="text-muted-foreground">
            Your account is not yet associated with an organization. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  const resetForm = () => {
    setFormData(initialFormData);
    setAiRecapResult(null);
    setNewAttendeeInput("");
    setNewAgendaInput("");
    setNewDecisionInput("");
    setNewActionInput("");
    setNewRiskInput("");
    setAttendeeSearchOpen(false);
  };

  const handleAnalyzeNotes = async () => {
    if (!formData.meetingNotes || formData.meetingNotes.length < 20) {
      toast({
        title: "Notes too short",
        description: "Please add more meeting notes to analyze (at least 20 characters).",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzingNotes(true);
    setAiRecapResult(null);

    try {
      const linkedOKRs: Array<{ type: string; title: string }> = [];
      formData.linkedObjectiveIds.forEach(id => {
        const obj = objectives.find(o => o.id === id);
        if (obj) linkedOKRs.push({ type: "Objective", title: obj.title });
      });
      formData.linkedBigRockIds.forEach(id => {
        const rock = bigRocks.find(b => b.id === id);
        if (rock) linkedOKRs.push({ type: "Big Rock", title: rock.title });
      });

      const res = await apiRequest("POST", "/api/ai/parse-meeting-recap", {
        meetingNotes: formData.meetingNotes,
        tenantId: currentTenant.id,
        meetingTitle: formData.title || "Untitled Meeting",
        meetingType: formData.meetingType,
        linkedOKRs,
      });

      const result = await res.json();
      setAiRecapResult(result);
      
      toast({
        title: "Notes analyzed",
        description: `Found ${result.actionItems.length} action items, ${result.decisions.length} decisions, ${result.blockers.length} blockers.`,
      });
    } catch (error: any) {
      toast({
        title: "Analysis failed",
        description: error.message || "Failed to analyze meeting notes",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzingNotes(false);
    }
  };

  const handleGenerateAgenda = async () => {
    if (!currentTenant?.id) return;
    setIsGeneratingAgenda(true);
    try {
      const linkedOKRs: Array<{ type: string; title: string; status?: string; progress?: number }> = [];
      formData.linkedObjectiveIds.forEach(id => {
        const obj = objectives.find(o => o.id === id);
        if (obj) linkedOKRs.push({ type: "Objective", title: obj.title, status: obj.status || undefined, progress: obj.progress ?? undefined });
      });
      formData.linkedBigRockIds.forEach(id => {
        const rock = bigRocks.find(b => b.id === id);
        if (rock) linkedOKRs.push({ type: "Big Rock", title: rock.title, status: rock.status || undefined, progress: rock.completionPercentage ?? undefined });
      });

      const atRiskItems: string[] = [
        ...objectives.filter(o => o.status === 'at_risk' || o.status === 'behind').map(o => `Objective: ${o.title} (${o.progress ?? 0}%)`),
        ...bigRocks.filter(b => b.status === 'at_risk' || b.status === 'behind').map(b => `Big Rock: ${b.title}`),
      ];

      const res = await apiRequest("POST", "/api/ai/generate-agenda", {
        meetingType: formData.meetingType || 'weekly',
        meetingTitle: formData.title || undefined,
        tenantId: currentTenant.id,
        linkedOKRs: linkedOKRs.length > 0 ? linkedOKRs : undefined,
        atRiskItems: atRiskItems.length > 0 ? atRiskItems : undefined,
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to generate agenda');

      setFormData(prev => ({
        ...prev,
        agenda: [...prev.agenda, ...result.agenda],
      }));
      toast({
        title: "Agenda Generated",
        description: `AI built ${result.agenda.filter((i: string) => !(i.startsWith('---') && i.endsWith('---'))).length} agenda items${result.focusTheme ? ` — ${result.focusTheme}` : ''}.`,
      });
    } catch (error: any) {
      toast({
        title: "Agenda Generation Failed",
        description: error.message || "Could not generate agenda. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAgenda(false);
    }
  };

  const applyAiRecapToForm = () => {
    if (!aiRecapResult) return;
    
    const updates: Partial<MeetingFormData> = {};
    let addedCount = 0;
    
    // Only add action items if AI found any
    if (aiRecapResult.actionItems.length > 0) {
      const existingDescriptions = formData.actionItems.map(a => a.description.toLowerCase());
      const newItems: ActionItem[] = aiRecapResult.actionItems
        .filter(item => !existingDescriptions.includes(item.description.toLowerCase()))
        .map(item => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          description: item.description,
          assignee: item.assignee || undefined,
          dueDate: item.dueDate || undefined,
          priority: (item.priority as 'high' | 'medium' | 'low') || undefined,
          completed: false,
        }));
      if (newItems.length > 0) {
        updates.actionItems = [...formData.actionItems, ...newItems];
        addedCount += newItems.length;
      }
    }

    // Only add decisions if AI found any
    if (aiRecapResult.decisions.length > 0) {
      const newDecisions = [...formData.decisions];
      aiRecapResult.decisions.forEach(d => {
        if (!newDecisions.includes(d.description)) {
          newDecisions.push(d.description);
          addedCount++;
        }
      });
      updates.decisions = newDecisions;
    }

    // Only add blockers as risks if AI found any
    if (aiRecapResult.blockers.length > 0) {
      const newRisks = [...formData.risks];
      aiRecapResult.blockers.forEach(b => {
        const text = b.suggestedResolution 
          ? `${b.description} - Resolution: ${b.suggestedResolution}`
          : b.description;
        if (!newRisks.includes(text)) {
          newRisks.push(text);
          addedCount++;
        }
      });
      updates.risks = newRisks;
    }

    // Only update summary if AI generated a meaningful one
    if (aiRecapResult.summary && aiRecapResult.summary !== "Unable to generate summary from the provided notes.") {
      updates.summary = formData.summary 
        ? formData.summary + "\n\n" + aiRecapResult.summary 
        : aiRecapResult.summary;
    }

    if (Object.keys(updates).length === 0) {
      toast({
        title: "Nothing to apply",
        description: "The AI analysis didn't find new items to add.",
      });
      return;
    }

    setFormData({
      ...formData,
      ...updates,
    });

    toast({
      title: "Applied to form",
      description: `Added ${addedCount} new items from AI analysis.`,
    });
  };

  const handleTemplateSelect = (template: MeetingTemplate) => {
    setFormData({
      ...initialFormData,
      title: template.id === 'custom' ? '' : template.name,
      meetingType: template.cadence,
      templateId: template.id,
      agenda: [...template.defaultAgenda],
      attendees: [...template.suggestedAttendees],
    });
    setShowTemplateSelector(false);
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

    const rawActions = (meeting.actionItems || []) as unknown[];
    const normalisedActions: ActionItem[] = rawActions.map((item, i) => {
      if (typeof item === 'object' && item !== null && 'description' in item) {
        return item as ActionItem;
      }
      return { id: `legacy-${i}`, description: String(item), completed: false };
    });

    setFormData({
      title: meeting.title,
      meetingType: meeting.meetingType || "weekly",
      templateId: meeting.templateId || "",
      date: formatDateForInput(meeting.date),
      attendees: meeting.attendees || [],
      facilitator: meeting.facilitator || "",
      agenda: meeting.agenda || [],
      summary: meeting.summary || "",
      decisions: meeting.decisions || [],
      actionItems: normalisedActions,
      risks: meeting.risks || [],
      nextMeetingDate: formatDateForInput(meeting.nextMeetingDate),
      linkedObjectiveIds: meeting.linkedObjectiveIds || [],
      linkedKeyResultIds: meeting.linkedKeyResultIds || [],
      linkedBigRockIds: meeting.linkedBigRockIds || [],
      meetingNotes: meeting.meetingNotes || "",
      isRecurring: meeting.isRecurring || false,
      recurrencePattern: meeting.recurrencePattern || "",
      recurrenceEndDate: formatDateForInput(meeting.recurrenceEndDate),
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setDeleteDialogOpen(true);
  };

  const handleCopyBrief = (meeting: Meeting) => {
    const linkedObjs = objectives.filter(o => meeting.linkedObjectiveIds?.includes(o.id));
    const linkedKRs = keyResults.filter(kr => meeting.linkedKeyResultIds?.includes(kr.id));
    const linkedRocks = bigRocks.filter(b => meeting.linkedBigRockIds?.includes(b.id));
    
    let brief = `${meeting.title}\n`;
    brief += `${'='.repeat(meeting.title.length)}\n\n`;
    
    if (meeting.date) {
      brief += `Date: ${format(new Date(meeting.date), "PPPP")}\n`;
    }
    if (meeting.facilitator) {
      brief += `Facilitator: ${meeting.facilitator}\n`;
    }
    if (meeting.attendees && meeting.attendees.length > 0) {
      brief += `Attendees: ${meeting.attendees.join(', ')}\n`;
    }
    brief += '\n';
    
    if (meeting.agenda && meeting.agenda.length > 0) {
      brief += `AGENDA\n`;
      brief += `${'─'.repeat(25)}\n`;
      let itemNum = 0;
      meeting.agenda.forEach(item => {
        const isSection = item.startsWith('---') && item.endsWith('---');
        const isOkr = item.startsWith('[OKR]');
        if (isSection) {
          brief += `\n${item.replace(/^---\s*/, '').replace(/\s*---$/, '').toUpperCase()}\n`;
        } else {
          itemNum++;
          brief += `  ${itemNum}. ${isOkr ? item.replace('[OKR] ', '') : item}\n`;
        }
      });
      brief += '\n';
    }

    if (linkedRocks.length > 0) {
      brief += `BIG ROCKS (Initiatives)\n`;
      brief += `${'─'.repeat(25)}\n`;
      linkedRocks.forEach(rock => {
        const statusLabel = rock.status === 'at_risk' ? 'AT RISK' : 
                           rock.status === 'behind' ? 'BEHIND' :
                           rock.status === 'on_track' ? 'On Track' :
                           rock.status === 'completed' ? 'Complete' : 'Not Started';
        brief += `- ${rock.title} [${statusLabel}]\n`;
        if (rock.description) {
          brief += `  ${rock.description}\n`;
        }
      });
      brief += '\n';
    }
    
    if (linkedObjs.length > 0) {
      brief += `OBJECTIVES\n`;
      brief += `${'─'.repeat(25)}\n`;
      linkedObjs.forEach(obj => {
        const progress = obj.progress?.toFixed(0) || 0;
        const statusLabel = obj.status === 'at_risk' ? 'AT RISK' : 
                           obj.status === 'behind' ? 'BEHIND' :
                           obj.status === 'on_track' ? 'On Track' :
                           obj.status === 'completed' ? 'Complete' : 'Not Started';
        brief += `- ${obj.title} [${statusLabel} - ${progress}%]\n`;
      });
      brief += '\n';
    }

    if (linkedKRs.length > 0) {
      brief += `KEY RESULTS\n`;
      brief += `${'─'.repeat(25)}\n`;
      linkedKRs.forEach(kr => {
        const progress = kr.progress?.toFixed(0) || 0;
        const statusLabel = kr.status === 'at_risk' ? 'AT RISK' : 
                           kr.status === 'behind' ? 'BEHIND' :
                           kr.status === 'on_track' ? 'On Track' :
                           kr.status === 'completed' ? 'Complete' : 'Not Started';
        brief += `- ${kr.title} [${statusLabel} - ${progress}%]\n`;
      });
      brief += '\n';
    }

    if (meeting.summary) {
      brief += `OUTCOMES / SUMMARY\n`;
      brief += `${'─'.repeat(25)}\n`;
      brief += `${meeting.summary}\n\n`;
    }

    if (meeting.decisions && meeting.decisions.length > 0) {
      brief += `DECISIONS\n`;
      brief += `${'─'.repeat(25)}\n`;
      meeting.decisions.forEach(d => {
        brief += `- ${d}\n`;
      });
      brief += '\n';
    }

    if (meeting.actionItems && meeting.actionItems.length > 0) {
      brief += `ACTION ITEMS\n`;
      brief += `${'─'.repeat(25)}\n`;
      (meeting.actionItems as unknown[]).forEach(a => {
        if (typeof a === 'object' && a !== null && 'description' in a) {
          const item = a as ActionItem;
          const status = item.completed ? '[✓]' : '[ ]';
          const priority = item.priority ? ` [${item.priority.toUpperCase()}]` : '';
          const assignee = item.assignee ? ` — ${item.assignee}` : '';
          const due = item.dueDate ? ` (due: ${item.dueDate})` : '';
          brief += `${status}${priority} ${item.description}${assignee}${due}\n`;
        } else {
          brief += `- ${String(a)}\n`;
        }
      });
      brief += '\n';
    }

    if (meeting.risks && meeting.risks.length > 0) {
      brief += `RISKS\n`;
      brief += `${'─'.repeat(25)}\n`;
      meeting.risks.forEach(r => {
        brief += `- ${r}\n`;
      });
      brief += '\n';
    }

    if (meeting.meetingNotes) {
      brief += `MEETING NOTES\n`;
      brief += `${'─'.repeat(25)}\n`;
      brief += `${meeting.meetingNotes}\n\n`;
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
        toast({
          title: "Meeting brief copied",
          description: "Full summary with linked items, outcomes, and action items copied",
        });
      } catch {
        toast({
          title: "Copy failed",
          description: "Could not copy to clipboard",
          variant: "destructive",
        });
      }
    };
    copyToClipboard(brief);
  };

  const handleCreate = () => {
    if (!formData.title.trim()) {
      toast({ title: "Validation Error", description: "Please enter a meeting title", variant: "destructive" });
      return;
    }
    if (!formData.date) {
      toast({ title: "Validation Error", description: "Please select a meeting date", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedMeeting) return;
    if (!formData.title.trim()) {
      toast({ title: "Validation Error", description: "Please enter a meeting title", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: selectedMeeting.id, data: formData });
  };

  const handleDelete = () => {
    if (!selectedMeeting) return;
    deleteMutation.mutate(selectedMeeting.id);
  };

  const handleLinksSave = (objectiveIds: string[], keyResultIds: string[], bigRockIds: string[]) => {
    setFormData({
      ...formData,
      linkedObjectiveIds: objectiveIds,
      linkedKeyResultIds: keyResultIds,
      linkedBigRockIds: bigRockIds,
    });
  };

  const meetingPeriod = getMeetingQuarterYear(formData.date);
  
  const addAttendee = (value: string) => {
    if (value.trim() && !formData.attendees.includes(value.trim())) {
      setFormData(prev => ({ ...prev, attendees: [...prev.attendees, value.trim()] }));
    }
    setNewAttendeeInput("");
    setAttendeeSearchOpen(false);
  };

  const addAgendaItem = () => {
    if (newAgendaInput.trim()) {
      setFormData(prev => ({ ...prev, agenda: [...prev.agenda, newAgendaInput.trim()] }));
      setNewAgendaInput("");
    }
  };

  const addDecisionItem = () => {
    if (newDecisionInput.trim()) {
      setFormData(prev => ({ ...prev, decisions: [...prev.decisions, newDecisionInput.trim()] }));
      setNewDecisionInput("");
    }
  };

  const addActionItem = () => {
    if (newActionInput.trim()) {
      const item: ActionItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        description: newActionInput.trim(),
        completed: false,
      };
      setFormData(prev => ({ ...prev, actionItems: [...prev.actionItems, item] }));
      setNewActionInput("");
    }
  };

  const addRiskItem = () => {
    if (newRiskInput.trim()) {
      setFormData(prev => ({ ...prev, risks: [...prev.risks, newRiskInput.trim()] }));
      setNewRiskInput("");
    }
  };
  
  const removeListItem = (field: 'attendees' | 'agenda' | 'decisions' | 'actionItems' | 'risks', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as unknown[]).filter((_, i) => i !== index),
    }));
  };

  const fiscalYearStartMonth = foundation?.fiscalYearStartMonth || 1;
  const meetingsInQuarter = meetings.filter(meeting => {
    if (!meeting.date) return false;
    const meetingDate = new Date(meeting.date);
    if (isAnnual) {
      const yearStart = getQuarterDateRange(1, year, fiscalYearStartMonth).start;
      const yearEnd = getQuarterDateRange(4, year, fiscalYearStartMonth).end;
      return meetingDate >= yearStart && meetingDate <= yearEnd;
    }
    const { start, end } = getQuarterDateRange(quarter, year, fiscalYearStartMonth);
    return meetingDate >= start && meetingDate <= end;
  });

  const searchFilteredMeetings = meetingsInQuarter.filter(meeting => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      meeting.title?.toLowerCase().includes(query) ||
      meeting.summary?.toLowerCase().includes(query) ||
      meeting.facilitator?.toLowerCase().includes(query) ||
      meeting.attendees?.some(a => a?.toLowerCase().includes(query)) ||
      meeting.agenda?.some(a => a?.toLowerCase().includes(query)) ||
      meeting.decisions?.some(d => d?.toLowerCase().includes(query)) ||
      meeting.actionItems?.some(a =>
        (typeof a === "string" && a.toLowerCase().includes(query)) ||
        ((a as ActionItem)?.description?.toLowerCase().includes(query))
      )
    );
  });

  const filteredMeetings = selectedType === "all"
    ? searchFilteredMeetings
    : searchFilteredMeetings.filter(m => m.meetingType === selectedType);

  const groupedMeetings = {
    all: searchFilteredMeetings,
    weekly: searchFilteredMeetings.filter(m => m.meetingType === "weekly"),
    monthly: searchFilteredMeetings.filter(m => m.meetingType === "monthly"),
    quarterly: searchFilteredMeetings.filter(m => m.meetingType === "quarterly"),
    annual: searchFilteredMeetings.filter(m => m.meetingType === "annual"),
  };

  const totalLinkedItems = formData.linkedObjectiveIds.length + formData.linkedKeyResultIds.length + formData.linkedBigRockIds.length;

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

  const filteredMembers = tenantMembers.filter(m => {
    const q = newAttendeeInput.toLowerCase();
    if (!q) return true;
    return m.displayName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  }).filter(m => !formData.attendees.includes(m.displayName) && !formData.attendees.includes(m.email));

  const meetingFormFields = (
    <Tabs defaultValue="details" className="w-full">
      <TabsList className="grid grid-cols-4 w-full">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="agenda">Agenda & Minutes</TabsTrigger>
        <TabsTrigger value="links">OKR Links</TabsTrigger>
        <TabsTrigger value="notes" data-testid="tab-imported-notes">Imported Notes</TabsTrigger>
      </TabsList>
      
      <TabsContent value="details" className="space-y-4 mt-4">
        <div>
          <Label htmlFor="title">Meeting Title *</Label>
          <Input
            id="title"
            placeholder="E.g., Q1 Strategy Review"
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
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="ad-hoc">Ad-hoc</SelectItem>
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
        
        <div className="border rounded-lg p-3 bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <Checkbox
              id="isRecurring"
              checked={formData.isRecurring}
              onCheckedChange={(checked) => setFormData({ 
                ...formData, 
                isRecurring: !!checked,
                recurrencePattern: checked ? (formData.recurrencePattern || formData.meetingType) : ""
              })}
              data-testid="checkbox-recurring"
            />
            <Label htmlFor="isRecurring" className="flex items-center gap-2 cursor-pointer">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
              Make this a recurring meeting series
            </Label>
          </div>
          
          {formData.isRecurring && (
            <div className="grid grid-cols-2 gap-4 pl-6">
              <div>
                <Label htmlFor="recurrencePattern">Recurrence Pattern</Label>
                <Select
                  value={formData.recurrencePattern}
                  onValueChange={(value) => setFormData({ ...formData, recurrencePattern: value })}
                >
                  <SelectTrigger data-testid="select-recurrence-pattern">
                    <SelectValue placeholder="Select pattern" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="recurrenceEndDate">Series End Date</Label>
                <Input
                  id="recurrenceEndDate"
                  type="date"
                  value={formData.recurrenceEndDate}
                  onChange={(e) => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
                  data-testid="input-recurrence-end-date"
                />
              </div>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="facilitator">Facilitator</Label>
            <Input
              id="facilitator"
              placeholder="Meeting facilitator"
              value={formData.facilitator}
              onChange={(e) => setFormData({ ...formData, facilitator: e.target.value })}
              data-testid="input-facilitator"
            />
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
        </div>
        
        <div>
          <Label>Attendees</Label>
          <div className="relative mt-2">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email, or type to add..."
                  value={newAttendeeInput}
                  onChange={(e) => {
                    setNewAttendeeInput(e.target.value);
                    setAttendeeSearchOpen(e.target.value.length > 0);
                  }}
                  onFocus={() => { if (newAttendeeInput.length > 0) setAttendeeSearchOpen(true); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (filteredMembers.length > 0) {
                        addAttendee(filteredMembers[0].displayName + ' (' + filteredMembers[0].email + ')');
                      } else if (newAttendeeInput.trim()) {
                        addAttendee(newAttendeeInput);
                      }
                    }
                    if (e.key === "Escape") {
                      setAttendeeSearchOpen(false);
                    }
                  }}
                  className="pl-9"
                  data-testid="input-attendee"
                />
                {attendeeSearchOpen && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredMembers.length > 0 ? (
                      filteredMembers.slice(0, 8).map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addAttendee(member.displayName + ' (' + member.email + ')');
                          }}
                          data-testid={`attendee-option-${member.id}`}
                        >
                          <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{member.displayName}</div>
                            <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                          </div>
                        </div>
                      ))
                    ) : newAttendeeInput.trim() ? (
                      <div
                        className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addAttendee(newAttendeeInput);
                        }}
                        data-testid="attendee-option-custom"
                      >
                        <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span>Add "{newAttendeeInput.trim()}"</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              <Button 
                type="button" 
                onClick={() => { if (newAttendeeInput.trim()) addAttendee(newAttendeeInput); }}
                data-testid="button-add-attendee"
              >
                Add
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.attendees.map((attendee, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="cursor-pointer gap-1"
                onClick={() => removeListItem('attendees', index)}
                data-testid={`badge-attendee-${index}`}
              >
                <Users className="w-3 h-3" />
                {attendee} <X className="w-3 h-3 ml-1" />
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
      </TabsContent>
      
      <TabsContent value="agenda" className="space-y-4 mt-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <Label>Agenda Items</Label>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={handleGenerateAgenda}
              disabled={isGeneratingAgenda}
              data-testid="button-auto-agenda"
            >
              {isGeneratingAgenda ? (
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-1" />
              )}
              {isGeneratingAgenda ? "Generating..." : "Build AI Agenda"}
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Add agenda item"
              value={newAgendaInput}
              onChange={(e) => setNewAgendaInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { addAgendaItem(); e.preventDefault(); }}}
              data-testid="input-agenda-item"
            />
            <Button type="button" onClick={addAgendaItem} data-testid="button-add-agenda">
              Add
            </Button>
          </div>
          <ScrollArea className="h-40 mt-2">
            {formData.agenda.map((item, index) => {
              const isSection = item.startsWith('---') && item.endsWith('---');
              const isOkrItem = item.startsWith('[OKR]');
              const displayText = isOkrItem ? item.replace('[OKR] ', '') : item;
              const sectionText = isSection ? item.replace(/^---\s*/, '').replace(/\s*---$/, '') : '';
              
              if (isSection) {
                return (
                  <div key={index} className="flex items-center gap-2 py-2 px-2 mt-1 group">
                    <div className="flex-1 flex items-center gap-2">
                      <div className="h-px bg-border flex-1" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {sectionText}
                      </span>
                      <div className="h-px bg-border flex-1" />
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => removeListItem('agenda', index)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                );
              }
              
              return (
                <div key={index} className={`flex items-center gap-2 p-2 hover:bg-muted rounded group ${isOkrItem ? 'bg-primary/5' : ''}`}>
                  {isOkrItem ? (
                    <Target className="w-4 h-4 text-primary shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className={`flex-1 text-sm ${isOkrItem ? 'text-primary font-medium' : ''}`}>
                    {displayText}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={() => removeListItem('agenda', index)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              );
            })}
          </ScrollArea>
        </div>
        
        <div>
          <Label>Key Decisions</Label>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Add decision"
              value={newDecisionInput}
              onChange={(e) => setNewDecisionInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { addDecisionItem(); e.preventDefault(); }}}
              data-testid="input-decision"
            />
            <Button type="button" onClick={addDecisionItem} data-testid="button-add-decision">
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.decisions.map((decision, index) => (
              <Badge key={index} variant="outline" className="cursor-pointer" onClick={() => removeListItem('decisions', index)}>
                <CheckCircle2 className="w-3 h-3 mr-1 text-green-500" />
                {decision} <X className="w-3 h-3 ml-1" />
              </Badge>
            ))}
          </div>
        </div>
        
        <div>
          <Label>Action Items</Label>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Add action item"
              value={newActionInput}
              onChange={(e) => setNewActionInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { addActionItem(); e.preventDefault(); }}}
              data-testid="input-action-item"
            />
            <Button type="button" onClick={addActionItem} data-testid="button-add-action-item">
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.actionItems.map((item, index) => (
              <Badge key={item.id} variant="secondary" className="cursor-pointer gap-1" onClick={() => removeListItem('actionItems', index)}>
                <Target className="w-3 h-3 text-blue-500 shrink-0" />
                <span className={item.completed ? 'line-through opacity-60' : ''}>{item.description}</span>
                {item.assignee && <span className="text-muted-foreground">({item.assignee})</span>}
                <X className="w-3 h-3 ml-0.5 shrink-0" />
              </Badge>
            ))}
          </div>
        </div>
        
        <div>
          <Label>Risks Identified</Label>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Add risk"
              value={newRiskInput}
              onChange={(e) => setNewRiskInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { addRiskItem(); e.preventDefault(); }}}
              data-testid="input-risk"
            />
            <Button type="button" onClick={addRiskItem} data-testid="button-add-risk">
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.risks.map((risk, index) => (
              <Badge key={index} variant="destructive" className="cursor-pointer" onClick={() => removeListItem('risks', index)}>
                <AlertTriangle className="w-3 h-3 mr-1" />
                {risk} <X className="w-3 h-3 ml-1" />
              </Badge>
            ))}
          </div>
        </div>
      </TabsContent>
      
      <TabsContent value="links" className="space-y-4 mt-4">
        <div className="text-center py-8">
          <Link2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Link OKRs & Big Rocks</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Connect this meeting to objectives and initiatives for focused discussions
          </p>
          <Button onClick={() => setLinkingModalOpen(true)} data-testid="button-link-okrs">
            <Link2 className="w-4 h-4 mr-2" />
            {totalLinkedItems > 0 ? `Edit ${totalLinkedItems} Links` : 'Add Links'}
          </Button>
        </div>
        
        {totalLinkedItems > 0 && (
          <div className="space-y-3">
            {formData.linkedObjectiveIds.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-medium">Linked Objectives</Label>
                {objectives.filter(o => formData.linkedObjectiveIds.includes(o.id)).map(obj => {
                  const progress = obj.progress || 0;
                  const statusColor = progress >= 70 ? 'text-green-600' : progress >= 40 ? 'text-amber-600' : 'text-red-600';
                  const bgColor = progress >= 70 ? 'bg-green-500' : progress >= 40 ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <div key={obj.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <Target className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{obj.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                            <div className={`h-full ${bgColor} transition-all`} style={{ width: `${Math.min(progress, 100)}%` }} />
                          </div>
                          <span className={`text-sm font-medium ${statusColor}`}>{progress}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {formData.linkedBigRockIds.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-medium">Linked Big Rocks</Label>
                {bigRocks.filter(b => formData.linkedBigRockIds.includes(b.id)).map(rock => {
                  const progress = rock.completionPercentage || 0;
                  const statusColor = progress >= 70 ? 'text-green-600' : progress >= 40 ? 'text-amber-600' : 'text-red-600';
                  const bgColor = progress >= 70 ? 'bg-green-500' : progress >= 40 ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <div key={rock.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <Zap className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{rock.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                            <div className={`h-full ${bgColor} transition-all`} style={{ width: `${Math.min(progress, 100)}%` }} />
                          </div>
                          <span className={`text-sm font-medium ${statusColor}`}>{progress}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </TabsContent>
      
      <TabsContent value="notes" className="space-y-4 mt-4">
        <div>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-muted-foreground" />
              <Label htmlFor="meetingNotes" className="text-base font-medium">Meeting Notes</Label>
            </div>
            <div className="flex items-center gap-2">
              {outlookStatus?.connected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOutlookImportDialogOpen(true)}
                  data-testid="button-import-from-outlook"
                >
                  <Cloud className="w-4 h-4 mr-2" />
                  Import from Outlook
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={handleAnalyzeNotes}
                disabled={isAnalyzingNotes || !formData.meetingNotes || formData.meetingNotes.length < 20}
                data-testid="button-analyze-with-ai"
              >
                {isAnalyzingNotes ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {isAnalyzingNotes ? "Analyzing..." : "Analyze with AI"}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Import notes from Outlook or paste content, then use AI to extract action items, decisions, and blockers.
          </p>
          <Textarea
            id="meetingNotes"
            placeholder="Paste meeting notes or import from Outlook calendar..."
            value={formData.meetingNotes}
            onChange={(e) => setFormData({ ...formData, meetingNotes: e.target.value })}
            rows={10}
            className="font-mono text-sm"
            data-testid="textarea-meeting-notes"
          />
          {formData.meetingNotes && (
            <div className="mt-2 text-xs text-muted-foreground">
              {formData.meetingNotes.length} characters
            </div>
          )}
        </div>
        
        {aiRecapResult && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <Label className="text-base font-medium">AI Analysis Results</Label>
              </div>
              <Button
                size="sm"
                onClick={applyAiRecapToForm}
                data-testid="button-apply-ai-results"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Apply to Form
              </Button>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50 space-y-1">
              <Label className="text-sm font-medium">Summary</Label>
              <p className="text-sm text-muted-foreground">{aiRecapResult.summary}</p>
            </div>
            
            {aiRecapResult.keyTakeaways.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Key Takeaways</Label>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {aiRecapResult.keyTakeaways.map((takeaway, i) => (
                    <li key={i}>{takeaway}</li>
                  ))}
                </ul>
              </div>
            )}

            {aiRecapResult.actionItems.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-500" />
                  Action Items ({aiRecapResult.actionItems.length})
                </Label>
                <div className="space-y-2">
                  {aiRecapResult.actionItems.map((item, i) => (
                    <div key={i} className="p-3 rounded-lg border bg-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.description}</div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {item.assignee && <span>Assignee: {item.assignee}</span>}
                            {item.dueDate && <span>Due: {item.dueDate}</span>}
                          </div>
                        </div>
                        {item.priority && (
                          <Badge 
                            variant={item.priority === 'high' ? 'destructive' : item.priority === 'medium' ? 'default' : 'secondary'}
                            className="text-xs shrink-0"
                          >
                            {item.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiRecapResult.decisions.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Decisions ({aiRecapResult.decisions.length})
                </Label>
                <div className="space-y-2">
                  {aiRecapResult.decisions.map((decision, i) => (
                    <div key={i} className="p-3 rounded-lg border bg-card">
                      <div className="font-medium text-sm">{decision.description}</div>
                      {decision.rationale && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Rationale: {decision.rationale}
                        </div>
                      )}
                      {decision.owner && (
                        <div className="text-xs text-muted-foreground">
                          Owner: {decision.owner}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiRecapResult.blockers.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Blockers ({aiRecapResult.blockers.length})
                </Label>
                <div className="space-y-2">
                  {aiRecapResult.blockers.map((blocker, i) => (
                    <div key={i} className="p-3 rounded-lg border bg-card border-amber-500/30">
                      <div className="font-medium text-sm">{blocker.description}</div>
                      {blocker.impact && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Impact: {blocker.impact}
                        </div>
                      )}
                      {blocker.suggestedResolution && (
                        <div className="text-xs text-green-600 mt-1">
                          Suggested resolution: {blocker.suggestedResolution}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Focus Rhythm</h1>
            <p className="text-muted-foreground mt-1">
              {isAnnual ? `Meetings for ${year}` : `Meetings for Q${quarter} ${year}`}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {outlookStatus?.connected ? (
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30" data-testid="badge-outlook-connected">
                <Cloud className="w-3 h-3 mr-1" />
                Outlook Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground" data-testid="badge-outlook-disconnected">
                <CloudOff className="w-3 h-3 mr-1" />
                Outlook Not Connected
              </Badge>
            )}
          </div>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setShowTemplateSelector(false);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => { setCreateDialogOpen(true); setShowTemplateSelector(true); }}
              data-testid="button-add-meeting"
            >
              <Plus className="w-4 h-4 mr-2" />
              Schedule Meeting
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {showTemplateSelector ? 'Choose Meeting Template' : 'Schedule New Meeting'}
              </DialogTitle>
              {showTemplateSelector && (
                <DialogDescription>
                  Select a template to get started with pre-filled agenda items
                </DialogDescription>
              )}
            </DialogHeader>
            
            {showTemplateSelector ? (
              <TemplateSelector onSelect={handleTemplateSelect} />
            ) : (
              <>
                {meetingFormFields}
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setShowTemplateSelector(true)}>
                    Change Template
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                    data-testid="button-save-meeting"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Meeting"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search meetings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-meetings"
            />
          </div>
          {searchQuery && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSearchQuery("")}
              data-testid="button-clear-search"
            >
              Clear search
            </Button>
          )}
        </div>

        <Tabs value={selectedType} onValueChange={setSelectedType} className="space-y-6">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">
              All ({groupedMeetings.all.length})
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
            <TabsTrigger value="annual" data-testid="tab-annual">
              Annual ({groupedMeetings.annual.length})
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
                  <Button
                    onClick={() => { setCreateDialogOpen(true); setShowTemplateSelector(true); }}
                    data-testid="button-create-first-meeting"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Schedule Meeting
                  </Button>
                </CardContent>
              </Card>
            ) : isAnnual ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(q => {
                  const quarterMeetings = filteredMeetings.filter(m => {
                    if (!m.date) return false;
                    const { start, end } = getQuarterDateRange(q, year, fiscalYearStartMonth);
                    const d = new Date(m.date);
                    return d >= start && d <= end;
                  });
                  return (
                    <div key={q} className="border rounded-lg overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 text-left bg-muted/30 hover:bg-muted/50 transition-colors"
                        onClick={() => setOpenQuarters(prev => prev.includes(q) ? prev.filter(x => x !== q) : [...prev, q])}
                        data-testid={`button-quarter-${q}`}
                      >
                        <span className="font-medium text-sm">Q{q} — {quarterMeetings.length} meeting{quarterMeetings.length !== 1 ? 's' : ''}</span>
                        <ChevronRight className={`h-4 w-4 transition-transform text-muted-foreground ${openQuarters.includes(q) ? 'rotate-90' : ''}`} />
                      </button>
                      {openQuarters.includes(q) && (
                        <div className="divide-y">
                          {quarterMeetings.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-muted-foreground">No meetings this quarter</p>
                          ) : (
                            quarterMeetings.map(meeting => (
                              <div key={meeting.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Link href={`/focus-rhythm/${meeting.id}`}>
                                    <span className="font-medium text-sm truncate cursor-pointer hover:text-primary transition-colors">{meeting.title}</span>
                                  </Link>
                                  <Badge variant="outline" className="text-xs shrink-0 capitalize">{meeting.meetingType}</Badge>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                  <span className="text-xs text-muted-foreground mr-1">{meeting.date ? format(new Date(meeting.date), "MMM d") : "—"}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title={outlookStatus?.connected ? "Schedule in Outlook" : "Connect Outlook in Settings to schedule"}
                                    onClick={() => {
                                      setSelectedMeeting(meeting);
                                      if (outlookStatus?.connected) {
                                        setListScheduleOpen(true);
                                      } else {
                                        toast({ title: "Outlook not connected", description: "Go to Settings → M365 Integration to connect your Outlook account.", variant: "destructive" });
                                      }
                                    }}
                                  >
                                    <CalendarCheck className={`h-3.5 w-3.5 ${!outlookStatus?.connected ? "opacity-40" : ""}`} />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit meeting" onClick={() => openEditDialog(meeting)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  {canDeleteMeeting && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete meeting" onClick={() => openDeleteDialog(meeting)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredMeetings.map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    onEdit={openEditDialog}
                    onDelete={openDeleteDialog}
                    canDelete={canDeleteMeeting}
                    objectives={objectives}
                    keyResults={keyResults}
                    bigRocks={bigRocks}
                    onCopyBrief={handleCopyBrief}
                    outlookConnected={outlookStatus?.connected}
                    onSyncToOutlook={(id, startDateTime, durationMinutes, meetingTime) => syncToOutlookMutation.mutate({ meetingId: id, startDateTime, durationMinutes, meetingTime })}
                    onSendSummary={(id) => sendSummaryMutation.mutate(id)}
                    isSyncing={syncToOutlookMutation.isPending}
                    isSendingSummary={sendSummaryMutation.isPending}
                    tenantId={currentTenant?.id}
                    userId={user?.id}
                    userEmail={user?.email}
                    quarter={quarter}
                    year={year}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Meeting</DialogTitle>
            </DialogHeader>
            {meetingFormFields}
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
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
              <DialogDescription>
                Are you sure you want to delete "{selectedMeeting?.title}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Meeting"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {selectedMeeting && (
          <ScheduleToOutlookDialog
            open={listScheduleOpen}
            onOpenChange={(open) => {
              setListScheduleOpen(open);
              if (!open) setSelectedMeeting(null);
            }}
            meeting={selectedMeeting}
            onConfirm={(startDateTime, durationMinutes, meetingTime) => {
              syncToOutlookMutation.mutate({ meetingId: selectedMeeting.id, startDateTime, durationMinutes, meetingTime });
              setListScheduleOpen(false);
              setSelectedMeeting(null);
            }}
            isSyncing={syncToOutlookMutation.isPending}
          />
        )}
        
        <Dialog open={!!newlyCreatedMeetingId} onOpenChange={(open) => { if (!open) setNewlyCreatedMeetingId(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarCheck className="w-5 h-5" />
                Meeting Created
              </DialogTitle>
              <DialogDescription>
                Would you like to schedule a time and send an Outlook calendar invite?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  toast({ title: "Meeting Created", description: "You can schedule it to Outlook later from the meeting card." });
                  setNewlyCreatedMeetingId(null);
                  setPostCreateMeetingData(null);
                }}
                data-testid="button-skip-outlook"
              >
                Not Now
              </Button>
              <Button
                onClick={() => {
                  setNewlyCreatedMeetingId(null);
                  if (postCreateMeetingData) {
                    setPostCreateScheduleOpen(true);
                  } else {
                    toast({ title: "Meeting Created", description: "Could not open scheduler. You can schedule from the meeting card." });
                  }
                }}
                data-testid="button-schedule-outlook-now"
              >
                <CalendarCheck className="w-4 h-4 mr-1" />
                Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {postCreateMeetingData && (
          <ScheduleToOutlookDialog
            open={postCreateScheduleOpen}
            onOpenChange={(open) => {
              setPostCreateScheduleOpen(open);
              if (!open) setPostCreateMeetingData(null);
            }}
            meeting={postCreateMeetingData}
            onConfirm={(startDateTime, durationMinutes, meetingTime) => {
              syncToOutlookMutation.mutate({ meetingId: postCreateMeetingData.id, startDateTime, durationMinutes, meetingTime });
              setPostCreateScheduleOpen(false);
              setPostCreateMeetingData(null);
            }}
            isSyncing={syncToOutlookMutation.isPending}
          />
        )}

        <OKRLinkingModal
          open={linkingModalOpen}
          onOpenChange={setLinkingModalOpen}
          linkedObjectiveIds={formData.linkedObjectiveIds}
          linkedKeyResultIds={formData.linkedKeyResultIds}
          linkedBigRockIds={formData.linkedBigRockIds}
          onSave={handleLinksSave}
          tenantId={currentTenant.id}
          quarter={meetingPeriod.quarter ?? undefined}
          year={meetingPeriod.year}
          fallbackQuarter={isAnnual ? undefined : quarter}
          fallbackYear={year}
        />
        
        <Dialog open={outlookImportDialogOpen} onOpenChange={setOutlookImportDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                Import Notes from Outlook
              </DialogTitle>
              <DialogDescription>
                Select a calendar event to import its body content as meeting notes.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[50vh] pr-4">
              {calendarEventsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : calendarEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No calendar events found in the past 30 days.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {calendarEvents.map((event: any) => {
                    const eventDate = event.start?.dateTime ? new Date(event.start.dateTime) : null;
                    const hasBody = event.body?.content && event.body.content.length > 50;
                    return (
                      <div
                        key={event.id}
                        className={`p-3 rounded-lg border cursor-pointer hover-elevate ${hasBody ? '' : 'opacity-50'}`}
                        onClick={() => {
                          if (event.body?.content) {
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = event.body.content;
                            const textContent = tempDiv.textContent || tempDiv.innerText || '';
                            const cleanedText = textContent.replace(/\s+/g, ' ').trim();
                            const existingNotes = formData.meetingNotes ? formData.meetingNotes + '\n\n---\n\n' : '';
                            setFormData({
                              ...formData,
                              meetingNotes: existingNotes + `Imported from: ${event.subject}\nDate: ${eventDate ? format(eventDate, 'PPP p') : 'N/A'}\n\n${cleanedText}`,
                            });
                            setOutlookImportDialogOpen(false);
                            toast({ title: "Notes imported", description: `Imported notes from "${event.subject}"` });
                          } else {
                            toast({ title: "No content", description: "This event has no body content to import.", variant: "destructive" });
                          }
                        }}
                        data-testid={`outlook-event-${event.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{event.subject || 'Untitled Event'}</div>
                            <div className="text-sm text-muted-foreground">
                              {eventDate ? format(eventDate, 'PPP p') : 'No date'}
                            </div>
                          </div>
                          {hasBody ? (
                            <Badge variant="outline" className="text-xs shrink-0">
                              Has Notes
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              No Notes
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOutlookImportDialogOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
