import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Sparkles, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Lightbulb, Wand2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface OKRQualityScoreResult {
  score: number;
  dimensions: {
    clarity: { score: number; maxScore: number; feedback: string };
    measurability: { score: number; maxScore: number; feedback: string };
    achievability: { score: number; maxScore: number; feedback: string };
    alignment: { score: number; maxScore: number; feedback: string };
    timeBound: { score: number; maxScore: number; feedback: string };
  };
  issues: Array<{ type: string; message: string; impact: number }>;
  strengths: Array<{ type: string; message: string; bonus: number }>;
  suggestion: string | null;
}

interface OKRQualityScoreProps {
  objectiveTitle: string;
  objectiveDescription?: string;
  keyResults?: Array<{ title: string; target?: number; unit?: string }>;
  alignedObjectives?: string[];
  onApplySuggestion?: (suggestion: string) => void;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-100 dark:bg-green-900/30";
  if (score >= 50) return "bg-yellow-100 dark:bg-yellow-900/30";
  return "bg-red-100 dark:bg-red-900/30";
}

function getProgressColor(score: number, maxScore: number): string {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 80) return "bg-green-500";
  if (percentage >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function DimensionScore({ label, score, maxScore, feedback }: { 
  label: string; 
  score: number; 
  maxScore: number; 
  feedback: string; 
}) {
  const percentage = (score / maxScore) * 100;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground/80">{label}</span>
        <span className={cn("font-medium", getScoreColor(percentage))}>
          {score}/{maxScore}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-300", getProgressColor(score, maxScore))}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{feedback}</p>
    </div>
  );
}

export function OKRQualityScore({
  objectiveTitle,
  objectiveDescription,
  keyResults,
  alignedObjectives,
  onApplySuggestion,
  className,
}: OKRQualityScoreProps) {
  const [result, setResult] = useState<OKRQualityScoreResult | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const scoreMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/score-okr", {
        objectiveTitle,
        objectiveDescription,
        keyResults,
        alignedObjectives,
      });
      return response.json() as Promise<OKRQualityScoreResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setIsExpanded(true);
    },
  });

  const handleScore = () => {
    if (!objectiveTitle || objectiveTitle.length < 3) return;
    scoreMutation.mutate();
  };

  const handleApplySuggestion = () => {
    if (result?.suggestion && onApplySuggestion) {
      onApplySuggestion(result.suggestion);
      setResult(null);
    }
  };

  if (!result && !scoreMutation.isPending) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleScore}
          disabled={!objectiveTitle || objectiveTitle.length < 3}
          data-testid="button-score-okr"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Check Quality
        </Button>
        {objectiveTitle && objectiveTitle.length < 3 && (
          <span className="text-xs text-muted-foreground">
            Enter at least 3 characters
          </span>
        )}
      </div>
    );
  }

  if (scoreMutation.isPending) {
    return (
      <div className={cn("flex items-center gap-2 py-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Analyzing OKR quality...</span>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className={cn("rounded-lg border", getScoreBgColor(result.score), className)}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between p-3 hover-elevate rounded-lg transition-colors"
            data-testid="button-toggle-quality-details"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg",
                getScoreBgColor(result.score),
                getScoreColor(result.score)
              )}>
                {result.score}
              </div>
              <div className="text-left">
                <p className={cn("font-medium", getScoreColor(result.score))}>
                  {result.score >= 80 ? "Excellent OKR" : result.score >= 50 ? "Good, needs work" : "Needs improvement"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {result.issues.length} issue{result.issues.length !== 1 ? "s" : ""} found
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {result.suggestion && onApplySuggestion && (
                <Badge variant="secondary" className="gap-1">
                  <Wand2 className="h-3 w-3" />
                  Suggestion available
                </Badge>
              )}
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-4">
            <div className="space-y-3 pt-2">
              <h4 className="text-sm font-medium text-foreground/80">Dimension Scores</h4>
              <DimensionScore 
                label="Clarity" 
                score={result.dimensions.clarity.score} 
                maxScore={result.dimensions.clarity.maxScore}
                feedback={result.dimensions.clarity.feedback}
              />
              <DimensionScore 
                label="Measurability" 
                score={result.dimensions.measurability.score} 
                maxScore={result.dimensions.measurability.maxScore}
                feedback={result.dimensions.measurability.feedback}
              />
              <DimensionScore 
                label="Achievability" 
                score={result.dimensions.achievability.score} 
                maxScore={result.dimensions.achievability.maxScore}
                feedback={result.dimensions.achievability.feedback}
              />
              <DimensionScore 
                label="Alignment" 
                score={result.dimensions.alignment.score} 
                maxScore={result.dimensions.alignment.maxScore}
                feedback={result.dimensions.alignment.feedback}
              />
              <DimensionScore 
                label="Time-Bound" 
                score={result.dimensions.timeBound.score} 
                maxScore={result.dimensions.timeBound.maxScore}
                feedback={result.dimensions.timeBound.feedback}
              />
            </div>

            {result.issues.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  Issues
                </h4>
                <ul className="space-y-1">
                  {result.issues.map((issue, i) => (
                    <li key={i} className="text-sm text-foreground/70 flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">-</span>
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.strengths.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  Strengths
                </h4>
                <ul className="space-y-1">
                  {result.strengths.map((strength, i) => (
                    <li key={i} className="text-sm text-foreground/70 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">+</span>
                      <span>{strength.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.suggestion && (
              <div className="space-y-2 pt-2 border-t">
                <h4 className="text-sm font-medium flex items-center gap-2 text-primary">
                  <Lightbulb className="h-4 w-4" />
                  AI Suggestion
                </h4>
                <p className="text-sm bg-background/50 p-2 rounded border italic">
                  "{result.suggestion}"
                </p>
                {onApplySuggestion && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleApplySuggestion}
                    className="w-full"
                    data-testid="button-apply-suggestion"
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Apply Suggestion
                  </Button>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleScore}
                disabled={scoreMutation.isPending}
                data-testid="button-rescore-okr"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Re-analyze
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setResult(null)}
                data-testid="button-dismiss-score"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
