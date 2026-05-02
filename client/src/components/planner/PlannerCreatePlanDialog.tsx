import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle, AlertCircle, Users, Plus, Search, Hash, Pin, ArrowLeft, FolderPlus, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PlannerCreatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bigRockId: string;
  bigRockTitle: string;
}

type ConnectionStep = "choose-method" | "select-team" | "select-plan" | "create-plan" | "select-channel" | "confirm";
type ConnectionMethod = "existing-plan" | "create-in-team";

interface TeamItem {
  id: string;
  displayName: string;
  description?: string;
}

interface ChannelItem {
  id: string;
  displayName: string;
  membershipType?: string;
}

interface PlanItem {
  id: string;
  title: string;
  graphPlanId: string;
  groupDisplayName?: string | null;
}

interface BucketItem {
  id: string;
  name: string;
  planId: string;
}

export function PlannerCreatePlanDialog({
  open,
  onOpenChange,
  bigRockId,
  bigRockTitle,
}: PlannerCreatePlanDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<ConnectionStep>("choose-method");
  const [method, setMethod] = useState<ConnectionMethod | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamItem | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanItem | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<BucketItem | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<ChannelItem | null>(null);
  const [pinToChannel, setPinToChannel] = useState(true);
  const [newPlanName, setNewPlanName] = useState(bigRockTitle || "");
  const [newBucketName, setNewBucketName] = useState("");
  const [teamSearchQuery, setTeamSearchQuery] = useState("");

  const { data: teams = [], isLoading: loadingTeams, error: teamsError } = useQuery<TeamItem[]>({
    queryKey: ["/api/planner/teams"],
    enabled: open && (step === "select-team"),
    retry: false,
  });

  const teamsErrorMsg = (teamsError as any)?.message?.toLowerCase() || '';
  const needsReconnect = !!teamsError && (
    teamsErrorMsg.includes('expired') ||
    teamsErrorMsg.includes('reconnect') ||
    teamsErrorMsg.startsWith('401')
  );

  const handleReconnectPlanner = () => {
    window.location.href = "/auth/entra/planner/connect";
  };

  const filteredTeams = useMemo(() => {
    if (!teamSearchQuery.trim()) return teams;
    const q = teamSearchQuery.toLowerCase();
    return teams.filter(t =>
      t.displayName.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q)
    );
  }, [teams, teamSearchQuery]);

  const { data: channels = [], isLoading: loadingChannels } = useQuery<ChannelItem[]>({
    queryKey: ["/api/planner/teams", selectedTeam?.id, "channels"],
    enabled: open && selectedTeam !== null && step === "select-channel",
    retry: false,
  });

  const { data: existingPlans = [], isLoading: loadingPlans } = useQuery<PlanItem[]>({
    queryKey: ["/api/planner/plans"],
    enabled: open && method === "existing-plan" && step === "select-plan",
    retry: false,
  });

  const { data: buckets = [], isLoading: loadingBuckets } = useQuery<BucketItem[]>({
    queryKey: ["/api/planner/plans", selectedPlan?.id, "buckets"],
    enabled: open && selectedPlan !== null && step === "confirm",
    retry: false,
  });

  const createPlanMutation = useMutation({
    mutationFn: async ({ teamId, title, channelId, bucketName }: {
      teamId: string;
      title: string;
      channelId?: string;
      bucketName?: string;
    }) => {
      const res = await apiRequest("POST", `/api/planner/teams/${teamId}/plans`, {
        title,
        channelId: pinToChannel && channelId ? channelId : undefined,
        bucketName: bucketName || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      const plan = data.plan;
      const bucket = data.bucket;
      setSelectedPlan(plan);
      if (bucket) {
        setSelectedBucket(bucket);
      } else if (data.syncedBuckets?.length > 0) {
        setSelectedBucket(data.syncedBuckets[0]);
      }
      toast({ title: "Plan created", description: `"${plan.title}" created in Microsoft Planner` });
      if (data.tabError) {
        toast({
          title: "Could not pin tab to channel",
          description: data.tabError.includes('scope') || data.tabError.includes('permission')
            ? "Your Microsoft account needs the TeamsTab.Create permission. Ask your admin to grant it, or you can pin the tab manually in Teams."
            : data.tabError,
          variant: "destructive",
        });
      }
      setStep("confirm");
    },
    onError: (error: any) => {
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('expired') || msg.includes('reconnect') || msg.includes('401')) {
        setStep("select-team");
        queryClient.invalidateQueries({ queryKey: ["/api/planner/teams"] });
      }
      toast({ title: "Failed to create plan", description: error.message, variant: "destructive" });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/planner/mapping/bigrock/${bigRockId}`, {
        plannerPlanId: selectedPlan?.id,
        plannerBucketId: selectedBucket?.id || null,
        plannerSyncEnabled: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/planner/mapping/bigrock/${bigRockId}/progress`] });
      queryClient.invalidateQueries({ queryKey: ["/api/planner/plans"] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/big-rocks`] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/context"] });
      toast({ title: "Connected to Planner", description: "This Big Rock is now linked to a Planner plan for task sync." });
      onOpenChange(false);
      resetState();
    },
    onError: (error: any) => {
      toast({ title: "Failed to connect", description: error.message, variant: "destructive" });
    },
  });

  const resetState = () => {
    setStep("choose-method");
    setMethod(null);
    setSelectedTeam(null);
    setSelectedPlan(null);
    setSelectedBucket(null);
    setSelectedChannel(null);
    setPinToChannel(true);
    setNewPlanName(bigRockTitle || "");
    setNewBucketName("");
    setTeamSearchQuery("");
  };

  const handleMethodSelect = (m: ConnectionMethod) => {
    setMethod(m);
    if (m === "existing-plan") {
      setStep("select-plan");
    } else {
      setStep("select-team");
    }
  };

  const handleTeamSelect = (team: TeamItem) => {
    setSelectedTeam(team);
    setNewPlanName(bigRockTitle || "");
    setStep("select-channel");
  };

  const handleChannelSelect = () => {
    setStep("create-plan");
  };

  const handleCreatePlan = () => {
    if (!selectedTeam || !newPlanName.trim()) return;
    createPlanMutation.mutate({
      teamId: selectedTeam.id,
      title: newPlanName.trim(),
      channelId: selectedChannel?.id,
      bucketName: newBucketName.trim() || undefined,
    });
  };

  const handlePlanSelect = (plan: PlanItem) => {
    setSelectedPlan(plan);
    setStep("confirm");
  };

  const handleConnect = () => {
    connectMutation.mutate();
  };

  const goBack = () => {
    if (step === "select-team") setStep("choose-method");
    else if (step === "select-plan") setStep("choose-method");
    else if (step === "select-channel") setStep("select-team");
    else if (step === "create-plan") setStep("select-channel");
    else if (step === "confirm" && method === "existing-plan") setStep("select-plan");
    else if (step === "confirm") setStep("create-plan");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetState(); }}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Connect to Microsoft Planner
          </DialogTitle>
          <DialogDescription>
            Link "{bigRockTitle}" to a Planner plan for bidirectional task sync.
          </DialogDescription>
        </DialogHeader>

        {step !== "choose-method" && (
          <Button variant="ghost" size="sm" onClick={goBack} className="self-start" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        )}

        {step === "choose-method" && (
          <div className="space-y-3" data-testid="step-choose-method">
            <p className="text-sm text-muted-foreground">How would you like to connect?</p>
            <div className="grid grid-cols-1 gap-3">
              <Card
                className="cursor-pointer hover-elevate"
                onClick={() => handleMethodSelect("create-in-team")}
                data-testid="option-create-plan"
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="rounded-md bg-primary/10 p-2">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Create New Plan in a Team</p>
                    <p className="text-xs text-muted-foreground">Select a Team, pick a channel, and create a new Planner plan</p>
                  </div>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer hover-elevate"
                onClick={() => handleMethodSelect("existing-plan")}
                data-testid="option-existing-plan"
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="rounded-md bg-primary/10 p-2">
                    <Link2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Connect to Existing Plan</p>
                    <p className="text-xs text-muted-foreground">Link to a plan that's already been synced to Vega</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === "select-team" && (
          <div className="space-y-3" data-testid="step-select-team">
            <p className="text-sm text-muted-foreground">Select a Microsoft Team to create the plan in:</p>
            {needsReconnect ? (
              <div className="text-center py-8 space-y-3">
                <AlertCircle className="h-8 w-8 mx-auto text-destructive opacity-60" />
                <p className="text-sm font-medium">Your Microsoft connection has expired</p>
                <p className="text-xs text-muted-foreground">You need to sign in again with Microsoft to access your Teams and Planner.</p>
                <Button onClick={handleReconnectPlanner} data-testid="button-reconnect-planner">
                  <Link2 className="h-4 w-4 mr-2" />
                  Reconnect to Microsoft
                </Button>
              </div>
            ) : (
            <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={teamSearchQuery}
                onChange={(e) => setTeamSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-teams"
              />
            </div>
            {loadingTeams ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading your Teams...</span>
              </div>
            ) : filteredTeams.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {teamSearchQuery ? "No teams match your search" : "No Teams found. Make sure your Planner connection is active."}
              </div>
            ) : (
              <ScrollArea className="h-[280px]">
                <div className="space-y-1 pr-4">
                  {filteredTeams.map((team) => (
                    <Card
                      key={team.id}
                      className="cursor-pointer hover-elevate"
                      onClick={() => handleTeamSelect(team)}
                      data-testid={`team-item-${team.id}`}
                    >
                      <CardContent className="flex items-center gap-3 p-3">
                        <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{team.displayName}</p>
                          {team.description && (
                            <p className="text-xs text-muted-foreground truncate">{team.description}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
            </>
            )}
          </div>
        )}

        {step === "select-channel" && (
          <div className="space-y-3" data-testid="step-select-channel">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                <Users className="w-3 h-3 mr-1" />
                {selectedTeam?.displayName}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Optionally pin the plan as a tab in a channel:</p>

            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                id="pinToChannel"
                checked={pinToChannel}
                onCheckedChange={(checked) => setPinToChannel(checked as boolean)}
                data-testid="checkbox-pin-to-channel"
              />
              <Label htmlFor="pinToChannel" className="text-sm">
                Pin plan as a Planner tab in a channel
              </Label>
            </div>

            {pinToChannel && (
              <>
                {loadingChannels ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading channels...</span>
                  </div>
                ) : (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-1 pr-4">
                      {channels.map((ch) => (
                        <Card
                          key={ch.id}
                          className={`cursor-pointer hover-elevate ${selectedChannel?.id === ch.id ? 'ring-2 ring-primary' : ''}`}
                          onClick={() => setSelectedChannel(ch)}
                          data-testid={`channel-item-${ch.id}`}
                        >
                          <CardContent className="flex items-center gap-3 p-3">
                            <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <p className="text-sm truncate">{ch.displayName}</p>
                            {selectedChannel?.id === ch.id && (
                              <CheckCircle className="h-4 w-4 text-primary ml-auto flex-shrink-0" />
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </>
            )}

            <DialogFooter>
              <Button onClick={handleChannelSelect} data-testid="button-next-channel">
                {pinToChannel && !selectedChannel ? "Skip Channel" : "Next"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "create-plan" && (
          <div className="space-y-4" data-testid="step-create-plan">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">
                <Users className="w-3 h-3 mr-1" />
                {selectedTeam?.displayName}
              </Badge>
              {selectedChannel && pinToChannel && (
                <Badge variant="outline">
                  <Pin className="w-3 h-3 mr-1" />
                  {selectedChannel.displayName}
                </Badge>
              )}
            </div>

            <div>
              <Label htmlFor="planName">Plan Name *</Label>
              <Input
                id="planName"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                placeholder="Enter plan name..."
                data-testid="input-plan-name"
              />
            </div>

            <div>
              <Label htmlFor="bucketName">Initial Bucket Name (optional)</Label>
              <Input
                id="bucketName"
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value)}
                placeholder="e.g., Tasks, Sprint 1, To Do..."
                data-testid="input-bucket-name"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Creates a bucket in the plan. Tasks will be synced into this bucket.
              </p>
            </div>

            <DialogFooter>
              <Button
                onClick={handleCreatePlan}
                disabled={!newPlanName.trim() || createPlanMutation.isPending}
                data-testid="button-create-plan"
              >
                {createPlanMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-4 h-4 mr-1" />
                    Create Plan
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "select-plan" && (
          <div className="space-y-3" data-testid="step-select-plan">
            <p className="text-sm text-muted-foreground">Select an existing plan that's been synced to Vega:</p>
            {loadingPlans ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading plans...</span>
              </div>
            ) : existingPlans.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No synced plans found. Sync your Planner data first in Tenant Admin, or create a new plan.
                </p>
                <Button variant="outline" className="mt-3" onClick={() => handleMethodSelect("create-in-team")} data-testid="button-switch-create">
                  <Plus className="w-4 h-4 mr-1" />
                  Create New Plan Instead
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[280px]">
                <div className="space-y-1 pr-4">
                  {existingPlans.map((plan) => (
                    <Card
                      key={plan.id}
                      className="cursor-pointer hover-elevate"
                      onClick={() => handlePlanSelect(plan)}
                      data-testid={`plan-item-${plan.id}`}
                    >
                      <CardContent className="flex items-center gap-3 p-3">
                        <FolderPlus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="truncate">
                          <p className="text-sm font-medium truncate">{plan.title}</p>
                          {plan.groupDisplayName && (
                            <p className="text-xs text-muted-foreground truncate">{plan.groupDisplayName}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4" data-testid="step-confirm">
            <div className="rounded-md border p-4 space-y-3">
              <p className="text-sm font-medium">Connection Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Big Rock:</span>
                  <span className="font-medium truncate">{bigRockTitle}</span>
                </div>
                {selectedTeam && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Team:</span>
                    <Badge variant="secondary">
                      <Users className="w-3 h-3 mr-1" />
                      {selectedTeam.displayName}
                    </Badge>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Plan:</span>
                  <span className="font-medium">{selectedPlan?.title}</span>
                </div>
                {selectedBucket && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Bucket:</span>
                    <span>{selectedBucket.name}</span>
                  </div>
                )}
                {selectedChannel && pinToChannel && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Channel Tab:</span>
                    <Badge variant="outline">
                      <Pin className="w-3 h-3 mr-1" />
                      {selectedChannel.displayName}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {method === "existing-plan" && buckets.length > 0 && (
              <div>
                <Label>Filter to specific bucket (optional)</Label>
                <Select
                  value={selectedBucket?.id || "all"}
                  onValueChange={(val) => {
                    if (val === "all") {
                      setSelectedBucket(null);
                    } else {
                      const b = buckets.find(bk => bk.id === val);
                      if (b) setSelectedBucket(b);
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-bucket">
                    <SelectValue placeholder="All buckets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All buckets</SelectItem>
                    {buckets.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { onOpenChange(false); resetState(); }}>
                Cancel
              </Button>
              <Button
                onClick={handleConnect}
                disabled={connectMutation.isPending}
                data-testid="button-confirm-connect"
              >
                {connectMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Connect
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
