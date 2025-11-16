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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertCircle, Calendar, FileSpreadsheet, Mail, Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Tenant } from "@/contexts/TenantContext";

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

export default function TenantAdmin() {
  const { toast } = useToast();
  const [permissionStates, setPermissionStates] = useState(
    Object.fromEntries(permissions.map((p) => [p.id, p.enabled]))
  );
  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [tenantFormData, setTenantFormData] = useState({
    name: "",
    color: "hsl(220, 85%, 38%)",
  });

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  const createTenantMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      apiRequest("POST", "/api/tenants", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setTenantDialogOpen(false);
      setTenantFormData({ name: "", color: "hsl(220, 85%, 38%)" });
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
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string } }) =>
      apiRequest("PATCH", `/api/tenants/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setTenantDialogOpen(false);
      setEditingTenant(null);
      setTenantFormData({ name: "", color: "hsl(220, 85%, 38%)" });
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

  const handleOpenCreateDialog = () => {
    setEditingTenant(null);
    setTenantFormData({ name: "", color: "hsl(220, 85%, 38%)" });
    setTenantDialogOpen(true);
  };

  const handleOpenEditDialog = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setTenantFormData({
      name: tenant.name,
      color: tenant.color || "hsl(220, 85%, 38%)",
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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Tenant Administration</h1>
        <p className="text-muted-foreground">
          Manage organizations, M365 connections, and app permissions
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
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold"
                          style={{ backgroundColor: tenant.color || "hsl(220, 85%, 38%)" }}
                        >
                          {tenant.name.substring(0, 2).toUpperCase()}
                        </div>
                        <CardTitle className="text-lg">{tenant.name}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex gap-2">
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
                  </CardContent>
                </Card>
              ))
            )}
          </div>
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

        <div>
          <h2 className="text-xl font-semibold mb-4">Tenant Information</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Tenant Name</p>
                  <p className="font-medium">Acme Corporation</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Tenant ID</p>
                  <p className="font-mono text-sm">abc-123-def-456</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Users</p>
                  <p className="font-medium">47</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active Integrations</p>
                  <p className="font-medium">3</p>
                </div>
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
              <Label htmlFor="color">Brand Color</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="text"
                  placeholder="hsl(220, 85%, 38%)"
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
                Use HSL format: hsl(hue, saturation%, lightness%)
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
    </div>
  );
}
