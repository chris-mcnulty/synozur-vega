import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, AlertCircle, Calendar, Plus, Pencil, Trash2, Building2, User, Globe, X, Clock, Shield, Settings2, Cloud, ShieldCheck, ExternalLink, UserPlus, Users, Search, Upload, Mail, FileText, Download, BookOpen, Activity, Palette, Ban, CreditCard } from "lucide-react";
import { type TenantBranding, vocabularyAlternatives, type VocabularyTerms, type ServicePlan, type BlockedDomain } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { AIUsageWidget } from "@/components/AIUsageWidget";
import excelIcon from "@assets/Excel_512_1765494903271.png";
import oneDriveIcon from "@assets/OneDrive_512_1765494903274.png";
import outlookIcon from "@assets/Outlook_512_1765494903276.png";
import sharePointIcon from "@assets/SharePoint_512_1765494903279.png";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Tenant } from "@/contexts/TenantContext";
import type { DefaultTimePeriod } from "@shared/schema";

const currentYear = new Date().getFullYear();
const getCurrentQuarter = () => Math.ceil((new Date().getMonth() + 1) / 3);

const generateQuarterOptions = () => {
  const options = [];
  for (let year = currentYear + 1; year >= currentYear - 2; year--) {
    for (let q = 4; q >= 1; q--) {
      options.push({
        value: `${year}-Q${q}`,
        label: `Q${q} ${year}`,
        year,
        quarter: q,
      });
    }
  }
  return options;
};

const quarterOptions = generateQuarterOptions();

type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  tenantId: string | null;
  emailVerified: boolean;
};

type ConsultantAccessGrant = {
  id: string;
  consultantUserId: string;
  tenantId: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt: string | null;
  notes: string | null;
  consultantEmail?: string;
  consultantName?: string | null;
};

const m365Connectors = [
  {
    id: "onedrive",
    key: "connectorOneDrive",
    name: "OneDrive",
    icon: oneDriveIcon,
    description: "Access personal files and documents stored in OneDrive",
  },
  {
    id: "sharepoint",
    key: "connectorSharePoint",
    name: "SharePoint",
    icon: sharePointIcon,
    description: "Access shared documents and sites in SharePoint",
  },
  {
    id: "outlook",
    key: "connectorOutlook",
    name: "Outlook",
    icon: outlookIcon,
    description: "Calendar integration for meetings and scheduling",
  },
  {
    id: "excel",
    key: "connectorExcel",
    name: "Excel",
    icon: excelIcon,
    description: "Sync Key Result data from Excel spreadsheets",
  },
  {
    id: "planner",
    key: "connectorPlanner",
    name: "Planner",
    iconLucide: Calendar,
    description: "Sync tasks and plans with Microsoft Planner",
  },
];

const permissions = [
  { id: "read-calendar", label: "Read Calendar Events", enabled: true },
  { id: "manage-tasks", label: "Manage Tasks in Planner", enabled: true },
  { id: "read-mail", label: "Read Email Headers", enabled: false },
  { id: "create-meetings", label: "Create Meetings", enabled: true },
];

const standardColors = [
  { name: "Blue", value: "#3B82F6" },
  { name: "Purple", value: "#A855F7" },
  { name: "Pink", value: "#EC4899" },
  { name: "Green", value: "#10B981" },
  { name: "Orange", value: "#F97316" },
  { name: "Red", value: "#EF4444" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Indigo", value: "#6366F1" },
];

type Team = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  parentTeamId: string | null;
  level: number | null;
  leaderId: string | null;
  leaderEmail: string | null;
  memberIds: string[] | null;
  createdAt: Date | null;
};

function TeamManagementSection({ 
  tenants,
  users
}: { 
  tenants: Tenant[];
  users: User[];
}) {
  const { toast } = useToast();
  const [selectedTenantId, setSelectedTenantId] = useState<string>(tenants[0]?.id || "");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>("");
  
  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams", selectedTenantId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${selectedTenantId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch teams");
      return res.json();
    },
    enabled: !!selectedTenantId,
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; leaderId?: string }) => {
      return await apiRequest("POST", "/api/teams", {
        tenantId: selectedTenantId,
        name: data.name,
        description: data.description || null,
        leaderId: data.leaderId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTenantId] });
      setIsCreateDialogOpen(false);
      setNewTeamName("");
      setNewTeamDescription("");
      setSelectedLeaderId("");
      toast({ title: "Team created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create team", 
        description: error.message || "Unknown error",
        variant: "destructive" 
      });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Team> }) => {
      return await apiRequest("PATCH", `/api/teams/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTenantId] });
      setIsEditDialogOpen(false);
      setEditingTeam(null);
      toast({ title: "Team updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update team", 
        description: error.message || "Unknown error",
        variant: "destructive" 
      });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/teams/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTenantId] });
      toast({ title: "Team deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete team", 
        description: error.message || "Unknown error",
        variant: "destructive" 
      });
    },
  });

  const handleOpenEditDialog = (team: Team) => {
    setEditingTeam(team);
    setNewTeamName(team.name);
    setNewTeamDescription(team.description || "");
    setSelectedLeaderId(team.leaderId || "");
    setIsEditDialogOpen(true);
  };

  const tenantUsers = users.filter(u => u.tenantId === selectedTenantId);

  const getLeaderName = (leaderId: string | null) => {
    if (!leaderId) return null;
    const user = users.find(u => u.id === leaderId);
    return user?.name || user?.email || leaderId;
  };

  return (
    <div data-testid="team-management-section">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Team Management</h2>
          <p className="text-muted-foreground text-sm">
            Create and manage teams for organizing objectives and key results by department or division.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tenants.length > 1 && (
            <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
              <SelectTrigger className="w-48" data-testid="select-team-tenant">
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map(tenant => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-team">
            <Plus className="h-4 w-4 mr-2" />
            Add Team
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-muted-foreground">Loading teams...</p>
          ) : teams.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No teams created yet</p>
              <p className="text-sm text-muted-foreground">Create teams to organize your objectives by department or division</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Leader</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id} data-testid={`team-row-${team.id}`}>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {team.description || "-"}
                    </TableCell>
                    <TableCell>
                      {team.leaderId ? (
                        <Badge variant="secondary">{getLeaderName(team.leaderId)}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">No leader</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {team.memberIds?.length || 0} members
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditDialog(team)}
                          title="Edit team"
                          data-testid={`button-edit-team-${team.id}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete team "${team.name}"?`)) {
                              deleteTeamMutation.mutate(team.id);
                            }
                          }}
                          title="Delete team"
                          data-testid={`button-delete-team-${team.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Team Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
            <DialogDescription>
              Add a new team to organize objectives and key results.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="team-name">Team Name</Label>
              <Input
                id="team-name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="e.g., Engineering, Marketing, Sales"
                data-testid="input-team-name"
              />
            </div>
            <div>
              <Label htmlFor="team-description">Description (optional)</Label>
              <Input
                id="team-description"
                value={newTeamDescription}
                onChange={(e) => setNewTeamDescription(e.target.value)}
                placeholder="Brief description of the team's focus"
                data-testid="input-team-description"
              />
            </div>
            <div>
              <Label htmlFor="team-leader">Team Leader (optional)</Label>
              <Select value={selectedLeaderId} onValueChange={setSelectedLeaderId}>
                <SelectTrigger data-testid="select-team-leader">
                  <SelectValue placeholder="Select a leader" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No leader</SelectItem>
                  {tenantUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createTeamMutation.mutate({ 
                name: newTeamName, 
                description: newTeamDescription,
                leaderId: selectedLeaderId || undefined
              })}
              disabled={!newTeamName.trim() || createTeamMutation.isPending}
              data-testid="button-confirm-create-team"
            >
              {createTeamMutation.isPending ? "Creating..." : "Create Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>
              Update team details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-team-name">Team Name</Label>
              <Input
                id="edit-team-name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Team name"
                data-testid="input-edit-team-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-team-description">Description (optional)</Label>
              <Input
                id="edit-team-description"
                value={newTeamDescription}
                onChange={(e) => setNewTeamDescription(e.target.value)}
                placeholder="Brief description"
                data-testid="input-edit-team-description"
              />
            </div>
            <div>
              <Label htmlFor="edit-team-leader">Team Leader</Label>
              <Select value={selectedLeaderId} onValueChange={setSelectedLeaderId}>
                <SelectTrigger data-testid="select-edit-team-leader">
                  <SelectValue placeholder="Select a leader" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No leader</SelectItem>
                  {tenantUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (editingTeam) {
                  updateTeamMutation.mutate({
                    id: editingTeam.id,
                    data: {
                      name: newTeamName,
                      description: newTeamDescription || null,
                      leaderId: selectedLeaderId || null,
                    }
                  });
                }
              }}
              disabled={!newTeamName.trim() || updateTeamMutation.isPending}
              data-testid="button-confirm-edit-team"
            >
              {updateTeamMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConsultantAccessCard({ 
  tenant, 
  onOpenGrantDialog, 
  onRevokeAccess 
}: { 
  tenant: Tenant; 
  onOpenGrantDialog: (tenant: Tenant) => void;
  onRevokeAccess: (userId: string) => void;
}) {
  const { data: grants = [], isLoading } = useQuery<ConsultantAccessGrant[]>({
    queryKey: ["/api/consultant-access/tenant", tenant.id],
  });

  return (
    <Card data-testid={`consultant-access-card-${tenant.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: tenant.color || '#6366F1' }}
            />
            <CardTitle className="text-base">{tenant.name}</CardTitle>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenGrantDialog(tenant)}
            data-testid={`button-grant-access-${tenant.id}`}
          >
            <UserPlus className="h-3 w-3 mr-1" />
            Grant Access
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : grants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No consultants have access</p>
        ) : (
          <div className="space-y-2">
            {grants.map((grant) => (
              <div 
                key={grant.id} 
                className="flex items-center justify-between p-2 border rounded-md text-sm"
                data-testid={`consultant-grant-${grant.id}`}
              >
                <div>
                  <p className="font-medium">{grant.consultantName || grant.consultantEmail}</p>
                  <p className="text-xs text-muted-foreground">{grant.consultantEmail}</p>
                  {grant.expiresAt && (
                    <p className="text-xs text-muted-foreground">
                      Expires: {new Date(grant.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Revoke access for ${grant.consultantEmail}?`)) {
                      onRevokeAccess(grant.consultantUserId);
                    }
                  }}
                  data-testid={`button-revoke-${grant.id}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TenantAdmin() {
  const { toast } = useToast();
  const [permissionStates, setPermissionStates] = useState(
    Object.fromEntries(permissions.map((p) => [p.id, p.enabled]))
  );
  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [tenantFormData, setTenantFormData] = useState({
    name: "",
    color: "#3B82F6",
    logoUrl: "",
  });

  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [selectedTenantForDomains, setSelectedTenantForDomains] = useState<Tenant | null>(null);
  const [newDomain, setNewDomain] = useState("");

  const [timePeriodDialogOpen, setTimePeriodDialogOpen] = useState(false);
  const [selectedTenantForTime, setSelectedTenantForTime] = useState<Tenant | null>(null);
  const [timePeriodMode, setTimePeriodMode] = useState<'current' | 'specific'>('current');
  const [selectedQuarterValue, setSelectedQuarterValue] = useState(`${currentYear}-Q${getCurrentQuarter()}`);

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState({
    email: "",
    password: "",
    name: "",
    role: "user",
    tenantId: "NONE",
    sendWelcomeEmail: false,
    userType: "client" as "client" | "consultant" | "internal",
  });

  const [ssoDialogOpen, setSsoDialogOpen] = useState(false);
  const [selectedTenantForSso, setSelectedTenantForSso] = useState<Tenant | null>(null);
  const [ssoFormData, setSsoFormData] = useState({
    azureTenantId: "",
    enforceSso: false,
    allowLocalAuth: true,
  });

  const [connectorsDialogOpen, setConnectorsDialogOpen] = useState(false);
  const [selectedTenantForConnectors, setSelectedTenantForConnectors] = useState<Tenant | null>(null);
  const [connectorFormData, setConnectorFormData] = useState({
    connectorOneDrive: false,
    connectorSharePoint: false,
    connectorOutlook: false,
    connectorExcel: false,
    connectorPlanner: false,
  });

  const [vocabularyDialogOpen, setVocabularyDialogOpen] = useState(false);
  const [selectedTenantForVocabulary, setSelectedTenantForVocabulary] = useState<Tenant | null>(null);
  const [vocabularyFormData, setVocabularyFormData] = useState<{
    goal: { singular: string; plural: string };
    strategy: { singular: string; plural: string };
    objective: { singular: string; plural: string };
    keyResult: { singular: string; plural: string };
    bigRock: { singular: string; plural: string };
    meeting: { singular: string; plural: string };
    focusRhythm: { singular: string; plural: string };
  }>({
    goal: { singular: "", plural: "" },
    strategy: { singular: "", plural: "" },
    objective: { singular: "", plural: "" },
    keyResult: { singular: "", plural: "" },
    bigRock: { singular: "", plural: "" },
    meeting: { singular: "", plural: "" },
    focusRhythm: { singular: "", plural: "" },
  });

  const [consultantAccessDialogOpen, setConsultantAccessDialogOpen] = useState(false);
  const [selectedTenantForAccess, setSelectedTenantForAccess] = useState<Tenant | null>(null);
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>("");
  const [accessExpiresAt, setAccessExpiresAt] = useState<string>("");
  const [accessNotes, setAccessNotes] = useState<string>("");

  // Branding dialog state
  const [brandingDialogOpen, setBrandingDialogOpen] = useState(false);
  const [selectedTenantForBranding, setSelectedTenantForBranding] = useState<Tenant | null>(null);
  const [brandingFormData, setBrandingFormData] = useState<{
    logoUrl: string;
    logoUrlDark: string;
    faviconUrl: string;
    branding: TenantBranding;
  }>({
    logoUrl: "",
    logoUrlDark: "",
    faviconUrl: "",
    branding: {},
  });

  const [entraSearchQuery, setEntraSearchQuery] = useState("");
  const [entraSearchResults, setEntraSearchResults] = useState<any[]>([]);
  const [isSearchingEntra, setIsSearchingEntra] = useState(false);

  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);
  const [csvData, setCsvData] = useState<{ email: string; name?: string; role?: string; password: string }[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [sendBulkWelcomeEmails, setSendBulkWelcomeEmails] = useState(true);
  const [bulkImportTenantId, setBulkImportTenantId] = useState<string>("NONE");
  const [importResults, setImportResults] = useState<{ email: string; success: boolean; error?: string }[] | null>(null);

  // Platform Admin state
  const { user: currentUser } = useAuth();
  const isPlatformAdmin = currentUser?.role === 'vega_admin' || currentUser?.role === 'global_admin';
  
  const [servicePlanDialogOpen, setServicePlanDialogOpen] = useState(false);
  const [editingServicePlan, setEditingServicePlan] = useState<ServicePlan | null>(null);
  const [servicePlanFormData, setServicePlanFormData] = useState({
    name: "",
    displayName: "",
    durationDays: "",
    maxReadWriteUsers: "",
    maxReadOnlyUsers: "",
    isDefault: false,
  });

  const [blockedDomainDialogOpen, setBlockedDomainDialogOpen] = useState(false);
  const [blockedDomainFormData, setBlockedDomainFormData] = useState({
    domain: "",
    reason: "",
  });

  const [tenantPlanDialogOpen, setTenantPlanDialogOpen] = useState(false);
  const [selectedTenantForPlan, setSelectedTenantForPlan] = useState<any>(null);
  const [tenantPlanFormData, setTenantPlanFormData] = useState({
    servicePlanId: "",
    planExpiresAt: "",
  });

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  // Platform Admin queries
  const { data: servicePlans = [] } = useQuery<ServicePlan[]>({
    queryKey: ["/api/admin/service-plans"],
    enabled: isPlatformAdmin,
  });

  const { data: blockedDomains = [] } = useQuery<BlockedDomain[]>({
    queryKey: ["/api/admin/blocked-domains"],
    enabled: isPlatformAdmin,
  });

  const { data: adminTenants = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/tenants"],
    enabled: isPlatformAdmin,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: consultants = [] } = useQuery<User[]>({
    queryKey: ["/api/consultants"],
  });

  const createTenantMutation = useMutation({
    mutationFn: (data: { name: string; color: string; logoUrl?: string }) =>
      apiRequest("POST", "/api/tenants", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setTenantDialogOpen(false);
      setTenantFormData({ name: "", color: "#3B82F6", logoUrl: "" });
      toast({ title: "Organization created successfully" });
    },
    onError: () => {
      toast({ 
        title: "Failed to create organization", 
        variant: "destructive" 
      });
    },
  });

  const updateTenantMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string; logoUrl?: string; allowedDomains?: string[] } }) =>
      apiRequest("PATCH", `/api/tenants/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setTenantDialogOpen(false);
      setEditingTenant(null);
      setTenantFormData({ name: "", color: "#3B82F6", logoUrl: "" });
      setDomainDialogOpen(false);
      setSelectedTenantForDomains(null);
      setNewDomain("");
      toast({ title: "Organization updated successfully" });
    },
    onError: () => {
      toast({ 
        title: "Failed to update organization", 
        variant: "destructive" 
      });
    },
  });

  const deleteTenantMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/tenants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      toast({ title: "Organization deleted successfully" });
    },
    onError: () => {
      toast({ 
        title: "Failed to delete organization", 
        variant: "destructive" 
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (data: { email: string; password: string; name?: string; role: string; tenantId?: string | null; sendWelcomeEmail?: boolean }) =>
      apiRequest("POST", "/api/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setUserDialogOpen(false);
      setUserFormData({ email: "", password: "", name: "", role: "user", tenantId: "NONE", sendWelcomeEmail: false, userType: "client" });
      toast({ title: "User created successfully" });
    },
    onError: () => {
      toast({ 
        title: "Failed to create user", 
        variant: "destructive" 
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { email?: string; password?: string; name?: string; role?: string; tenantId?: string | null } }) =>
      apiRequest("PATCH", `/api/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setUserDialogOpen(false);
      setEditingUser(null);
      setUserFormData({ email: "", password: "", name: "", role: "user", tenantId: "NONE", sendWelcomeEmail: false, userType: "client" });
      toast({ title: "User updated successfully" });
    },
    onError: () => {
      toast({ 
        title: "Failed to update user", 
        variant: "destructive" 
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted successfully" });
    },
    onError: () => {
      toast({ 
        title: "Failed to delete user", 
        variant: "destructive" 
      });
    },
  });

  const grantConsultantAccessMutation = useMutation({
    mutationFn: (data: { consultantUserId: string; tenantId: string; expiresAt?: string; notes?: string }) =>
      apiRequest("POST", "/api/consultant-access", data),
    onSuccess: () => {
      if (selectedTenantForAccess) {
        queryClient.invalidateQueries({ queryKey: ["/api/consultant-access/tenant", selectedTenantForAccess.id] });
      }
      setConsultantAccessDialogOpen(false);
      setSelectedConsultantId("");
      setAccessExpiresAt("");
      setAccessNotes("");
      toast({ title: "Consultant access granted successfully" });
    },
    onError: () => {
      toast({ 
        title: "Failed to grant consultant access", 
        variant: "destructive" 
      });
    },
  });

  const revokeConsultantAccessMutation = useMutation({
    mutationFn: ({ userId, tenantId }: { userId: string; tenantId: string }) =>
      apiRequest("DELETE", `/api/consultant-access/${userId}/${tenantId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant-access/tenant", variables.tenantId] });
      toast({ title: "Consultant access revoked" });
    },
    onError: () => {
      toast({ 
        title: "Failed to revoke consultant access", 
        variant: "destructive" 
      });
    },
  });

  const resendWelcomeEmailMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest("POST", `/api/users/${userId}/resend-welcome`),
    onSuccess: () => {
      toast({ title: "Welcome email sent successfully" });
    },
    onError: () => {
      toast({ 
        title: "Failed to send welcome email", 
        variant: "destructive" 
      });
    },
  });

  const manualVerifyMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest("POST", `/api/users/${userId}/manual-verify`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User verified successfully" });
    },
    onError: () => {
      toast({ 
        title: "Failed to verify user", 
        variant: "destructive" 
      });
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: (data: { users: any[]; sendWelcomeEmails: boolean; defaultTenantId: string | null }) =>
      apiRequest("POST", "/api/users/bulk-import", data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setImportResults(response.results || []);
      toast({ 
        title: `Import complete: ${response.created} created, ${response.failed} failed` 
      });
    },
    onError: () => {
      toast({ 
        title: "Failed to import users", 
        variant: "destructive" 
      });
    },
  });

  // Platform Admin mutations
  const createServicePlanMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/service-plans", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/service-plans"] });
      setServicePlanDialogOpen(false);
      setServicePlanFormData({ name: "", displayName: "", durationDays: "", maxReadWriteUsers: "", maxReadOnlyUsers: "", isDefault: false });
      toast({ title: "Service plan created" });
    },
    onError: () => {
      toast({ title: "Failed to create service plan", variant: "destructive" });
    },
  });

  const updateServicePlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/admin/service-plans/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/service-plans"] });
      setServicePlanDialogOpen(false);
      setEditingServicePlan(null);
      setServicePlanFormData({ name: "", displayName: "", durationDays: "", maxReadWriteUsers: "", maxReadOnlyUsers: "", isDefault: false });
      toast({ title: "Service plan updated" });
    },
    onError: () => {
      toast({ title: "Failed to update service plan", variant: "destructive" });
    },
  });

  const blockDomainMutation = useMutation({
    mutationFn: (data: { domain: string; reason?: string }) => apiRequest("POST", "/api/admin/blocked-domains", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blocked-domains"] });
      setBlockedDomainDialogOpen(false);
      setBlockedDomainFormData({ domain: "", reason: "" });
      toast({ title: "Domain blocked" });
    },
    onError: (error: any) => {
      const msg = error?.message?.includes("already blocked") ? "Domain is already blocked" : "Failed to block domain";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const unblockDomainMutation = useMutation({
    mutationFn: (domain: string) => apiRequest("DELETE", `/api/admin/blocked-domains/${encodeURIComponent(domain)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blocked-domains"] });
      toast({ title: "Domain unblocked" });
    },
    onError: () => {
      toast({ title: "Failed to unblock domain", variant: "destructive" });
    },
  });

  const updateTenantPlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/admin/tenants/${id}/plan`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setTenantPlanDialogOpen(false);
      setSelectedTenantForPlan(null);
      toast({ title: "Tenant plan updated" });
    },
    onError: () => {
      toast({ title: "Failed to update tenant plan", variant: "destructive" });
    },
  });

  const handleOpenCreateDialog = () => {
    setEditingTenant(null);
    setTenantFormData({ name: "", color: "#3B82F6", logoUrl: "" });
    setTenantDialogOpen(true);
  };

  const handleOpenEditDialog = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setTenantFormData({
      name: tenant.name,
      color: tenant.color || "#3B82F6",
      logoUrl: tenant.logoUrl || "",
    });
    setTenantDialogOpen(true);
  };

  const handleSaveTenant = () => {
    if (editingTenant) {
      updateTenantMutation.mutate({
        id: editingTenant.id,
        data: tenantFormData,
      });
    } else {
      createTenantMutation.mutate(tenantFormData);
    }
  };

  const handleOpenDomainDialog = (tenant: Tenant) => {
    setSelectedTenantForDomains(tenant);
    setNewDomain("");
    setDomainDialogOpen(true);
  };

  const handleAddDomain = () => {
    if (!selectedTenantForDomains || !newDomain.trim()) return;
    
    const currentDomains = selectedTenantForDomains.allowedDomains || [];
    if (currentDomains.includes(newDomain.trim())) {
      toast({ 
        title: "Domain already exists", 
        variant: "destructive" 
      });
      return;
    }

    updateTenantMutation.mutate({
      id: selectedTenantForDomains.id,
      data: {
        allowedDomains: [...currentDomains, newDomain.trim()],
      },
    });
    setNewDomain("");
  };

  const handleRemoveDomain = (domain: string) => {
    if (!selectedTenantForDomains) return;
    
    const currentDomains = selectedTenantForDomains.allowedDomains || [];
    updateTenantMutation.mutate({
      id: selectedTenantForDomains.id,
      data: {
        allowedDomains: currentDomains.filter(d => d !== domain),
      },
    });
  };

  const handleOpenTimePeriodDialog = (tenant: Tenant) => {
    setSelectedTenantForTime(tenant);
    const defaultTime = (tenant as any).defaultTimePeriod as DefaultTimePeriod | null;
    if (defaultTime?.mode === 'specific' && defaultTime.year && defaultTime.quarter) {
      setTimePeriodMode('specific');
      setSelectedQuarterValue(`${defaultTime.year}-Q${defaultTime.quarter}`);
    } else {
      setTimePeriodMode('current');
      setSelectedQuarterValue(`${currentYear}-Q${getCurrentQuarter()}`);
    }
    setTimePeriodDialogOpen(true);
  };

  const handleSaveTimePeriod = () => {
    if (!selectedTenantForTime) return;
    
    let defaultTimePeriod: DefaultTimePeriod;
    if (timePeriodMode === 'current') {
      defaultTimePeriod = { mode: 'current' };
    } else {
      const match = selectedQuarterValue.match(/^(\d+)-Q(\d)$/);
      if (match) {
        defaultTimePeriod = {
          mode: 'specific',
          year: parseInt(match[1]),
          quarter: parseInt(match[2]),
        };
      } else {
        defaultTimePeriod = { mode: 'current' };
      }
    }
    
    updateTenantMutation.mutate({
      id: selectedTenantForTime.id,
      data: { defaultTimePeriod } as any,
    });
    setTimePeriodDialogOpen(false);
  };

  const getTimePeriodDisplay = (tenant: Tenant) => {
    const defaultTime = (tenant as any).defaultTimePeriod as DefaultTimePeriod | null;
    if (!defaultTime || defaultTime.mode === 'current') {
      return 'Current Quarter';
    }
    return `Q${defaultTime.quarter} ${defaultTime.year}`;
  };

  const handleOpenCreateUserDialog = () => {
    setEditingUser(null);
    setUserFormData({ email: "", password: "", name: "", role: "user", tenantId: "NONE", sendWelcomeEmail: false, userType: "client" });
    setUserDialogOpen(true);
  };

  const handleOpenBulkImportDialog = () => {
    setCsvData([]);
    setCsvError(null);
    setImportResults(null);
    setSendBulkWelcomeEmails(true);
    setBulkImportTenantId("NONE");
    setBulkImportDialogOpen(true);
  };

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleCsvFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvError(null);
    setImportResults(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length < 2) {
          setCsvError("CSV must have a header row and at least one data row");
          return;
        }

        const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
        const emailIdx = headers.findIndex(h => h === 'email');
        const nameIdx = headers.findIndex(h => h === 'name');
        const roleIdx = headers.findIndex(h => h === 'role');
        const passwordIdx = headers.findIndex(h => h === 'password');

        if (emailIdx === -1) {
          setCsvError("CSV must have an 'email' column");
          return;
        }
        if (passwordIdx === -1) {
          setCsvError("CSV must have a 'password' column");
          return;
        }

        const parsedUsers: { email: string; name?: string; role?: string; password: string }[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCsvLine(lines[i]);
          const email = values[emailIdx];
          const password = values[passwordIdx];
          
          if (!email || !password) continue;

          parsedUsers.push({
            email,
            password,
            name: nameIdx >= 0 ? values[nameIdx] || undefined : undefined,
            role: roleIdx >= 0 ? values[roleIdx] || undefined : undefined,
          });
        }

        if (parsedUsers.length === 0) {
          setCsvError("No valid users found in CSV");
          return;
        }

        setCsvData(parsedUsers);
      } catch (err) {
        setCsvError("Failed to parse CSV file");
      }
    };
    reader.readAsText(file);
  };

  const handleBulkImport = () => {
    if (csvData.length === 0) return;

    bulkImportMutation.mutate({
      users: csvData,
      sendWelcomeEmails: sendBulkWelcomeEmails,
      defaultTenantId: bulkImportTenantId === "NONE" ? null : bulkImportTenantId,
    });
  };

  const downloadSampleCsv = () => {
    const sampleCsv = "email,name,role,password\njohn.doe@example.com,John Doe,tenant_user,SecurePassword123\njane.smith@example.com,Jane Smith,tenant_admin,AnotherPassword456";
    const blob = new Blob([sampleCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenEditUserDialog = (user: User) => {
    setEditingUser(user);
    setUserFormData({
      email: user.email,
      password: "",
      name: user.name || "",
      role: user.role,
      tenantId: user.tenantId || "NONE",
      sendWelcomeEmail: false,
      userType: ((user as any).userType || "client") as "client" | "consultant" | "internal",
    });
    setUserDialogOpen(true);
  };

  const handleSaveUser = () => {
    const userData = {
      email: userFormData.email,
      name: userFormData.name || undefined,
      role: userFormData.role,
      tenantId: userFormData.tenantId === "NONE" ? null : userFormData.tenantId,
      userType: userFormData.userType,
      ...(userFormData.password && { password: userFormData.password }),
    };

    if (editingUser) {
      updateUserMutation.mutate({
        id: editingUser.id,
        data: userData,
      });
    } else {
      if (!userFormData.password) {
        toast({ 
          title: "Password is required for new users", 
          variant: "destructive" 
        });
        return;
      }
      createUserMutation.mutate({ ...userData, password: userFormData.password, sendWelcomeEmail: userFormData.sendWelcomeEmail });
    }
  };

  const getTenantName = (tenantId: string | null) => {
    if (!tenantId) return "Global";
    const tenant = tenants.find(t => t.id === tenantId);
    return tenant?.name || "Unknown";
  };

  const handleOpenSsoDialog = (tenant: Tenant) => {
    setSelectedTenantForSso(tenant);
    setSsoFormData({
      azureTenantId: (tenant as any).azureTenantId || "",
      enforceSso: (tenant as any).enforceSso || false,
      allowLocalAuth: (tenant as any).allowLocalAuth !== false,
    });
    setSsoDialogOpen(true);
  };

  const handleSaveSsoSettings = () => {
    if (!selectedTenantForSso) return;
    
    updateTenantMutation.mutate({
      id: selectedTenantForSso.id,
      data: {
        azureTenantId: ssoFormData.azureTenantId || null,
        enforceSso: ssoFormData.enforceSso,
        allowLocalAuth: ssoFormData.allowLocalAuth,
      } as any,
    });
    setSsoDialogOpen(false);
  };

  const handleOpenConnectorsDialog = (tenant: Tenant) => {
    setSelectedTenantForConnectors(tenant);
    setConnectorFormData({
      connectorOneDrive: (tenant as any).connectorOneDrive || false,
      connectorSharePoint: (tenant as any).connectorSharePoint || false,
      connectorOutlook: (tenant as any).connectorOutlook || false,
      connectorExcel: (tenant as any).connectorExcel || false,
      connectorPlanner: (tenant as any).connectorPlanner || false,
    });
    setConnectorsDialogOpen(true);
  };

  const handleSaveConnectorSettings = () => {
    if (!selectedTenantForConnectors) return;
    
    updateTenantMutation.mutate({
      id: selectedTenantForConnectors.id,
      data: connectorFormData as any,
    });
    setConnectorsDialogOpen(false);
  };

  const getConnectorCount = (tenant: Tenant) => {
    const t = tenant as any;
    let count = 0;
    if (t.connectorOneDrive) count++;
    if (t.connectorSharePoint) count++;
    if (t.connectorOutlook) count++;
    if (t.connectorExcel) count++;
    if (t.connectorPlanner) count++;
    return count;
  };

  const handleOpenVocabularyDialog = (tenant: Tenant) => {
    setSelectedTenantForVocabulary(tenant);
    const overrides = (tenant as any).vocabularyOverrides || {};
    setVocabularyFormData({
      goal: overrides.goal || { singular: "", plural: "" },
      strategy: overrides.strategy || { singular: "", plural: "" },
      objective: overrides.objective || { singular: "", plural: "" },
      keyResult: overrides.keyResult || { singular: "", plural: "" },
      bigRock: overrides.bigRock || { singular: "", plural: "" },
      meeting: overrides.meeting || { singular: "", plural: "" },
      focusRhythm: overrides.focusRhythm || { singular: "", plural: "" },
    });
    setVocabularyDialogOpen(true);
  };

  const handleSaveVocabularySettings = async () => {
    if (!selectedTenantForVocabulary) return;
    
    const cleanedOverrides: Record<string, { singular: string; plural: string }> = {};
    Object.entries(vocabularyFormData).forEach(([key, value]) => {
      if (value.singular || value.plural) {
        cleanedOverrides[key] = value;
      }
    });
    
    try {
      await apiRequest("PUT", `/api/vocabulary/tenant/${selectedTenantForVocabulary.id}`, cleanedOverrides);
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary"] });
      toast({ title: "Vocabulary settings saved" });
      setVocabularyDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Failed to save vocabulary", description: error.message, variant: "destructive" });
    }
  };

  const getVocabularyOverrideCount = (tenant: Tenant) => {
    const overrides = (tenant as any).vocabularyOverrides || {};
    return Object.keys(overrides).filter(key => {
      const value = overrides[key];
      return value && (value.singular || value.plural);
    }).length;
  };

  const getSsoStatus = (tenant: Tenant) => {
    const azureTenantId = (tenant as any).azureTenantId;
    const enforceSso = (tenant as any).enforceSso;
    if (!azureTenantId) return { label: "Not Configured", variant: "secondary" as const };
    if (enforceSso) return { label: "SSO Required", variant: "default" as const };
    return { label: "SSO Available", variant: "outline" as const };
  };

  // Branding handlers
  const handleOpenBrandingDialog = (tenant: Tenant) => {
    setSelectedTenantForBranding(tenant);
    const t = tenant as any;
    setBrandingFormData({
      logoUrl: t.logoUrl || "",
      logoUrlDark: t.logoUrlDark || "",
      faviconUrl: t.faviconUrl || "",
      branding: t.branding || {},
    });
    setBrandingDialogOpen(true);
  };

  const handleSaveBrandingSettings = async () => {
    if (!selectedTenantForBranding) return;
    
    try {
      await apiRequest("PATCH", `/api/tenants/${selectedTenantForBranding.id}`, {
        logoUrl: brandingFormData.logoUrl || null,
        logoUrlDark: brandingFormData.logoUrlDark || null,
        faviconUrl: brandingFormData.faviconUrl || null,
        branding: brandingFormData.branding,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      toast({ title: "Branding settings saved" });
      setBrandingDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Failed to save branding", description: error.message, variant: "destructive" });
    }
  };

  const getBrandingStatus = (tenant: Tenant) => {
    const t = tenant as any;
    const hasLogo = !!t.logoUrl;
    const hasColors = t.branding && (t.branding.primaryColor || t.branding.secondaryColor);
    if (hasLogo && hasColors) return { label: "Customized", variant: "default" as const };
    if (hasLogo || hasColors) return { label: "Partial", variant: "outline" as const };
    return { label: "Default", variant: "secondary" as const };
  };

  const handleOpenConsultantAccessDialog = (tenant: Tenant) => {
    setSelectedTenantForAccess(tenant);
    setSelectedConsultantId("");
    setAccessExpiresAt("");
    setAccessNotes("");
    setConsultantAccessDialogOpen(true);
  };

  const handleGrantConsultantAccess = () => {
    if (!selectedTenantForAccess || !selectedConsultantId) return;
    
    grantConsultantAccessMutation.mutate({
      consultantUserId: selectedConsultantId,
      tenantId: selectedTenantForAccess.id,
      expiresAt: accessExpiresAt || undefined,
      notes: accessNotes || undefined,
    });
  };

  const handleEntraSearch = async (query: string) => {
    if (query.length < 2) {
      setEntraSearchResults([]);
      return;
    }
    setIsSearchingEntra(true);
    try {
      const response = await fetch(`/auth/entra/users/search?q=${encodeURIComponent(query)}&limit=10`, {
        credentials: 'include'
      });
      const data = await response.json();
      setEntraSearchResults(data.users || []);
    } catch (error) {
      console.error('Entra search failed:', error);
      setEntraSearchResults([]);
    } finally {
      setIsSearchingEntra(false);
    }
  };

  const handleSelectEntraUser = (user: any) => {
    setUserFormData({
      ...userFormData,
      email: user.mail || user.userPrincipalName,
      name: user.displayName || "",
    });
    setEntraSearchQuery("");
    setEntraSearchResults([]);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Tenant Administration</h1>
        <p className="text-muted-foreground">
          Manage organizations, domains, users, M365 connections, and app permissions
        </p>
      </div>

      <div className="space-y-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Organizations</h2>
            <Button 
              onClick={handleOpenCreateDialog}
              data-testid="button-create-tenant"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Organization
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenantsLoading ? (
              <Card>
                <CardContent className="p-6">
                  <p className="text-muted-foreground">Loading...</p>
                </CardContent>
              </Card>
            ) : (
              tenants.map((tenant) => (
                <Card key={tenant.id} data-testid={`tenant-card-${tenant.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {tenant.logoUrl ? (
                          <img 
                            src={tenant.logoUrl} 
                            alt={`${tenant.name} logo`}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold"
                            style={{ backgroundColor: tenant.color || "#3B82F6" }}
                          >
                            {tenant.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <CardTitle className="text-lg">{tenant.name}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditDialog(tenant)}
                        data-testid={`button-edit-tenant-${tenant.id}`}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${tenant.name}"? This will remove all associated data.`)) {
                            deleteTenantMutation.mutate(tenant.id);
                          }
                        }}
                        data-testid={`button-delete-tenant-${tenant.id}`}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => handleOpenDomainDialog(tenant)}
                      data-testid={`button-manage-domains-${tenant.id}`}
                    >
                      <Globe className="h-3 w-3 mr-1" />
                      Membership: 
                      {(tenant as any).inviteOnly ? (
                        <Badge variant="outline" className="ml-1 text-xs">Invite Only</Badge>
                      ) : (
                        <Badge variant="secondary" className="ml-1 text-xs">{(tenant.allowedDomains || []).length} domains</Badge>
                      )}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => handleOpenTimePeriodDialog(tenant)}
                      data-testid={`button-time-period-${tenant.id}`}
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      Default Time Period: {getTimePeriodDisplay(tenant)}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => handleOpenSsoDialog(tenant)}
                      data-testid={`button-sso-settings-${tenant.id}`}
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      SSO: <Badge variant={getSsoStatus(tenant).variant} className="ml-1 text-xs">{getSsoStatus(tenant).label}</Badge>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => handleOpenConnectorsDialog(tenant)}
                      data-testid={`button-connectors-${tenant.id}`}
                    >
                      <Cloud className="h-3 w-3 mr-1" />
                      M365 Connectors: <Badge variant={getConnectorCount(tenant) > 0 ? "default" : "secondary"} className="ml-1 text-xs">{getConnectorCount(tenant)} enabled</Badge>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => handleOpenVocabularyDialog(tenant)}
                      data-testid={`button-vocabulary-${tenant.id}`}
                    >
                      <BookOpen className="h-3 w-3 mr-1" />
                      Vocabulary: <Badge variant={getVocabularyOverrideCount(tenant) > 0 ? "default" : "secondary"} className="ml-1 text-xs">{getVocabularyOverrideCount(tenant)} customized</Badge>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => handleOpenBrandingDialog(tenant)}
                      data-testid={`button-branding-${tenant.id}`}
                    >
                      <Palette className="h-3 w-3 mr-1" />
                      Branding: <Badge variant={getBrandingStatus(tenant).variant} className="ml-1 text-xs">{getBrandingStatus(tenant).label}</Badge>
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">User Management</h2>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={handleOpenBulkImportDialog}
                data-testid="button-bulk-import"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
              <Button 
                onClick={handleOpenCreateUserDialog}
                data-testid="button-create-user"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>
          </div>
          <Card>
            <CardContent className="pt-6">
              {usersLoading ? (
                <p className="text-muted-foreground">Loading users...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                        <TableCell className="font-mono text-sm">{user.email}</TableCell>
                        <TableCell>{user.name || "-"}</TableCell>
                        <TableCell>
                          {user.emailVerified ? (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-amber-600">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Unverified
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.role}</Badge>
                        </TableCell>
                        <TableCell>{getTenantName(user.tenantId)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!user.emailVerified && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm(`Manually verify ${user.email}?`)) {
                                    manualVerifyMutation.mutate(user.id);
                                  }
                                }}
                                disabled={manualVerifyMutation.isPending}
                                title="Manually verify user"
                                data-testid={`button-verify-${user.id}`}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm(`Send welcome email to ${user.email}?`)) {
                                  resendWelcomeEmailMutation.mutate(user.id);
                                }
                              }}
                              disabled={resendWelcomeEmailMutation.isPending}
                              title="Resend welcome email"
                              data-testid={`button-resend-welcome-${user.id}`}
                            >
                              <Mail className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEditUserDialog(user)}
                              title="Edit user"
                              data-testid={`button-edit-user-${user.id}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete user "${user.email}"?`)) {
                                  deleteUserMutation.mutate(user.id);
                                }
                              }}
                              title="Delete user"
                              data-testid={`button-delete-user-${user.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Consultant Access Management</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Grant consultants access to specific organizations. Consultants can only access tenants where they have been explicitly granted access.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map((tenant) => (
              <ConsultantAccessCard 
                key={tenant.id} 
                tenant={tenant} 
                onOpenGrantDialog={handleOpenConsultantAccessDialog}
                onRevokeAccess={(userId: string) => 
                  revokeConsultantAccessMutation.mutate({ userId, tenantId: tenant.id })
                }
              />
            ))}
          </div>
        </div>

        {/* AI Usage Analytics Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">AI Usage Analytics</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Monitor AI model usage, token consumption, and estimated costs for this organization.
          </p>
          <AIUsageWidget />
        </div>

        {/* Team Management Section */}
        <TeamManagementSection tenants={tenants} users={users} />

        {/* Platform Admin Section - Only visible to vega_admin and global_admin */}
        {isPlatformAdmin && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Platform Administration
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                Manage service plans, blocked domains, and tenant licensing. These settings are only visible to platform administrators.
              </p>
            </div>

            {/* Service Plans Management */}
            <Card data-testid="service-plans-section">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle className="text-lg">Service Plans</CardTitle>
                <Button 
                  size="sm" 
                  onClick={() => {
                    setEditingServicePlan(null);
                    setServicePlanFormData({ name: "", displayName: "", durationDays: "", maxReadWriteUsers: "", maxReadOnlyUsers: "", isDefault: false });
                    setServicePlanDialogOpen(true);
                  }}
                  data-testid="button-add-service-plan"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Plan
                </Button>
              </CardHeader>
              <CardContent>
                {servicePlans.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No service plans defined yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Display Name</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>R/W Users</TableHead>
                        <TableHead>Read-Only</TableHead>
                        <TableHead>Default</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {servicePlans.map((plan) => (
                        <TableRow key={plan.id} data-testid={`row-plan-${plan.id}`}>
                          <TableCell className="font-medium">{plan.name}</TableCell>
                          <TableCell>{plan.displayName}</TableCell>
                          <TableCell>{plan.durationDays ? `${plan.durationDays} days` : "Unlimited"}</TableCell>
                          <TableCell>{plan.maxReadWriteUsers ?? "Unlimited"}</TableCell>
                          <TableCell>{plan.maxReadOnlyUsers ?? "Unlimited"}</TableCell>
                          <TableCell>
                            {plan.isDefault && <Badge variant="default">Default</Badge>}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingServicePlan(plan);
                                setServicePlanFormData({
                                  name: plan.name,
                                  displayName: plan.displayName,
                                  durationDays: plan.durationDays?.toString() || "",
                                  maxReadWriteUsers: plan.maxReadWriteUsers?.toString() || "",
                                  maxReadOnlyUsers: plan.maxReadOnlyUsers?.toString() || "",
                                  isDefault: plan.isDefault || false,
                                });
                                setServicePlanDialogOpen(true);
                              }}
                              data-testid={`button-edit-plan-${plan.id}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Blocked Domains Management */}
            <Card data-testid="blocked-domains-section">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Ban className="h-4 w-4" />
                  Blocked Domains
                </CardTitle>
                <Button 
                  size="sm" 
                  onClick={() => {
                    setBlockedDomainFormData({ domain: "", reason: "" });
                    setBlockedDomainDialogOpen(true);
                  }}
                  data-testid="button-add-blocked-domain"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Block Domain
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4">
                  Blocked domains cannot create self-service accounts. Use this to prevent specific email domains from signing up.
                </p>
                {blockedDomains.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No blocked domains.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Blocked At</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blockedDomains.map((domain) => (
                        <TableRow key={domain.domain} data-testid={`row-blocked-${domain.domain}`}>
                          <TableCell className="font-mono">{domain.domain}</TableCell>
                          <TableCell>{domain.reason || "-"}</TableCell>
                          <TableCell>{domain.blockedAt ? new Date(domain.blockedAt).toLocaleDateString() : "-"}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm(`Unblock domain "${domain.domain}"?`)) {
                                  unblockDomainMutation.mutate(domain.domain);
                                }
                              }}
                              data-testid={`button-unblock-${domain.domain}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Tenant Plan Management */}
            <Card data-testid="tenant-plans-section">
              <CardHeader>
                <CardTitle className="text-lg">Tenant Service Plans</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4">
                  View and modify service plans assigned to each organization.
                </p>
                {adminTenants.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No tenants found.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organization</TableHead>
                        <TableHead>Current Plan</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminTenants.map((tenant) => {
                        const isExpired = tenant.planExpiresAt && new Date(tenant.planExpiresAt) < new Date();
                        const daysLeft = tenant.planExpiresAt 
                          ? Math.ceil((new Date(tenant.planExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                          : null;
                        return (
                          <TableRow key={tenant.id} data-testid={`row-tenant-plan-${tenant.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: tenant.color || '#6366F1' }}
                                />
                                <span className="font-medium">{tenant.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={tenant.servicePlan ? "default" : "secondary"}>
                                {tenant.servicePlan?.displayName || "No Plan"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {tenant.planStartedAt ? new Date(tenant.planStartedAt).toLocaleDateString() : "-"}
                            </TableCell>
                            <TableCell>
                              {tenant.planExpiresAt ? new Date(tenant.planExpiresAt).toLocaleDateString() : "Never"}
                            </TableCell>
                            <TableCell>
                              {isExpired ? (
                                <Badge variant="destructive">Expired</Badge>
                              ) : daysLeft !== null && daysLeft <= 30 ? (
                                <Badge variant="outline" className="text-amber-600 border-amber-600">
                                  {daysLeft} days left
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedTenantForPlan(tenant);
                                  setTenantPlanFormData({
                                    servicePlanId: tenant.servicePlanId || "none",
                                    planExpiresAt: tenant.planExpiresAt ? new Date(tenant.planExpiresAt).toISOString().split('T')[0] : "",
                                  });
                                  setTenantPlanDialogOpen(true);
                                }}
                                data-testid={`button-edit-tenant-plan-${tenant.id}`}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-4">Microsoft 365 Integration</h2>
          
          {/* Admin Consent Section */}
          <Card className="mb-6" data-testid="admin-consent-section">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Multi-Tenant Admin Consent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm mb-4">
                For Microsoft 365 features to work across your organization, an Azure AD administrator must grant consent 
                for the Vega application. This authorizes Vega to access Microsoft Graph APIs on behalf of users.
              </p>
              
              <div className="space-y-3">
                {tenants.map((tenant) => {
                  const hasConsent = (tenant as any).adminConsentGranted;
                  const consentDate = (tenant as any).adminConsentGrantedAt;
                  
                  return (
                    <div 
                      key={tenant.id} 
                      className="flex items-center justify-between p-3 border rounded-md"
                      data-testid={`admin-consent-row-${tenant.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tenant.color || '#6366F1' }}
                        />
                        <div>
                          <p className="font-medium text-sm">{tenant.name}</p>
                          {hasConsent && consentDate && (
                            <p className="text-xs text-muted-foreground">
                              Granted {new Date(consentDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {hasConsent ? (
                          <>
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Consent Granted
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm('Revoke admin consent record? Note: This does not revoke permissions in Azure AD.')) {
                                  apiRequest('POST', '/auth/entra/admin-consent/revoke', { tenantId: tenant.id })
                                    .then(() => {
                                      queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
                                      toast({ title: 'Admin consent record cleared' });
                                    })
                                    .catch(() => toast({ title: 'Failed to revoke', variant: 'destructive' }));
                                }
                              }}
                              data-testid={`button-revoke-consent-${tenant.id}`}
                            >
                              Revoke
                            </Button>
                          </>
                        ) : (
                          <>
                            <Badge variant="secondary">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Consent Required
                            </Badge>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                window.location.href = `/auth/entra/admin-consent?tenantId=${tenant.id}`;
                              }}
                              data-testid={`button-grant-consent-${tenant.id}`}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Grant Admin Consent
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <p className="text-xs text-muted-foreground mt-4">
                Required scopes: User.Read.All, Files.Read.All, Sites.Read.All, Tasks.ReadWrite.All, Calendars.ReadWrite, Mail.Read
              </p>
            </CardContent>
          </Card>
          
          {/* M365 Connectors Info */}
          <h3 className="text-lg font-medium mb-3">Available Connectors</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Configure which Microsoft 365 integrations are available for each organization using the "M365 Connectors" button on each organization card above.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {m365Connectors.map((connector) => (
              <Card key={connector.id} className="text-center" data-testid={`connector-info-${connector.id}`}>
                <CardContent className="pt-6 pb-4 flex flex-col items-center gap-2">
                  {'icon' in connector ? (
                    <img src={connector.icon} alt={connector.name} className="w-12 h-12 object-contain" />
                  ) : (
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <connector.iconLucide className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <p className="font-medium text-sm">{connector.name}</p>
                  <p className="text-xs text-muted-foreground">{connector.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={tenantDialogOpen} onOpenChange={setTenantDialogOpen}>
        <DialogContent data-testid="dialog-tenant-form">
          <DialogHeader>
            <DialogTitle>
              {editingTenant ? "Edit Organization" : "Create New Organization"}
            </DialogTitle>
            <DialogDescription>
              {editingTenant
                ? "Update the organization details below."
                : "Add a new organization to manage."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                placeholder="Acme Corporation"
                value={tenantFormData.name}
                onChange={(e) =>
                  setTenantFormData({ ...tenantFormData, name: e.target.value })
                }
                data-testid="input-tenant-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="color-preset">Brand Color</Label>
              <Select
                value={tenantFormData.color}
                onValueChange={(value) =>
                  setTenantFormData({ ...tenantFormData, color: value })
                }
              >
                <SelectTrigger data-testid="select-tenant-color">
                  <SelectValue placeholder="Select a color">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: tenantFormData.color }}
                      />
                      {standardColors.find(c => c.value === tenantFormData.color)?.name || "Custom"}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  {standardColors.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: color.value }}
                        />
                        {color.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Custom Hex Color (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="text"
                  placeholder="#3B82F6"
                  value={tenantFormData.color}
                  onChange={(e) =>
                    setTenantFormData({ ...tenantFormData, color: e.target.value })
                  }
                  data-testid="input-tenant-color"
                />
                <div
                  className="w-12 h-10 rounded-md border"
                  style={{ backgroundColor: tenantFormData.color }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use hex format: #3B82F6 or select from presets above
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL (Optional)</Label>
              <Input
                id="logoUrl"
                type="url"
                placeholder="https://example.com/logo.png"
                value={tenantFormData.logoUrl}
                onChange={(e) =>
                  setTenantFormData({ ...tenantFormData, logoUrl: e.target.value })
                }
                data-testid="input-tenant-logo"
              />
              <p className="text-xs text-muted-foreground">
                Enter a URL to your organization's logo image
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTenantDialogOpen(false)}
              data-testid="button-cancel-tenant"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTenant}
              disabled={!tenantFormData.name.trim()}
              data-testid="button-save-tenant"
            >
              {editingTenant ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={domainDialogOpen} onOpenChange={setDomainDialogOpen}>
        <DialogContent data-testid="dialog-domain-management">
          <DialogHeader>
            <DialogTitle>
              Manage Allowed Domains - {selectedTenantForDomains?.name}
            </DialogTitle>
            <DialogDescription>
              Configure how new users can join this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-base">Invite Only Mode</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, new users must be explicitly invited and cannot auto-join via domain matching.
                </p>
              </div>
              <Switch
                checked={(selectedTenantForDomains as any)?.inviteOnly || false}
                onCheckedChange={(checked) => {
                  if (selectedTenantForDomains) {
                    updateTenantMutation.mutate({
                      id: selectedTenantForDomains.id,
                      data: { inviteOnly: checked } as any,
                    });
                  }
                }}
                data-testid="switch-invite-only"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Add New Domain</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="example.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddDomain();
                    }
                  }}
                  data-testid="input-new-domain"
                />
                <Button
                  onClick={handleAddDomain}
                  disabled={!newDomain.trim()}
                  data-testid="button-add-domain"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Current Domains</Label>
              {!selectedTenantForDomains?.allowedDomains || selectedTenantForDomains.allowedDomains.length === 0 ? (
                <p className="text-sm text-muted-foreground">No domains configured. Add one above.</p>
              ) : (
                <div className="space-y-2">
                  {selectedTenantForDomains.allowedDomains.map((domain) => (
                    <div
                      key={domain}
                      className="flex items-center justify-between p-2 bg-muted rounded-md"
                      data-testid={`domain-item-${domain}`}
                    >
                      <span className="font-mono text-sm">{domain}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDomain(domain)}
                        data-testid={`button-remove-domain-${domain}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setDomainDialogOpen(false)}
              data-testid="button-close-domains"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={timePeriodDialogOpen} onOpenChange={setTimePeriodDialogOpen}>
        <DialogContent data-testid="dialog-time-period">
          <DialogHeader>
            <DialogTitle>
              Default Time Period - {selectedTenantForTime?.name}
            </DialogTitle>
            <DialogDescription>
              Set the default time period that users see when they open the dashboard. This works like Viva Goals' active time period setting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div 
                className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer ${timePeriodMode === 'current' ? 'border-primary bg-primary/5' : 'border-border'}`}
                onClick={() => setTimePeriodMode('current')}
                data-testid="option-current-quarter"
              >
                <div className={`w-4 h-4 rounded-full border-2 ${timePeriodMode === 'current' ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                  {timePeriodMode === 'current' && <div className="w-2 h-2 bg-white rounded-full m-auto mt-0.5" />}
                </div>
                <div>
                  <p className="font-medium">Current Quarter (Auto)</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically shows Q{getCurrentQuarter()} {currentYear} - updates each quarter
                  </p>
                </div>
              </div>
              
              <div 
                className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer ${timePeriodMode === 'specific' ? 'border-primary bg-primary/5' : 'border-border'}`}
                onClick={() => setTimePeriodMode('specific')}
                data-testid="option-specific-quarter"
              >
                <div className={`w-4 h-4 rounded-full border-2 ${timePeriodMode === 'specific' ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                  {timePeriodMode === 'specific' && <div className="w-2 h-2 bg-white rounded-full m-auto mt-0.5" />}
                </div>
                <div className="flex-1">
                  <p className="font-medium">Specific Quarter</p>
                  <p className="text-sm text-muted-foreground">
                    Always show a specific quarter until manually changed
                  </p>
                </div>
              </div>
              
              {timePeriodMode === 'specific' && (
                <div className="ml-7 mt-2">
                  <Select value={selectedQuarterValue} onValueChange={setSelectedQuarterValue}>
                    <SelectTrigger data-testid="select-specific-quarter">
                      <SelectValue placeholder="Select quarter" />
                    </SelectTrigger>
                    <SelectContent>
                      {quarterOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTimePeriodDialogOpen(false)}
              data-testid="button-cancel-time-period"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTimePeriod}
              data-testid="button-save-time-period"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent data-testid="dialog-user-form">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "Create New User"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Update user details below."
                : "Add a new user to the system."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!editingUser && (
              <div className="space-y-2 pb-3 border-b">
                <Label>Search Entra Directory</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={entraSearchQuery}
                    onChange={(e) => {
                      setEntraSearchQuery(e.target.value);
                      handleEntraSearch(e.target.value);
                    }}
                    className="pl-9"
                    data-testid="input-entra-search"
                  />
                </div>
                {isSearchingEntra && (
                  <p className="text-sm text-muted-foreground">Searching...</p>
                )}
                {entraSearchResults.length > 0 && (
                  <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                    {entraSearchResults.map((user) => (
                      <div
                        key={user.id}
                        className="p-2 cursor-pointer hover-elevate"
                        onClick={() => handleSelectEntraUser(user)}
                        data-testid={`entra-user-${user.id}`}
                      >
                        <p className="font-medium text-sm">{user.displayName}</p>
                        <p className="text-xs text-muted-foreground">{user.mail || user.userPrincipalName}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                placeholder="user@example.com"
                value={userFormData.email}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, email: e.target.value })
                }
                data-testid="input-user-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-password">
                Password {editingUser && "(leave blank to keep current)"}
              </Label>
              <Input
                id="user-password"
                type="password"
                placeholder={editingUser ? "••••••••" : "Enter password"}
                value={userFormData.password}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, password: e.target.value })
                }
                data-testid="input-user-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-name">Name (Optional)</Label>
              <Input
                id="user-name"
                placeholder="John Doe"
                value={userFormData.name}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, name: e.target.value })
                }
                data-testid="input-user-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-type">User Type</Label>
              <Select
                value={userFormData.userType}
                onValueChange={(value: "client" | "consultant" | "internal") => {
                  const newFormData = { ...userFormData, userType: value };
                  if (value === "client") {
                    if (!["tenant_user", "tenant_admin", "admin"].includes(newFormData.role)) {
                      newFormData.role = "tenant_user";
                    }
                  } else if (value === "consultant") {
                    newFormData.role = "vega_consultant";
                  } else if (value === "internal") {
                    if (!["global_admin", "vega_admin"].includes(newFormData.role)) {
                      newFormData.role = "vega_admin";
                    }
                  }
                  setUserFormData(newFormData);
                }}
              >
                <SelectTrigger data-testid="select-user-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  <SelectItem value="client">Client - Organization User</SelectItem>
                  <SelectItem value="consultant">Consultant - External Advisor</SelectItem>
                  <SelectItem value="internal">Internal - Vega Staff</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {userFormData.userType === "client" && "Regular user belonging to a client organization"}
                {userFormData.userType === "consultant" && "External consultant who works with multiple client organizations"}
                {userFormData.userType === "internal" && "Vega internal staff (platform admins, support)"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              <Select
                value={userFormData.role}
                onValueChange={(value) =>
                  setUserFormData({ ...userFormData, role: value })
                }
              >
                <SelectTrigger data-testid="select-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  {userFormData.userType === "client" && (
                    <>
                      <SelectItem value="tenant_user">Tenant User</SelectItem>
                      <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </>
                  )}
                  {userFormData.userType === "consultant" && (
                    <SelectItem value="vega_consultant">Vega Consultant</SelectItem>
                  )}
                  {userFormData.userType === "internal" && (
                    <>
                      <SelectItem value="global_admin">Global Admin</SelectItem>
                      <SelectItem value="vega_admin">Platform Admin</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-tenant">Organization</Label>
              <Select
                value={userFormData.tenantId}
                onValueChange={(value) =>
                  setUserFormData({ ...userFormData, tenantId: value })
                }
              >
                <SelectTrigger data-testid="select-user-tenant">
                  <SelectValue placeholder="Select organization (or leave blank for global)" />
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  <SelectItem value="NONE">Global (No Organization)</SelectItem>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!editingUser && (
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="send-welcome-email"
                  checked={userFormData.sendWelcomeEmail}
                  onCheckedChange={(checked) =>
                    setUserFormData({ ...userFormData, sendWelcomeEmail: checked === true })
                  }
                  data-testid="checkbox-send-welcome-email"
                />
                <Label htmlFor="send-welcome-email" className="text-sm font-normal cursor-pointer">
                  Send welcome email with login instructions and user guide
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUserDialogOpen(false)}
              data-testid="button-cancel-user"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveUser}
              disabled={!userFormData.email.trim() || (!editingUser && !userFormData.password)}
              data-testid="button-save-user"
            >
              {editingUser ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ssoDialogOpen} onOpenChange={setSsoDialogOpen}>
        <DialogContent data-testid="dialog-sso-settings">
          <DialogHeader>
            <DialogTitle>
              SSO Settings - {selectedTenantForSso?.name}
            </DialogTitle>
            <DialogDescription>
              Configure Microsoft Entra ID (Azure AD) Single Sign-On for this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="azure-tenant-id">Azure Tenant ID</Label>
              <Input
                id="azure-tenant-id"
                type="text"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={ssoFormData.azureTenantId}
                onChange={(e) =>
                  setSsoFormData({ ...ssoFormData, azureTenantId: e.target.value })
                }
                data-testid="input-azure-tenant-id"
              />
              <p className="text-xs text-muted-foreground">
                Find this in Azure Portal under Entra ID &gt; Overview
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require SSO</Label>
                  <p className="text-xs text-muted-foreground">
                    Users must sign in with Microsoft SSO
                  </p>
                </div>
                <Switch
                  checked={ssoFormData.enforceSso}
                  onCheckedChange={(checked) =>
                    setSsoFormData({ ...ssoFormData, enforceSso: checked })
                  }
                  data-testid="switch-enforce-sso"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Local Auth</Label>
                  <p className="text-xs text-muted-foreground">
                    Users can also log in with email/password
                  </p>
                </div>
                <Switch
                  checked={ssoFormData.allowLocalAuth}
                  onCheckedChange={(checked) =>
                    setSsoFormData({ ...ssoFormData, allowLocalAuth: checked })
                  }
                  data-testid="switch-allow-local-auth"
                />
              </div>
            </div>

            {ssoFormData.azureTenantId && (
              <div className="mt-4 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">SSO Login URL</p>
                <code className="text-xs text-muted-foreground break-all">
                  {window.location.origin}/auth/entra/login?tenant={selectedTenantForSso?.id}
                </code>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSsoDialogOpen(false)}
              data-testid="button-cancel-sso"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSsoSettings}
              data-testid="button-save-sso"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={connectorsDialogOpen} onOpenChange={setConnectorsDialogOpen}>
        <DialogContent data-testid="dialog-connectors-settings" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              M365 Connectors - {selectedTenantForConnectors?.name}
            </DialogTitle>
            <DialogDescription>
              Enable Microsoft 365 integrations for this organization. Users will be able to connect their accounts to use these services.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {m365Connectors.map((connector) => (
              <div 
                key={connector.id}
                className="flex items-center justify-between py-3 border-b last:border-b-0"
                data-testid={`connector-toggle-${connector.id}`}
              >
                <div className="flex items-center gap-3">
                  {'icon' in connector ? (
                    <img src={connector.icon} alt={connector.name} className="w-10 h-10 object-contain" />
                  ) : (
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <connector.iconLucide className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{connector.name}</p>
                    <p className="text-xs text-muted-foreground">{connector.description}</p>
                  </div>
                </div>
                <Switch
                  checked={connectorFormData[connector.key as keyof typeof connectorFormData]}
                  onCheckedChange={(checked) =>
                    setConnectorFormData({ ...connectorFormData, [connector.key]: checked })
                  }
                  data-testid={`switch-${connector.id}`}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConnectorsDialogOpen(false)}
              data-testid="button-cancel-connectors"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveConnectorSettings}
              data-testid="button-save-connectors"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={vocabularyDialogOpen} onOpenChange={setVocabularyDialogOpen}>
        <DialogContent data-testid="dialog-vocabulary-settings" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Vocabulary Settings - {selectedTenantForVocabulary?.name}
            </DialogTitle>
            <DialogDescription>
              Choose alternative terminology for this organization. Select "Use Default" to keep the system default.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {(['goal', 'strategy', 'objective', 'keyResult', 'bigRock', 'meeting', 'focusRhythm'] as const).map((termKey) => {
              const alternatives = vocabularyAlternatives[termKey];
              const currentValue = vocabularyFormData[termKey];
              const matchedAlternative = alternatives.find(
                alt => alt.singular === currentValue.singular && alt.plural === currentValue.plural
              );
              const selectedValue = matchedAlternative 
                ? `${matchedAlternative.singular}|${matchedAlternative.plural}` 
                : "";
              
              return (
                <div key={termKey} className="grid gap-2 p-3 rounded-md border">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium capitalize">{termKey.replace(/([A-Z])/g, ' $1').trim()}</h4>
                    {currentValue.singular && (
                      <Badge variant="secondary" className="text-xs">
                        {currentValue.singular} / {currentValue.plural}
                      </Badge>
                    )}
                  </div>
                  <Select
                    value={selectedValue}
                    onValueChange={(value) => {
                      if (value === "default") {
                        setVocabularyFormData({
                          ...vocabularyFormData,
                          [termKey]: { singular: "", plural: "" }
                        });
                      } else {
                        const [singular, plural] = value.split("|");
                        setVocabularyFormData({
                          ...vocabularyFormData,
                          [termKey]: { singular, plural }
                        });
                      }
                    }}
                  >
                    <SelectTrigger data-testid={`select-vocab-${termKey}`}>
                      <SelectValue placeholder="Use Default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Use Default</SelectItem>
                      {alternatives.map((alt) => (
                        <SelectItem 
                          key={`${alt.singular}|${alt.plural}`} 
                          value={`${alt.singular}|${alt.plural}`}
                        >
                          {alt.singular} / {alt.plural}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVocabularyDialogOpen(false)}
              data-testid="button-cancel-vocabulary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveVocabularySettings}
              data-testid="button-save-vocabulary"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Branding Dialog */}
      <Dialog open={brandingDialogOpen} onOpenChange={setBrandingDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-branding">
          <DialogHeader>
            <DialogTitle>
              Branding Settings - {selectedTenantForBranding?.name}
            </DialogTitle>
            <DialogDescription>
              Customize logos, colors, and branding for this organization. These settings appear in the sidebar, login page, and reports.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto">
            {/* Logo URLs Section */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Logo URLs</h4>
              <p className="text-xs text-muted-foreground">
                Enter URLs to your organization's logo images. For best results, use PNG or SVG format with transparent backgrounds.
              </p>
              
              <div className="space-y-2">
                <Label htmlFor="logo-url">Primary Logo (Light Background)</Label>
                <Input
                  id="logo-url"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={brandingFormData.logoUrl}
                  onChange={(e) => setBrandingFormData({ ...brandingFormData, logoUrl: e.target.value })}
                  data-testid="input-logo-url"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="logo-url-dark">Dark Mode Logo (Dark Background)</Label>
                <Input
                  id="logo-url-dark"
                  type="url"
                  placeholder="https://example.com/logo-white.png"
                  value={brandingFormData.logoUrlDark}
                  onChange={(e) => setBrandingFormData({ ...brandingFormData, logoUrlDark: e.target.value })}
                  data-testid="input-logo-url-dark"
                />
                <p className="text-xs text-muted-foreground">Optional: Use a white or light-colored version for dark backgrounds</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="favicon-url">Favicon URL</Label>
                <Input
                  id="favicon-url"
                  type="url"
                  placeholder="https://example.com/favicon.ico"
                  value={brandingFormData.faviconUrl}
                  onChange={(e) => setBrandingFormData({ ...brandingFormData, faviconUrl: e.target.value })}
                  data-testid="input-favicon-url"
                />
                <p className="text-xs text-muted-foreground">Browser tab icon (16x16 or 32x32 pixels)</p>
              </div>

              {/* Logo Preview */}
              {brandingFormData.logoUrl && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="flex gap-4 p-4 rounded-md border">
                    <div className="flex-1 p-3 bg-background rounded">
                      <img 
                        src={brandingFormData.logoUrl} 
                        alt="Logo preview (light)" 
                        className="max-h-12 max-w-full object-contain"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                    {brandingFormData.logoUrlDark && (
                      <div className="flex-1 p-3 bg-slate-900 rounded">
                        <img 
                          src={brandingFormData.logoUrlDark} 
                          alt="Logo preview (dark)" 
                          className="max-h-12 max-w-full object-contain"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Brand Colors Section */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Brand Colors</h4>
              <p className="text-xs text-muted-foreground">
                These colors are used in reports and email templates.
              </p>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="primary-color" className="text-xs">Primary</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary-color"
                      type="color"
                      className="w-10 h-9 p-1 cursor-pointer"
                      value={brandingFormData.branding.primaryColor || "#3B82F6"}
                      onChange={(e) => setBrandingFormData({
                        ...brandingFormData,
                        branding: { ...brandingFormData.branding, primaryColor: e.target.value }
                      })}
                      data-testid="input-primary-color"
                    />
                    <Input
                      type="text"
                      placeholder="#3B82F6"
                      value={brandingFormData.branding.primaryColor || ""}
                      onChange={(e) => setBrandingFormData({
                        ...brandingFormData,
                        branding: { ...brandingFormData.branding, primaryColor: e.target.value }
                      })}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="secondary-color" className="text-xs">Secondary</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary-color"
                      type="color"
                      className="w-10 h-9 p-1 cursor-pointer"
                      value={brandingFormData.branding.secondaryColor || "#6B7280"}
                      onChange={(e) => setBrandingFormData({
                        ...brandingFormData,
                        branding: { ...brandingFormData.branding, secondaryColor: e.target.value }
                      })}
                      data-testid="input-secondary-color"
                    />
                    <Input
                      type="text"
                      placeholder="#6B7280"
                      value={brandingFormData.branding.secondaryColor || ""}
                      onChange={(e) => setBrandingFormData({
                        ...brandingFormData,
                        branding: { ...brandingFormData.branding, secondaryColor: e.target.value }
                      })}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="accent-color" className="text-xs">Accent</Label>
                  <div className="flex gap-2">
                    <Input
                      id="accent-color"
                      type="color"
                      className="w-10 h-9 p-1 cursor-pointer"
                      value={brandingFormData.branding.accentColor || "#10B981"}
                      onChange={(e) => setBrandingFormData({
                        ...brandingFormData,
                        branding: { ...brandingFormData.branding, accentColor: e.target.value }
                      })}
                      data-testid="input-accent-color"
                    />
                    <Input
                      type="text"
                      placeholder="#10B981"
                      value={brandingFormData.branding.accentColor || ""}
                      onChange={(e) => setBrandingFormData({
                        ...brandingFormData,
                        branding: { ...brandingFormData.branding, accentColor: e.target.value }
                      })}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Report Branding Section */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Report Branding</h4>
              
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  placeholder="Your company tagline"
                  value={brandingFormData.branding.tagline || ""}
                  onChange={(e) => setBrandingFormData({
                    ...brandingFormData,
                    branding: { ...brandingFormData.branding, tagline: e.target.value }
                  })}
                  data-testid="input-tagline"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="report-header">Report Header Text</Label>
                <Input
                  id="report-header"
                  placeholder="Text to appear in report headers"
                  value={brandingFormData.branding.reportHeaderText || ""}
                  onChange={(e) => setBrandingFormData({
                    ...brandingFormData,
                    branding: { ...brandingFormData.branding, reportHeaderText: e.target.value }
                  })}
                  data-testid="input-report-header"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="report-footer">Report Footer Text</Label>
                <Input
                  id="report-footer"
                  placeholder="Text to appear in report footers"
                  value={brandingFormData.branding.reportFooterText || ""}
                  onChange={(e) => setBrandingFormData({
                    ...brandingFormData,
                    branding: { ...brandingFormData.branding, reportFooterText: e.target.value }
                  })}
                  data-testid="input-report-footer"
                />
              </div>
            </div>

            {/* Email Branding Section */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Email Branding</h4>
              
              <div className="space-y-2">
                <Label htmlFor="email-from-name">Email Sender Name</Label>
                <Input
                  id="email-from-name"
                  placeholder="Your Company Name"
                  value={brandingFormData.branding.emailFromName || ""}
                  onChange={(e) => setBrandingFormData({
                    ...brandingFormData,
                    branding: { ...brandingFormData.branding, emailFromName: e.target.value }
                  })}
                  data-testid="input-email-from-name"
                />
                <p className="text-xs text-muted-foreground">Name shown in the "From" field of system emails</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBrandingDialogOpen(false)}
              data-testid="button-cancel-branding"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveBrandingSettings}
              data-testid="button-save-branding"
            >
              Save Branding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={consultantAccessDialogOpen} onOpenChange={setConsultantAccessDialogOpen}>
        <DialogContent data-testid="dialog-grant-consultant-access">
          <DialogHeader>
            <DialogTitle>
              Grant Consultant Access - {selectedTenantForAccess?.name}
            </DialogTitle>
            <DialogDescription>
              Select a consultant to grant access to this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="consultant-select">Select Consultant</Label>
              <Select
                value={selectedConsultantId}
                onValueChange={setSelectedConsultantId}
              >
                <SelectTrigger data-testid="select-consultant">
                  <SelectValue placeholder="Choose a consultant" />
                </SelectTrigger>
                <SelectContent>
                  {consultants.map((consultant) => (
                    <SelectItem key={consultant.id} value={consultant.id}>
                      {consultant.name || consultant.email} ({consultant.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {consultants.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No consultants found. Create a user with the vega_consultant role first.
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="expires-at">Expiration Date (optional)</Label>
              <Input
                id="expires-at"
                type="date"
                value={accessExpiresAt}
                onChange={(e) => setAccessExpiresAt(e.target.value)}
                data-testid="input-expires-at"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                placeholder="Reason for access grant..."
                value={accessNotes}
                onChange={(e) => setAccessNotes(e.target.value)}
                data-testid="input-access-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConsultantAccessDialogOpen(false)}
              data-testid="button-cancel-grant-access"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGrantConsultantAccess}
              disabled={!selectedConsultantId || grantConsultantAccessMutation.isPending}
              data-testid="button-confirm-grant-access"
            >
              {grantConsultantAccessMutation.isPending ? "Granting..." : "Grant Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkImportDialogOpen} onOpenChange={setBulkImportDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-bulk-import">
          <DialogHeader>
            <DialogTitle>
              Bulk Import Users from CSV
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file to create multiple users at once. The CSV must have 'email' and 'password' columns. Optional columns: 'name', 'role'.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadSampleCsv}
                data-testid="button-download-sample-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Sample CSV
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Upload CSV File</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={handleCsvFileUpload}
                data-testid="input-csv-file"
              />
            </div>

            {csvError && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm" data-testid="csv-error">
                {csvError}
              </div>
            )}

            {csvData.length > 0 && !importResults && (
              <>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium">Found {csvData.length} users to import:</p>
                  <div className="max-h-40 overflow-y-auto mt-2 space-y-1">
                    {csvData.map((user, idx) => (
                      <p key={idx} className="text-xs text-muted-foreground font-mono">
                        {user.email} {user.name ? `(${user.name})` : ""} - {user.role || "tenant_user"}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Assign to Organization</Label>
                  <Select
                    value={bulkImportTenantId}
                    onValueChange={setBulkImportTenantId}
                  >
                    <SelectTrigger data-testid="select-bulk-import-tenant">
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Global (No Organization)</SelectItem>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="send-bulk-welcome"
                    checked={sendBulkWelcomeEmails}
                    onCheckedChange={(checked) => setSendBulkWelcomeEmails(checked === true)}
                    data-testid="checkbox-send-bulk-welcome"
                  />
                  <Label htmlFor="send-bulk-welcome" className="text-sm font-normal cursor-pointer">
                    Send welcome emails to all imported users
                  </Label>
                </div>
              </>
            )}

            {importResults && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Import Results:</p>
                <div className="max-h-60 overflow-y-auto space-y-1 border rounded-md p-3">
                  {importResults.map((result, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-center gap-2 text-xs p-1.5 rounded ${result.success ? 'bg-green-500/10' : 'bg-destructive/10'}`}
                    >
                      {result.success ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-destructive" />
                      )}
                      <span className="font-mono">{result.email}</span>
                      {result.error && <span className="text-destructive">- {result.error}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkImportDialogOpen(false)}
              data-testid="button-cancel-bulk-import"
            >
              {importResults ? "Close" : "Cancel"}
            </Button>
            {!importResults && csvData.length > 0 && (
              <Button
                onClick={handleBulkImport}
                disabled={bulkImportMutation.isPending}
                data-testid="button-confirm-bulk-import"
              >
                {bulkImportMutation.isPending ? "Importing..." : `Import ${csvData.length} Users`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Platform Admin Dialogs */}
      {/* Service Plan Dialog */}
      <Dialog open={servicePlanDialogOpen} onOpenChange={setServicePlanDialogOpen}>
        <DialogContent data-testid="dialog-service-plan">
          <DialogHeader>
            <DialogTitle>
              {editingServicePlan ? "Edit Service Plan" : "Create Service Plan"}
            </DialogTitle>
            <DialogDescription>
              Define a service plan with limits and duration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-name">Internal Name</Label>
                <Input
                  id="plan-name"
                  placeholder="trial"
                  value={servicePlanFormData.name}
                  onChange={(e) => setServicePlanFormData({ ...servicePlanFormData, name: e.target.value })}
                  data-testid="input-plan-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-display-name">Display Name</Label>
                <Input
                  id="plan-display-name"
                  placeholder="Trial Plan"
                  value={servicePlanFormData.displayName}
                  onChange={(e) => setServicePlanFormData({ ...servicePlanFormData, displayName: e.target.value })}
                  data-testid="input-plan-display-name"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-duration">Duration (days)</Label>
                <Input
                  id="plan-duration"
                  type="number"
                  placeholder="60 for trial (blank = unlimited)"
                  value={servicePlanFormData.durationDays}
                  onChange={(e) => setServicePlanFormData({ ...servicePlanFormData, durationDays: e.target.value })}
                  data-testid="input-plan-duration"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-rw-users">Max R/W Users</Label>
                <Input
                  id="plan-rw-users"
                  type="number"
                  placeholder="blank = unlimited"
                  value={servicePlanFormData.maxReadWriteUsers}
                  onChange={(e) => setServicePlanFormData({ ...servicePlanFormData, maxReadWriteUsers: e.target.value })}
                  data-testid="input-plan-rw-users"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-ro-users">Max Read-Only</Label>
                <Input
                  id="plan-ro-users"
                  type="number"
                  placeholder="blank = unlimited"
                  value={servicePlanFormData.maxReadOnlyUsers}
                  onChange={(e) => setServicePlanFormData({ ...servicePlanFormData, maxReadOnlyUsers: e.target.value })}
                  data-testid="input-plan-ro-users"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="plan-is-default"
                checked={servicePlanFormData.isDefault}
                onCheckedChange={(checked) => setServicePlanFormData({ ...servicePlanFormData, isDefault: checked === true })}
                data-testid="checkbox-plan-default"
              />
              <Label htmlFor="plan-is-default" className="text-sm font-normal cursor-pointer">
                Set as default plan for new self-service signups
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServicePlanDialogOpen(false)} data-testid="button-cancel-plan">
              Cancel
            </Button>
            <Button
              onClick={() => {
                const data = {
                  name: servicePlanFormData.name,
                  displayName: servicePlanFormData.displayName,
                  durationDays: servicePlanFormData.durationDays ? parseInt(servicePlanFormData.durationDays) : null,
                  maxReadWriteUsers: servicePlanFormData.maxReadWriteUsers ? parseInt(servicePlanFormData.maxReadWriteUsers) : null,
                  maxReadOnlyUsers: servicePlanFormData.maxReadOnlyUsers ? parseInt(servicePlanFormData.maxReadOnlyUsers) : null,
                  isDefault: servicePlanFormData.isDefault,
                };
                if (editingServicePlan) {
                  updateServicePlanMutation.mutate({ id: editingServicePlan.id, data });
                } else {
                  createServicePlanMutation.mutate(data);
                }
              }}
              disabled={!servicePlanFormData.name || !servicePlanFormData.displayName || createServicePlanMutation.isPending || updateServicePlanMutation.isPending}
              data-testid="button-save-plan"
            >
              {editingServicePlan ? "Update Plan" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocked Domain Dialog */}
      <Dialog open={blockedDomainDialogOpen} onOpenChange={setBlockedDomainDialogOpen}>
        <DialogContent data-testid="dialog-block-domain">
          <DialogHeader>
            <DialogTitle>Block Domain</DialogTitle>
            <DialogDescription>
              Prevent users with this email domain from creating self-service accounts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="block-domain">Domain</Label>
              <Input
                id="block-domain"
                placeholder="example.com"
                value={blockedDomainFormData.domain}
                onChange={(e) => setBlockedDomainFormData({ ...blockedDomainFormData, domain: e.target.value })}
                data-testid="input-block-domain"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-reason">Reason (optional)</Label>
              <Input
                id="block-reason"
                placeholder="Reason for blocking this domain..."
                value={blockedDomainFormData.reason}
                onChange={(e) => setBlockedDomainFormData({ ...blockedDomainFormData, reason: e.target.value })}
                data-testid="input-block-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockedDomainDialogOpen(false)} data-testid="button-cancel-block">
              Cancel
            </Button>
            <Button
              onClick={() => blockDomainMutation.mutate({ domain: blockedDomainFormData.domain, reason: blockedDomainFormData.reason || undefined })}
              disabled={!blockedDomainFormData.domain || blockDomainMutation.isPending}
              data-testid="button-confirm-block"
            >
              Block Domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tenant Plan Dialog */}
      <Dialog open={tenantPlanDialogOpen} onOpenChange={setTenantPlanDialogOpen}>
        <DialogContent data-testid="dialog-tenant-plan">
          <DialogHeader>
            <DialogTitle>
              Update Plan - {selectedTenantForPlan?.name}
            </DialogTitle>
            <DialogDescription>
              Change the service plan and expiration date for this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Service Plan</Label>
              <Select
                value={tenantPlanFormData.servicePlanId}
                onValueChange={(value) => setTenantPlanFormData({ ...tenantPlanFormData, servicePlanId: value })}
              >
                <SelectTrigger data-testid="select-tenant-plan">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Plan</SelectItem>
                  {servicePlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.displayName} {plan.isDefault && "(Default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-expires-at">Expiration Date (blank = never expires)</Label>
              <Input
                id="plan-expires-at"
                type="date"
                value={tenantPlanFormData.planExpiresAt}
                onChange={(e) => setTenantPlanFormData({ ...tenantPlanFormData, planExpiresAt: e.target.value })}
                data-testid="input-plan-expires-at"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTenantPlanDialogOpen(false)} data-testid="button-cancel-tenant-plan">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedTenantForPlan) {
                  updateTenantPlanMutation.mutate({
                    id: selectedTenantForPlan.id,
                    data: {
                      servicePlanId: (!tenantPlanFormData.servicePlanId || tenantPlanFormData.servicePlanId === "none") ? null : tenantPlanFormData.servicePlanId,
                      planExpiresAt: tenantPlanFormData.planExpiresAt || null,
                    },
                  });
                }
              }}
              disabled={updateTenantPlanMutation.isPending}
              data-testid="button-save-tenant-plan"
            >
              Update Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
