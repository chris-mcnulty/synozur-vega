import { ArrowRight, Target, Layers, Lightbulb, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LinkageIndicatorProps {
  /**
   * Linkages to display.
   * Supports: 'goals', 'strategies', 'objectives', 'bigrocks'
   */
  linkedGoals?: string[];
  linkedStrategies?: string[];
  linkedObjectives?: string[];
  linkedBigRocks?: string[];
  
  /**
   * Display mode: 'compact' | 'detailed'
   * compact: Shows count badges
   * detailed: Shows full list with titles
   */
  mode?: 'compact' | 'detailed';
  
  /**
   * Direction: 'horizontal' | 'vertical'
   */
  direction?: 'horizontal' | 'vertical';
  
  /**
   * Show alignment chain visualization
   */
  showChain?: boolean;
}

const entityConfig = {
  goals: {
    icon: Trophy,
    label: 'Goals',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
  },
  strategies: {
    icon: Layers,
    label: 'Strategies',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
  },
  objectives: {
    icon: Target,
    label: 'Objectives',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
  },
  bigrocks: {
    icon: Lightbulb,
    label: 'Big Rocks',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950',
  },
};

export function LinkageIndicator({
  linkedGoals = [],
  linkedStrategies = [],
  linkedObjectives = [],
  linkedBigRocks = [],
  mode = 'compact',
  direction = 'horizontal',
  showChain = false,
}: LinkageIndicatorProps) {
  const hasAnyLinks = 
    linkedGoals.length > 0 || 
    linkedStrategies.length > 0 || 
    linkedObjectives.length > 0 || 
    linkedBigRocks.length > 0;

  if (!hasAnyLinks && !showChain) return null;

  if (showChain) {
    return (
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Strategic Alignment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`flex ${direction === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'} items-center gap-2`}>
            {linkedGoals.length > 0 && (
              <EntityChip 
                type="goals" 
                count={linkedGoals.length} 
                items={mode === 'detailed' ? linkedGoals : undefined}
              />
            )}
            {linkedGoals.length > 0 && linkedStrategies.length > 0 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            
            {linkedStrategies.length > 0 && (
              <EntityChip 
                type="strategies" 
                count={linkedStrategies.length}
                items={mode === 'detailed' ? linkedStrategies : undefined}
              />
            )}
            {linkedStrategies.length > 0 && linkedObjectives.length > 0 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            
            {linkedObjectives.length > 0 && (
              <EntityChip 
                type="objectives" 
                count={linkedObjectives.length}
                items={mode === 'detailed' ? linkedObjectives : undefined}
              />
            )}
            {linkedObjectives.length > 0 && linkedBigRocks.length > 0 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            
            {linkedBigRocks.length > 0 && (
              <EntityChip 
                type="bigrocks" 
                count={linkedBigRocks.length}
                items={mode === 'detailed' ? linkedBigRocks : undefined}
              />
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`flex ${direction === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'} gap-2`}>
      {linkedGoals.length > 0 && (
        <EntityChip 
          type="goals" 
          count={linkedGoals.length}
          items={mode === 'detailed' ? linkedGoals : undefined}
        />
      )}
      {linkedStrategies.length > 0 && (
        <EntityChip 
          type="strategies" 
          count={linkedStrategies.length}
          items={mode === 'detailed' ? linkedStrategies : undefined}
        />
      )}
      {linkedObjectives.length > 0 && (
        <EntityChip 
          type="objectives" 
          count={linkedObjectives.length}
          items={mode === 'detailed' ? linkedObjectives : undefined}
        />
      )}
      {linkedBigRocks.length > 0 && (
        <EntityChip 
          type="bigrocks" 
          count={linkedBigRocks.length}
          items={mode === 'detailed' ? linkedBigRocks : undefined}
        />
      )}
    </div>
  );
}

function EntityChip({ 
  type, 
  count, 
  items 
}: { 
  type: keyof typeof entityConfig; 
  count: number;
  items?: string[];
}) {
  const config = entityConfig[type];
  const Icon = config.icon;
  
  if (items) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          <Icon className="h-3 w-3" />
          <span>{config.label}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {items.map((item, index) => (
            <Badge 
              key={index} 
              variant="outline" 
              className="text-xs"
              data-testid={`badge-linked-${type}-${index}`}
            >
              {item}
            </Badge>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <Badge 
      variant="outline" 
      className={`gap-1 ${config.bgColor} border-transparent`}
      data-testid={`chip-${type}`}
    >
      <Icon className={`h-3 w-3 ${config.color}`} />
      <span className={config.color}>{count} {config.label}</span>
    </Badge>
  );
}
