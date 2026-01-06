import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { pool } from "./db";
import { initializeDatabase } from "./init";

const app = express();
const PgStore = connectPgSimple(session);

// Trust entire proxy chain (required for secure cookies behind Replit's reverse proxy)
app.set('trust proxy', true);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Session configuration
app.use(
  session({
    store: new PgStore({
      pool: pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'vega-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax', // Allow cookies to be sent on same-site navigations
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize database with seed data if empty (for production deployments)
  await initializeDatabase();

  const server = await registerRoutes(app);

  // STABILITY: Enhanced global error handler with structured logging and response
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    
    // Structured error logging with context
    const errorContext = {
      requestId,
      path: req.path,
      method: req.method,
      status,
      message,
      userId: req.session?.userId,
      tenantId: req.headers['x-tenant-id'],
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
    };
    
    // Log full stack trace for 5xx errors in development
    if (status >= 500) {
      console.error('[ERROR] Server Error:', errorContext);
      if (process.env.NODE_ENV === 'development') {
        console.error('[ERROR] Stack:', err.stack);
      }
    } else if (status >= 400) {
      // Log 4xx as warnings (client errors)
      console.warn('[WARN] Client Error:', errorContext);
    }
    
    // Don't send error details to client in production for 5xx
    const clientMessage = (status >= 500 && process.env.NODE_ENV === 'production')
      ? 'An unexpected error occurred. Please try again.'
      : message;
    
    // For API routes, return JSON error with request ID for support
    if (req.path.startsWith('/api')) {
      return res.status(status).json({ 
        error: clientMessage,
        status,
        requestId,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      });
    }
    
    // For other routes, return HTML error page
    return res.status(status).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error ${status}</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            h1 { color: #dc2626; }
            code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>Error ${status}</h1>
          <p>${clientMessage}</p>
          <p><small>Request ID: <code>${requestId}</code></small></p>
        </body>
      </html>
    `);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
