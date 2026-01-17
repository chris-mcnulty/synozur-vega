import { Router, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './server';
import { validateApiKey, generateShortLivedToken, getAuthContext, generateApiKey, hasScope } from './auth';
import { storage } from '../storage';
import { MCP_SCOPES } from '@shared/schema';

const router = Router();

router.post('/token', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const apiKeyValue = authHeader.substring(7);
    const apiKey = await validateApiKey(apiKeyValue);

    if (!apiKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const token = generateShortLivedToken(apiKey);
    
    res.json({
      access_token: token,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: apiKey.scopes.join(' '),
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
    
    let context = await getAuthContext(token);
    
    if (!context) {
      const apiKey = await validateApiKey(token);
      if (apiKey) {
        const [user, tenant] = await Promise.all([
          storage.getUser(apiKey.userId),
          storage.getTenantById(apiKey.tenantId),
        ]);
        if (user && tenant) {
          context = {
            user,
            tenant,
            apiKey,
            scopes: apiKey.scopes,
          };
        }
      }
    }
    
    if (!context) {
      return res.status(401).json({ error: 'Invalid or expired token' });
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
      tools: Object.keys(require('./tools').mcpTools),
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
