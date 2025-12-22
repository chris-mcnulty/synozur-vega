import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const comparisons = [
  {
    feature: "Product Status",
    vivaGoals: "Deprecated July 2025",
    vega: "Actively developed",
    vegaWins: true,
  },
  {
    feature: "Scope",
    vivaGoals: "OKRs only",
    vega: "Full Company OS (Mission → Execution)",
    vegaWins: true,
  },
  {
    feature: "AI Capabilities",
    vivaGoals: "Basic suggestions",
    vega: "GPT-5 powered throughout",
    vegaWins: true,
  },
  {
    feature: "Custom Vocabulary",
    vivaGoals: "Not supported",
    vega: "Fully customizable terminology",
    vegaWins: true,
  },
  {
    feature: "Meeting Integration",
    vivaGoals: "None",
    vega: "Focus Rhythm with Outlook sync",
    vegaWins: true,
  },
  {
    feature: "Document Import",
    vivaGoals: "OKR creation from documents",
    vega: "AI Launchpad: Full Company OS from documents",
    vegaWins: true,
  },
  {
    feature: "Planner Integration",
    vivaGoals: "Limited",
    vega: "Full bidirectional sync",
    vegaWins: true,
  },
  {
    feature: "Reporting & Export",
    vivaGoals: "Basic dashboards",
    vega: "PDF, PowerPoint, Snapshots",
    vegaWins: true,
  },
];

export function WhyVegaSection() {
  return (
    <section id="why-vega" className="py-20 bg-muted/30">
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-6">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">Viva Goals Migration</Badge>
          <h2 className="text-4xl font-semibold mb-4">Why Organizations Choose Vega</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Microsoft announced Viva Goals deprecation in July 2025. 
            Vega is the natural next step—built by M365 experts, for M365 organizations.
          </p>
        </div>
        
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-semibold">Feature</th>
                    <th className="text-left p-4 font-semibold text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <X className="h-4 w-4 text-destructive" />
                        Viva Goals
                      </span>
                    </th>
                    <th className="text-left p-4 font-semibold text-primary">
                      <span className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Vega
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((row, index) => (
                    <tr key={index} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-4 font-medium">{row.feature}</td>
                      <td className="p-4 text-muted-foreground">{row.vivaGoals}</td>
                      <td className="p-4">
                        <span className="flex items-center gap-2 text-foreground">
                          {row.vegaWins && <Check className="h-4 w-4 text-green-500 flex-shrink-0" />}
                          {row.vega}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        
        <div className="text-center mt-10">
          <Link href="/login">
            <Button size="lg" className="px-8" data-testid="button-migrate-now">
              Start Your Migration
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
