import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Target, TrendingUp, Loader2, Plus, X, Link2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Objective, Strategy } from "@shared/schema";

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
}

export function ValueDetailView({ open, onOpenChange, valueTitle, valueDescription, tenantId }: ValueDetailViewProps) {
  const { toast } = useToast();
  const [linkStrategiesOpen, setLinkStrategiesOpen] = useState(false);
  const [linkObjectivesOpen, setLinkObjectivesOpen] = useState(false);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [selectedObjectives, setSelectedObjectives] = useState<string[]>([]);

  const { data: taggedItems, isLoading, refetch } = useQuery<TaggedItems>({
    queryKey: [`/api/values/${encodeURIComponent(valueTitle)}/tagged-items`],
    enabled: open && !!valueTitle,
  });

  // Fetch all strategies for linking
  const { data: allStrategies = [] } = useQuery<Strategy[]>({
    queryKey: ['/api/strategies'],
    enabled: linkStrategiesOpen,
  });

  // Fetch all objectives for linking
  const { data: allObjectives = [] } = useQuery<Objective[]>({
    queryKey: ['/api/objectives'],
    enabled: linkObjectivesOpen,
  });

  // Link strategy to value mutation
  const linkStrategyMutation = useMutation({
    mutationFn: async (strategyId: string) => {
      return apiRequest('POST', `/api/strategies/${strategyId}/values`, { valueTitle });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/values/${encodeURIComponent(valueTitle)}/tagged-items`] });
      queryClient.invalidateQueries({ queryKey: ['/api/values/analytics/distribution'] });
    },
  });

  // Unlink strategy from value mutation
  const unlinkStrategyMutation = useMutation({
    mutationFn: async (strategyId: string) => {
      return apiRequest('DELETE', `/api/strategies/${strategyId}/values`, { valueTitle });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/values/${encodeURIComponent(valueTitle)}/tagged-items`] });
      queryClient.invalidateQueries({ queryKey: ['/api/values/analytics/distribution'] });
    },
  });

  // Link objective to value mutation
  const linkObjectiveMutation = useMutation({
    mutationFn: async (objectiveId: string) => {
      return apiRequest('POST', `/api/objectives/${objectiveId}/values`, { valueTitle });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/values/${encodeURIComponent(valueTitle)}/tagged-items`] });
      queryClient.invalidateQueries({ queryKey: ['/api/values/analytics/distribution'] });
    },
  });

  // Unlink objective from value mutation
  const unlinkObjectiveMutation = useMutation({
    mutationFn: async (objectiveId: string) => {
      return apiRequest('DELETE', `/api/objectives/${objectiveId}/values`, { valueTitle });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/values/${encodeURIComponent(valueTitle)}/tagged-items`] });
      queryClient.invalidateQueries({ queryKey: ['/api/values/analytics/distribution'] });
    },
  });

  const handleOpenLinkStrategies = () => {
    // Pre-select already linked strategies
    const linkedIds = taggedItems?.strategies.map(s => s.id) || [];
    setSelectedStrategies(linkedIds);
    setLinkStrategiesOpen(true);
  };

  const handleOpenLinkObjectives = () => {
    // Pre-select already linked objectives
    const linkedIds = taggedItems?.objectives.map(o => o.id) || [];
    setSelectedObjectives(linkedIds);
    setLinkObjectivesOpen(true);
  };

  const handleSaveStrategyLinks = async () => {
    const currentLinkedIds = taggedItems?.strategies.map(s => s.id) || [];
    
    // Find strategies to link (newly selected)
    const toLink = selectedStrategies.filter(id => !currentLinkedIds.includes(id));
    // Find strategies to unlink (deselected)
    const toUnlink = currentLinkedIds.filter(id => !selectedStrategies.includes(id));

    try {
      await Promise.all([
        ...toLink.map(id => linkStrategyMutation.mutateAsync(id)),
        ...toUnlink.map(id => unlinkStrategyMutation.mutateAsync(id)),
      ]);
      toast({ title: "Strategies updated", description: "Strategy links have been saved." });
      setLinkStrategiesOpen(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update strategy links." });
    }
  };

  const handleSaveObjectiveLinks = async () => {
    const currentLinkedIds = taggedItems?.objectives.map(o => o.id) || [];
    
    // Find objectives to link (newly selected)
    const toLink = selectedObjectives.filter(id => !currentLinkedIds.includes(id));
    // Find objectives to unlink (deselected)
    const toUnlink = currentLinkedIds.filter(id => !selectedObjectives.includes(id));

    try {
      await Promise.all([
        ...toLink.map(id => linkObjectiveMutation.mutateAsync(id)),
        ...toUnlink.map(id => unlinkObjectiveMutation.mutateAsync(id)),
      ]);
      toast({ title: "Objectives updated", description: "Objective links have been saved." });
      setLinkObjectivesOpen(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update objective links." });
    }
  };

  const toggleStrategy = (strategyId: string) => {
    setSelectedStrategies(prev => 
      prev.includes(strategyId) 
        ? prev.filter(id => id !== strategyId)
        : [...prev, strategyId]
    );
  };

  const toggleObjective = (objectiveId: string) => {
    setSelectedObjectives(prev => 
      prev.includes(objectiveId) 
        ? prev.filter(id => id !== objectiveId)
        : [...prev, objectiveId]
    );
  };

  return (
    <>
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
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5" />
                    Strategies ({taggedItems?.strategies.length || 0})
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenLinkStrategies}
                    data-testid="button-link-strategies"
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Link Strategies
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {taggedItems && taggedItems.strategies.length > 0 ? (
                    taggedItems.strategies.map((strategy) => (
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
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      No strategies linked to this value yet
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Objectives Section */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="h-5 w-5" />
                    Objectives ({taggedItems?.objectives.length || 0})
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenLinkObjectives}
                    data-testid="button-link-objectives"
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Link Objectives
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {taggedItems && taggedItems.objectives.length > 0 ? (
                    taggedItems.objectives.map((objective) => (
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
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      No objectives linked to this value yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Link Strategies Dialog */}
      <Dialog open={linkStrategiesOpen} onOpenChange={setLinkStrategiesOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-link-strategies">
          <DialogHeader>
            <DialogTitle>Link Strategies to "{valueTitle}"</DialogTitle>
            <DialogDescription>
              Select strategies to associate with this company value.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-2">
              {allStrategies.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No strategies available. Create strategies first.
                </div>
              ) : (
                allStrategies.map((strategy) => (
                  <div
                    key={strategy.id}
                    className="flex items-start gap-3 p-3 rounded-md border hover-elevate cursor-pointer"
                    onClick={() => toggleStrategy(strategy.id)}
                    data-testid={`item-strategy-${strategy.id}`}
                  >
                    <Checkbox
                      checked={selectedStrategies.includes(strategy.id)}
                      onCheckedChange={() => toggleStrategy(strategy.id)}
                      data-testid={`checkbox-strategy-${strategy.id}`}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{strategy.title}</div>
                      {strategy.description && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {strategy.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkStrategiesOpen(false)} data-testid="button-cancel-link-strategies">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveStrategyLinks} 
              disabled={linkStrategyMutation.isPending || unlinkStrategyMutation.isPending}
              data-testid="button-save-link-strategies"
            >
              {(linkStrategyMutation.isPending || unlinkStrategyMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Objectives Dialog */}
      <Dialog open={linkObjectivesOpen} onOpenChange={setLinkObjectivesOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-link-objectives">
          <DialogHeader>
            <DialogTitle>Link Objectives to "{valueTitle}"</DialogTitle>
            <DialogDescription>
              Select objectives to associate with this company value.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-2">
              {allObjectives.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No objectives available. Create objectives first.
                </div>
              ) : (
                allObjectives.map((objective) => (
                  <div
                    key={objective.id}
                    className="flex items-start gap-3 p-3 rounded-md border hover-elevate cursor-pointer"
                    onClick={() => toggleObjective(objective.id)}
                    data-testid={`item-objective-${objective.id}`}
                  >
                    <Checkbox
                      checked={selectedObjectives.includes(objective.id)}
                      onCheckedChange={() => toggleObjective(objective.id)}
                      data-testid={`checkbox-objective-${objective.id}`}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{objective.title}</div>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          Q{objective.quarter} {objective.year}
                        </Badge>
                        {objective.level && (
                          <Badge variant="secondary" className="text-xs capitalize">
                            {objective.level}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkObjectivesOpen(false)} data-testid="button-cancel-link-objectives">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveObjectiveLinks} 
              disabled={linkObjectiveMutation.isPending || unlinkObjectiveMutation.isPending}
              data-testid="button-save-link-objectives"
            >
              {(linkObjectiveMutation.isPending || unlinkObjectiveMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
