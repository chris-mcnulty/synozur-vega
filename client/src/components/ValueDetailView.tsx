import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Target, TrendingUp, Zap, Loader2 } from "lucide-react";
import type { Objective, Strategy, BigRock } from "@shared/schema";

interface ValueDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  valueTitle: string;
  valueDescription: string;
  tenantId: string;
}

interface TaggedItems {
  objectives: Objective[];
  strategies: Strategy[];
  bigRocks: BigRock[];
}

export function ValueDetailView({ open, onOpenChange, valueTitle, valueDescription, tenantId }: ValueDetailViewProps) {
  const { data: taggedItems, isLoading } = useQuery<TaggedItems>({
    queryKey: [`/api/values/${encodeURIComponent(valueTitle)}/tagged-items`],
    enabled: open && !!valueTitle,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-value-detail">
        <DialogHeader>
          <DialogTitle className="text-2xl" data-testid="text-value-title">{valueTitle}</DialogTitle>
          {valueDescription && (
            <DialogDescription className="text-base" data-testid="text-value-description">
              {valueDescription}
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Strategies Section */}
            {taggedItems && taggedItems.strategies.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5" />
                    Strategic Priorities ({taggedItems.strategies.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {taggedItems.strategies.map((strategy) => (
                    <div
                      key={strategy.id}
                      className="p-3 rounded-md border hover-elevate"
                      data-testid={`card-strategy-${strategy.id}`}
                    >
                      <div className="font-medium" data-testid={`text-strategy-title-${strategy.id}`}>
                        {strategy.title}
                      </div>
                      {strategy.description && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {strategy.description}
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        {strategy.status && (
                          <Badge variant="outline" className="text-xs">
                            {strategy.status}
                          </Badge>
                        )}
                        {strategy.owner && (
                          <Badge variant="secondary" className="text-xs">
                            {strategy.owner}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Objectives Section */}
            {taggedItems && taggedItems.objectives.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="h-5 w-5" />
                    Objectives ({taggedItems.objectives.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {taggedItems.objectives.map((objective) => (
                    <div
                      key={objective.id}
                      className="p-3 rounded-md border hover-elevate"
                      data-testid={`card-objective-${objective.id}`}
                    >
                      <div className="font-medium" data-testid={`text-objective-title-${objective.id}`}>
                        {objective.title}
                      </div>
                      {objective.description && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {objective.description}
                        </div>
                      )}
                      <div className="flex gap-2 mt-2 items-center">
                        <Badge variant="outline" className="text-xs">
                          Q{objective.quarter} {objective.year}
                        </Badge>
                        {objective.progress !== null && objective.progress !== undefined && (
                          <Badge variant="secondary" className="text-xs">
                            {objective.progress}% Complete
                          </Badge>
                        )}
                        {objective.status && (
                          <Badge variant="outline" className="text-xs">
                            {objective.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Big Rocks Section */}
            {taggedItems && taggedItems.bigRocks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Zap className="h-5 w-5" />
                    Big Rocks ({taggedItems.bigRocks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {taggedItems.bigRocks.map((bigRock) => (
                    <div
                      key={bigRock.id}
                      className="p-3 rounded-md border hover-elevate"
                      data-testid={`card-bigrock-${bigRock.id}`}
                    >
                      <div className="font-medium" data-testid={`text-bigrock-title-${bigRock.id}`}>
                        {bigRock.title}
                      </div>
                      {bigRock.description && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {bigRock.description}
                        </div>
                      )}
                      <div className="flex gap-2 mt-2 items-center">
                        <Badge variant="outline" className="text-xs">
                          Q{bigRock.quarter} {bigRock.year}
                        </Badge>
                        {bigRock.status && (
                          <Badge variant="outline" className="text-xs">
                            {bigRock.status}
                          </Badge>
                        )}
                        {bigRock.completionPercentage !== null && bigRock.completionPercentage !== undefined && (
                          <Badge variant="secondary" className="text-xs">
                            {bigRock.completionPercentage}% Complete
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {taggedItems && 
             taggedItems.objectives.length === 0 && 
             taggedItems.strategies.length === 0 && 
             taggedItems.bigRocks.length === 0 && (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-no-items">
                No objectives, strategies, or big rocks are currently tagged with "{valueTitle}"
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
