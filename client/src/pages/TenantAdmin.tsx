import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, AlertCircle, Calendar, FileSpreadsheet, Mail } from "lucide-react";
import { useState } from "react";

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
  const [permissionStates, setPermissionStates] = useState(
    Object.fromEntries(permissions.map((p) => [p.id, p.enabled]))
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Tenant Administration</h1>
        <p className="text-muted-foreground">
          Manage M365 connections and app permissions
        </p>
      </div>

      <div className="space-y-8">
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
    </div>
  );
}
