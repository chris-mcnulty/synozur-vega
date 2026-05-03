import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCommentCount, type CommentEntityType } from "@/hooks/use-comment-counts";

interface Props {
  entityType: CommentEntityType;
  entityId: string;
  className?: string;
  size?: "sm" | "xs";
}

export function CommentCountInlineBadge({ entityType, entityId, className, size = "sm" }: Props) {
  const count = useCommentCount(entityType, entityId);
  if (!count || count <= 0) return null;
  const isXs = size === "xs";
  return (
    <Badge
      variant="outline"
      className={cn(
        isXs ? "text-[10px] px-1.5 py-0 h-4" : "text-xs",
        "flex-shrink-0",
        className,
      )}
      data-testid={`badge-comments-${entityId}`}
      title={`${count} comment${count === 1 ? "" : "s"}`}
    >
      <MessageSquare className={cn("mr-1", isXs ? "h-2.5 w-2.5" : "h-3 w-3")} />
      {count}
    </Badge>
  );
}
