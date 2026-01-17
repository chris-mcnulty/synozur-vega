# Vega Changelog

**Your AI-Augmented Company Operating System**

This changelog documents new features, improvements, and fixes in Vega. Updates are listed with the most recent changes first.

---

## January 2026

### January 17, 2026

**New Features**
- **MCP Server (Model Context Protocol)**: Connect external AI assistants like Claude Desktop and Cursor to your Vega data
  - 12 MCP tools: 9 read operations (OKRs, Big Rocks, Strategies, Mission, Vision, Values, Annual Goals, Teams, Meetings) and 3 write operations (update KR progress, add check-in notes, update Big Rock status)
  - Secure API key authentication with bcrypt hashing and short-lived JWT tokens
  - Scope-based permissions for granular access control
  - IP allowlisting with CIDR notation support
  - Key rotation with configurable grace periods
  - Rate limiting (60 requests/minute per tenant)

**Improvements**
- Admin-only access for MCP API key management (create, update, rotate, revoke)
- Full audit logging for all MCP tool invocations

---

### January 13, 2026

**New Features**
- **Clone Big Rocks**: You can now clone Big Rocks to different quarters or years, similar to cloning objectives. Options include keeping the original owner and linked OKRs

**Improvements**
- Annual view in Outcomes now shows all Big Rocks for the year (both quarterly and annual), not just annual-only items

**Bug Fixes**
- AI Executive Insights slide now appears in PowerPoint reports generated from snapshots (previously only appeared for current state reports)

---

### January 11, 2026

**New Features**
- **AI Period Summary in Reports**: GPT-5 generates executive headlines, key themes (max 4), and strategic guidance for your reports
- **Dynamic Date Selection for Reports**: Choose the exact period for your report with appropriate selectors:
  - Weekly reports: Pick from the last 12 weeks
  - Monthly reports: Select any month
  - Quarterly reports: Choose quarter and year
  - Annual reports: Select year

**Improvements**
- Added privacy policy and terms of service links to login page
- Updated social sharing preview image with proper Vega branding
- Reports now use correct date windows (7 days for weekly, 30 days for monthly, etc.) instead of always using quarterly ranges
- AI Period Summary slide added to PowerPoint exports with branded styling

**Performance**
- Added database performance indexes for faster loading of OKRs, check-ins, and meetings

---

### January 10, 2026

**New Features**
- **Delete Check-in**: You can now delete check-ins you've created. When deleted, progress reverts to the previous check-in's values

**Improvements**
- Excel auto-sync now creates proper check-in records with sync notes
- AI-powered check-in rewrite now considers your pace against the period timeline

---

### January 9, 2026

**New Features**
- **Executive Dashboard Personalization**: Customize which sections appear on your executive dashboard
- **OKR Intelligence Phase 1**: Pace badges show whether you're on track, ahead, or behind schedule

**Improvements**
- Behind Pace alerts on Executive Dashboard with severity sorting
- Velocity projections displayed in pace badges

---

## December 2025

### December 31, 2025

**New Features**
- **OKR Period Close-Out**: When checking in on past period items, choose to continue in a new period or close with notes
- **OKR Cloning**: Clone objectives with various scope options and target quarter/year selection

**Improvements**
- Pacific Time detection for period boundaries
- Closing notes are now mandatory when ending an OKR

---

### December 15, 2025 - Version 1.0 Release

**Major Milestone: Production Release**

Vega 1.0 marks our official production release with full Company OS capabilities:

**Core Platform**
- Complete OKR management with hierarchical objectives, Key Results, and Big Rocks
- Strategy development and alignment tools
- Foundations module for mission, vision, values, and annual goals
- Focus Rhythm meeting management with templates and agendas

**Microsoft 365 Integration**
- Microsoft Entra ID single sign-on
- Microsoft Planner integration with bidirectional sync
- OneDrive/SharePoint file picker
- Outlook Calendar sync

**AI-Powered Features**
- Launchpad document analysis for Company OS generation
- AI suggestions for OKRs and Big Rocks
- Streaming chat assistance

**Enterprise Features**
- Multi-tenancy with data isolation
- Role-based access control (6 roles, 20+ permissions)
- Custom vocabulary per tenant
- Custom branding with dark mode support
- PDF and PowerPoint report exports

---

## How to Read This Changelog

- **New Features**: Brand new capabilities added to the platform
- **Improvements**: Enhancements to existing features
- **Bug Fixes**: Issues that have been resolved
- **Performance**: Speed and efficiency improvements
- **Security**: Security-related updates

---

## Feedback

Have suggestions or found an issue? Contact us at [Vega@synozur.com](mailto:Vega@synozur.com)
