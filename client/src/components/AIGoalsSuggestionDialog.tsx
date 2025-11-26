import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { Loader2, Copy, Check, Sparkles, Target, RefreshCw } from "lucide-react";

interface AIGoalsSuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIGoalsSuggestionDialog({
  open,
  onOpenChange,
}: AIGoalsSuggestionDialogProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState("");
  const [copied, setCopied] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (suggestionsRef.current) {
      suggestionsRef.current.scrollTop = suggestionsRef.current.scrollHeight;
    }
  }, [suggestions]);

  useEffect(() => {
    if (open && !hasGenerated && !isGenerating) {
      handleGenerate();
    }
  }, [open]);

  const handleGenerate = async () => {
    if (!currentTenant?.id) {
      toast({
        title: "No tenant selected",
        description: "Please select an organization first.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setSuggestions("");
    setHasGenerated(true);

    try {
      const response = await fetch("/api/ai/suggest/goals/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tenantId: currentTenant.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate goal suggestions");
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
                setSuggestions(prev => prev + data.content);
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
      console.error("Error generating goal suggestions:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate goal suggestions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(suggestions);
      setCopied(true);
      toast({
        title: "Copied",
        description: "Goal suggestions copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSuggestions("");
    setHasGenerated(false);
  };

  const formatSuggestions = (text: string) => {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/^(\d+\.)/gm, '<span class="text-primary font-semibold">$1</span>')
      .replace(/^- /gm, '<span class="text-muted-foreground">•</span> ')
      .replace(/\n/g, '<br/>');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" data-testid="dialog-ai-goal-suggestions">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="text-dialog-title">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Goal Suggestions
          </DialogTitle>
          <DialogDescription data-testid="text-dialog-description">
            AI-generated annual goal suggestions based on your organization's mission, vision, values, and strategies.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-[300px] max-h-[50vh]" ref={suggestionsRef as any}>
          <div className="p-4 space-y-4" data-testid="container-suggestions">
            {isGenerating && suggestions === "" && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="relative">
                  <Target className="w-12 h-12 text-primary/30" />
                  <Loader2 className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium" data-testid="text-generating-status">Analyzing organizational context...</p>
                  <p className="text-xs text-muted-foreground mt-1">Reviewing mission, vision, values, and strategies</p>
                </div>
              </div>
            )}
            
            {suggestions && (
              <div 
                className="prose prose-sm dark:prose-invert max-w-none"
                data-testid="text-suggestions-content"
                dangerouslySetInnerHTML={{ __html: formatSuggestions(suggestions) }}
              />
            )}
            
            {isGenerating && suggestions && (
              <div className="flex items-center gap-2 text-primary animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Generating...</span>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between gap-2 pt-4 border-t">
          <div className="flex items-center gap-2">
            {suggestions && !isGenerating && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                data-testid="button-regenerate"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {suggestions && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={isGenerating || !suggestions}
                data-testid="button-copy"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            )}
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleClose}
              data-testid="button-close"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
