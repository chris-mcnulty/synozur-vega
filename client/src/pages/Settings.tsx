import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlannerConnectionCard } from "@/components/planner/PlannerConnectionCard";
import { useAuth } from "@/contexts/AuthContext";
import { User, Bell, Plug, Shield, Mail } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="flex-1 p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and integrations</p>
      </div>

      <Tabs defaultValue="integrations" className="w-full">
        <TabsList>
          <TabsTrigger value="profile" className="flex items-center gap-2" data-testid="tab-profile">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2" data-testid="tab-integrations">
            <Plug className="h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <p className="text-sm" data-testid="text-user-name">{user?.name || 'Not set'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm" data-testid="text-user-email">{user?.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Role</label>
                  <p className="text-sm">
                    <Badge variant="outline" data-testid="badge-user-role">{user?.role}</Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Authentication</label>
                  <p className="text-sm">
                    <Badge 
                      variant={user?.authProvider === 'entra' ? 'default' : 'secondary'}
                      data-testid="badge-auth-provider"
                    >
                      {user?.authProvider === 'entra' ? 'Microsoft SSO' : 'Email/Password'}
                    </Badge>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Microsoft 365 Integrations</h2>
            <p className="text-sm text-muted-foreground">
              Connect your Microsoft 365 services to enhance your Vega experience
            </p>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <PlannerConnectionCard />
            
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Microsoft Outlook
                    </CardTitle>
                    <CardDescription>
                      Sync calendar events with meetings
                    </CardDescription>
                  </div>
                  <Badge variant="outline">Coming Soon</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Calendar integration with Focus Rhythm meetings will be available soon.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
