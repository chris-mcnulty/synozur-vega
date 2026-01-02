import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileText, Loader2 } from "lucide-react";
import type { Team } from "@shared/schema";

interface ExportOptions {
  includeFoundations: boolean;
  includeStrategies: boolean;
  includeObjectives: boolean;
  includeBigRocks: boolean;
  includeTeams: boolean;
  quarter?: number;
  year?: number;
  teamId?: string;
  format: "markdown" | "json";
}

interface CompanyOSExportDialogProps {
  trigger?: React.ReactNode;
}

export function CompanyOSExportDialog({ trigger }: CompanyOSExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({
    includeFoundations: true,
    includeStrategies: true,
    includeObjectives: true,
    includeBigRocks: true,
    includeTeams: true,
    format: "markdown",
  });

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const currentYear = new Date().getFullYear();

  const periods = [
    { value: "all", label: "All Time" },
    { value: `year-${currentYear}`, label: `Full Year ${currentYear}` },
    { value: `year-${currentYear - 1}`, label: `Full Year ${currentYear - 1}` },
    { value: `${currentYear}-1`, label: `Q1 ${currentYear}` },
    { value: `${currentYear}-2`, label: `Q2 ${currentYear}` },
    { value: `${currentYear}-3`, label: `Q3 ${currentYear}` },
    { value: `${currentYear}-4`, label: `Q4 ${currentYear}` },
    { value: `${currentYear - 1}-1`, label: `Q1 ${currentYear - 1}` },
    { value: `${currentYear - 1}-2`, label: `Q2 ${currentYear - 1}` },
    { value: `${currentYear - 1}-3`, label: `Q3 ${currentYear - 1}` },
    { value: `${currentYear - 1}-4`, label: `Q4 ${currentYear - 1}` },
  ];

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.append("includeFoundations", String(options.includeFoundations));
      params.append("includeStrategies", String(options.includeStrategies));
      params.append("includeObjectives", String(options.includeObjectives));
      params.append("includeBigRocks", String(options.includeBigRocks));
      params.append("includeTeams", String(options.includeTeams));
      params.append("format", options.format);
      
      if (options.quarter) params.append("quarter", String(options.quarter));
      if (options.year) params.append("year", String(options.year));
      if (options.teamId) params.append("teamId", options.teamId);

      const response = await fetch(`/api/export/company-os?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error("Export failed");
      }

      if (options.format === "json") {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Company_OS_${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const contentDisposition = response.headers.get("Content-Disposition");
        const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
        a.download = filenameMatch ? filenameMatch[1] : `Company_OS_${new Date().toISOString().split("T")[0]}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setOpen(false);
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePeriodChange = (value: string) => {
    if (value === "all") {
      setOptions(prev => ({ ...prev, quarter: undefined, year: undefined }));
    } else if (value.startsWith("year-")) {
      const year = parseInt(value.replace("year-", ""));
      setOptions(prev => ({ ...prev, year, quarter: undefined }));
    } else {
      const [year, quarter] = value.split("-").map(Number);
      setOptions(prev => ({ ...prev, year, quarter }));
    }
  };

  const getPeriodValue = () => {
    if (!options.year) return "all";
    if (!options.quarter) return `year-${options.year}`;
    return `${options.year}-${options.quarter}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" data-testid="button-export-company-os">
            <Download className="h-4 w-4 mr-2" />
            Export Company OS
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Export Company OS
          </DialogTitle>
          <DialogDescription>
            Generate a comprehensive document of your organization's strategic framework. Perfect for board presentations, Copilot context, or creating templates for new organizations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <Label className="text-sm font-medium">Include Sections</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="foundations"
                  checked={options.includeFoundations}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, includeFoundations: !!checked }))
                  }
                  data-testid="checkbox-foundations"
                />
                <Label htmlFor="foundations" className="text-sm">Foundations</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="strategies"
                  checked={options.includeStrategies}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, includeStrategies: !!checked }))
                  }
                  data-testid="checkbox-strategies"
                />
                <Label htmlFor="strategies" className="text-sm">Strategies</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="objectives"
                  checked={options.includeObjectives}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, includeObjectives: !!checked }))
                  }
                  data-testid="checkbox-objectives"
                />
                <Label htmlFor="objectives" className="text-sm">Objectives & KRs</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="bigRocks"
                  checked={options.includeBigRocks}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, includeBigRocks: !!checked }))
                  }
                  data-testid="checkbox-bigrocks"
                />
                <Label htmlFor="bigRocks" className="text-sm">Big Rocks</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="teams"
                  checked={options.includeTeams}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, includeTeams: !!checked }))
                  }
                  data-testid="checkbox-teams"
                />
                <Label htmlFor="teams" className="text-sm">Teams</Label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-medium">Filters</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="period" className="text-xs text-muted-foreground">Time Period</Label>
                <Select
                  value={getPeriodValue()}
                  onValueChange={handlePeriodChange}
                >
                  <SelectTrigger data-testid="select-export-period">
                    <SelectValue placeholder="All Time" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="team" className="text-xs text-muted-foreground">Team</Label>
                <Select
                  value={options.teamId || "all"}
                  onValueChange={(value) =>
                    setOptions(prev => ({ ...prev, teamId: value === "all" ? undefined : value }))
                  }
                >
                  <SelectTrigger data-testid="select-export-team">
                    <SelectValue placeholder="All Teams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Format</Label>
            <Select
              value={options.format}
              onValueChange={(value: "markdown" | "json") =>
                setOptions(prev => ({ ...prev, format: value }))
              }
            >
              <SelectTrigger data-testid="select-export-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="markdown">Markdown (.md) - Best for Copilot & documents</SelectItem>
                <SelectItem value="json">JSON (.json) - Best for data processing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting} data-testid="button-confirm-export">
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
