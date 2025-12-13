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
import { CheckCircle2, AlertCircle, Calendar, Plus, Pencil, Trash2, Building2, User, Globe, X, Clock, Shield, Settings2, Cloud, ShieldCheck, ExternalLink, UserPlus, Users } from "lucide-react";
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

  const [consultantAccessDialogOpen, setConsultantAccessDialogOpen] = useState(false);
  const [selectedTenantForAccess, setSelectedTenantForAccess] = useState<Tenant | null>(null);
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>("");
  const [accessExpiresAt, setAccessExpiresAt] = useState<string>("");
  const [accessNotes, setAccessNotes] = useState<string>("");

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
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
    mutationFn: (data: { email: string; password: string; name?: string; role: string; tenantId?: string | null }) =>
      apiRequest("POST", "/api/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setUserDialogOpen(false);
      setUserFormData({ email: "", password: "", name: "", role: "user", tenantId: "NONE" });
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
      setUserFormData({ email: "", password: "", name: "", role: "user", tenantId: "NONE" });
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
    setUserFormData({ email: "", password: "", name: "", role: "user", tenantId: "NONE", sendWelcomeEmail: false });
    setUserDialogOpen(true);
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
    });
    setUserDialogOpen(true);
  };

  const handleSaveUser = () => {
    const userData = {
      email: userFormData.email,
      name: userFormData.name || undefined,
      role: userFormData.role,
      tenantId: userFormData.tenantId === "NONE" ? null : userFormData.tenantId,
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

  const getSsoStatus = (tenant: Tenant) => {
    const azureTenantId = (tenant as any).azureTenantId;
    const enforceSso = (tenant as any).enforceSso;
    if (!azureTenantId) return { label: "Not Configured", variant: "secondary" as const };
    if (enforceSso) return { label: "SSO Required", variant: "default" as const };
    return { label: "SSO Available", variant: "outline" as const };
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
                      Manage Domains ({(tenant.allowedDomains || []).length})
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
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">User Management</h2>
            <Button 
              onClick={handleOpenCreateUserDialog}
              data-testid="button-create-user"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
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
                          <Badge variant="outline">{user.role}</Badge>
                        </TableCell>
                        <TableCell>{getTenantName(user.tenantId)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditUserDialog(user)}
                              data-testid={`button-edit-user-${user.id}`}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete user "${user.email}"?`)) {
                                  deleteUserMutation.mutate(user.id);
                                }
                              }}
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
              Add or remove email domains that are allowed to access this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
                  <SelectItem value="tenant_user">Tenant User</SelectItem>
                  <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="global_admin">Global Admin</SelectItem>
                  <SelectItem value="vega_consultant">Vega Consultant</SelectItem>
                  <SelectItem value="vega_admin">Vega Admin</SelectItem>
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
    </div>
  );
}
