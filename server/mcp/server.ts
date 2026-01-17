import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mcpTools, type McpToolName, type McpToolResult } from './tools';
import type { McpAuthContext } from './auth';
import { storage } from '../storage';

export function createMcpServer(context: McpAuthContext) {
  const server = new McpServer(
    {
      name: 'vega-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  for (const [toolName, toolDef] of Object.entries(mcpTools)) {
    const name = toolName as McpToolName;
    
    server.tool(
      name,
      toolDef.inputSchema.shape,
      async (params: Record<string, unknown>) => {
        const startTime = Date.now();
        let success = true;
        let errorMessage: string | undefined;

        try {
          const result = await toolDef.execute(params as never, context);
          
          if (result.isError) {
            success = false;
            errorMessage = result.content[0]?.text;
          }

          return result as McpToolResult;
        } catch (err) {
          success = false;
          errorMessage = err instanceof Error ? err.message : 'Unknown error';
          throw err;
        } finally {
          const durationMs = Date.now() - startTime;
          
          try {
            await storage.createMcpAuditLog({
              tenantId: context.tenant.id,
              userId: context.user.id,
              apiKeyId: context.apiKey.id,
              toolName: name,
              toolParams: params,
              success,
              errorMessage,
              durationMs,
            });
          } catch (logError) {
            console.error('[MCP] Failed to create audit log:', logError);
          }
        }
      }
    );
  }

  return server;
}
