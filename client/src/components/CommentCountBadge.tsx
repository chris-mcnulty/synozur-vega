import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

type CommentEntityType = "objective" | "key_result" | "big_rock" | "check_in";

interface Props {
  entityType: CommentEntityType;
  entityId: string;
  className?: string;
}

export function CommentCountBadge({ entityType, entityId, className }: Props) {
  const { data: count } = useQuery<number>({
    queryKey: ["/api/comments/counts", entityType, entityId],
    queryFn: async () => {
      const res = await fetch("/api/comments/counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ entityType, entityIds: [entityId] }),
      });
      if (!res.ok) return 0;
      const data = await res.json();
      return Number(data?.[entityId] ?? 0);
    },
    enabled: !!entityId,
    staleTime: 30000,
  });

  if (!count || count <= 0) return null;
  return (
    <Badge
      variant="outline"
      className={`text-xs ${className ?? ""}`}
      data-testid={`badge-comments-${entityId}`}
      title={`${count} comment${count === 1 ? "" : "s"}`}
    >
      <MessageSquare className="h-3 w-3 mr-1" />
      {count}
    </Badge>
  );
}
