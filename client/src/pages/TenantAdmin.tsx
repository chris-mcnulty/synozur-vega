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
import { CheckCircle2, AlertCircle, Calendar, FileSpreadsheet, Mail, Plus, Pencil, Trash2, Building2, User, Globe, X } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Tenant } from "@/contexts/TenantContext";

type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  tenantId: string | null;
};

const m365Services = [
  {
    id: "excel",
    name: "Microsoft Excel",
    icon: FileSpreadsheet,
    description: "Data sync and analytics integration",
    connected: true,
    lastSync: "2 minutes ago",
  },
  {
    id: "outlook",
    name: "Microsoft Outlook",
    icon: Mail,
    description: "Calendar and email integration",
    connected: true,
    lastSync: "5 minutes ago",
  },
  {
    id: "planner",
    name: "Microsoft Planner",
    icon: Calendar,
    description: "Task management synchronization",
    connected: true,
    lastSync: "1 hour ago",
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

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState({
    email: "",
    password: "",
    name: "",
    role: "user",
    tenantId: "NONE",
  });

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
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

  const handleOpenCreateUserDialog = () => {
    setEditingUser(null);
    setUserFormData({ email: "", password: "", name: "", role: "user", tenantId: "NONE" });
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
      createUserMutation.mutate({ ...userData, password: userFormData.password });
    }
  };

  const getTenantName = (tenantId: string | null) => {
    if (!tenantId) return "Global";
    const tenant = tenants.find(t => t.id === tenantId);
    return tenant?.name || "Unknown";
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Tenant Administration</h1>
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
          <h2 className="text-xl font-semibold mb-4">M365 Service Connections</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {m365Services.map((service) => (
              <Card key={service.id} data-testid={`service-card-${service.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <service.icon className="h-6 w-6 text-primary" />
                    </div>
                    <Badge
                      variant={service.connected ? "default" : "secondary"}
                      className="gap-1"
                    >
                      {service.connected ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          Connected
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3" />
                          Disconnected
                        </>
                      )}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg mt-4">{service.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {service.description}
                  </p>
                  {service.connected && (
                    <p className="text-xs text-muted-foreground">
                      Last synced: {service.lastSync}
                    </p>
                  )}
                  <Button
                    variant={service.connected ? "outline" : "default"}
                    size="sm"
                    className="w-full"
                    data-testid={`button-${service.connected ? 'disconnect' : 'connect'}-${service.id}`}
                  >
                    {service.connected ? "Disconnect" : "Connect"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">App Permissions</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {permissions.map((permission) => (
                  <div
                    key={permission.id}
                    className="flex items-center justify-between py-3 border-b last:border-b-0"
                    data-testid={`permission-${permission.id}`}
                  >
                    <div>
                      <p className="font-medium">{permission.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {permissionStates[permission.id]
                          ? "Application can access this resource"
                          : "Access is disabled"}
                      </p>
                    </div>
                    <Switch
                      checked={permissionStates[permission.id]}
                      onCheckedChange={(checked) =>
                        setPermissionStates({
                          ...permissionStates,
                          [permission.id]: checked,
                        })
                      }
                      data-testid={`switch-${permission.id}`}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
                <SelectContent>
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
                <SelectContent>
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
    </div>
  );
}
