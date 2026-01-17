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

router.all('/', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.substring(7);
    
    // SECURITY: Only accept JWT tokens, not raw API keys
    // Users must first exchange their API key for a short-lived JWT via POST /mcp/token
    const context = await getAuthContext(token);
    
    if (!context) {
      return res.status(401).json({ 
        error: 'Invalid or expired token. Use POST /mcp/token with your API key to obtain a short-lived access token.' 
      });
    }

    const rateLimitResult = checkMcpRateLimit(context.tenant.id);
    const headers = getRateLimitHeaders(rateLimitResult);
    Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
    
    if (!rateLimitResult.allowed) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Please try again later.',
        retry_after: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
      });
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
  expiresAt?: Date
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
  });

  return {
    apiKey: key,
    id: created.id,
    prefix,
  };
}
