import OpenAI from "openai";
import { storage } from "./storage";
import type { GroundingDocument, Foundation, Strategy, Objective } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const MODEL = "gpt-5";

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
  // Get active grounding documents sorted by priority
  const groundingDocs = await storage.getActiveGroundingDocuments();
  
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
  options: ChatCompletionOptions = {}
): Promise<string> {
  const { tenantId, maxTokens = 4096 } = options;

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

    return response.choices[0]?.message?.content || "I apologize, but I was unable to generate a response. Please try again.";
  } catch (error: any) {
    console.error("OpenAI API Error:", error);
    
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
  options: ChatCompletionOptions = {}
): AsyncGenerator<string, void, unknown> {
  const { tenantId, maxTokens = 4096 } = options;
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
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        chunkCount++;
        yield content;
      }
    }
    console.log("[AI Service] Stream completed, total chunks:", chunkCount);
  } catch (error: any) {
    console.error("[AI Service] OpenAI Streaming Error:", error.message || error);
    console.error("[AI Service] Full error:", JSON.stringify(error, null, 2));
    
    if (error?.message?.includes("429") || error?.message?.includes("RATELIMIT")) {
      throw new Error("The AI service is currently busy. Please try again in a moment.");
    }
    
    throw new Error(`Failed to stream AI response: ${error.message || 'Unknown error'}`);
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

${context.strategies?.length ? `**Strategic Priorities:**\n${context.strategies.map(s => `- ${s.title}: ${s.description || ""}`).join("\n")}` : ""}

${context.existingObjectives?.length ? `**Existing Objectives (to avoid duplication):**\n${context.existingObjectives.map(o => `- ${o.title}`).join("\n")}` : ""}

Please format each OKR with:
1. A clear, inspirational Objective
2. 3-4 measurable Key Results with specific targets
3. Brief rationale for how this aligns with our strategy`,
    },
  ];

  return getChatCompletion(messages, { tenantId: context.tenantId });
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
      content: `Suggest 3-5 "Big Rocks" (major initiatives or projects) that would help achieve the following objective:

**Objective:** ${context.objective.title}
${context.objective.description ? `**Description:** ${context.objective.description}` : ""}

${context.keyResults?.length ? `**Key Results:**\n${context.keyResults.map(kr => `- ${kr.title}: Target ${kr.targetValue} ${kr.unit || ""}`).join("\n")}` : ""}

For each Big Rock, provide:
1. A clear, action-oriented title
2. Brief description of what it involves
3. Estimated effort (small/medium/large)
4. Which key result(s) it primarily supports`,
    },
  ];

  return getChatCompletion(messages, { tenantId: context.tenantId });
}
