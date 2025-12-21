import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Calendar, FileSpreadsheet, Mail, Bot, FolderOpen, Shield } from "lucide-react";

const integrations = [
  {
    icon: Bot,
    name: "Copilot Agent",
    description: "Query OKRs and meetings from Teams chat",
    badge: "Coming Soon",
    badgeVariant: "secondary" as const,
  },
  {
    icon: Calendar,
    name: "Planner",
    description: "Bidirectional task sync with Big Rocks",
    badge: "Connected",
    badgeVariant: "default" as const,
  },
  {
    icon: Mail,
    name: "Outlook Calendar",
    description: "Sync Focus Rhythm meetings",
    badge: "Connected",
    badgeVariant: "default" as const,
  },
  {
    icon: FileSpreadsheet,
    name: "Excel Binding",
    description: "Live KR updates from SharePoint files",
    badge: "Connected",
    badgeVariant: "default" as const,
  },
  {
    icon: FolderOpen,
    name: "SharePoint/OneDrive",
    description: "Document storage and grounding",
    badge: "Connected",
    badgeVariant: "default" as const,
  },
  {
    icon: Shield,
    name: "Entra ID SSO",
    description: "Enterprise single sign-on with MFA",
    badge: "Connected",
    badgeVariant: "default" as const,
  },
];

export function M365IntegrationSection() {
  return (
    <section className="py-20 bg-card">
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-6">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">Enterprise Ready</Badge>
          <h2 className="text-4xl font-semibold mb-4">Deep Microsoft 365 Integration</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Built by Microsoft partners, for Microsoft organizations. 
            Vega connects natively to your M365 tenant with enterprise-grade security.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((integration, index) => (
            <Card key={index} className="hover-elevate" data-testid={`integration-card-${index}`}>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                    <integration.icon className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{integration.name}</h3>
                      <Badge variant={integration.badgeVariant} className="gap-1 text-xs">
                        {integration.badge === "Connected" && <CheckCircle2 className="h-3 w-3" />}
                        {integration.badge}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            Admin consent flow available for enterprise-wide deployment. 
            All data stays within your Microsoft tenant.
          </p>
        </div>
      </div>
    </section>
  );
}
