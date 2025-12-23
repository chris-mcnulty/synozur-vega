import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Info,
  Mail,
  Calendar,
  ExternalLink,
  Building,
  Users,
  Target,
  Layers,
  Rocket,
  HelpCircle
} from "lucide-react";

const VERSION_MAJOR = 1;
const VERSION_RELEASE_DATE = "2024-12-23";

export default function About() {
  const formatVersionNumber = (major: number, dateStr: string) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${major}.${year}.${month}.${day}`;
  };

  const versionNumber = formatVersionNumber(VERSION_MAJOR, VERSION_RELEASE_DATE);
  const isProductionRelease = VERSION_MAJOR > 0;
  const environment = import.meta.env.PROD ? 'Production' : 'Development';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <Building className="h-8 w-8 text-primary" />
        </div>
        <div>
          <p className="text-lg text-muted-foreground font-medium">Synozur</p>
          <h1 className="text-3xl font-bold tracking-tight">Vega</h1>
          <p className="text-xl text-muted-foreground">
            Company OS Platform
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Badge
            variant={environment === 'Production' ? "default" : "secondary"}
            className="text-sm"
            data-testid="badge-environment"
          >
            {environment}
          </Badge>
          <Badge
            variant={isProductionRelease ? "default" : "outline"}
            className="text-sm"
            data-testid="badge-version"
          >
            Version {versionNumber}
          </Badge>
          {!isProductionRelease && (
            <Badge variant="outline" className="text-sm">
              Beta
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              <span>Platform Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">About Vega</p>
              <p className="text-sm text-muted-foreground">
                Vega is an AI-augmented Company Operating System that aligns organizational 
                strategy with execution. Manage your foundations, strategies, OKRs, and 
                team rhythm all in one integrated platform.
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-medium">Key Features</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <Target className="h-3 w-3 shrink-0" />
                  OKR management with hierarchical objectives
                </li>
                <li className="flex items-center gap-2">
                  <Layers className="h-3 w-3 shrink-0" />
                  Strategic planning and alignment
                </li>
                <li className="flex items-center gap-2">
                  <Calendar className="h-3 w-3 shrink-0" />
                  Focus Rhythm meeting management
                </li>
                <li className="flex items-center gap-2">
                  <Rocket className="h-3 w-3 shrink-0" />
                  AI-powered Launchpad document analysis
                </li>
                <li className="flex items-center gap-2">
                  <Building className="h-3 w-3 shrink-0" />
                  Microsoft 365 integration
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span>Support & Help</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Need Assistance?</p>
              <p className="text-sm text-muted-foreground">
                Our IT support team is here to help with any questions or issues you may encounter.
              </p>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Vega Support</p>
                  <p className="text-sm text-muted-foreground">Vega@synozur.com</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open('mailto:Vega@synozur.com', '_blank')}
                data-testid="button-email-support"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Email
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-medium">Documentation</p>
              <p className="text-sm text-muted-foreground">
                Visit the User Guide for comprehensive guidance on all 
                platform features and workflows.
              </p>
              <Button
                size="sm"
                variant="outline"
                asChild
                data-testid="button-user-guide"
              >
                <a href="/help">
                  <HelpCircle className="h-3 w-3 mr-1" />
                  User Guide
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <span>Version Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold text-primary">{versionNumber}</div>
                <div className="text-sm text-muted-foreground">Current Version</div>
              </div>

              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {new Date(VERSION_RELEASE_DATE).toLocaleDateString()}
                </div>
                <div className="text-sm text-muted-foreground">Release Date</div>
              </div>

              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {environment}
                </div>
                <div className="text-sm text-muted-foreground">Environment</div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    About Company OS
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Vega is positioned as the modern successor to Microsoft Viva Goals, 
                    providing enhanced OKR management with AI-powered insights and 
                    deep Microsoft 365 integration for enterprise teams.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
