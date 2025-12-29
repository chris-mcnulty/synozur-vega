# Vega M365 Copilot Agent

This folder contains the manifests required to deploy Vega as a Microsoft 365 Copilot Agent.

## Files

- `manifest.json` - Teams app manifest (v1.19) that packages the Copilot agent
- `declarative-agent.json` - Declarative agent manifest (v1.6) defining behavior and instructions
- `vega-api-plugin.json` - API plugin manifest connecting to Vega's OpenAPI spec

## Prerequisites

Before deploying the Copilot Agent:

### 1. Azure AD App Registration
- Register an app in Azure AD for OAuth authentication
- Configure redirect URIs for Copilot authentication flow
- Grant appropriate Microsoft Graph permissions
- Note the Application (client) ID and create a client secret

### 2. Update Configuration

Update the following placeholders in the manifests:

**manifest.json:**
- Replace `00000000-0000-0000-0000-000000000000` with your Azure AD App ID
- Add icon files (`color-icon.png` and `outline-icon.png`)
- Update `validDomains` with your production domain

**vega-api-plugin.json:**
- Replace `{VEGA_OAUTH_CONNECTION_ID}` with your Plugin Vault OAuth connection ID
- Verify `spec.url` points to your production OpenAPI endpoint

### 3. OAuth Setup in Copilot Studio

1. Go to Microsoft Copilot Studio
2. Create an OAuth connection for Vega
3. Configure with your Azure AD app credentials
4. Note the connection ID for the plugin manifest

## Deployment Steps

1. Package the files into a ZIP archive:
   ```
   zip vega-copilot-agent.zip manifest.json declarative-agent.json vega-api-plugin.json color-icon.png outline-icon.png
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

**401 Unauthorized errors:**
- Verify OAuth connection is configured correctly
- Check that user has appropriate Vega permissions
- Ensure tenant context is being passed correctly

**Agent not appearing:**
- Verify manifest is uploaded and approved
- Check Teams Admin Center for app status
- Ensure user has Copilot license

**API calls failing:**
- Verify production OpenAPI spec is accessible
- Check operationIds match function names
- Review server logs for errors

## License Requirements

- Microsoft 365 Copilot license required for full functionality
- WebSearch capability available to all users
