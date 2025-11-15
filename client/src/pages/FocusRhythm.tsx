import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Video, Users, ExternalLink, Sparkles, Mail, Plus, FileText, Target, Link2, MessageSquare, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
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

type MeetingNote = {
  id: string;
  content: string;
  linkedOKRs: string[];
  linkedMetrics: string[];
  createdBy: string;
  createdAt: string;
};

type AgendaItem = {
  id: string;
  topic: string;
  duration: number;
  owner: string;
  linkedOKRs: string[];
};

type Meeting = {
  id: string;
  title: string;
  type: "weekly" | "monthly" | "quarterly" | "annual";
  day: string;
  time: string;
  attendees: number;
  teamsLink: string;
  agenda: AgendaItem[];
  notes: MeetingNote[];
  outcomes: string;
  nextSteps: string;
};

const availableOKRs = [
  "Increase Market Share",
  "Build World-Class Product",
  "Improve Customer Experience",
];

const availableMetrics = [
  "Monthly Recurring Revenue",
  "Customer Churn Rate",
  "Net Promoter Score",
  "Feature Adoption Rate",
];

const mockMeetings: Meeting[] = [
  {
    id: "1",
    title: "Strategic Planning Review",
    type: "weekly",
    day: "Monday",
    time: "9:00 AM - 10:00 AM",
    attendees: 8,
    teamsLink: "https://teams.microsoft.com/meet/abc123",
    agenda: [
      { id: "a1", topic: "Q1 OKR Progress Review", duration: 20, owner: "Sarah Chen", linkedOKRs: ["Increase Market Share"] },
      { id: "a2", topic: "Market Expansion Update", duration: 15, owner: "Michael Torres", linkedOKRs: ["Increase Market Share"] },
      { id: "a3", topic: "Blockers and Solutions", duration: 15, owner: "Team", linkedOKRs: [] },
      { id: "a4", topic: "Next Week Planning", duration: 10, owner: "Sarah Chen", linkedOKRs: [] },
    ],
    notes: [
      {
        id: "n1",
        content: "Revenue targets exceeded by 12%. Customer acquisition in EMEA showing strong momentum.",
        linkedOKRs: ["Increase Market Share"],
        linkedMetrics: ["Monthly Recurring Revenue"],
        createdBy: "Sarah Chen",
        createdAt: "2025-01-15",
      },
    ],
    outcomes: "Approved expansion into German market. Allocated additional $50K budget for Q1 marketing.",
    nextSteps: "1. Finalize Germany go-to-market plan by Jan 22\n2. Schedule customer interviews in UK market",
  },
  {
    id: "2",
    title: "Weekly Team Sync",
    type: "weekly",
    day: "Wednesday",
    time: "2:00 PM - 3:00 PM",
    attendees: 12,
    teamsLink: "https://teams.microsoft.com/meet/def456",
    agenda: [
      { id: "a5", topic: "Sprint Progress Update", duration: 20, owner: "Engineering Lead", linkedOKRs: ["Build World-Class Product"] },
      { id: "a6", topic: "Bug Triage", duration: 15, owner: "QA Lead", linkedOKRs: ["Build World-Class Product"] },
      { id: "a7", topic: "Customer Feedback Review", duration: 15, owner: "Product Manager", linkedOKRs: ["Improve Customer Experience"] },
    ],
    notes: [
      {
        id: "n2",
        content: "Feature release on track. Bug count reduced by 35% this sprint. Customer satisfaction improved.",
        linkedOKRs: ["Build World-Class Product"],
        linkedMetrics: ["Net Promoter Score"],
        createdBy: "Alex Kim",
        createdAt: "2025-01-15",
      },
    ],
    outcomes: "Approved feature scope for next sprint. Decision to focus on performance improvements.",
    nextSteps: "1. Complete performance profiling by Jan 20\n2. Schedule design review for new dashboard",
  },
  {
    id: "3",
    title: "Monthly Business Review",
    type: "monthly",
    day: "Last Friday",
    time: "10:00 AM - 12:00 PM",
    attendees: 15,
    teamsLink: "https://teams.microsoft.com/meet/ghi789",
    agenda: [
      { id: "a8", topic: "Monthly Metrics Review", duration: 30, owner: "CFO", linkedOKRs: [] },
      { id: "a9", topic: "OKR Progress Deep Dive", duration: 40, owner: "Leadership Team", linkedOKRs: ["Increase Market Share", "Build World-Class Product"] },
      { id: "a10", topic: "Strategic Initiatives Update", duration: 30, owner: "CEO", linkedOKRs: [] },
      { id: "a11", topic: "Q&A and Discussion", duration: 20, owner: "All", linkedOKRs: [] },
    ],
    notes: [],
    outcomes: "",
    nextSteps: "",
  },
  {
    id: "4",
    title: "Quarterly Planning Session",
    type: "quarterly",
    day: "First Monday of Quarter",
    time: "9:00 AM - 4:00 PM",
    attendees: 20,
    teamsLink: "https://teams.microsoft.com/meet/jkl012",
    agenda: [
      { id: "a12", topic: "Previous Quarter Retrospective", duration: 60, owner: "Leadership", linkedOKRs: [] },
      { id: "a13", topic: "Market Analysis and Trends", duration: 45, owner: "Strategy Team", linkedOKRs: [] },
      { id: "a14", topic: "OKR Planning Workshop", duration: 120, owner: "All Departments", linkedOKRs: [] },
      { id: "a15", topic: "Resource Allocation", duration: 45, owner: "CFO", linkedOKRs: [] },
      { id: "a16", topic: "Finalize Quarterly Plan", duration: 60, owner: "Leadership", linkedOKRs: [] },
    ],
    notes: [],
    outcomes: "",
    nextSteps: "",
  },
  {
    id: "5",
    title: "Annual Strategy Summit",
    type: "annual",
    day: "January",
    time: "Full Day Event",
    attendees: 50,
    teamsLink: "https://teams.microsoft.com/meet/mno345",
    agenda: [
      { id: "a17", topic: "Year in Review", duration: 60, owner: "CEO", linkedOKRs: [] },
      { id: "a18", topic: "Market Positioning and Vision", duration: 90, owner: "Leadership", linkedOKRs: [] },
      { id: "a19", topic: "Annual Goals Workshop", duration: 180, owner: "All Teams", linkedOKRs: [] },
      { id: "a20", topic: "Culture and Values Discussion", duration: 60, owner: "HR", linkedOKRs: [] },
    ],
    notes: [],
    outcomes: "",
    nextSteps: "",
  },
];

const meetingTypeColors = {
  weekly: "default" as const,
  monthly: "secondary" as const,
  quarterly: "outline" as const,
  annual: "destructive" as const,
};

export default function FocusRhythm() {
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>(mockMeetings);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("agenda");

  const openMeetingDialog = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setDialogOpen(true);
  };

  const exportSchedule = () => {
    const csvContent = [
      ["Meeting", "Type", "Day", "Time", "Attendees"],
      ...meetings.map((m) => [m.title, m.type, m.day, m.time, m.attendees.toString()]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meeting_schedule_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: "Meeting schedule exported to CSV",
    });
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-2">Focus Rhythm</h1>
          <p className="text-muted-foreground">
            Manage meeting cadence, agendas, and capture outcomes
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="default" className="gap-1">
            <Mail className="h-3 w-3" />
            Outlook Connected
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={exportSchedule}
            data-testid="button-export-schedule"
          >
            <Download className="h-4 w-4" />
            Export Schedule
          </Button>
          <Button variant="outline" size="sm" data-testid="button-sync-calendar">
            Sync Calendar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="weekly" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="weekly" data-testid="tab-weekly">
            <Calendar className="h-4 w-4 mr-2" />
            Weekly
          </TabsTrigger>
          <TabsTrigger value="monthly" data-testid="tab-monthly">
            Monthly
          </TabsTrigger>
          <TabsTrigger value="quarterly" data-testid="tab-quarterly">
            Quarterly
          </TabsTrigger>
          <TabsTrigger value="annual" data-testid="tab-annual">
            Annual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-4">
          <h2 className="text-xl font-semibold">Weekly Meetings</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {meetings
              .filter((m) => m.type === "weekly")
              .map((meeting) => (
                <Card
                  key={meeting.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => openMeetingDialog(meeting)}
                  data-testid={`meeting-card-${meeting.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-lg">{meeting.title}</CardTitle>
                      <Badge variant={meetingTypeColors[meeting.type]}>{meeting.day}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {meeting.time}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {meeting.attendees} attendees
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{meeting.agenda.length} agenda items</span>
                      <span>{meeting.notes.length} notes</span>
                    </div>
                    {meeting.agenda.some(item => item.linkedOKRs.length > 0) && (
                      <div className="flex flex-wrap gap-1 pt-2 border-t">
                        {Array.from(new Set(meeting.agenda.flatMap(item => item.linkedOKRs))).map((okr, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            <Target className="h-3 w-3 mr-1" />
                            {okr}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <h2 className="text-xl font-semibold">Monthly Meetings</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {meetings
              .filter((m) => m.type === "monthly")
              .map((meeting) => (
                <Card
                  key={meeting.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => openMeetingDialog(meeting)}
                  data-testid={`meeting-card-${meeting.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-lg">{meeting.title}</CardTitle>
                      <Badge variant={meetingTypeColors[meeting.type]}>{meeting.day}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {meeting.time}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {meeting.attendees} attendees
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{meeting.agenda.length} agenda items</span>
                      <span>{meeting.notes.length} notes</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="quarterly" className="space-y-4">
          <h2 className="text-xl font-semibold">Quarterly Meetings</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {meetings
              .filter((m) => m.type === "quarterly")
              .map((meeting) => (
                <Card
                  key={meeting.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => openMeetingDialog(meeting)}
                  data-testid={`meeting-card-${meeting.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-lg">{meeting.title}</CardTitle>
                      <Badge variant={meetingTypeColors[meeting.type]}>{meeting.day}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {meeting.time}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {meeting.attendees} attendees
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{meeting.agenda.length} agenda items</span>
                      <span>{meeting.notes.length} notes</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="annual" className="space-y-4">
          <h2 className="text-xl font-semibold">Annual Meetings</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {meetings
              .filter((m) => m.type === "annual")
              .map((meeting) => (
                <Card
                  key={meeting.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => openMeetingDialog(meeting)}
                  data-testid={`meeting-card-${meeting.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-lg">{meeting.title}</CardTitle>
                      <Badge variant={meetingTypeColors[meeting.type]}>{meeting.day}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {meeting.time}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {meeting.attendees} attendees
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{meeting.agenda.length} agenda items</span>
                      <span>{meeting.notes.length} notes</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Meeting Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="text-2xl">{selectedMeeting?.title}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedMeeting?.day} • {selectedMeeting?.time} • {selectedMeeting?.attendees} attendees
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                data-testid="button-join-meeting"
              >
                <Video className="h-4 w-4" />
                Join Meeting
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </DialogHeader>

          {selectedMeeting && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="agenda" data-testid="tab-meeting-agenda">
                  <FileText className="h-4 w-4 mr-2" />
                  Agenda
                </TabsTrigger>
                <TabsTrigger value="notes" data-testid="tab-meeting-notes">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Notes
                </TabsTrigger>
                <TabsTrigger value="outcomes" data-testid="tab-meeting-outcomes">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Outcomes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="agenda" className="space-y-4 mt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Meeting Agenda</h3>
                  <Button size="sm" className="gap-2" data-testid="button-add-agenda-item">
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                </div>
                <div className="space-y-3">
                  {selectedMeeting.agenda.map((item, index) => (
                    <Card key={item.id} data-testid={`agenda-item-${index}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium">{item.topic}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Owner: {item.owner} • {item.duration} minutes
                            </p>
                          </div>
                          <Badge variant="secondary">{index + 1}</Badge>
                        </div>
                        {item.linkedOKRs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.linkedOKRs.map((okr, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                <Target className="h-3 w-3 mr-1" />
                                {okr}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="notes" className="space-y-4 mt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Meeting Notes</h3>
                  <Button size="sm" className="gap-2" data-testid="button-add-note">
                    <Plus className="h-4 w-4" />
                    Add Note
                  </Button>
                </div>

                {selectedMeeting.notes.length > 0 ? (
                  <div className="space-y-4">
                    {selectedMeeting.notes.map((note) => (
                      <Card key={note.id} data-testid={`note-${note.id}`}>
                        <CardContent className="p-4">
                          <p className="text-sm mb-3">{note.content}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                            <span>by {note.createdBy}</span>
                            <span>{note.createdAt}</span>
                          </div>
                          {(note.linkedOKRs.length > 0 || note.linkedMetrics.length > 0) && (
                            <div className="flex flex-wrap gap-1 pt-2 border-t">
                              {note.linkedOKRs.map((okr, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  <Target className="h-3 w-3 mr-1" />
                                  {okr}
                                </Badge>
                              ))}
                              {note.linkedMetrics.map((metric, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  <Link2 className="h-3 w-3 mr-1" />
                                  {metric}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-4">
                        No notes captured yet. Add notes during or after the meeting.
                      </p>
                      <div className="space-y-3">
                        <Textarea
                          placeholder="Enter meeting notes, key points, or decisions..."
                          rows={4}
                          data-testid="input-new-note"
                        />
                        <div>
                          <Label className="text-sm mb-2 block">Link to OKRs/Metrics</Label>
                          <div className="flex flex-wrap gap-2">
                            {availableOKRs.map((okr) => (
                              <Badge key={okr} variant="outline" className="cursor-pointer text-xs">
                                <Target className="h-3 w-3 mr-1" />
                                {okr}
                              </Badge>
                            ))}
                            {availableMetrics.map((metric) => (
                              <Badge key={metric} variant="secondary" className="cursor-pointer text-xs">
                                <Link2 className="h-3 w-3 mr-1" />
                                {metric}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Button className="w-full" data-testid="button-save-note">
                          Save Note
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="outcomes" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="outcomes" className="text-base font-semibold">
                    Key Outcomes & Decisions
                  </Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Document important decisions, commitments, and outcomes from this meeting
                  </p>
                  <Textarea
                    id="outcomes"
                    value={selectedMeeting.outcomes}
                    onChange={(e) => {
                      const updated = meetings.map((m) =>
                        m.id === selectedMeeting.id ? { ...m, outcomes: e.target.value } : m
                      );
                      setMeetings(updated);
                      setSelectedMeeting({ ...selectedMeeting, outcomes: e.target.value });
                    }}
                    placeholder="Enter key outcomes and decisions..."
                    rows={6}
                    data-testid="input-outcomes"
                  />
                </div>

                <div>
                  <Label htmlFor="next-steps" className="text-base font-semibold">
                    Next Steps & Action Items
                  </Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    List action items, owners, and deadlines
                  </p>
                  <Textarea
                    id="next-steps"
                    value={selectedMeeting.nextSteps}
                    onChange={(e) => {
                      const updated = meetings.map((m) =>
                        m.id === selectedMeeting.id ? { ...m, nextSteps: e.target.value } : m
                      );
                      setMeetings(updated);
                      setSelectedMeeting({ ...selectedMeeting, nextSteps: e.target.value });
                    }}
                    placeholder="1. Action item with owner and deadline&#10;2. Follow-up task..."
                    rows={6}
                    data-testid="input-next-steps"
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={() => {
                    toast({
                      title: "Meeting Outcomes Saved",
                      description: "Key outcomes and next steps have been captured",
                    });
                  }}
                  data-testid="button-save-outcomes"
                >
                  Save Outcomes
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
