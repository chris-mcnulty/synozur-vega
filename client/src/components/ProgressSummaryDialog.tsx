import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { Loader2, Copy, Check, Sparkles, Calendar, FileText } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

interface ObjectiveWithKRs {
  id: string;
  title: string;
  progress: number;
  status: string;
  keyResults?: Array<{
    id: string;
    title: string;
    currentValue: number;
    targetValue: number;
    unit: string;
    progress: number;
  }>;
}

interface ProgressSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectives: ObjectiveWithKRs[];
  quarter: number;
  year: number;
}

type DatePreset = 'today' | 'yesterday' | 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'custom';

export function ProgressSummaryDialog({
  open,
  onOpenChange,
  objectives,
  quarter,
  year,
}: ProgressSummaryDialogProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState("");
  const [copied, setCopied] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>('this-week');
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const today = new Date();
    
    switch (datePreset) {
      case 'today':
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'yesterday':
        const yesterday = subDays(today, 1);
        setStartDate(format(yesterday, 'yyyy-MM-dd'));
        setEndDate(format(yesterday, 'yyyy-MM-dd'));
        break;
      case 'this-week':
        setStartDate(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        break;
      case 'last-week':
        const lastWeek = subDays(today, 7);
        setStartDate(format(startOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        break;
      case 'this-month':
        setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
        break;
      case 'last-month':
        const lastMonth = subDays(startOfMonth(today), 1);
        setStartDate(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));
        break;
      case 'custom':
        break;
    }
  }, [datePreset]);

  const handleGenerate = async () => {
    if (objectives.length === 0) {
      toast({
        title: "No objectives",
        description: "There are no objectives in the current view to summarize.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setSummary("");

    try {
      const response = await fetch("/api/ai/progress-summary/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tenantId: currentTenant.id,
          objectives: objectives.map(obj => ({
            id: obj.id,
            title: obj.title,
            progress: obj.progress,
            status: obj.status,
            keyResults: obj.keyResults?.map(kr => ({
              id: kr.id,
              title: kr.title,
              currentValue: kr.currentValue,
              targetValue: kr.targetValue,
              unit: kr.unit,
              progress: kr.progress,
            })),
          })),
          quarter,
          year,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          customPrompt: customPrompt || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate summary");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response stream");
      }

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                setSummary(prev => prev + data.content);
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Error generating summary:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate progress summary",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Summary copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const formatDateDisplay = () => {
    if (!startDate && !endDate) return "All time";
    if (startDate === endDate) return format(new Date(startDate), 'MMM d, yyyy');
    return `${format(new Date(startDate), 'MMM d')} - ${format(new Date(endDate), 'MMM d, yyyy')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate Progress Summary
          </DialogTitle>
          <DialogDescription>
            Create an AI-generated summary of OKR progress for the selected time period. 
            The summary is optimized for copy/paste into emails or team updates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Time Period
            </Label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'today', label: 'Today' },
                { value: 'yesterday', label: 'Yesterday' },
                { value: 'this-week', label: 'This Week' },
                { value: 'last-week', label: 'Last Week' },
                { value: 'this-month', label: 'This Month' },
                { value: 'last-month', label: 'Last Month' },
                { value: 'custom', label: 'Custom' },
              ].map((preset) => (
                <Button
                  key={preset.value}
                  variant={datePreset === preset.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDatePreset(preset.value as DatePreset)}
                  data-testid={`button-preset-${preset.value}`}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            {datePreset === 'custom' && (
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    data-testid="input-start-date"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    data-testid="input-end-date"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-prompt" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Custom Instructions (Optional)
            </Label>
            <Textarea
              id="custom-prompt"
              placeholder="E.g., 'Focus on sales team progress' or 'Highlight blockers and risks'"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="resize-none"
              rows={2}
              data-testid="input-custom-prompt"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {objectives.length} objective{objectives.length !== 1 ? 's' : ''} in view | {formatDateDisplay()}
            </div>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || objectives.length === 0}
              data-testid="button-generate-summary"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Summary
                </>
              )}
            </Button>
          </div>

          {summary && (
            <div className="flex-1 overflow-hidden flex flex-col border rounded-lg">
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
                <span className="text-sm font-medium">Generated Summary</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!summary}
                  data-testid="button-copy-summary"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <ScrollArea className="flex-1 p-4" ref={summaryRef}>
                <div 
                  className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap"
                  data-testid="text-summary-content"
                >
                  {summary}
                </div>
              </ScrollArea>
            </div>
          )}

          {!summary && !isGenerating && (
            <div className="flex-1 flex items-center justify-center border rounded-lg bg-muted/20">
              <div className="text-center text-muted-foreground p-8">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Click "Generate Summary" to create an AI-powered progress report</p>
                <p className="text-sm mt-2">The summary will be ready to copy and share</p>
              </div>
            </div>
          )}

          {isGenerating && !summary && (
            <div className="flex-1 flex items-center justify-center border rounded-lg">
              <div className="text-center p-8">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                <p className="text-muted-foreground">Analyzing progress and generating summary...</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
