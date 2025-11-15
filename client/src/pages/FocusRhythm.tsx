import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Video, Users, ExternalLink, Sparkles, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const mockMeetings = [
  {
    id: "1",
    title: "Strategic Planning Review",
    day: "Monday",
    time: "9:00 AM - 10:00 AM",
    attendees: 8,
    teamsLink: "https://teams.microsoft.com/meet/abc123",
    aiSummary: "Review Q4 strategic objectives and align on key initiatives for the upcoming quarter.",
  },
  {
    id: "2",
    title: "Weekly Team Sync",
    day: "Wednesday",
    time: "2:00 PM - 3:00 PM",
    attendees: 12,
    teamsLink: "https://teams.microsoft.com/meet/def456",
    aiSummary: "Team updates, blockers discussion, and sprint planning for the week ahead.",
  },
  {
    id: "3",
    title: "OKR Progress Check",
    day: "Friday",
    time: "10:00 AM - 11:00 AM",
    attendees: 6,
    teamsLink: "https://teams.microsoft.com/meet/ghi789",
    aiSummary: "Review progress on quarterly OKRs and discuss any adjustments needed.",
  },
];

export default function FocusRhythm() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Focus Rhythm</h1>
          <p className="text-muted-foreground">
            Manage your meeting cadence and rhythm
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default" className="gap-1">
            <Mail className="h-3 w-3" />
            Outlook Connected
          </Badge>
          <Button variant="outline" size="sm" data-testid="button-sync-calendar">
            Sync Calendar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="weekly" className="space-y-6">
        <TabsList>
          <TabsTrigger value="weekly" data-testid="tab-weekly">
            <Calendar className="h-4 w-4 mr-2" />
            Weekly View
          </TabsTrigger>
          <TabsTrigger value="monthly" data-testid="tab-monthly">
            Monthly View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">This Week's Meetings</h2>
              {mockMeetings.map((meeting) => (
                <Card key={meeting.id} className="hover-elevate" data-testid={`meeting-card-${meeting.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-lg">{meeting.title}</CardTitle>
                      <Badge variant="secondary">{meeting.day}</Badge>
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      data-testid={`button-join-meeting-${meeting.id}`}
                    >
                      <Video className="h-4 w-4" />
                      Join Teams Meeting
                      <ExternalLink className="h-3 w-3 ml-auto" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">AI Meeting Summaries</h2>
              </div>
              {mockMeetings.map((meeting) => (
                <Card key={meeting.id} className="bg-accent/30" data-testid={`summary-card-${meeting.id}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{meeting.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {meeting.aiSummary}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="monthly">
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Monthly calendar view would be displayed here with all recurring meetings and events
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
