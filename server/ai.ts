import OpenAI from "openai";
import { storage } from "./storage";
import type { GroundingDocument, Foundation, Strategy, Objective, InsertAiUsageLog } from "@shared/schema";
import { AI_PROVIDERS, AI_FEATURES, type AIFeature } from "@shared/schema";
import { AI_TOOLS, executeTool, formatToolResult } from "./ai-tools";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const MODEL = "gpt-5";
const CURRENT_PROVIDER = AI_PROVIDERS.REPLIT;

// Cost per 1K tokens in microdollars (1 cent = 10000 microdollars)
// Pricing estimates based on public pricing as of late 2025
const COST_PER_1K_TOKENS: Record<string, { prompt: number; completion: number }> = {
  'gpt-5': { prompt: 50000, completion: 150000 },      // ~$5/$15 per 1M tokens
  'gpt-4o': { prompt: 25000, completion: 100000 },     // ~$2.50/$10 per 1M tokens
  'gpt-4o-mini': { prompt: 1500, completion: 6000 },   // ~$0.15/$0.60 per 1M tokens
  'gpt-4-turbo': { prompt: 10000, completion: 30000 }, // ~$1/$3 per 1M tokens
  'gpt-4': { prompt: 30000, completion: 60000 },       // ~$3/$6 per 1M tokens
  'claude-3-opus': { prompt: 15000, completion: 75000 },     // ~$15/$75 per 1M tokens
  'claude-3.5-opus': { prompt: 15000, completion: 75000 },   // ~$15/$75 per 1M tokens (same as opus)
  'claude-3-sonnet': { prompt: 3000, completion: 15000 },    // ~$3/$15 per 1M tokens
  'claude-3.5-sonnet': { prompt: 3000, completion: 15000 },  // ~$3/$15 per 1M tokens
  'claude-3-haiku': { prompt: 250, completion: 1250 },       // ~$0.25/$1.25 per 1M tokens
  'claude-3.5-haiku': { prompt: 250, completion: 1250 },     // ~$0.25/$1.25 per 1M tokens
  'replit-ai-unknown': { prompt: 10000, completion: 30000 },
  'default': { prompt: 10000, completion: 30000 }
};

// Helper to log AI usage after each API call
async function logAiUsage(params: {
  tenantId?: string;
  userId?: string;
  feature: AIFeature;
  promptTokens: number;
  completionTokens: number;
  latencyMs?: number;
  wasStreaming?: boolean;
  requestId?: string;
  errorCode?: string;
  errorMessage?: string;
  // Allow overriding model/provider for future multi-provider support
  model?: string;
  provider?: string;
}): Promise<void> {
  try {
    const actualModel = params.model || MODEL;
    const actualProvider = params.provider || CURRENT_PROVIDER;
    
    const totalTokens = params.promptTokens + params.completionTokens;
    const costs = COST_PER_1K_TOKENS[actualModel] || COST_PER_1K_TOKENS.default;
    const estimatedCost = Math.round(
      (params.promptTokens / 1000) * costs.prompt +
      (params.completionTokens / 1000) * costs.completion
    );

    const log: InsertAiUsageLog = {
      tenantId: params.tenantId || null,
      userId: params.userId || null,
      provider: actualProvider,
      model: actualModel,
      feature: params.feature,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens,
      estimatedCostMicrodollars: estimatedCost,
      latencyMs: params.latencyMs,
      wasStreaming: params.wasStreaming || false,
      requestId: params.requestId,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
    };

    await storage.createAiUsageLog(log);
  } catch (error) {
    // Don't let logging failures affect the main AI functionality
    console.error("[AI Usage Logging] Failed to log usage:", error);
  }
}

// Initialize OpenAI client using Replit AI Integrations
// This uses Replit's AI Integrations service, which provides OpenAI-compatible API access
// without requiring your own OpenAI API key. Charges are billed to your credits.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

// Category labels for grounding document context
const CATEGORY_LABELS: Record<string, string> = {
  company_os: "Company Operating System Overview",
  methodology: "Methodology & Framework",
  best_practices: "Best Practices",
  terminology: "Key Terminology",
  examples: "Examples & Templates",
};

// Build system prompt with grounding documents
async function buildSystemPrompt(tenantId?: string): Promise<string> {
  // Get active grounding documents - both global and tenant-specific if tenantId provided
  const groundingDocs = tenantId 
    ? await storage.getActiveGroundingDocumentsForTenant(tenantId)
    : await storage.getActiveGroundingDocuments();
  
  // Build grounding context by category
  const groundingContext = groundingDocs
    .map((doc) => {
      const categoryLabel = CATEGORY_LABELS[doc.category] || doc.category;
      return `### ${categoryLabel}: ${doc.title}\n${doc.content}`;
    })
    .join("\n\n");

  // Get tenant-specific context if available
  let tenantContext = "";
  if (tenantId) {
    try {
      const foundation = await storage.getFoundationByTenantId(tenantId);
      if (foundation) {
        const contextParts: string[] = [];
        if (foundation.mission) contextParts.push(`**Mission:** ${foundation.mission}`);
        if (foundation.vision) contextParts.push(`**Vision:** ${foundation.vision}`);
        if (foundation.cultureStatement) contextParts.push(`**Culture:** ${foundation.cultureStatement}`);
        if (foundation.values && Array.isArray(foundation.values) && foundation.values.length > 0) {
          const valuesText = foundation.values
            .map((v: any) => `- ${v.title}: ${v.description || ""}`)
            .join("\n");
          contextParts.push(`**Company Values:**\n${valuesText}`);
        }
        if (contextParts.length > 0) {
          tenantContext = `\n\n## Current Organization Context\n${contextParts.join("\n\n")}`;
        }
      }
    } catch (error) {
      console.error("Error fetching tenant context for AI:", error);
    }
  }

  // Compose the complete system prompt
  const systemPrompt = `You are Vega AI, an intelligent assistant for the Vega Company Operating System platform. You help organizations align strategy with execution through OKRs (Objectives and Key Results), strategic planning, and focus rhythm management.

## Your Core Responsibilities
1. **Strategic Guidance**: Help users create, refine, and align objectives with company strategy
2. **OKR Expertise**: Provide best practices for writing effective OKRs, key results, and initiatives (Big Rocks)
3. **Company OS Navigation**: Guide users through the platform's features and workflows
4. **Culture-Grounded Responses**: Ensure all suggestions align with the organization's mission, vision, and values

## Grounding Knowledge Base
${groundingContext || "No grounding documents have been configured yet."}
${tenantContext}

## Response Guidelines
- Be concise and actionable
- Reference the Company OS methodology when relevant
- When suggesting OKRs or strategies, ensure they follow best practices
- If asked about features not yet available, acknowledge the limitation and suggest alternatives
- Maintain a professional, supportive tone
- Use bullet points and structured formatting for clarity
- When appropriate, ask clarifying questions to provide better guidance`;

  return systemPrompt;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatCompletionOptions {
  tenantId?: string;
  maxTokens?: number;
  temperature?: number;
}

// Main chat completion function
export async function getChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
  feature: AIFeature = AI_FEATURES.CHAT
): Promise<string> {
  const { tenantId, maxTokens = 4096 } = options;
  const startTime = Date.now();

  // Build system prompt with grounding documents
  const systemPrompt = await buildSystemPrompt(tenantId);

  // Prepare messages with system prompt
  const fullMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
  ];

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: fullMessages,
      max_completion_tokens: maxTokens,
    });

    const latencyMs = Date.now() - startTime;
    
    // Log AI usage
    await logAiUsage({
      tenantId,
      feature,
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      latencyMs,
      wasStreaming: false,
      requestId: response.id,
    });

    return response.choices[0]?.message?.content || "I apologize, but I was unable to generate a response. Please try again.";
  } catch (error: any) {
    console.error("OpenAI API Error:", error);
    
    // Log error
    await logAiUsage({
      tenantId,
      feature,
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: Date.now() - startTime,
      wasStreaming: false,
      errorCode: error?.code || 'unknown',
      errorMessage: error?.message,
    });
    
    // Handle rate limiting
    if (error?.message?.includes("429") || error?.message?.includes("RATELIMIT")) {
      throw new Error("The AI service is currently busy. Please try again in a moment.");
    }
    
    throw new Error("Failed to get AI response. Please try again.");
  }
}

// Streaming chat completion for better UX
export async function* streamChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
  feature: AIFeature = AI_FEATURES.CHAT
): AsyncGenerator<string, void, unknown> {
  const { tenantId, maxTokens = 4096 } = options;
  const startTime = Date.now();
  console.log("[AI Service] streamChatCompletion called, tenantId:", tenantId);

  // Build system prompt with grounding documents
  const systemPrompt = await buildSystemPrompt(tenantId);
  console.log("[AI Service] System prompt length:", systemPrompt.length);

  // Prepare messages with system prompt
  const fullMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
  ];
  console.log("[AI Service] Full messages count:", fullMessages.length);

  // Estimate prompt tokens (rough: ~4 chars per token)
  const estimatedPromptTokens = Math.ceil(
    fullMessages.reduce((acc, m) => acc + (typeof m.content === 'string' ? m.content.length : 0), 0) / 4
  );

  try {
    console.log("[AI Service] Calling OpenAI API with model:", MODEL);
    console.log("[AI Service] Base URL:", process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? "configured" : "NOT SET");
    console.log("[AI Service] API Key:", process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? "configured" : "NOT SET");
    
    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages: fullMessages,
      max_completion_tokens: maxTokens,
      stream: true,
    });
    console.log("[AI Service] Stream created successfully");

    let chunkCount = 0;
    let totalContent = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        chunkCount++;
        totalContent += content;
        yield content;
      }
    }
    console.log("[AI Service] Stream completed, total chunks:", chunkCount);

    // Estimate completion tokens
    const estimatedCompletionTokens = Math.ceil(totalContent.length / 4);
    
    // Log AI usage after streaming completes
    await logAiUsage({
      tenantId,
      feature,
      promptTokens: estimatedPromptTokens,
      completionTokens: estimatedCompletionTokens,
      latencyMs: Date.now() - startTime,
      wasStreaming: true,
    });
  } catch (error: any) {
    console.error("[AI Service] OpenAI Streaming Error:", error.message || error);
    console.error("[AI Service] Full error:", JSON.stringify(error, null, 2));
    
    // Log error
    await logAiUsage({
      tenantId,
      feature,
      promptTokens: estimatedPromptTokens,
      completionTokens: 0,
      latencyMs: Date.now() - startTime,
      wasStreaming: true,
      errorCode: error?.code || 'unknown',
      errorMessage: error?.message,
    });
    
    if (error?.message?.includes("429") || error?.message?.includes("RATELIMIT")) {
      throw new Error("The AI service is currently busy. Please try again in a moment.");
    }
    
    throw new Error(`Failed to stream AI response: ${error.message || 'Unknown error'}`);
  }
}

// Extended chat completion options with tool support
export interface ChatCompletionWithToolsOptions extends ChatCompletionOptions {
  enableTools?: boolean;
  userRole?: string;
}

// Streaming chat completion with function calling support
export async function* streamChatWithTools(
  messages: ChatMessage[],
  options: ChatCompletionWithToolsOptions = {}
): AsyncGenerator<string, void, unknown> {
  const { tenantId, maxTokens = 4096, enableTools = true, userRole } = options;
  const startTime = Date.now();
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  console.log("[AI Service] streamChatWithTools called, tenantId:", tenantId, "enableTools:", enableTools);

  // Build system prompt with grounding documents and user role
  let systemPrompt = await buildSystemPrompt(tenantId);
  
  // Add role context if available
  if (userRole) {
    systemPrompt += `\n\n## User Context\nThe current user has the role: ${userRole}. Tailor your responses appropriately for their access level and responsibilities.`;
  }
  
  // Add tool usage instructions
  if (enableTools) {
    systemPrompt += `\n\n## Data Query Capabilities
You have access to tools that can query live organizational data. When users ask questions about objectives, key results, Big Rocks, meetings, or want statistics, USE THE APPROPRIATE TOOL to get real data rather than making assumptions.

Available tools:
- listObjectives: Query objectives with filters (quarter, year, level, status)
- listKeyResults: Query key results with filters
- listBigRocks: Query Big Rocks/initiatives with filters
- listMeetings: Query meetings with filters
- getAtRiskItems: Find items that are at risk, behind, or need attention
- getStats: Get summary statistics for the organization

When presenting tool results, synthesize the data into a clear, readable response. Don't just dump raw data - explain what it means and highlight important insights.`;
  }

  // Prepare messages with system prompt
  const fullMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
  ];

  // Estimate prompt tokens
  const estimatedPromptTokens = Math.ceil(
    fullMessages.reduce((acc, m) => acc + (typeof m.content === 'string' ? m.content.length : 0), 0) / 4
  );

  try {
    if (!enableTools || !tenantId) {
      // Fall back to regular streaming without tools
      const stream = await openai.chat.completions.create({
        model: MODEL,
        messages: fullMessages,
        max_completion_tokens: maxTokens,
        stream: true,
      });

      let totalContent = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          totalContent += content;
          yield content;
        }
      }
      
      // Log usage
      await logAiUsage({
        tenantId,
        feature: AI_FEATURES.CHAT,
        promptTokens: estimatedPromptTokens,
        completionTokens: Math.ceil(totalContent.length / 4),
        latencyMs: Date.now() - startTime,
        wasStreaming: true,
      });
      return;
    }

    // First call with tools - non-streaming to handle tool calls
    console.log("[AI Service] Making initial call with tools");
    const initialResponse = await openai.chat.completions.create({
      model: MODEL,
      messages: fullMessages,
      max_completion_tokens: maxTokens,
      tools: AI_TOOLS,
      tool_choice: "auto",
    });

    // Track usage from initial call
    totalPromptTokens += initialResponse.usage?.prompt_tokens || estimatedPromptTokens;
    totalCompletionTokens += initialResponse.usage?.completion_tokens || 0;

    const choice = initialResponse.choices[0];
    
    // Check if the model wants to call tools
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      console.log("[AI Service] Tool calls detected:", choice.message.tool_calls.length);
      
      // Execute all tool calls
      const toolResults: OpenAI.ChatCompletionMessageParam[] = [
        { role: "assistant", content: choice.message.content, tool_calls: choice.message.tool_calls },
      ];

      for (const toolCall of choice.message.tool_calls) {
        // Handle both function tool calls and other types
        const funcCall = (toolCall as any).function;
        if (!funcCall) {
          console.warn("[AI Service] Skipping non-function tool call");
          continue;
        }
        
        try {
          console.log(`[AI Service] Executing tool: ${funcCall.name}`);
          const args = JSON.parse(funcCall.arguments || "{}");
          const result = await executeTool(funcCall.name, args, tenantId);
          const formattedResult = formatToolResult(funcCall.name, result);
          
          toolResults.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: formattedResult,
          });
          console.log(`[AI Service] Tool ${funcCall.name} executed successfully`);
        } catch (error: any) {
          console.error(`[AI Service] Tool ${funcCall.name} failed:`, error.message);
          toolResults.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: `Error executing tool: ${error.message}`,
          });
        }
      }

      // Now stream the final response with tool results
      console.log("[AI Service] Streaming final response with tool results");
      const finalStream = await openai.chat.completions.create({
        model: MODEL,
        messages: [...fullMessages, ...toolResults],
        max_completion_tokens: maxTokens,
        stream: true,
      });

      let totalContent = "";
      for await (const chunk of finalStream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          totalContent += content;
          yield content;
        }
      }
      
      totalCompletionTokens += Math.ceil(totalContent.length / 4);
      
      // Log usage for function calling flow
      await logAiUsage({
        tenantId,
        feature: AI_FEATURES.FUNCTION_CALL,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        latencyMs: Date.now() - startTime,
        wasStreaming: true,
      });
    } else {
      // No tool calls - just yield the content directly
      console.log("[AI Service] No tool calls, yielding direct response");
      if (choice.message.content) {
        yield choice.message.content;
        totalCompletionTokens = Math.ceil(choice.message.content.length / 4);
      }
      
      // Log usage
      await logAiUsage({
        tenantId,
        feature: AI_FEATURES.CHAT,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        latencyMs: Date.now() - startTime,
        wasStreaming: false,
      });
    }
  } catch (error: any) {
    console.error("[AI Service] Error in streamChatWithTools:", error.message || error);
    
    // Log error
    await logAiUsage({
      tenantId,
      feature: AI_FEATURES.CHAT,
      promptTokens: estimatedPromptTokens,
      completionTokens: 0,
      latencyMs: Date.now() - startTime,
      wasStreaming: false,
      errorCode: error?.code || 'unknown',
      errorMessage: error?.message,
    });
    
    if (error?.message?.includes("429") || error?.message?.includes("RATELIMIT")) {
      throw new Error("The AI service is currently busy. Please try again in a moment.");
    }
    
    throw new Error(`Failed to get AI response: ${error.message || 'Unknown error'}`);
  }
}

// Helper function to generate OKR suggestions based on context
export async function generateOKRSuggestions(
  context: {
    tenantId: string;
    strategies?: Strategy[];
    existingObjectives?: Objective[];
    focusArea?: string;
    quarter?: number;
    year?: number;
  }
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `Based on our company context and the following information, suggest 3 well-crafted OKRs for ${context.focusArea || "our organization"}:

${context.strategies?.length ? `**Strategies:**\n${context.strategies.map(s => `- ${s.title}: ${s.description || ""}`).join("\n")}` : ""}

${context.existingObjectives?.length ? `**Existing Objectives (to avoid duplication):**\n${context.existingObjectives.map(o => `- ${o.title}`).join("\n")}` : ""}

Please format each OKR with:
1. A clear, inspirational Objective
2. 3-4 measurable Key Results with specific targets
3. Brief rationale for how this aligns with our strategy`,
    },
  ];

  return getChatCompletion(messages, { tenantId: context.tenantId }, AI_FEATURES.OKR_SUGGESTION);
}

// Helper function to suggest Big Rocks for an objective
export async function suggestBigRocks(
  context: {
    tenantId: string;
    objective: Objective;
    keyResults?: any[];
  }
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `Suggest 3-5 "Big Rocks" (major initiatives or projects) that would help achieve this objective:

**${context.objective.title}**
${context.objective.description ? `${context.objective.description}` : ""}

${context.keyResults?.length ? `**Supporting Key Results:**\n${context.keyResults.map(kr => `- ${kr.title}: Target ${kr.targetValue} ${kr.unit || ""}`).join("\n")}` : ""}

For each Big Rock, provide a JSON-formatted suggestion with these fields (respond ONLY with valid JSON array):
- title: Clear, action-oriented name
- description: 1-2 sentence description of what it involves
- effort: Estimated effort level (small/medium/large)
- supportedKR: Which key result(s) it supports

Return as JSON array only, no markdown formatting or additional text.`,
    },
  ];

  return getChatCompletion(messages, { tenantId: context.tenantId }, AI_FEATURES.BIG_ROCK_SUGGESTION);
}

// Interface for progress summary data
export interface ProgressSummaryData {
  objectives: Array<{
    id: string;
    title: string;
    progress: number;
    status: string;
    keyResults?: Array<{
      id: string;
      title: string;
      currentValue: number;
      targetValue: number;
      unit: string;
      progress: number;
    }>;
  }>;
  checkIns: Array<{
    entityType: string;
    entityId: string;
    entityTitle?: string;
    previousProgress: number;
    newProgress: number;
    note?: string;
    achievements?: string[];
    challenges?: string[];
    nextSteps?: string[];
    createdAt: Date;
  }>;
  quarter: number;
  year: number;
  dateRange?: string;
}

// Generate AI progress summary for objectives and recent check-ins
export async function generateProgressSummary(
  context: {
    tenantId: string;
    data: ProgressSummaryData;
    customPrompt?: string;
  }
): Promise<string> {
  const { data, customPrompt } = context;
  
  // Build objectives summary
  const objectivesSummary = data.objectives.map(obj => {
    const krSummary = obj.keyResults?.map(kr => 
      `    - ${kr.title}: ${kr.currentValue}/${kr.targetValue} ${kr.unit || ''} (${Math.round(kr.progress)}%)`
    ).join('\n') || '    (No key results)';
    
    return `  * **${obj.title}** - ${Math.round(obj.progress)}% complete (${obj.status})\n${krSummary}`;
  }).join('\n\n');

  // Build check-ins summary
  const checkInsSummary = data.checkIns.length > 0 
    ? data.checkIns.map(ci => {
        const progressChange = ci.newProgress - ci.previousProgress;
        const changeText = progressChange >= 0 ? `+${progressChange.toFixed(1)}%` : `${progressChange.toFixed(1)}%`;
        const achievementText = ci.achievements?.length ? `\n      Achievements: ${ci.achievements.join(', ')}` : '';
        const challengeText = ci.challenges?.length ? `\n      Challenges: ${ci.challenges.join(', ')}` : '';
        const nextStepsText = ci.nextSteps?.length ? `\n      Next Steps: ${ci.nextSteps.join(', ')}` : '';
        
        return `  * ${ci.entityTitle || ci.entityType}: ${changeText} progress${ci.note ? ` - "${ci.note}"` : ''}${achievementText}${challengeText}${nextStepsText}`;
      }).join('\n')
    : '  No check-ins recorded for the selected period.';

  const defaultPrompt = `Generate a concise executive summary of OKR progress that can be easily shared (copied/pasted) into email, Slack, or a meeting update. The summary should be professional, highlight key wins and areas needing attention, and be formatted for readability.`;

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `${customPrompt || defaultPrompt}

## Current OKR Status (Q${data.quarter} ${data.year})
${data.dateRange ? `**Period:** ${data.dateRange}\n` : ''}
### Objectives Overview
${objectivesSummary || 'No objectives in the current view.'}

### Recent Check-ins & Updates
${checkInsSummary}

Please provide:
1. **Executive Summary** (2-3 sentences highlighting overall progress)
2. **Key Wins** (bullet points of significant achievements)
3. **Attention Areas** (items that may need focus or support)
4. **Looking Ahead** (brief preview of upcoming priorities)

Format the response so it's ready to copy and paste directly into a communication.`,
    },
  ];

  return getChatCompletion(messages, { tenantId: context.tenantId, maxTokens: 2048 });
}

// Streaming version for better UX
export async function* streamProgressSummary(
  context: {
    tenantId: string;
    data: ProgressSummaryData;
    customPrompt?: string;
  }
): AsyncGenerator<string, void, unknown> {
  const { data, customPrompt } = context;
  
  // Build objectives summary
  const objectivesSummary = data.objectives.map(obj => {
    const krSummary = obj.keyResults?.map(kr => 
      `    - ${kr.title}: ${kr.currentValue}/${kr.targetValue} ${kr.unit || ''} (${Math.round(kr.progress)}%)`
    ).join('\n') || '    (No key results)';
    
    return `  * **${obj.title}** - ${Math.round(obj.progress)}% complete (${obj.status})\n${krSummary}`;
  }).join('\n\n');

  // Build check-ins summary
  const checkInsSummary = data.checkIns.length > 0 
    ? data.checkIns.map(ci => {
        const progressChange = ci.newProgress - ci.previousProgress;
        const changeText = progressChange >= 0 ? `+${progressChange.toFixed(1)}%` : `${progressChange.toFixed(1)}%`;
        const achievementText = ci.achievements?.length ? `\n      Achievements: ${ci.achievements.join(', ')}` : '';
        const challengeText = ci.challenges?.length ? `\n      Challenges: ${ci.challenges.join(', ')}` : '';
        const nextStepsText = ci.nextSteps?.length ? `\n      Next Steps: ${ci.nextSteps.join(', ')}` : '';
        
        return `  * ${ci.entityTitle || ci.entityType}: ${changeText} progress${ci.note ? ` - "${ci.note}"` : ''}${achievementText}${challengeText}${nextStepsText}`;
      }).join('\n')
    : '  No check-ins recorded for the selected period.';

  const defaultPrompt = `Generate a concise executive summary of OKR progress that can be easily shared (copied/pasted) into email, Slack, or a meeting update. The summary should be professional, highlight key wins and areas needing attention, and be formatted for readability.`;

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `${customPrompt || defaultPrompt}

## Current OKR Status (Q${data.quarter} ${data.year})
${data.dateRange ? `**Period:** ${data.dateRange}\n` : ''}
### Objectives Overview
${objectivesSummary || 'No objectives in the current view.'}

### Recent Check-ins & Updates
${checkInsSummary}

Please provide:
1. **Executive Summary** (2-3 sentences highlighting overall progress)
2. **Key Wins** (bullet points of significant achievements)
3. **Attention Areas** (items that may need focus or support)
4. **Looking Ahead** (brief preview of upcoming priorities)

Format the response so it's ready to copy and paste directly into a communication.`,
    },
  ];

  // Use the streaming function with higher token limit for comprehensive summaries
  const stream = streamChatCompletion(messages, { tenantId: context.tenantId, maxTokens: 4096 });
  for await (const chunk of stream) {
    yield chunk;
  }
}

// Interface for goal suggestion context
export interface GoalSuggestionContext {
  tenantId: string;
  foundation: Foundation | null;
  strategies: Strategy[];
  objectives: Objective[];
  existingGoals: string[];
}

// Streaming goal suggestions based on organizational context
export async function* streamGoalSuggestions(
  context: GoalSuggestionContext
): AsyncGenerator<string, void, unknown> {
  const { foundation, strategies, objectives, existingGoals } = context;

  // Build context about the organization
  let organizationContext = "";
  
  if (foundation) {
    if (foundation.mission) organizationContext += `**Mission:** ${foundation.mission}\n`;
    if (foundation.vision) organizationContext += `**Vision:** ${foundation.vision}\n`;
    if (foundation.tagline) organizationContext += `**Tagline:** ${foundation.tagline}\n`;
    if (foundation.companySummary) organizationContext += `**Company Summary:** ${foundation.companySummary}\n`;
    if (foundation.cultureStatement) organizationContext += `**Culture:** ${foundation.cultureStatement}\n`;
    if (foundation.values && Array.isArray(foundation.values) && foundation.values.length > 0) {
      const valuesText = foundation.values
        .map((v: any) => `- ${v.title}${v.description ? `: ${v.description}` : ''}`)
        .join('\n');
      organizationContext += `**Values:**\n${valuesText}\n`;
    }
  }

  // Build strategies context
  const strategiesContext = strategies.length > 0
    ? strategies.map(s => `- ${s.title}${s.description ? `: ${s.description}` : ''}`).join('\n')
    : 'No strategies defined yet.';

  // Build objectives context
  const objectivesContext = objectives.length > 0
    ? objectives.slice(0, 10).map(o => `- ${o.title} (${o.progress || 0}% complete)`).join('\n')
    : 'No objectives defined yet.';

  // Build existing goals context
  const existingGoalsContext = existingGoals.length > 0
    ? existingGoals.map(g => `- ${g}`).join('\n')
    : 'No annual goals defined yet.';

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `Based on the following organizational context, suggest 5-7 compelling annual goals that would help this organization achieve its mission and vision. Consider the existing strategies and objectives when making suggestions.

## Organization Context
${organizationContext || 'No organizational context available yet.'}

## Current Strategies
${strategiesContext}

## Current Objectives (Sample)
${objectivesContext}

## Existing Annual Goals
${existingGoalsContext}

## Instructions
1. Analyze the organization's mission, vision, values, and strategies
2. Identify gaps or opportunities not covered by existing goals
3. Suggest goals that are:
   - Specific and measurable where possible
   - Aligned with the organization's mission and values
   - Ambitious but achievable within a year
   - Complementary to (not duplicating) existing goals
4. For each suggestion, provide a brief rationale (1-2 sentences)

Format your response as:
**Suggested Goals:**

1. **[Goal Title]**
   - Rationale: [Brief explanation of why this goal aligns with the organization]

2. **[Goal Title]**
   - Rationale: [Brief explanation]

(Continue for all suggestions)

End with a brief summary of the strategic themes these goals address.`,
    },
  ];

  // Use the streaming function with higher token limit for comprehensive suggestions
  const stream = streamChatCompletion(messages, { tenantId: context.tenantId, maxTokens: 4096 });
  for await (const chunk of stream) {
    yield chunk;
  }
}

// Interface for strategy draft context
export interface StrategyDraftContext {
  tenantId: string;
  prompt: string;
  foundation: Foundation | null;
  existingStrategies: Strategy[];
}

// Streaming strategy draft generation based on organizational context and grounding documents
export async function* streamStrategyDraft(
  context: StrategyDraftContext
): AsyncGenerator<string, void, unknown> {
  const { prompt, foundation, existingStrategies } = context;

  // Build context about the organization
  let organizationContext = "";
  
  if (foundation) {
    if (foundation.mission) organizationContext += `**Mission:** ${foundation.mission}\n`;
    if (foundation.vision) organizationContext += `**Vision:** ${foundation.vision}\n`;
    if (foundation.tagline) organizationContext += `**Tagline:** ${foundation.tagline}\n`;
    if (foundation.companySummary) organizationContext += `**Company Summary:** ${foundation.companySummary}\n`;
    if (foundation.cultureStatement) organizationContext += `**Culture:** ${foundation.cultureStatement}\n`;
    if (foundation.values && Array.isArray(foundation.values) && foundation.values.length > 0) {
      const valuesText = foundation.values
        .map((v: any) => `- ${v.title}${v.description ? `: ${v.description}` : ''}`)
        .join('\n');
      organizationContext += `**Values:**\n${valuesText}\n`;
    }
    if (foundation.annualGoals && Array.isArray(foundation.annualGoals) && foundation.annualGoals.length > 0) {
      const goalsText = foundation.annualGoals.map((g: string) => `- ${g}`).join('\n');
      organizationContext += `**Annual Goals:**\n${goalsText}\n`;
    }
  }

  // Build existing strategies context
  const existingStrategiesContext = existingStrategies.length > 0
    ? existingStrategies.map(s => `- ${s.title}${s.description ? `: ${s.description}` : ''} (${s.priority} priority, ${s.status})`).join('\n')
    : 'No existing strategies defined yet.';

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `Based on the organizational context and the user's description below, draft a comprehensive strategy.

## User's Strategy Description
${prompt}

## Organization Context
${organizationContext || 'No organizational context available yet.'}

## Existing Strategies (to avoid duplication)
${existingStrategiesContext}

## Instructions
Create a well-structured strategy that:
1. Aligns with the organization's mission, vision, and values
2. Complements (doesn't duplicate) existing strategies
3. Addresses the user's described focus area
4. Is actionable and measurable

Please respond with a JSON object in the following format (no markdown, just pure JSON):
{
  "title": "A clear, concise strategy title (max 100 characters)",
  "description": "A comprehensive description of the strategy (2-3 paragraphs explaining what this strategy entails, why it matters, and how it will be executed)",
  "priority": "critical|high|medium|low",
  "suggestedTimeline": "A suggested timeline (e.g., 'Q1-Q2 2025', '6-12 months', 'Ongoing')",
  "linkedGoals": ["Array of annual goal titles this strategy supports"],
  "rationale": "Brief explanation of why this strategy is important and how it aligns with the organization's direction"
}

Ensure the response is valid JSON only, with no additional text before or after.`,
    },
  ];

  // Use the streaming function
  const stream = streamChatCompletion(messages, { tenantId: context.tenantId, maxTokens: 2048 });
  for await (const chunk of stream) {
    yield chunk;
  }
}

// Meeting recap parser - extract action items, decisions, and blockers
export interface MeetingRecapResult {
  actionItems: Array<{
    description: string;
    assignee?: string;
    dueDate?: string;
    priority?: "high" | "medium" | "low";
  }>;
  decisions: Array<{
    description: string;
    rationale?: string;
    owner?: string;
  }>;
  blockers: Array<{
    description: string;
    impact?: string;
    suggestedResolution?: string;
  }>;
  summary: string;
  keyTakeaways: string[];
}

export async function parseMeetingRecap(
  meetingNotes: string,
  context: {
    tenantId?: string;
    meetingTitle?: string;
    meetingType?: string;
    linkedOKRs?: Array<{ type: string; title: string }>;
  }
): Promise<MeetingRecapResult> {
  const okrContext = context.linkedOKRs?.length
    ? `\n\n**Linked OKRs for context:**\n${context.linkedOKRs.map((okr) => `- ${okr.type}: ${okr.title}`).join("\n")}`
    : "";

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `You are an expert meeting analyst. Please analyze the following meeting notes and extract key information.

**Meeting:** ${context.meetingTitle || "Untitled Meeting"}
**Type:** ${context.meetingType || "General Meeting"}${okrContext}

**Meeting Notes:**
${meetingNotes}

---

Please extract and return a JSON object with the following structure:
{
  "actionItems": [
    {
      "description": "Clear action item description",
      "assignee": "Person responsible (if mentioned)",
      "dueDate": "Due date if mentioned (format: YYYY-MM-DD or descriptive like 'next week')",
      "priority": "high|medium|low (infer from context)"
    }
  ],
  "decisions": [
    {
      "description": "Decision that was made",
      "rationale": "Why this decision was made (if mentioned)",
      "owner": "Who owns implementing this decision"
    }
  ],
  "blockers": [
    {
      "description": "Issue blocking progress",
      "impact": "What is impacted by this blocker",
      "suggestedResolution": "Potential solution if discussed"
    }
  ],
  "summary": "A brief 2-3 sentence summary of the meeting",
  "keyTakeaways": ["List of 3-5 key points from the meeting"]
}

IMPORTANT:
- Only include items that are explicitly mentioned or clearly implied in the notes
- If no action items, decisions, or blockers are present, return empty arrays
- Keep descriptions concise but complete
- For priorities, infer from urgency words (ASAP, critical, urgent = high; soon, next week = medium; when possible = low)
- Return ONLY valid JSON, no additional text`,
    },
  ];

  try {
    const response = await getChatCompletion(messages, {
      tenantId: context.tenantId,
      maxTokens: 2048,
    }, AI_FEATURES.MEETING_RECAP);

    // Parse the JSON response with robust cleaning
    const cleanedResponse = response
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .replace(/^[^{]*/, "")
      .replace(/[^}]*$/, "")
      .trim();
    
    let parsed: any;
    try {
      parsed = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("[AI Service] JSON parse error:", parseError);
      throw new Error("AI response was not in valid JSON format. Please try again.");
    }

    // Validate and sanitize the response with strict defaults
    const validateActionItem = (item: any) => {
      if (!item || typeof item.description !== 'string' || !item.description.trim()) return null;
      return {
        description: item.description.trim(),
        assignee: typeof item.assignee === 'string' ? item.assignee.trim() : undefined,
        dueDate: typeof item.dueDate === 'string' ? item.dueDate.trim() : undefined,
        priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : undefined,
      };
    };

    const validateDecision = (item: any) => {
      if (!item || typeof item.description !== 'string' || !item.description.trim()) return null;
      return {
        description: item.description.trim(),
        rationale: typeof item.rationale === 'string' ? item.rationale.trim() : undefined,
        owner: typeof item.owner === 'string' ? item.owner.trim() : undefined,
      };
    };

    const validateBlocker = (item: any) => {
      if (!item || typeof item.description !== 'string' || !item.description.trim()) return null;
      return {
        description: item.description.trim(),
        impact: typeof item.impact === 'string' ? item.impact.trim() : undefined,
        suggestedResolution: typeof item.suggestedResolution === 'string' ? item.suggestedResolution.trim() : undefined,
      };
    };

    const actionItems = Array.isArray(parsed.actionItems)
      ? parsed.actionItems.map(validateActionItem).filter(Boolean)
      : [];

    const decisions = Array.isArray(parsed.decisions)
      ? parsed.decisions.map(validateDecision).filter(Boolean)
      : [];

    const blockers = Array.isArray(parsed.blockers)
      ? parsed.blockers.map(validateBlocker).filter(Boolean)
      : [];

    const summary = typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : "Unable to generate summary from the provided notes.";

    const keyTakeaways = Array.isArray(parsed.keyTakeaways)
      ? parsed.keyTakeaways.filter((t: any) => typeof t === 'string' && t.trim()).map((t: string) => t.trim())
      : [];

    return {
      actionItems,
      decisions,
      blockers,
      summary,
      keyTakeaways,
    };
  } catch (error: any) {
    console.error("[AI Service] Error parsing meeting recap:", error.message);
    throw new Error(`Failed to parse meeting notes: ${error.message}`);
  }
}

// ============================================
// OKR QUALITY SCORING
// ============================================

export interface OKRQualityScoreResult {
  score: number; // 0-100
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

export interface OKRQualityScoreInput {
  objectiveTitle: string;
  objectiveDescription?: string;
  keyResults?: Array<{ title: string; target?: number; current?: number; unit?: string }>;
  tenantId?: string;
  alignedObjectives?: string[];
}

export async function scoreOKRQuality(input: OKRQualityScoreInput): Promise<OKRQualityScoreResult> {
  const { objectiveTitle, objectiveDescription, keyResults, alignedObjectives } = input;
  const startTime = Date.now();
  const maxRetries = 2;

  // Use a lightweight, direct call to avoid the heavy system prompt with grounding docs
  const systemMessage = `You are an OKR quality analyst. Always respond with valid JSON only, no other text.`;
  
  const userMessage = `Analyze this OKR and score it. Return only JSON.

Objective: "${objectiveTitle}"${objectiveDescription ? `\nDescription: "${objectiveDescription}"` : ''}${keyResults && keyResults.length > 0 ? `\nKey Results: ${keyResults.map((kr, i) => `${i + 1}. ${kr.title}`).join(', ')}` : ''}${alignedObjectives && alignedObjectives.length > 0 ? `\nAligned to: ${alignedObjectives.join(', ')}` : ''}

Score: Clarity(0-25), Measurability(0-25), Achievability(0-20), Alignment(0-15), Time-Bound(0-15). Total 0-100.

JSON format:
{"score":75,"dimensions":{"clarity":{"score":20,"maxScore":25,"feedback":"feedback text"},"measurability":{"score":18,"maxScore":25,"feedback":"feedback"},"achievability":{"score":15,"maxScore":20,"feedback":"feedback"},"alignment":{"score":12,"maxScore":15,"feedback":"feedback"},"timeBound":{"score":10,"maxScore":15,"feedback":"feedback"}},"issues":[{"type":"dimension","message":"issue","impact":5}],"strengths":[{"type":"dimension","message":"strength","bonus":5}],"suggestion":"improved text or null"}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Direct lightweight call without the full grounding context
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage }
        ],
        max_completion_tokens: 1000,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content || "";
      console.log(`[AI Service] OKR Quality Score attempt ${attempt} response:`, content.substring(0, 300));

      // Log AI usage
      const latencyMs = Date.now() - startTime;
      await logAiUsage({
        feature: AI_FEATURES.OKR_QUALITY_SCORING,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        latencyMs,
      });

      // Check for refusal responses
      if (content.toLowerCase().includes("apologize") || 
          content.toLowerCase().includes("sorry") || 
          content.toLowerCase().includes("unable to") ||
          !content.includes("{")) {
        console.log("[AI Service] Received non-JSON response, retrying...");
        if (attempt < maxRetries) continue;
      }

      // Parse the JSON response
      let cleanedResponse = content
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      
      const firstBrace = cleanedResponse.indexOf("{");
      const lastBrace = cleanedResponse.lastIndexOf("}");
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanedResponse = cleanedResponse.substring(firstBrace, lastBrace + 1);
      }

      console.log("[AI Service] OKR Quality Score cleaned:", cleanedResponse.substring(0, 200));

      const parsed = JSON.parse(cleanedResponse);
      
      return {
        score: typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : 50,
        dimensions: {
          clarity: parsed.dimensions?.clarity || { score: 0, maxScore: 25, feedback: "Not analyzed" },
          measurability: parsed.dimensions?.measurability || { score: 0, maxScore: 25, feedback: "Not analyzed" },
          achievability: parsed.dimensions?.achievability || { score: 0, maxScore: 20, feedback: "Not analyzed" },
          alignment: parsed.dimensions?.alignment || { score: 0, maxScore: 15, feedback: "Not analyzed" },
          timeBound: parsed.dimensions?.timeBound || { score: 0, maxScore: 15, feedback: "Not analyzed" },
        },
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        suggestion: typeof parsed.suggestion === 'string' ? parsed.suggestion : null,
      };
    } catch (parseError: any) {
      console.error(`[AI Service] OKR Quality Score attempt ${attempt} failed:`, parseError.message);
      if (attempt < maxRetries) {
        console.log("[AI Service] Retrying OKR quality scoring...");
        continue;
      }
    }
  }

  // Return default after all retries failed
  console.error("[AI Service] All OKR Quality Score attempts failed");
  return {
    score: 50,
    dimensions: {
      clarity: { score: 12, maxScore: 25, feedback: "AI analysis unavailable - try again later" },
      measurability: { score: 12, maxScore: 25, feedback: "AI analysis unavailable - try again later" },
      achievability: { score: 10, maxScore: 20, feedback: "AI analysis unavailable - try again later" },
      alignment: { score: 8, maxScore: 15, feedback: "AI analysis unavailable - try again later" },
      timeBound: { score: 8, maxScore: 15, feedback: "AI analysis unavailable - try again later" },
    },
    issues: [{ type: "system", message: "AI analysis temporarily unavailable - please try again", impact: 0 }],
    strengths: [],
    suggestion: null,
  };
}

