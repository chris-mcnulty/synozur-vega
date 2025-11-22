import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

interface ValueBadgesProps {
  entityType: 'objective' | 'strategy';
  entityId: string;
  className?: string;
}

export function ValueBadges({ entityType, entityId, className = "" }: ValueBadgesProps) {
  const endpoint = entityType === 'objective' 
    ? `/api/objectives/${entityId}/values`
    : `/api/strategies/${entityId}/values`;

  const { data: values = [] } = useQuery<string[]>({
    queryKey: [endpoint],
    queryFn: async () => {
      const res = await fetch(endpoint);
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (values.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {values.map((valueTitle: string) => (
        <Badge
          key={valueTitle}
          variant="outline"
          className="text-xs"
          data-testid={`badge-value-${valueTitle}`}
        >
          {valueTitle}
        </Badge>
      ))}
    </div>
  );
}
