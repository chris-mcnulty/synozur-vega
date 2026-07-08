import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { pool } from "./db";
import { initializeDatabase } from "./init";

// Prevent transient DB/network errors from crashing the process
process.on('unhandledRejection', (reason: unknown) => {
  console.error('[Process] Unhandled promise rejection (non-fatal):', reason);
});
process.on('uncaughtException', (err: Error) => {
  console.error('[Process] Uncaught exception (non-fatal):', err.message);
});

const app = express();
const PgStore = connectPgSimple(session);

// Trust exactly one hop (Replit's reverse proxy) so Express derives req.ip from the
// single trusted X-Forwarded-For entry it appends, rather than trusting the entire
// (attacker-controllable) header chain. This keeps secure cookies working behind the
// proxy while preventing clients from spoofing their apparent source IP.
app.set('trust proxy', 1);

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
  // Health check endpoint - responds immediately for deployment checks
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    console.error("Error:", err);
    
    // For API routes, return JSON error
    if (req.path.startsWith('/api')) {
      return res.status(status).json({ 
        error: message,
        status: status 
      });
    }
    
    // For other routes, return HTML error page
    return res.status(status).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error ${status}</title>
        </head>
        <body>
          <h1>Error ${status}</h1>
          <p>${message}</p>
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

    // Initialize database AFTER port is open so deployment health checks pass
    initializeDatabase()
      .then(() => log("Database initialization complete"))
      .catch((err) => console.error("Database initialization error (non-fatal):", err));
  });
})();
