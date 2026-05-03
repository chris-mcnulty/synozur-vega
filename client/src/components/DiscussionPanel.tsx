import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { usePermissions } from "@/hooks/use-permissions";
import { format } from "date-fns";
import { AtSign, Send, Pencil, Trash2, MessageSquare, X, Reply } from "lucide-react";
import ReactMarkdown from "react-markdown";

export type CommentEntityType = "objective" | "key_result" | "big_rock" | "check_in";

interface UserResult {
  id: string;
  email: string;
  name: string;
}

interface Comment {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  parentCommentId: string | null;
  authorUserId: string;
  body: string;
  mentionedUserIds: string[] | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  author: UserResult | null;
  mentions: UserResult[];
}

interface DiscussionPanelProps {
  entityType: CommentEntityType;
  entityId: string;
  className?: string;
}

const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g;
const EDIT_WINDOW_MS = 15 * 60 * 1000;

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// Convert @[name](id) tokens to bold markdown so react-markdown renders them
// alongside the markdown-light syntax (bold, italic, links, code).
function bodyToMarkdown(body: string): string {
  return body.replace(MENTION_RE, (_full, name) => `**@${name}**`);
}

function MentionComposer({
  value,
  onChange,
  onSubmit,
  submitting,
  placeholder = "Write a comment… type @ to mention. **bold**, *italic*, [link](url) supported.",
  testIdPrefix = "discussion",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  placeholder?: string;
  testIdPrefix?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const { data: users = [] } = useQuery<UserResult[]>({
    queryKey: ["/api/users/search", tenantId, debounced, "discussion"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debounced) params.set("q", debounced);
      const res = await fetch(`/api/users/search?${params}`, {
        credentials: "include",
        headers: tenantId ? { "x-tenant-id": tenantId } : undefined,
      });
      if (!res.ok) throw new Error("Failed to search users");
      return res.json();
    },
    enabled: !!tenantId && pickerOpen,
    staleTime: 30000,
  });

  const mentionCount = useMemo(() => {
    let count = 0;
    let m: RegExpExecArray | null;
    MENTION_RE.lastIndex = 0;
    const seen = new Set<string>();
    while ((m = MENTION_RE.exec(value)) !== null) {
      if (!seen.has(m[2])) { seen.add(m[2]); count++; }
    }
    return count;
  }, [value]);

  const insertMention = (user: UserResult) => {
    const token = `@[${user.name}](${user.id}) `;
    const el = ref.current;
    if (el) {
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const before = value.slice(0, start);
      const after = value.slice(end);
      const lastAt = before.lastIndexOf("@");
      let newValue: string;
      if (lastAt >= 0 && /^@\w*$/.test(before.slice(lastAt))) {
        newValue = before.slice(0, lastAt) + token + after;
      } else {
        newValue = before + token + after;
      }
      onChange(newValue);
      setTimeout(() => {
        el.focus();
        const pos = (lastAt >= 0 && /^@\w*$/.test(before.slice(lastAt))
          ? before.slice(0, lastAt)
          : before).length + token.length;
        try { el.setSelectionRange(pos, pos); } catch {}
      }, 0);
    } else {
      onChange(value + token);
    }
    setPickerOpen(false);
    setSearch("");
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (value.trim()) onSubmit();
    } else if (e.key === "@") {
      setTimeout(() => setPickerOpen(true), 0);
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        className="min-h-[80px] resize-none"
        data-testid={`${testIdPrefix}-textarea`}
      />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              data-testid={`${testIdPrefix}-mention-trigger`}
            >
              <AtSign className="h-3 w-3 mr-1" />
              Mention
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2 z-[100]" align="start">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teammates…"
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm mb-2"
              data-testid={`${testIdPrefix}-mention-search`}
            />
            <div className="max-h-56 overflow-y-auto">
              {users.length === 0 ? (
                <div className="text-xs text-muted-foreground py-3 text-center">
                  No users found
                </div>
              ) : (
                users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => insertMention(u)}
                    className="w-full flex items-center gap-2 p-2 rounded-md hover-elevate text-left"
                    data-testid={`${testIdPrefix}-mention-option-${u.id}`}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px]">
                        {getInitials(u.name || u.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm truncate">{u.name || u.email}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2">
          {mentionCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {mentionCount} mentioned
            </span>
          )}
          <Button
            size="sm"
            onClick={() => onSubmit()}
            disabled={!value.trim() || submitting}
            data-testid={`${testIdPrefix}-submit`}
          >
            <Send className="h-3 w-3 mr-1" />
            {submitting ? "Posting…" : "Post"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommentBody({ body }: { body: string }) {
  return (
    <div className="text-sm prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_a]:underline">
      <ReactMarkdown
        allowedElements={["p", "strong", "em", "a", "code", "ul", "ol", "li", "br"]}
        unwrapDisallowed
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer nofollow" />
          ),
        }}
      >
        {bodyToMarkdown(body)}
      </ReactMarkdown>
    </div>
  );
}

interface CommentItemProps {
  comment: Comment;
  replies: Comment[];
  currentUserId: string | undefined;
  isAdmin: boolean;
  onReply: (parentId: string) => void;
  onEdit: (c: Comment) => void;
  onDelete: (c: Comment) => void;
  editingId: string | null;
  editBody: string;
  setEditBody: (v: string) => void;
  onSubmitEdit: () => void;
  onCancelEdit: () => void;
  isUpdating: boolean;
  highlightId: string | null;
  replyingTo: string | null;
  replyBody: string;
  setReplyBody: (v: string) => void;
  onSubmitReply: () => void;
  onCancelReply: () => void;
  isReplying: boolean;
  depth?: number;
}

function CommentItem(props: CommentItemProps) {
  const {
    comment: c, replies, currentUserId, isAdmin, onReply, onEdit, onDelete,
    editingId, editBody, setEditBody, onSubmitEdit, onCancelEdit, isUpdating,
    highlightId, replyingTo, replyBody, setReplyBody, onSubmitReply, onCancelReply,
    isReplying, depth = 0,
  } = props;
  const isAuthor = currentUserId === c.authorUserId;
  const ageMs = Date.now() - new Date(c.createdAt).getTime();
  const canEdit = isAuthor && !c.deletedAt && ageMs < EDIT_WINDOW_MS;
  const canDelete = !c.deletedAt && (isAuthor || isAdmin);
  const isEditing = editingId === c.id;
  const authorName = c.author?.name || c.author?.email || "Unknown";
  const isHighlighted = highlightId === c.id;

  return (
    <div
      id={`comment-${c.id}`}
      className={`rounded-md border p-3 transition-shadow ${isHighlighted ? "ring-2 ring-primary" : ""}`}
      data-testid={`comment-${c.id}`}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-7 w-7 flex-shrink-0">
          <AvatarFallback className="text-xs">
            {getInitials(authorName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="font-medium" data-testid={`comment-author-${c.id}`}>
              {authorName}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(c.createdAt), "MMM d, yyyy h:mm a")}
            </span>
            {c.editedAt && (
              <span className="text-xs text-muted-foreground">(edited)</span>
            )}
            {c.deletedAt && (
              <Badge variant="secondary" className="text-[10px]">deleted</Badge>
            )}
            <div className="ml-auto flex items-center gap-1">
              {!c.deletedAt && depth < 2 && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => onReply(c.id)}
                  data-testid={`button-reply-comment-${c.id}`}
                  title="Reply"
                >
                  <Reply className="h-3 w-3" />
                </Button>
              )}
              {canEdit && !isEditing && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => onEdit(c)}
                  data-testid={`button-edit-comment-${c.id}`}
                  title="Edit (within 15 min)"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
              {canDelete && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => onDelete(c)}
                  data-testid={`button-delete-comment-${c.id}`}
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="mt-2">
              <MentionComposer
                value={editBody}
                onChange={setEditBody}
                onSubmit={onSubmitEdit}
                submitting={isUpdating}
                testIdPrefix={`discussion-edit-${c.id}`}
                placeholder="Edit comment…"
              />
              <Button
                size="sm"
                variant="ghost"
                className="mt-1"
                onClick={onCancelEdit}
                data-testid={`button-cancel-edit-${c.id}`}
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          ) : (
            <div className="mt-1" data-testid={`comment-body-${c.id}`}>
              {c.deletedAt
                ? <em className="text-muted-foreground text-sm">(comment deleted)</em>
                : <CommentBody body={c.body} />}
            </div>
          )}

          {replyingTo === c.id && (
            <div className="mt-3 border-l-2 pl-3">
              <MentionComposer
                value={replyBody}
                onChange={setReplyBody}
                onSubmit={onSubmitReply}
                submitting={isReplying}
                testIdPrefix={`discussion-reply-${c.id}`}
                placeholder="Write a reply…"
              />
              <Button
                size="sm"
                variant="ghost"
                className="mt-1"
                onClick={onCancelReply}
                data-testid={`button-cancel-reply-${c.id}`}
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          )}

          {replies.length > 0 && (
            <div className="mt-3 pl-4 border-l-2 space-y-3">
              {replies.map(r => (
                <CommentItem
                  key={r.id}
                  {...props}
                  comment={r}
                  replies={[]}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DiscussionPanel({
  entityType,
  entityId,
  className,
}: DiscussionPanelProps) {
  const { toast } = useToast();
  const permissions = usePermissions();
  const user = permissions.user;
  const role = user?.role;
  const isAdmin = role === "tenant_admin" || role === "admin" || role === "global_admin" || role === "vega_admin";

  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  // Deep link via ?focusComment=
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const focus = url.searchParams.get("focusComment");
    const fEntityId = url.searchParams.get("entityId");
    const fEntityType = url.searchParams.get("entityType");
    if (focus && (!fEntityId || fEntityId === entityId) && (!fEntityType || fEntityType === entityType)) {
      setHighlightId(focus);
    }
  }, [entityId, entityType]);

  const queryKey = ["/api/comments", entityType, entityId];

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(
        `/api/comments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load comments");
      return res.json();
    },
    enabled: !!entityId,
  });

  // Group into threads.
  const { topLevel, repliesByParent } = useMemo(() => {
    const top: Comment[] = [];
    const map = new Map<string, Comment[]>();
    for (const c of comments) {
      if (c.parentCommentId) {
        const arr = map.get(c.parentCommentId) || [];
        arr.push(c);
        map.set(c.parentCommentId, arr);
      } else {
        top.push(c);
      }
    }
    return { topLevel: top, repliesByParent: map };
  }, [comments]);

  // Scroll to highlighted comment.
  useEffect(() => {
    if (!highlightId || comments.length === 0) return;
    const el = document.getElementById(`comment-${highlightId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const t = setTimeout(() => setHighlightId(null), 2500);
      return () => clearTimeout(t);
    }
  }, [highlightId, comments]);

  const createMut = useMutation({
    mutationFn: async (input: { body: string; parentCommentId?: string | null }) => {
      const res = await apiRequest("POST", "/api/comments", {
        entityType,
        entityId,
        body: input.body,
        parentCommentId: input.parentCommentId ?? null,
      });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      if (vars.parentCommentId) {
        setReplyBody("");
        setReplyingTo(null);
      } else {
        setBody("");
      }
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/comments/counts"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to post", description: err?.message || "Try again", variant: "destructive" });
    },
  });

  const updateMut = useMutation({
    mutationFn: async (input: { id: string; body: string }) => {
      const res = await apiRequest("PATCH", `/api/comments/${input.id}`, {
        body: input.body,
      });
      return res.json();
    },
    onSuccess: () => {
      setEditingId(null);
      setEditBody("");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err?.message || "Try again", variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/comments/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/comments/counts"] });
    },
  });

  const handleDelete = (c: Comment) => {
    if (confirm("Delete this comment?")) deleteMut.mutate(c.id);
  };

  return (
    <div className={`space-y-4 ${className || ""}`} data-testid="discussion-panel">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageSquare className="h-4 w-4" />
        <span>Discussion</span>
        <span className="text-xs text-muted-foreground">
          ({comments.filter(c => !c.deletedAt).length})
        </span>
      </div>

      <MentionComposer
        value={body}
        onChange={setBody}
        onSubmit={() => {
          if (!body.trim()) return;
          createMut.mutate({ body: body.trim(), parentCommentId: null });
        }}
        submitting={createMut.isPending}
        testIdPrefix="discussion-new"
      />

      <div className="space-y-3">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : topLevel.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No comments yet. Start the conversation.
          </div>
        ) : (
          topLevel.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              replies={repliesByParent.get(c.id) || []}
              currentUserId={user?.id}
              isAdmin={isAdmin}
              onReply={(parentId) => { setReplyingTo(parentId); setReplyBody(""); }}
              onEdit={(cm) => { setEditingId(cm.id); setEditBody(cm.body); }}
              onDelete={handleDelete}
              editingId={editingId}
              editBody={editBody}
              setEditBody={setEditBody}
              onSubmitEdit={() => {
                if (!editingId || !editBody.trim()) return;
                updateMut.mutate({ id: editingId, body: editBody.trim() });
              }}
              onCancelEdit={() => { setEditingId(null); setEditBody(""); }}
              isUpdating={updateMut.isPending}
              highlightId={highlightId}
              replyingTo={replyingTo}
              replyBody={replyBody}
              setReplyBody={setReplyBody}
              onSubmitReply={() => {
                if (!replyingTo || !replyBody.trim()) return;
                createMut.mutate({ body: replyBody.trim(), parentCommentId: replyingTo });
              }}
              onCancelReply={() => { setReplyingTo(null); setReplyBody(""); }}
              isReplying={createMut.isPending}
            />
          ))
        )}
      </div>
    </div>
  );
}
