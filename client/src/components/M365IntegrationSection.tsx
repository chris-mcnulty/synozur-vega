import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Calendar, FileSpreadsheet, Mail } from "lucide-react";

const integrations = [
  {
    icon: FileSpreadsheet,
    name: "Excel",
    description: "Sync data and analytics",
    connected: true,
  },
  {
    icon: Mail,
    name: "Outlook",
    description: "Calendar and email integration",
    connected: true,
  },
  {
    icon: Calendar,
    name: "Planner",
    description: "Task management sync",
    connected: true,
  },
];

export function M365IntegrationSection() {
  return (
    <section className="py-20 bg-card">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Seamless M365 Integration</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Connect your Microsoft 365 tenant for powerful productivity integrations
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                      {integration.connected && (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Connected
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
