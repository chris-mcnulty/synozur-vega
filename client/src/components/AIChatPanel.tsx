import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, Sparkles, Loader2, AlertCircle, RefreshCw, Target, CheckCircle2, Rocket, Calendar, BarChart3, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

type QuickAction = {
  id: string;
  label: string;
  icon: typeof Target;
  action: () => void;
  variant?: "default" | "outline" | "ghost";
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  error?: boolean;
  quickActions?: QuickAction[];
};

type AIChatPanelProps = {
  onClose: () => void;
};

// Detect quick actions based on AI response content
function detectQuickActions(content: string, navigate: (path: string) => void): QuickAction[] {
  const actions: QuickAction[] = [];
  const lowerContent = content.toLowerCase();
  
  // Detect objective/OKR related content
  if (lowerContent.includes("objective") || lowerContent.includes("okr") || lowerContent.includes("key result")) {
    actions.push({
      id: "view-planning",
      label: "View Planning",
      icon: Target,
      action: () => navigate("/planning"),
      variant: "outline",
    });
  }
  
  // Detect at-risk or status-related content
  if (lowerContent.includes("at risk") || lowerContent.includes("behind") || lowerContent.includes("off track") || lowerContent.includes("needs attention")) {
    actions.push({
      id: "check-status",
      label: "Review At-Risk Items",
      icon: AlertCircle,
      action: () => navigate("/planning"),
      variant: "outline",
    });
  }
  
  // Detect Big Rock / initiative content
  if (lowerContent.includes("big rock") || lowerContent.includes("initiative") || lowerContent.includes("project")) {
    actions.push({
      id: "view-initiatives",
      label: "View Big Rocks",
      icon: Rocket,
      action: () => navigate("/planning"),
      variant: "outline",
    });
  }
  
  // Detect meeting-related content
  if (lowerContent.includes("meeting") || lowerContent.includes("agenda") || lowerContent.includes("standup") || lowerContent.includes("review")) {
    actions.push({
      id: "view-meetings",
      label: "View Meetings",
      icon: Calendar,
      action: () => navigate("/focus-rhythm"),
      variant: "outline",
    });
  }
  
  // Detect strategy-related content
  if (lowerContent.includes("strateg") || lowerContent.includes("goal") || lowerContent.includes("mission") || lowerContent.includes("vision")) {
    actions.push({
      id: "view-strategy",
      label: "View Strategy",
      icon: BarChart3,
      action: () => navigate("/strategy"),
      variant: "outline",
    });
  }
  
  // Detect dashboard/overview content
  if (lowerContent.includes("overview") || lowerContent.includes("summary") || lowerContent.includes("dashboard") || lowerContent.includes("progress")) {
    actions.push({
      id: "view-dashboard",
      label: "View Dashboard",
      icon: BarChart3,
      action: () => navigate("/dashboard"),
      variant: "outline",
    });
  }
  
  // Limit to top 3 most relevant actions
  return actions.slice(0, 3);
}

export function AIChatPanel({ onClose }: AIChatPanelProps) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm Vega AI, your strategy assistant. I can help you with:\n\n• Creating and refining OKRs\n• Strategy development guidance\n• Company OS best practices\n• Big Rock suggestions\n\nHow can I assist you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [useStreaming, setUseStreaming] = useState(true);

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
      if (useStreaming) {
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

        const response = await fetch("/api/ai/chat/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: conversationHistory,
            tenantId: currentTenant?.id,
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

        // Add quick actions when streaming completes
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId 
              ? { 
                  ...m, 
                  isStreaming: false,
                  quickActions: detectQuickActions(m.content, setLocation)
                } 
              : m
          )
        );
      } else {
        const conversationHistory = messages
          .filter((m) => m.id !== "welcome" && !m.error)
          .concat(userMessage)
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

        const response = await apiRequest(
          "POST",
          "/api/ai/chat",
          {
            messages: conversationHistory,
            tenantId: currentTenant?.id,
          }
        );
        
        const result = await response.json();

        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: "assistant",
            content: result.response,
            quickActions: detectQuickActions(result.response, setLocation),
          },
        ]);
      }
    } catch (error: any) {
      console.error("AI Chat error:", error);
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
        content: "Hello! I'm Vega AI, your strategy assistant. How can I help you today?",
      },
    ]);
  }

  return (
    <div className="w-[400px] h-full flex flex-col bg-card border-l">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Vega AI</h3>
            {currentTenant && (
              <p className="text-xs text-muted-foreground">{currentTenant.name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={clearChat}
            title="Clear chat"
            data-testid="button-clear-chat"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-chat"
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
              data-testid={`message-${message.role}`}
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
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    user?.name?.charAt(0) || "U"
                  )}
                </AvatarFallback>
              </Avatar>
              <div
                className={`rounded-lg p-3 max-w-[280px] ${
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
                    className="mt-2 h-7 text-xs"
                    onClick={retryLastMessage}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                )}
                {/* Quick action buttons */}
                {message.quickActions && message.quickActions.length > 0 && !message.isStreaming && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-border/50">
                    {message.quickActions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <Button
                          key={action.id}
                          variant={action.variant || "outline"}
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={action.action}
                          data-testid={`quick-action-${action.id}`}
                        >
                          <Icon className="h-3 w-3" />
                          {action.label}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && !messages.some((m) => m.isStreaming) && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="rounded-lg p-3 bg-muted">
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
            placeholder="Ask me anything about OKRs, strategy, or planning..."
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
            data-testid="input-chat-message"
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            data-testid="button-send-message"
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
