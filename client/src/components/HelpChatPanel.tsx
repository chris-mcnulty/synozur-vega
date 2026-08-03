import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, HelpCircle, Loader2, AlertCircle, RefreshCw, LifeBuoy, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useDialogPanel } from "@/hooks/use-dialog-panel";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  error?: boolean;
  showEscalation?: boolean;
};

type HelpChatPanelProps = {
  onClose: () => void;
  onOpenTicket?: (summary?: string) => void;
};

const WELCOME_MESSAGE = "Hi! I'm the Vega Help Assistant. I can help you with:\n\n- How to use platform features\n- Navigating the Company OS\n- Troubleshooting common issues\n- Understanding OKRs and strategy tools\n\nWhat would you like to know?";

function shouldShowEscalation(content: string, messageCount: number): boolean {
  const lowerContent = content.toLowerCase();
  if (
    lowerContent.includes("support ticket") ||
    lowerContent.includes("contact support") ||
    lowerContent.includes("open a ticket") ||
    lowerContent.includes("reach out to") ||
    lowerContent.includes("submit a ticket") ||
    lowerContent.includes("escalate")
  ) {
    return true;
  }
  if (messageCount >= 6) {
    return true;
  }
  if (
    lowerContent.includes("i'm not sure") ||
    lowerContent.includes("i don't know") ||
    lowerContent.includes("unable to") ||
    lowerContent.includes("can't help with that") ||
    lowerContent.includes("beyond my")
  ) {
    return true;
  }
  return false;
}

function getConversationSummary(messages: Message[]): string {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content);
  if (userMessages.length === 0) return "";
  return userMessages.slice(-3).join(" | ");
}

export function HelpChatPanel({ onClose, onOpenTicket }: HelpChatPanelProps) {
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useDialogPanel<HTMLDivElement>(onClose);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: WELCOME_MESSAGE,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const assistantMessageId = `assistant-${Date.now()}`;

    try {
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          isStreaming: true,
        },
      ]);

      const conversationHistory = messages
        .filter((m) => m.id !== "welcome" && !m.error)
        .concat(userMessage)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const response = await fetch("/api/support/help/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: conversationHistory,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response stream available");
      }

      const decoder = new TextDecoder();
      let accumulatedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                accumulatedContent += data.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: accumulatedContent }
                      : m
                  )
                );
              }
              if (data.done) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, isStreaming: false }
                      : m
                  )
                );
              }
            } catch {
            }
          }
        }
      }

      setMessages((prev) => {
        const totalMessages = prev.filter((m) => m.id !== "welcome").length;
        return prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                isStreaming: false,
                showEscalation: shouldShowEscalation(m.content, totalMessages),
              }
            : m
        );
      });
    } catch (error: any) {
      console.error("Help Chat error:", error);
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== assistantMessageId);
        return [
          ...filtered,
          {
            id: assistantMessageId,
            role: "assistant",
            content: error.message || "Sorry, I encountered an error. Please try again.",
            error: true,
          },
        ];
      });
    } finally {
      setIsLoading(false);
    }
  }

  function retryLastMessage() {
    const lastUserMessageIndex = messages.findLastIndex((m) => m.role === "user");
    if (lastUserMessageIndex === -1) return;

    const messagesToKeep = messages.slice(0, lastUserMessageIndex);
    const lastUserMessage = messages[lastUserMessageIndex];

    setMessages(messagesToKeep);
    setInput(lastUserMessage.content);
  }

  function clearChat() {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: WELCOME_MESSAGE,
      },
    ]);
  }

  function handleOpenTicket() {
    const summary = getConversationSummary(messages);
    onOpenTicket?.(summary || undefined);
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="Help assistant"
      tabIndex={-1}
      className="fixed right-0 top-0 h-full z-50 w-[400px] flex flex-col bg-background border-l"
      data-testid="help-chat-panel"
    >
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center">
            <HelpCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Help Assistant</h3>
            <p className="text-xs text-muted-foreground">Platform support</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={clearChat}
            title="Clear chat"
            aria-label="Clear chat"
            data-testid="button-clear-help-chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close help assistant"
            data-testid="button-close-help-chat"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === "user" ? "flex-row-reverse" : ""
              }`}
              data-testid={`help-message-${message.role}`}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback
                  className={
                    message.role === "assistant"
                      ? "bg-primary text-primary-foreground"
                      : ""
                  }
                >
                  {message.role === "assistant" ? (
                    <HelpCircle className="h-4 w-4" />
                  ) : (
                    user?.name?.charAt(0) || "U"
                  )}
                </AvatarFallback>
              </Avatar>
              <div
                className={`rounded-md p-3 max-w-[280px] ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : message.error
                    ? "bg-destructive/10 border border-destructive/20"
                    : "bg-muted"
                }`}
              >
                {message.error && (
                  <div className="flex items-center gap-1 text-destructive mb-2">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-xs font-medium">Error</span>
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap">
                  {message.content}
                  {message.isStreaming && (
                    <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-1" />
                  )}
                </div>
                {message.error && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={retryLastMessage}
                    data-testid="button-retry-help-message"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                )}
                {message.showEscalation && !message.isStreaming && onOpenTicket && (
                  <div className="mt-3 pt-2 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={handleOpenTicket}
                      data-testid="button-open-support-ticket"
                    >
                      <LifeBuoy className="h-3 w-3" />
                      Need more help? Open a Support Ticket
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && !messages.some((m) => m.isStreaming) && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <HelpCircle className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="rounded-md p-3 bg-muted">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    Thinking...
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            placeholder="Ask a question about the platform..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            className="resize-none"
            rows={2}
            disabled={isLoading}
            data-testid="input-help-chat-message"
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            data-testid="button-send-help-message"
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
