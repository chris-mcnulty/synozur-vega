# Vega Platform Backlog

**Last Updated:** November 22, 2025

---

## HIGH PRIORITY (Business-Critical)

### 1. RBAC Enforcement ⚠️ SECURITY GAP

**Status:** Not Started  
**Priority:** Critical  
**Effort:** 2-3 weeks

**Description:**
Role-Based Access Control is defined but not enforced. All authenticated users currently have full access regardless of their assigned role.

**Current State:**
- 6 roles defined: `tenant_user`, `tenant_admin`, `admin`, `global_admin`, `vega_consultant`, `vega_admin`
- Roles assigned to users in database
- NO enforcement on API endpoints or UI

**Requirements:**
- Implement middleware to check user roles on protected routes
- Enforce tenant isolation (users can only access their tenant's data)
- Role-specific UI restrictions (hide features based on permissions)
- Permission matrix documentation

**Future Considerations:**
- **Team Membership (TBD):** Teams may optionally have limited membership, restricting which users can view/edit team-level objectives. This decision is pending and may affect how team-based access control is implemented.

**Business Value:** Essential for production deployment, compliance, and security.

**Dependencies:** None

---

### 2. Microsoft Entra SSO Integration ⭐ NEW

**Status:** Not Started  
**Priority:** High  
**Effort:** 8-12 weeks (3 phases)

**Description:**
Enterprise-grade authentication using Microsoft Entra (Azure AD) SSO with multi-domain support and automatic tenant provisioning.

**Phase 1: SSO Foundation (4-6 weeks)**
- Multi-tenant app registration in Synozur Entra tenant
- `/api/auth/microsoft` callback route implementation
- Auto-provision trial tenants for new domains
- Add `authProvider`, `entraObjectId`, `entraRefreshToken` fields to user schema
- "Sign in with Microsoft" button in login UI
- Dual authentication support (email/password + SSO)

**Phase 2: Graph API Integration (6-8 weeks)**
- Delegated permissions flow for Excel/Planner
- Encrypted token storage system (AES-256)
- Graph API client service
- "Connect Microsoft 365" UI in settings
- OKR import from Excel files
- Planner integration for Big Rocks

**Phase 3: Enterprise Features (4 weeks)**
- Custom app registration support for enterprise customers
- Tenant-specific app registration storage
- Admin consent workflow UI
- Enterprise onboarding documentation

**Business Value:**
- Reduces friction for Microsoft 365 customers (90%+ of enterprise market)
- Enables seamless Excel/Planner data sync
- Enterprise-ready authentication
- Supports self-service and enterprise deployment models

**Technical Notes:**
- See `TECHNICAL_DECISIONS.md` ADR-009 for full architecture
- Requires encrypted refresh token storage
- Multi-tenant app works for any Microsoft user globally
- No customer setup required for basic SSO

**Dependencies:**
- Environment variables: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`
- Schema changes to `users` and `tenants` tables

---

### 3. Focus Rhythm Integration ⭐ NEW

**Status:** Not Started  
**Priority:** High  
**Effort:** 4-6 weeks

**Description:**
Connect weekly/monthly/quarterly/annual meetings to live OKR tracking, creating a continuous improvement loop.

**Features:**
- Meeting templates for different cadences (weekly standup, monthly review, quarterly planning, annual strategy)
- Link meetings to specific objectives, key results, and big rocks
- Log decisions, risks, and assignments per meeting
- Meeting minutes with action items
- Automatic agenda generation based on OKR status
- Meeting history and searchable archives

**Business Value:**
- Closes the execution gap between planning and doing
- Ensures strategic alignment in regular operations
- Creates audit trail for decision-making
- Drives accountability through tracked commitments

**Dependencies:**
- Existing `meetings` table in schema (already present)
- May integrate with Outlook Calendar (Phase 2 of Entra integration)

---

### 4. Culture & Values Integration ✅ COMPLETE

**Status:** Completed (November 22, 2025)  
**Priority:** High  
**Effort:** 3 weeks

**Description:**
Tag objectives and strategies with company values to ensure values-driven decision making.

**Completed Features:**
- ✅ Values with title + description in Foundations module
- ✅ ValueTagSelector component for tagging entities
- ✅ Value tagging for Objectives (NOT Big Rocks - removed as data clutter)
- ✅ Value tagging for Strategies (NOT Big Rocks - removed as data clutter)
- ✅ Display value badges in Objective and Strategy detail views
- ✅ Backend APIs for value tag sync (add, remove, get)
- ✅ Values analytics endpoint (`/api/values/analytics/distribution`)
- ✅ Values alignment dashboard widget showing distribution
- ✅ Value badges displayed in dashboard strategic priorities section
- ✅ Culture statement integration in dashboard (collapsible identity section)

**Business Value:**
- ✅ Reinforces company culture in daily work
- ✅ Provides values-based reporting for leadership via analytics
- ✅ Helps teams make decisions aligned with culture
- ✅ Visual insights into which values drive the most work

**Future Enhancements (moved to MEDIUM priority):**
- Brand voice templates for AI-generated content
- Advanced values-based decision tracking
- Values trend analysis over time

**Dependencies:** None

---

### 5. AI-Powered Assistance ⭐ EXPANDED

**Status:** Not Started  
**Priority:** High  
**Effort:** 8-12 weeks

**Description:**
Chat-based AI assistant with culture-grounded outputs and MCP-style agent architecture.

**Features:**

**Phase 1: Basic AI Chat (4 weeks)**
- Q&A interface for OKR queries ("What are our Q4 objectives?")
- Natural language reporting ("Show me all at-risk initiatives")
- Context-aware responses (tenant-specific, user role aware)

**Phase 2: Culture-Grounded Intelligence (4 weeks)**
- Train on organization's values, mission, vision
- Suggest objectives aligned with strategic priorities
- Draft key results based on historical patterns
- Generate meeting agendas incorporating company culture

**Phase 3: Advanced Agent Features (4 weeks)**
- Human-in-the-loop controls (approve before taking action)
- Meeting prep automation (pull relevant OKRs, past decisions)
- Follow-up reminders and suggestions
- Predictive analytics (risk detection, variance alerts)

**Business Value:**
- Reduces time spent on status reporting by 70%
- Improves strategic alignment through AI-powered suggestions
- Scales consultant expertise through AI
- Differentiator in market (culture-aware AI)

**Technical Notes:**
- OpenAI integration already available via Replit connector
- Requires vector database for RAG (retrieval-augmented generation)
- Consider MCP (Model Context Protocol) for tool use

**Dependencies:**
- OpenAI API key (available)
- Vector database (Pinecone, Weaviate, or PostgreSQL pgvector)

---

### 6. Enhanced Reporting & Snapshots

**Status:** Not Started  
**Priority:** High  
**Effort:** 4-6 weeks

**Description:**
Point-in-time snapshots for audit trails and branded report generation.

**Features:**

**Snapshot System:**
- As-of date snapshots for Objectives, Key Results, Big Rocks
- Snapshot metadata (created date, quarter, year, creator)
- Read-only historical views
- Comparison views (Q3 vs Q4, YoY)

**Report Generation:**
- Weekly status reports (automated)
- Quarterly business reviews (QBRs)
- Annual strategic reports
- PDF export with company branding
- PowerPoint export for board meetings
- Custom report templates

**Business Value:**
- Audit trail for compliance and governance
- Professional client deliverables for consultants
- Historical trend analysis
- Board-ready materials

**Dependencies:**
- Report generation library (e.g., PDFKit, Puppeteer)
- Template engine (Handlebars, EJS)

---

## MEDIUM PRIORITY

### 7. Company OS Export/Import System

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 2-3 weeks

**Description:**
Export and import complete Company OS data for portability, backups, and migrations.

**Features:**
- Export to `.cos` JSON file format
- Tenant-specific and year-specific filtering
- Import to different tenant or server
- Data validation and conflict resolution
- Dry-run import mode (preview changes)

**Use Cases:**
- Data portability between environments
- Backup and disaster recovery
- Testing with production data
- Consultant templates (pre-built Company OS structures)

**Business Value:**
- De-risks platform adoption (no lock-in)
- Enables consultant playbooks
- Supports migration workflows

---

### 8. Customizable Branding ⭐ NEW

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 3-4 weeks

**Description:**
White-label deployments for enterprise customers and consultants.

**Features:**
- Custom logo upload per tenant
- Color scheme customization (primary, secondary, accent)
- Custom domain support (customer.vega.synozur.com)
- Branded email templates
- Custom terminology (rename "Big Rocks" to "Initiatives", etc.)

**Business Value:**
- Enables consultant resale model
- Enterprise sales advantage
- Higher perceived value

**Dependencies:**
- File upload for logos (already supported via tenant.logoUrl)
- CSS variable system (already in place)

---

### 9. Governance & Audit Enhancements ⭐ NEW

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 4-5 weeks

**Description:**
Compliance features for regulated industries and enterprise governance.

**Features:**
- Audit log for all changes (who, what, when)
- Change approval workflows (require approval for strategic changes)
- Version history for all documents
- Compliance reports (SOC 2, ISO 27001 evidence)
- Data retention policies
- GDPR/privacy controls (data export, right to deletion)

**Business Value:**
- Enterprise sales requirement
- Compliance with regulations
- Risk mitigation

---

### 10. Strategic Alignment Mind Map ⭐ NEW

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 2-3 weeks

**Description:**
Interactive visual graph showing how company values, annual goals, strategies, objectives, key results, and big rocks interconnect, filtered by time period.

**Features:**
- React Flow-based interactive graph visualization
- Time period filtering (fiscal year + quarter selector)
- Custom node types for each entity (Values, Goals, Strategies, Objectives, KRs, Big Rocks)
- Distinct edge styling for different relationship types:
  - Values → Goals (foundational alignment)
  - Goals → Strategies (strategic alignment)
  - Strategies → Objectives (execution alignment)
  - Objectives → Key Results (measurement hierarchy)
  - Objectives/KRs → Big Rocks (initiative linking)
  - Big Rocks → Strategies (strategic initiative alignment)
- Auto-layout algorithm with hierarchical positioning
- Interactive features:
  - Hover to highlight connected nodes
  - Click node to view details
  - Pan/zoom controls
  - Toggle visibility by entity type
- Legend explaining node colors and edge types
- Export as PNG/SVG for presentations

**API Endpoint:**
- `GET /api/mindmap/data?tenantId={id}&quarter={q}&year={y}` 
- Returns all interconnected entities with relationships for the specified time period

**Business Value:**
- Visual clarity on strategic alignment
- Quick identification of gaps (unlinked strategies, underutilized values)
- Executive communication tool for board presentations
- Validates strategic coherence across the organization
- Helps consultants diagnose alignment issues

**Technical Notes:**
- Use `@xyflow/react` (formerly react-flow-renderer) for graph rendering
- Transform existing relationships into graph nodes/edges format
- Leverage existing backend relationships (linkedGoals, linkedStrategies, objectiveId, keyResultId)
- Build on existing ValuesAlignmentWidget analytics patterns

**Dependencies:**
- Install `@xyflow/react` package
- Existing relationship data (already implemented)
- No schema changes required

---

## LOWER PRIORITY / FUTURE

### 11. Advanced AI Features ⭐ NEW

**Status:** Not Started  
**Priority:** Low  
**Effort:** TBD

**Features:**
- Predictive analytics (forecast OKR completion probability)
- Variance detection (alert on unusual patterns)
- Sentiment analysis on meeting notes
- Automated insights ("Your team is behind on 3 objectives")

**Business Value:** Differentiation, but not essential for launch.

---

### 12. Sector-Specific Playbooks ⭐ NEW

**Status:** Not Started  
**Priority:** Low  
**Effort:** Ongoing (content creation)

**Description:**
Pre-built Company OS templates for different industries.

**Examples:**
- SaaS startup playbook
- Professional services playbook
- Manufacturing playbook
- Non-profit playbook

**Business Value:** Faster time-to-value, consultant enablement.

---

### 13. Microsoft 365 Deep Integration

**Status:** Infrastructure Ready  
**Priority:** Low (superseded by Entra SSO backlog item)  
**Effort:** Covered in Entra SSO Phase 2

**Description:**
See "Microsoft Entra SSO Integration" (High Priority #2) for full scope.

**Notes:**
- Microsoft Graph Client already in dependencies
- Will be implemented as part of Entra SSO Phase 2

---

### 13. Employee Experience & Engagement ⭐ NEW

**Status:** Not Started  
**Priority:** Low  
**Effort:** TBD

**Description:**
Features to drive employee adoption and engagement with the Company OS.

**Potential Features:**
- Gamification (badges, achievements)
- Personal OKRs linked to team objectives
- Progress notifications and celebrations
- Social features (comments, likes on achievements)
- Mobile app for on-the-go updates

**Business Value:** Increases adoption, but not critical for B2B consultant model.

---

## Recently Completed ✅

### ✅ Dashboard Resilience (November 2025)
Per-section error handling to prevent entire dashboard failure.

### ✅ Values with Descriptions (November 2025)
Enhanced values model to include both title and description.

### ✅ Enhanced OKR System (November 2025)
Hierarchical objectives, weighted key results, rollup progress calculation.

### ✅ Check-In History & Editing (November 2025)
Full check-in history with inline editing capabilities.

### ✅ Entity Relationship Linking (November 2025 - Partial)
- Objectives can link to Strategies and Annual Goals
- Strategies can link to Annual Goals
- Big Rocks can link to Strategies

---

## Quick Wins (Can be done in <1 week)

1. **Values alignment dashboard widget** - Visualize which values are most represented in current work
2. **Email notifications for OKR updates** - Leverage existing SendGrid integration
3. **Keyboard shortcuts** - Power user efficiency
4. **Dark mode refinements** - Already implemented, just needs polish
5. **Export OKRs to CSV** - Simple data export for Excel analysis

---

## Parking Lot (Ideas for Future Consideration)

- Slack/Teams integration for notifications
- Public API for third-party integrations
- Webhooks for external systems
- Mobile app (native iOS/Android)
- Offline mode with sync
- Multi-language support (i18n)
- Advanced charting (Gantt charts, burndown charts)
