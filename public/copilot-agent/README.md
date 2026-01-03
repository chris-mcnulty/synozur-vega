# Vega M365 Copilot Agent

This folder contains the manifests required to deploy Vega as a Microsoft 365 Copilot Agent.

## Files

- `manifest.json` - Teams app manifest (v1.23) that packages the Copilot agent
- `declarative-agent.json` - Declarative agent manifest (v1.2) defining behavior and instructions
- `vega-api-plugin.json` - API plugin manifest (v2.2) connecting to Vega's OpenAPI spec
- `color.png` - Color icon (192x192 pixels, PNG format)
- `outline.png` - Outline icon (32x32 pixels, PNG format)
- `vega-copilot-agent.zip` - Pre-built package ready for upload

## Prerequisites

Before deploying the Copilot Agent:

### 1. Azure AD App Registration

Register an app in Azure Portal (Entra ID) with the following configuration:

**Step 1: Create the App Registration**
1. Go to Azure Portal > Microsoft Entra ID > App registrations > New registration
2. Name: "Vega Copilot Agent" (or similar)
3. Supported account types: "Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)"
4. Click Register

**Step 2: Configure Redirect URIs**

Add these redirect URIs under Authentication > Web:
```
https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect
https://teams.microsoft.com/api/platform/v1.0/oAuthConsentRedirect
```

**Step 3: Grant API Permissions**

Under API permissions > Add a permission > Microsoft Graph > Delegated permissions:

| Permission | Purpose |
|------------|---------|
| `User.Read` | Read signed-in user's profile |
| `openid` | Sign users in |
| `profile` | View users' basic profile |
| `email` | View users' email address |

These are the minimum permissions. The Vega API handles authorization internally based on the authenticated user.

**Step 4: Create Client Secret**
1. Go to Certificates & secrets > New client secret
2. Add a description and expiration period
3. Copy the secret value immediately (shown only once)

**Step 5: Note These Values**
- Application (client) ID
- Directory (tenant) ID (use "common" for multi-tenant)
- Client secret value

**Step 6: Allowlist Microsoft Enterprise Token Store**

If your API validates client application IDs, you must allow:
```
ab3be6b7-f5df-413d-ac2d-abf1e3fd9c0b
```
This is Microsoft's Enterprise Token Store client ID that Copilot uses to request tokens on behalf of users.

### 2. Update Configuration

Update the following placeholders in the manifests:

**manifest.json:**
- Replace `00000000-0000-0000-0000-000000000000` with your Azure AD App ID
- Add icon files (`color-icon.png` and `outline-icon.png`)
- Update `validDomains` with your production domain

**vega-api-plugin.json:**
- Replace `{VEGA_OAUTH_CONNECTION_ID}` with your Plugin Vault OAuth connection ID
- Verify `spec.url` points to your production OpenAPI endpoint

### 3. OAuth Client Registration in Teams Developer Portal

1. Go to Teams Developer Portal (https://dev.teams.microsoft.com)
2. Navigate to Tools > OAuth client registration
3. Click "Register client" (or "New OAuth client registration")
4. Fill in the required fields:

| Field | Value |
|-------|-------|
| Registration name | Vega Copilot Agent |
| Base URL | `https://vega.synozur.com` |
| Client ID | (from Azure AD app registration) |
| Client secret | (from Azure AD app registration) |
| Authorization endpoint | `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` |
| Token endpoint | `https://login.microsoftonline.com/common/oauth2/v2.0/token` |
| Refresh endpoint | `https://login.microsoftonline.com/common/oauth2/v2.0/token` |
| Scopes | `User.Read openid profile email` |

5. Enable PKCE if your OAuth provider supports it (recommended)
6. Click Register and copy the **OAuth client registration ID**
7. Use this ID in `vega-api-plugin.json` as the `reference_id`

## Deployment Steps

1. Package the files into a ZIP archive (or use the pre-built `vega-copilot-agent.zip`):
   ```
   zip vega-copilot-agent.zip manifest.json declarative-agent.json vega-api-plugin.json color.png outline.png
   ```

2. Upload to Microsoft 365 Admin Center:
   - Go to Teams Admin Center > Manage Apps
   - Upload the ZIP package
   - Approve for your organization

3. Test in Copilot:
   - Open Microsoft Copilot in Teams or M365
   - The Vega agent should appear as an available plugin
   - Try conversation starters like "Show my OKRs"

## API Endpoints Used

The agent connects to these Vega API endpoints:

| Function | Endpoint | Description |
|----------|----------|-------------|
| listObjectives | GET /api/okr/objectives | List OKRs |
| getObjective | GET /api/okr/objectives/{id} | Get objective details |
| listKeyResults | GET /api/okr/key-results | List key results |
| listBigRocks | GET /api/okr/big-rocks | List quarterly priorities |
| listMeetings | GET /api/meetings/{tenantId} | List Focus Rhythm meetings |
| getMeeting | GET /api/meetings/{id} | Get meeting details |
| listStrategies | GET /api/strategies/{tenantId} | List strategies |
| getFoundations | GET /api/foundations/{tenantId} | Get mission/vision/values |
| listTeams | GET /api/teams/{tenantId} | List teams |
| getReportingSummary | GET /api/reporting/summary | Get progress summary |
| suggestOkrs | POST /api/ai/suggest/okrs | AI OKR suggestions |
| suggestBigRocks | POST /api/ai/suggest/big-rocks | AI Big Rock suggestions |

## Conversation Starters

Users can start conversations with:
- "Show my OKRs"
- "Check progress"
- "View Big Rocks"
- "Upcoming meetings"
- "Company strategy"
- "Suggest OKRs"

## Troubleshooting

**App not recognized in Teams App Center:**
1. Verify manifest version compatibility:
   - Use `manifestVersion: "1.23"` (latest version with full Copilot agent support)
   - Schema URL must match: `https://developer.microsoft.com/json-schemas/teams/v1.23/MicrosoftTeams.schema.json`
2. Check icon requirements:
   - Color icon: exactly 192x192 pixels, PNG format
   - Outline icon: exactly 32x32 pixels, PNG format, white with transparency
   - File names must match manifest.json references exactly
3. Validate the app package:
   - Use Teams Developer Portal validation tool
   - Ensure ZIP contains exactly: manifest.json, declarative-agent.json, vega-api-plugin.json, color.png, outline.png
4. Check declarative agent schema:
   - Use schema version v1.2: `https://developer.microsoft.com/json-schemas/copilot/declarative-agent/v1.2/schema.json`

**401 Unauthorized errors:**
- Verify OAuth connection is configured correctly in Teams Developer Portal
- Check that user has appropriate Vega permissions
- Ensure tenant context is being passed correctly
- Verify the OAuth reference_id in vega-api-plugin.json matches your registration

**Agent not appearing in Copilot:**
- Verify manifest is uploaded and approved in Teams Admin Center
- Check Teams Admin Center > Manage Apps for app status
- Ensure user has Microsoft 365 Copilot license
- Wait 45 minutes to several hours after approval for propagation

**API calls failing:**
- Verify production OpenAPI spec is accessible at https://vega.synozur.com/openapi.json
- Check operationIds in OpenAPI spec match function names in vega-api-plugin.json
- Ensure server URL in OpenAPI spec is absolute (not relative)
- Review server logs for errors

## Publishing to Microsoft Marketplace

To make the Vega Copilot Agent available in the Microsoft Commercial Marketplace (Agent Store):

### Prerequisites

1. **Partner Center Account**: Enroll in the Microsoft AI Cloud Partner Program
2. **Microsoft 365 and Copilot Program**: Required for publishing agents
   - Sign in to [Partner Center](https://partner.microsoft.com/dashboard)
   - Go to Settings > Account settings > Programs
   - On the "Microsoft 365 and Copilot" tile, click "Get Started"
   - Accept the Microsoft Publisher Agreement

### App Package Contents

Create a ZIP file containing:
```
vega-copilot-agent.zip
├── manifest.json           (Teams app manifest)
├── declarative-agent.json  (Agent behavior definition)
├── vega-api-plugin.json    (API plugin configuration)
├── color-icon.png          (192x192 full color icon)
└── outline-icon.png        (32x32 white outline icon)
```

### Submission Process

1. **Create Offer in Partner Center**
   - Sign in to Partner Center > Marketplace offers
   - Click "+ New offer" > "Apps and agents for Microsoft 365 and Copilot"
   - Select your enrolled publisher account

2. **Upload Package**
   - On the Packages page, upload your ZIP file
   - Wait for "Manifest checks passed" validation
   - Fix any validation errors before proceeding

3. **Complete Listing Details**
   - Properties: Select 1-3 categories (e.g., "Productivity", "Business Management")
   - Marketplace Listings: Add descriptions, screenshots, support contact
   - Legal: Choose Standard Contract or custom EULA

4. **Submit for Review**
   - Microsoft reviews the submission (typically several days)
   - Address any feedback from the review team
   - Once approved, the agent appears in the Agent Store

### Distribution Options

| Option | Audience | How |
|--------|----------|-----|
| **Organization Only** | Internal users | Upload to Teams Admin Center |
| **Commercial Marketplace** | All M365 Copilot users | Partner Center submission |

### Post-Publication

- IT admins manage agent availability via Teams/M365 Admin Center
- Admins can approve, block, or assign to specific users/groups
- End-user availability: 45 minutes to several hours after admin approval

### Monetization (Optional)

You can monetize through a linked SaaS offer:
- Per-user pricing
- Flat rate
- Usage-based
- Custom dimensions

See: [Monetize a Microsoft 365 agent](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/ai-agent-overview)

## License Requirements

- Microsoft 365 Copilot license required for full functionality
- WebSearch capability available to all users

## Useful Links

- [Publishing Guide](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/publish)
- [Partner Center Submission Guide](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/add-in-submission-guide)
- [Agent Store Announcement](https://devblogs.microsoft.com/microsoft365dev/introducing-the-agent-store-build-publish-and-discover-agents-in-microsoft-365-copilot/)
