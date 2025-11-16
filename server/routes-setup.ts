import { type Express } from "express";
import { db } from "./db";
import { users, tenants } from "@shared/schema";
import { hashPassword } from "./auth";
import { sql } from "drizzle-orm";

export function registerSetupRoutes(app: Express) {
  // Serve the setup HTML page
  app.get("/setup", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vega Production Setup</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px; 
            margin: 50px auto; 
            padding: 20px;
            background: #0a0a0a;
            color: #fafafa;
        }
        h1 { color: #810FFB; }
        input, button { 
            width: 100%; 
            padding: 10px; 
            margin: 10px 0;
            background: #18181b;
            color: #fafafa;
            border: 1px solid #27272a;
            border-radius: 6px;
        }
        button { 
            background: #810FFB; 
            color: white; 
            cursor: pointer;
            font-weight: bold;
        }
        button:hover { background: #6b0dd3; }
        button:disabled { 
            opacity: 0.5; 
            cursor: not-allowed; 
        }
        .result { 
            margin-top: 20px; 
            padding: 15px; 
            border-radius: 6px;
            background: #18181b;
            border: 1px solid #27272a;
        }
        .success { border-color: #10b981; color: #10b981; }
        .error { border-color: #ef4444; color: #ef4444; }
        .info { border-color: #3b82f6; color: #3b82f6; }
        pre { 
            background: #09090b; 
            padding: 10px; 
            border-radius: 4px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <h1>🚀 Vega Production Setup</h1>
    
    <div>
        <h2>Step 1: Enter Your Production URL</h2>
        <input type="text" id="prodUrl" placeholder="https://your-app.replit.app" />
        
        <h2>Step 2: Check Status</h2>
        <button onclick="checkStatus()">Check If System Is Initialized</button>
        
        <h2>Step 3: Initialize (If Needed)</h2>
        <input type="text" id="setupToken" placeholder="Enter your SETUP_TOKEN" />
        <button onclick="initializeSystem()">Initialize Production System</button>
    </div>
    
    <div id="result"></div>

    <script>
        function showResult(message, type = 'info') {
            document.getElementById('result').innerHTML = 
                \`<div class="result \${type}">\${message}</div>\`;
        }
        
        async function checkStatus() {
            const url = document.getElementById('prodUrl').value;
            if (!url) {
                showResult('Please enter your production URL', 'error');
                return;
            }
            
            try {
                const response = await fetch(\`\${url}/api/setup/status\`);
                const data = await response.json();
                
                if (data.initialized) {
                    showResult(\`
                        <strong>✅ System Already Initialized</strong><br>
                        Admins: \${data.admins}<br>
                        Tenants: \${data.tenants}<br>
                        <br>
                        You can log in at \${url}/login
                    \`, 'success');
                } else {
                    showResult(\`
                        <strong>⚠️ System Not Initialized</strong><br>
                        Admins: \${data.admins}<br>
                        Tenants: \${data.tenants}<br>
                        <br>
                        Use the Initialize button below to set up your system.
                    \`, 'info');
                }
            } catch (error) {
                showResult(\`Error: \${error.message}\`, 'error');
            }
        }
        
        async function initializeSystem() {
            const url = document.getElementById('prodUrl').value;
            const setupToken = document.getElementById('setupToken').value;
            
            if (!url || !setupToken) {
                showResult('Please enter both URL and setup token', 'error');
                return;
            }
            
            try {
                const response = await fetch(\`\${url}/api/setup/initialize\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ setupToken })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showResult(\`
                        <strong>🎉 Production Setup Complete!</strong><br><br>
                        <strong>Tenant Created:</strong> \${data.tenant}<br><br>
                        <strong>Admin Accounts:</strong><br>
                        <pre>\${data.admins.join('\\n')}</pre>
                        <strong style="color: #ef4444;">⚠️ \${data.warning}</strong><br><br>
                        You can now log in at: <a href="\${url}/login" target="_blank">\${url}/login</a>
                    \`, 'success');
                } else {
                    showResult(\`Error: \${data.message}\`, 'error');
                }
            } catch (error) {
                showResult(\`Error: \${error.message}\`, 'error');
            }
        }
    </script>
</body>
</html>
    `);
  });
  
  // One-time production setup endpoint
  // IMPORTANT: Remove this endpoint after initial setup!
  app.post("/api/setup/initialize", async (req, res) => {
    try {
      // Check if setup token matches (for security)
      const setupToken = req.body.setupToken;
      
      // You should set this in your production environment variables
      if (setupToken !== process.env.SETUP_TOKEN) {
        return res.status(403).json({ message: "Invalid setup token" });
      }

      // Check if any admin already exists
      const existingAdmins = await db
        .select()
        .from(users)
        .where(sql`${users.role} IN ('global_admin', 'vega_admin')`)
        .limit(1);

      if (existingAdmins.length > 0) {
        return res.status(400).json({ 
          message: "System already initialized. Admins exist." 
        });
      }

      // Create first tenant - The Synozur Alliance LLC
      const [tenant] = await db
        .insert(tenants)
        .values({
          name: "The Synozur Alliance LLC",
          brandColor: "hsl(270, 100%, 50%)",
        })
        .returning();

      console.log("✅ Created tenant:", tenant.name);

      // Hash passwords
      const chrisPasswordHash = await hashPassword("East2west!");
      const adminPasswordHash = await hashPassword("admin123");

      // Create Chris McNulty admin
      await db.insert(users).values({
        email: "chris.mcnulty@synozur.com",
        username: "chris.mcnulty",
        password: chrisPasswordHash,
        role: "global_admin",
        tenantId: null, // Global admins don't belong to specific tenant
      });

      // Create generic admin account
      await db.insert(users).values({
        email: "admin@synozur.com", 
        username: "admin",
        password: adminPasswordHash,
        role: "global_admin",
        tenantId: null,
      });

      res.json({
        success: true,
        message: "Production setup complete!",
        admins: [
          "chris.mcnulty@synozur.com / East2west!",
          "admin@synozur.com / admin123"
        ],
        tenant: tenant.name,
        warning: "CHANGE THESE PASSWORDS IMMEDIATELY!"
      });

    } catch (error) {
      console.error("Setup error:", error);
      res.status(500).json({ 
        message: "Setup failed", 
        error: error.message 
      });
    }
  });

  // Endpoint to check if system is initialized
  app.get("/api/setup/status", async (req, res) => {
    try {
      const adminCount = await db
        .select({ count: sql`count(*)` })
        .from(users)
        .where(sql`${users.role} IN ('global_admin', 'vega_admin')`);

      const tenantCount = await db
        .select({ count: sql`count(*)` })
        .from(tenants);

      res.json({
        initialized: adminCount[0].count > 0,
        admins: adminCount[0].count,
        tenants: tenantCount[0].count
      });
    } catch (error) {
      res.status(500).json({ message: "Status check failed" });
    }
  });
}