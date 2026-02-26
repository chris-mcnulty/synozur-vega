import { Router, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './server';
import { validateApiKey, generateShortLivedToken, getAuthContext, generateApiKey } from './auth';
import { storage } from '../storage';
import { MCP_SCOPES } from '@shared/schema';
import { checkMcpRateLimit, checkTokenExchangeRateLimit, getRateLimitHeaders } from './rateLimiter';
import { mcpTools } from './tools';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

const router = Router();

router.post('/token', async (req: Request, res: Response) => {
  try {
    const clientIp = getClientIp(req);
    
    const rateLimitResult = checkTokenExchangeRateLimit(clientIp);
    const headers = getRateLimitHeaders(rateLimitResult);
    Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
    
    if (!rateLimitResult.allowed) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Please try again later.',
        retry_after: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
      });
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const apiKeyValue = authHeader.substring(7);
    const result = await validateApiKey(apiKeyValue, clientIp);

    if (!result.apiKey) {
      const errorMessages: Record<string, { status: number; message: string }> = {
        'invalid_key': { status: 401, message: 'Invalid API key' },
        'revoked': { status: 401, message: 'API key has been revoked' },
        'expired': { status: 401, message: 'API key has expired' },
        'ip_not_allowed': { status: 403, message: 'Access denied: IP address not in allowlist' },
      };
      const err = errorMessages[result.error || 'invalid_key'];
      return res.status(err.status).json({ error: err.message });
    }

    const token = generateShortLivedToken(result.apiKey);
    
    res.json({
      access_token: token,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: result.apiKey.scopes.join(' '),
    });
  } catch (error) {
    console.error('[MCP] Token exchange error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function authenticateRequest(req: Request, res: Response): Promise<ReturnType<typeof getAuthContext> extends Promise<infer T> ? T : never> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return null;
  }

  const token = authHeader.substring(7);
  const clientIp = getClientIp(req);
  
  const context = await getAuthContext(token, clientIp);
  
  if (!context) {
    res.status(401).json({ 
      error: 'Invalid or expired token. Use POST /mcp/token with your API key to obtain a short-lived access token, or use a direct-auth API key.' 
    });
    return null;
  }

  const rateLimitResult = checkMcpRateLimit(context.tenant.id);
  const headers = getRateLimitHeaders(rateLimitResult);
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  
  if (!rateLimitResult.allowed) {
    res.status(429).json({ 
      error: 'Rate limit exceeded. Please try again later.',
      retry_after: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
    });
    return null;
  }

  return context;
}

function clientAcceptsSSE(req: Request): boolean {
  const accept = req.headers.accept || '';
  return accept.includes('text/event-stream');
}

async function handleJsonRpc(req: Request, res: Response, context: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>) {
  const { method, params, id } = req.body;

  if (method === 'tools/list') {
    const tools = Object.entries(mcpTools).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(tool.inputSchema.shape).map(([key, val]: [string, any]) => [
            key,
            { type: val._def?.typeName === 'ZodNumber' ? 'number' : 'string', description: val.description || key }
          ])
        ),
      },
    }));
    return res.json({ jsonrpc: '2.0', result: { tools }, id });
  }

  if (method === 'tools/call') {
    const toolName = params?.name as string;
    const toolArgs = params?.arguments || {};
    const toolDef = mcpTools[toolName as keyof typeof mcpTools];
    if (!toolDef) {
      return res.json({ jsonrpc: '2.0', error: { code: -32601, message: `Unknown tool: ${toolName}` }, id });
    }

    const startTime = Date.now();
    let success = true;
    let errorMessage: string | undefined;

    try {
      const result = await toolDef.execute(toolArgs as never, context);
      if (result.isError) {
        success = false;
        errorMessage = result.content[0]?.text;
      }

      try {
        await storage.createMcpAuditLog({
          tenantId: context.tenant.id,
          userId: context.user.id,
          apiKeyId: context.apiKey?.id || null,
          toolName,
          toolParams: toolArgs,
          success,
          errorMessage,
          durationMs: Date.now() - startTime,
        });
      } catch (logError) {
        console.error('[MCP] Failed to create audit log:', logError);
      }

      return res.json({ jsonrpc: '2.0', result: { content: result.content, isError: result.isError }, id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      try {
        await storage.createMcpAuditLog({
          tenantId: context.tenant.id,
          userId: context.user.id,
          apiKeyId: context.apiKey?.id || null,
          toolName,
          toolParams: toolArgs,
          success: false,
          errorMessage: msg,
          durationMs: Date.now() - startTime,
        });
      } catch (logError) {
        console.error('[MCP] Failed to create audit log:', logError);
      }
      return res.json({ jsonrpc: '2.0', error: { code: -32000, message: msg }, id });
    }
  }

  return res.json({ jsonrpc: '2.0', error: { code: -32601, message: `Unsupported method: ${method}` }, id });
}

router.all('/', async (req: Request, res: Response) => {
  try {
    const context = await authenticateRequest(req, res);
    if (!context) return;

    if (!clientAcceptsSSE(req)) {
      return handleJsonRpc(req, res, context);
    }

    const server = createMcpServer(context);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('[MCP] Server error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

router.get('/info', (_req: Request, res: Response) => {
  res.json({
    name: 'Vega MCP Server',
    version: '1.0.0',
    description: 'MCP server for accessing Vega Company OS data',
    capabilities: {
      tools: Object.keys(mcpTools),
    },
    scopes: Object.values(MCP_SCOPES),
  });
});

export const mcpRouter = router;

export async function createApiKeyForUser(
  userId: string,
  tenantId: string,
  name: string,
  scopes: string[],
  expiresAt?: Date,
  directAuth: boolean = false
): Promise<{ apiKey: string; id: string; prefix: string }> {
  const { key, hash, prefix } = generateApiKey();
  
  const created = await storage.createMcpApiKey({
    userId,
    tenantId,
    name,
    keyHash: hash,
    keyPrefix: prefix,
    scopes,
    status: 'active',
    expiresAt,
    directAuth,
  });

  return {
    apiKey: key,
    id: created.id,
    prefix,
  };
}
