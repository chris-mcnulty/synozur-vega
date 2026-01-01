# Vega Platform Master Backlog

**Last Updated:** January 1, 2026 (Company OS Document Export added)

> **Note:** This is the single source of truth for all Vega feature proposals, implementation plans, UX enhancements, known issues, and technical decisions. All coding agents should reference this document for backlog-related questions.

---

## TABLE OF CONTENTS

1. [Executive Summary & Priority Sequence](#executive-summary--priority-sequence)
2. [High Priority Features](#high-priority-features)
3. [Medium Priority Features](#medium-priority-features)
4. [Lower Priority / Future Features](#lower-priority--future-features)
5. [UX Enhancements](#ux-enhancements)
6. [Feature Proposals](#feature-proposals)
7. [Business Success Optimization](#business-success-optimization)
8. [Known Issues & Bugs](#known-issues--bugs)
9. [Technical Decisions](#technical-decisions)
10. [Completed Features](#completed-features)

---

## EXECUTIVE SUMMARY & PRIORITY SEQUENCE

### Current Status Assessment (December 31, 2025)

| Item | Status | Notes |
|------|--------|-------|
| **RBAC** | ✅ 100% | Complete. Fine-grained permissions implemented. |
| **M365 Multi-Tenant** | ✅ ~90% | SSO, Planner, SharePoint/OneDrive, Admin Consent, Outlook Calendar complete. |
| **Focus Rhythm** | ✅ ~85% | Decisions/Risks UI, OKR linking, meeting templates complete. |
| **Culture & Values** | ✅ Complete | |
| **M365 Copilot Agent** | ~60% | OpenAPI spec ✅, Declarative manifest ✅, API plugin ✅, OAuth setup pending |
| **AI-Powered Assistance** | ~40% | 7 AI tools implemented. Q&A chat with function calling works. |
| **AI Usage Reporting** | ✅ Complete | Full implementation with Tenant + Platform admin UI |
| **Enhanced Reporting** | ✅ ~80% | PDF + PPTX export complete. Snapshot comparison remaining. |
| **Export/Import** | ✅ Complete | |
| **Customizable Branding** | ✅ Complete | Full UI with dark mode logo support |
| **Custom Vocabulary** | ✅ Complete | VocabularyContext + system/tenant overrides |
| **Team Mode** | ✅ Complete | /team route with filtered views |
| **Objective Alignment** | ✅ Complete | alignedToObjectiveIds many-to-many |
| **Team Management** | ✅ Complete | CRUD UI in Tenant Admin, API routes, member management |
| **Launchpad** | ✅ Complete | AI document-to-Company OS generator |
| **OKR Cloning** | ✅ Complete | Clone objectives with scope options |
| **OKR Period Close-Out** | ✅ Complete | Pacific Time detection, closing notes, clone prompts |
| **Organized Navigation** | ✅ Complete | Collapsible sidebar sections |

### Recommended Priority Sequence

```
PHASE 1: M365 Copilot Agent Completion (January 2025)
├── OAuth setup in Copilot Studio (pending client Azure AD setup)
├── Testing in M365 dev tenant
└── Client deployment + refinement

PHASE 2: UX Enhancements (January-February 2025)
├── Unified Time Period Selector (1 week)
├── Contextual Breadcrumbs (1 week)
└── OKR Creation Wizard (2 weeks)

PHASE 3: Advanced Features (February-March 2025)
├── Strategy Cascade Visualization (2-3 weeks)
├── OKR Health Scoring & Predictive Analytics (3-4 weeks)
└── Cross-Team Dependencies & Collaboration Hub (2-3 weeks)
```

---

## HIGH PRIORITY FEATURES

### 1. RBAC Enforcement ✅ COMPLETE

**Status:** Complete (January 1, 2026)  
**Priority:** High  

**What's Built:**
- 6 roles defined: `tenant_user`, `tenant_admin`, `admin`, `global_admin`, `vega_consultant`, `vega_admin`
- 20+ permissions defined
- RBAC middleware with role/permission/tenant checking
- All routes protected with authentication
- **Fine-grained permissions (UPDATE_OWN_OKR vs UPDATE_ANY_OKR)**:
  - Server-side: `canUserModifyOKR()` and `canUserDeleteOKR()` helper functions in routes-okr.ts
  - Ownership checks on objective, key result, and big rock update/delete routes
  - Meeting ownership checks (facilitator or attendee can edit/delete)
- **Frontend permission-aware UI**:
  - `usePermissions()` hook in `client/src/hooks/use-permissions.ts`
  - Edit/Delete buttons conditionally hidden in OKRDetailPane and HierarchicalOKRTable
  - Permission checks based on current user, item owner, and item creator

---

### 2. Microsoft 365 Multi-Tenant Integration ✅ ~90% COMPLETE

**Status:** Phase 1 Complete, Minor Enhancements Remaining  
**Priority:** High

**What's Built:**
- Multi-tenant MSAL config with `/common` authority
- Microsoft Entra ID login/callback flow
- JIT user provisioning from SSO
- Tenant mapping via `azureTenantId` or email domain
- SSO policy enforcement
- Planner Integration with OAuth consent
- OneDrive/SharePoint file picker
- Admin consent endpoints
- Outlook Calendar sync

**Remaining:**
- Excel data binding for Key Results
- Incremental consent for Mail.Send

---

### 3. M365 Copilot Agent

**Status:** ~60% Complete  
**Priority:** High (CLIENT REQUIREMENT - January 2025)

**What's Built:**
- ✅ OpenAPI 3.0 specification at `/openapi.yaml` and `/openapi.json`
- ✅ Declarative agent manifest (v1.6)
- ✅ API plugin manifest with OAuth config
- ✅ Response formatting helpers in `server/copilot-response-formatter.ts`

**Remaining:**
- OAuth setup in Copilot Studio (pending client Azure AD setup)
- Testing in M365 dev tenant
- Client deployment + refinement

---

### 4. AI-Powered Assistance

**Status:** ~40% Complete  
**Priority:** High

**What's Built:**
- 7 AI tools with function calling
- Streaming chat interface
- Grounding Documents system with tenant-specific context
- AI usage tracking for cost analysis

**Remaining Work:**
- Vector database for semantic search (pgvector)
- AI-powered search across OKRs
- Meeting prep AI with context retrieval
- Predictive analytics

---

## MEDIUM PRIORITY FEATURES

### Key Result Weighting ✅ COMPLETE

**Status:** Complete (December 31, 2025)  
**Effort:** Complete

**Implementation:**
- Schema has `weight` (default 25) and `isWeightLocked` fields on key_results table
- WeightManager component with auto-balance, normalize, and lock features
- Weight badges displayed in HierarchicalOKRTable with lock indicator
- Weight display in OKRDetailPane for Key Results showing contribution percentage
- Weighted progress calculation in objective rollup
- Weight editing via dialog accessed from objective hover menu

---

### Objective Alignment Visual Indicator (Viva Goals-style)

**Status:** Schema Ready, UI Enhancement Needed  
**Priority:** Low-Medium  
**Effort:** 2-3 days

**Reference:** Viva Goals "Aligned to" display (see attached_assets/IMG_7052_1767222592902.png)

**Description:**
Show a visual indicator when an objective is "aligned to" (ladders up to) a parent objective on a different team or at the organization level. This helps users understand cross-team strategic alignment at a glance.

**What's Already Built:**
- ✅ `alignedToObjectiveIds` field in objectives schema (many-to-many)
- ✅ "Aligned to" section in OKRDetailPane showing aligned objectives
- ✅ Alignment dialog in PlanningEnhanced for setting alignments
- ✅ API support for updating alignments

**Remaining Work:**
1. **Hierarchy Table Indicator**: Add visual badge/icon on objective rows that are aligned to other objectives
2. **Alignment Arrow**: Show ↑ arrow icon with parent objective name on hover
3. **Quick Alignment**: One-click "Align to..." action from objective row menu
4. **Alignment Count Badge**: Show count of aligned children on parent objectives

**UI Reference (Viva Goals):**
- "Aligned to" section with ↑ arrow and parent objective title
- Shows the strategic relationship clearly

**Business Value:**
- Visual clarity on cross-team strategic alignment
- Matches Viva Goals behavior for migrating users
- Helps identify orphaned objectives (not aligned to anything)

**Dependencies:** None (schema already supports this)

---

### Governance & Audit Enhancements

**Status:** Not Started  
**Effort:** 4-5 weeks

Features:
- Audit log for all changes
- Change approval workflows
- Version history
- Compliance reports
- Data retention policies
- GDPR/privacy controls

---

### Strategic Alignment Mind Map

**Status:** Not Started  
**Effort:** 2-3 weeks

Interactive visual graph showing how values, goals, strategies, objectives, KRs, and big rocks interconnect. Uses React Flow.

---

### Dynamic Backlog & Changelog Viewer

**Status:** Not Started  
**Priority:** Low-Medium  
**Effort:** 1-2 days

**Description:**
Expose BACKLOG.md and a changelog file dynamically within the application UI so users and administrators can view upcoming features, known issues, and recent changes without leaving the app.

**Features:**
1. **Backlog Viewer**: Read and render BACKLOG.md as formatted HTML in an admin-accessible page
2. **Changelog Page**: Maintain a CHANGELOG.md and display it for users (version history, release notes)
3. **Access Control**: 
   - Full backlog visible to admins/consultants
   - Condensed "What's New" / release notes visible to all users
4. **Markdown Rendering**: Use existing `react-markdown` package with `remark-gfm` for GitHub-flavored markdown
5. **Navigation**: Add "What's New" or "Release Notes" link in sidebar Personal section

**Technical Approach:**
- API endpoint: `GET /api/docs/:filename` to serve markdown content
- Frontend: New page using `react-markdown` (already installed)
- Role-based filtering for admin-only sections

**Business Value:**
- Transparency on roadmap and upcoming features
- Self-service for users to check release notes
- Reduces support questions about new features
- Professional product experience

**Dependencies:** 
- `react-markdown` (already installed)
- `remark-gfm` (already installed)

---

### Company OS Document Export

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 1-2 weeks

**Description:**
Generate a comprehensive single-document view of an organization's Company OS, exportable as Markdown (with future support for PDF/PPTX). This provides a complete snapshot of the company's strategic framework in a shareable, printable format.

**Features:**
1. **Full Export**: Generate complete document including:
   - Foundation (Mission, Vision, Values, Annual Goals)
   - Strategies with linked values
   - Objectives hierarchy with Key Results and progress
   - Big Rocks with status
   - Team structure (optional)
2. **Filtering Options**:
   - By organizational level (Organization, Division, Team, Individual)
   - By team (specific teams only)
   - By time period (quarter/year)
   - By status (active, completed, all)
3. **Output Formats**:
   - Phase 1: Markdown (.md)
   - Future: PDF, PPTX
4. **Access Control**: Respect RBAC (tenant users see only their tenant)

**Technical Approach:**
- API endpoint: `GET /api/export/company-os` with filter query params
- Server-side markdown generation
- Frontend: Export button in sidebar or Planning page with filter dialog

**Business Value:**
- Board presentations and leadership reviews
- Strategic planning documentation
- Consultant deliverables
- Archival and compliance

**Dependencies:** None

---

## LOWER PRIORITY / FUTURE FEATURES

### Advanced AI Features

- Predictive analytics (forecast OKR completion probability)
- Variance detection
- Sentiment analysis on meeting notes
- AI Big Rock suggestions

### Sector-Specific Playbooks

Pre-built Company OS templates for different industries (SaaS, professional services, manufacturing, non-profit).

### Employee Experience & Engagement

Gamification, personal OKRs, progress notifications, mobile app.

---

## UX ENHANCEMENTS

### ✅ Enhancement 4: Organized Navigation (IMPLEMENTED)

**Status:** Complete (December 30, 2025)

Reorganized sidebar navigation into logical, collapsible sections:

```
📊 Execute (Expanded by default)
├─ Company OS Dashboard
└─ Team Mode

🎯 Plan & Align (Expanded by default)
├─ Foundations
├─ Strategy
└─ Planning

📅 Review & Learn (Collapsed by default)
└─ Focus Rhythm

⚙️ Manage (Admin only, Collapsed by default)
├─ Launchpad
├─ Import Data
├─ Reporting
├─ AI Grounding
└─ Tenant Admin

🛡️ Platform (Platform admins only)
└─ System Admin

👤 Personal (Always visible)
├─ My Settings
├─ User Guide
└─ About
```

**Key Features:**
- Collapsible sections with persistent state
- Smart auto-expand for active page
- Role-based visibility
- Smooth 200ms animations

---

### Enhancement 1: Contextual Breadcrumbs with Quick Actions

**Status:** Documented, Not Implemented  
**Effort:** 1 week  
**Priority:** High

Display navigation path with interactive elements:
```
Planning > Q4 2025 > Marketing Team > Objective > Key Result
```

Features:
- Quick action menu on each breadcrumb segment
- Smart truncation for long paths
- Type indicators (icons) for each level

---

### Enhancement 2: Unified Time Period Selector

**Status:** Documented, Not Implemented  
**Effort:** 1 week  
**Priority:** Critical (RECOMMENDED NEXT)

Global time period component in header:
- Consistent quarter/year selection across modules
- Persistent selection as user navigates
- Quick shortcuts (Current Quarter, Previous Quarter, etc.)

---

### Enhancement 3: Streamlined OKR Creation Wizard

**Status:** Documented, Not Implemented  
**Effort:** 2 weeks  
**Priority:** High

Multi-step wizard: Objective → Key Results → Big Rocks → Review
- Create complete OKR hierarchy in one session
- AI suggestions integrated throughout
- Draft auto-save functionality
- Template library

---

### Enhancement 5: Unified Relationships Panel

**Status:** Documented, Not Implemented  
**Effort:** 2-3 weeks  
**Priority:** Medium

"Relationships" tab on all entity detail views:
- Visual relationship graph
- Quick link/unlink without modals
- Relationship warnings and AI suggestions

---

### Multi-Select Time Period Filter

**Status:** Backlogged  
**Priority:** Medium

Standardized multi-select time period picker allowing selection of multiple quarters/years simultaneously. Reference: Viva Goals time period selector.

---

## FEATURE PROPOSALS

### Strategy Cascade Visualization (Strategy Map)

**Effort:** 2-3 weeks  
**Priority:** Medium

Interactive visual map showing how annual goals flow down to strategies, objectives, key results, and big rocks.

**Key Capabilities:**
- Sankey diagram or tree visualization with color-coded status
- Visual detection of "orphan" items
- Drill-down filtering by team, quarter, or company values
- Exportable for presentations

---

### OKR Health Scoring & Predictive Analytics

**Effort:** 3-4 weeks  
**Priority:** Medium

AI-powered health scoring system with multi-factor scoring:
- Progress Trajectory (30%)
- Check-in Frequency (20%)
- Historical Performance (20%)
- Dependency Health (15%)
- Time Remaining (15%)

Predictive classifications: Likely to Achieve, Needs Attention, At Risk, Unlikely to Achieve

---

### Cross-Team Dependencies & Collaboration Hub

**Effort:** 2-3 weeks  
**Priority:** Medium-High

Formal system for declaring and tracking cross-team dependencies:
- Dependency types: blocking, contributing, informational
- Network graph visualization
- Request/accept workflow with discussion threads
- Auto-integration with Focus Rhythm meeting agendas

---

### Global Command Palette & Keyboard Shortcuts

**Effort:** 1 week  
**Priority:** Medium

Power-user feature (⌘K / Ctrl+K) for fuzzy searching and quick actions:
- Search across all entities
- Navigate shortcuts (G then D for Dashboard, etc.)
- Action commands (New Objective, Quick Check-in)

Uses `cmdk` package (already installed).

---

### Personalized Dashboard Widgets & Pinned Items

**Effort:** 2 weeks  
**Priority:** Medium

Customizable dashboard with drag-and-drop widgets:
- Widget library (My OKRs, Team Health, At-Risk Items, etc.)
- Role-based default layouts
- Pinned items for quick access

---

### Progress Timeline & Activity Feed

**Effort:** 1-2 weeks  
**Priority:** Medium

Visual progress trends and real-time activity feed:
- Interactive line charts showing KR progress over time
- Global activity feed with filters
- Sparkline mini-charts on objective cards

---

## BUSINESS SUCCESS OPTIMIZATION

> **The Big Idea:** Vega becomes not just a tool teams use, but the platform through which organizations become systematically great at execution. These proposals position Vega as the central nervous system for organizational performance - combining predictive AI, behavioral science, network analysis, continuous learning, and ecosystem integration to make goal achievement inevitable rather than aspirational.

**Date:** December 30, 2025 | **Version:** 1.0

---

### Implementation Roadmap

#### Phase 1: Foundation (Q1 2026) - Quick Wins

| Feature | Effort | Impact | Priority | Status |
|---------|--------|--------|----------|--------|
| OKR Quality Scoring | Medium | High | P1 | ✅ DONE |
| Automated Retrospectives | Medium | High | P1 | |
| Enhanced Dependency Risk | Low | Medium | P1 |
| Check-in Habit Features (streaks, nudges) | Low | Medium | P2 |
| Pattern Library v1 | Low | Medium | P2 |

#### Phase 2: Intelligence (Q2 2026) - Differentiation

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| Probabilistic Outcome Forecasting | High | Very High | P1 |
| Collaboration Graph | Medium | High | P1 |
| Leading Indicator Detection | High | High | P2 |
| Meeting Intelligence | Medium | Medium | P2 |

#### Phase 3: Ecosystem (Q3 2026) - Platform Play

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| CRM Integration (Salesforce, HubSpot) | High | Very High | P1 |
| Product Tool Integration (Jira, Linear) | High | High | P1 |
| Strategic Command Center | Medium | High | P2 |
| Bi-directional Workflows | High | High | P2 |

#### Phase 4: Transformation (Q4 2026) - Market Leadership

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| Virtual Strategy Consultant | Very High | Very High | P1 |
| Self-Service Transformation Journeys | High | High | P1 |
| Certification Platform | Medium | Medium | P2 |
| Cross-Organization Benchmarking | High | High | P2 |

---

### Success Metrics

#### Business Impact Metrics

| Metric | Current Baseline | Year 1 Target | Year 2 Target |
|--------|------------------|---------------|---------------|
| Customer OKR Achievement Rate | ~65% | 75% | 85% |
| Time to Value (first successful quarter) | 12 weeks | 8 weeks | 6 weeks |
| Check-in Consistency | 45% weekly | 70% weekly | 85% weekly |
| Strategic Alignment Score | Unknown | 70% | 85% |
| Customer Retention (Vega) | 85% | 92% | 95% |
| NPS (Vega) | Unknown | 45 | 60 |

#### Platform Metrics

| Metric | Target |
|--------|--------|
| Integrations Active per Customer | 3+ |
| AI Recommendations Acted On | 40%+ |
| Forecasting Accuracy | 80%+ |
| Consultant Time Savings | 50%+ |

---

### Pillar 1: Predictive Intelligence Engine

**Vision:** Transform Vega from a **rearview mirror** (tracking what happened) to a **windshield** (predicting what will happen and prescribing what to do).

#### 1.1 Probabilistic Outcome Forecasting

**Current State:** Vega shows progress percentages and status colors, but users must interpret what this means for achieving targets.

**Design Mock:**
```
┌─────────────────────────────────────────────────────────────┐
│  OBJECTIVE: Launch Enterprise Product by Q4                │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  🎯 Probability of Success: 67% (↓ from 72% last week)     │
│                                                             │
│  📊 Monte Carlo Simulation (1000 scenarios):               │
│     ├── 95% Confidence: Complete by Mar 15 - May 22        │
│     ├── Most Likely: Complete by Apr 3                     │
│     └── Current Target: Mar 31                             │
│                                                             │
│  ⚠️ Top Risk Factors:                                       │
│     1. KR3 velocity declining (impact: -12%)               │
│     2. Dependency on Platform Team blocked (impact: -8%)   │
│     3. Historical pattern: Q4 objectives 23% slower        │
│                                                             │
│  💡 AI Recommendations:                                     │
│     "Reallocate 20% capacity from KR1 (ahead of target)    │
│      to KR3. Similar rebalancing improved outcomes by      │
│      34% in analogous situations across 847 organizations."│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Capabilities:**
- **Monte Carlo simulations** using historical check-in velocity, seasonality, and dependency patterns
- **Bayesian probability updates** with each new check-in
- **Cross-organizational learning** (anonymized) to identify patterns like "objectives started in December have 18% lower success rates"
- **Prescriptive interventions** ranked by effort-to-impact ratio
- **What-if scenario modeling**: "If we add one more engineer, success probability increases to 82%"

**Business Impact:**
- Executives can allocate resources proactively, not reactively
- Teams course-correct weeks earlier, salvaging objectives that would have failed
- Organizations learn their own "execution metabolism" and set more realistic targets

#### 1.2 Leading Indicator Detection

**Concept:** Most OKR systems track lagging indicators (revenue, customers acquired). Vega should automatically identify and track leading indicators.

**How It Works:**
1. Analyze historical data to find correlations: "When customer meetings per week drop below 15, revenue objectives fail 80% of the time"
2. Surface these as **Early Warning Metrics** in the dashboard
3. AI generates suggested leading indicator KRs when users create objectives

**Example Output:**
```
"Based on your historical data, 'Website Traffic' is a strong leading 
indicator for 'Qualified Leads Generated'. Traffic typically leads 
conversion by 6-8 weeks. Current traffic trend suggests KR2 will 
be 15% below target. Consider adding a traffic-focused Big Rock."
```

#### 1.3 Organizational Stress Detection

**Concept:** Identify organizational stress before it manifests as missed objectives.

**Signals Monitored:**
- Check-in frequency declining (people avoiding bad news)
- Status updates becoming shorter (engagement dropping)
- Increasing use of "At Risk" without corresponding check-in notes (hiding problems)
- Time between status changes accelerating near quarter-end (panic mode)
- Cross-team dependencies stalling (collaboration breakdown)

**Design Mock:**
```
🏢 Organizational Health: 72/100 (declining)

⚠️ Signals Detected:
- Engineering team check-in frequency dropped 40% in 2 weeks
- 3 dependencies from Product → Engineering unacknowledged for 8+ days
- Executive sponsor hasn't viewed dashboard in 14 days

💡 Suggested Actions:
1. Schedule a "Blockers Amnesty" session with Engineering leadership
2. Escalate stalled dependencies to COO
3. Send automated progress summary to executive sponsors
```

---

### Pillar 2: Behavioral Science Integration

**Vision:** Apply behavioral economics and habit science to make high-performance behaviors **automatic and effortless** rather than requiring willpower.

#### 2.1 Habit-Forming Check-In System

**Current State:** Users must remember to check in. Many don't until reminded (or never).

**Proposed Enhancement: The "2-Minute Check-In" Habit Loop**

**Cue → Routine → Reward Design:**
1. **Smart Timing:** AI learns when each user is most likely to check in (after morning standup? Before weekly 1:1?) and sends contextual nudges
2. **Frictionless Entry:** Voice check-ins via Microsoft Teams bot: "Hey Vega, KR3 is now at 65%"
3. **Immediate Rewards:**
   - Streak counters with visual badges
   - Team leaderboards (opt-in) for check-in consistency
   - "Your updates helped your manager prep for the board in 5 minutes instead of 30"
4. **Variable Rewards:** Occasional "surprise" recognition when check-ins contain particularly useful insights

**Gamification Elements (Tasteful):**
- **Consistency Streaks:** "🔥 14-week check-in streak! You're in the top 5% of contributors"
- **Impact Visibility:** "Your Big Rock completion directly contributed to +$340K pipeline this month"
- **Team Challenges:** "Marketing vs. Sales: Which team hits 100% check-in rate first this quarter?"

#### 2.2 Commitment Devices

**Concept:** Help users pre-commit to outcomes using behavioral science.

**Features:**
- **Public Commitments:** Optional "I'm committed" badge that shows on objectives, creating social accountability
- **Implementation Intentions:** Prompt users to specify *when* and *where* they'll work on Big Rocks ("I will work on the pitch deck every Tuesday from 2-4pm")
- **Premortem Prompts:** When creating objectives, AI asks "Imagine it's end of quarter and you missed this. What went wrong?" This surfaces obstacles early.
- **Ulysses Contracts:** Users can opt to auto-schedule "no meeting" focus time when Big Rocks are at risk

#### 2.3 Friction Engineering

**Concept:** Add strategic friction to harmful behaviors, remove friction from beneficial ones.

**Add Friction To:**
- Changing status to "On Track" without a check-in note (requires explanation)
- Closing an objective without reviewing Key Results (completion ritual)
- Creating objectives without KRs (wizard requires at least 2 KRs)
- Setting unrealistic targets (AI warns based on historical patterns)

**Remove Friction From:**
- Check-ins (1-click, voice, bot)
- Viewing "my priorities" (persistent widget, morning email digest)
- Asking for help (Big Rocks can have "request support" button)
- Celebrating wins (auto-generated "achievements" from closed items)

#### 2.4 Social Proof Engine

**Concept:** Leverage social proof to drive adoption and best practices.

**Features:**
- "Organizations like yours typically have 3-5 org-level objectives per quarter"
- "Teams with weekly Focus Rhythm meetings achieve 34% more of their OKRs"
- "Top performers in your industry average 2.3 Big Rocks per KR"
- Anonymous benchmarking dashboards showing percentile performance

---

### Pillar 3: Organizational Network Intelligence

**Vision:** Map and optimize the **informal networks** through which work actually gets done, not just the formal hierarchy.

#### 3.1 Collaboration Graph

**Concept:** Build a real-time map of how people and teams actually collaborate.

**Data Sources:**
- Shared objective ownership and contributors
- Cross-team dependencies
- Meeting attendees (from Focus Rhythm)
- @mentions in check-in notes
- MS Teams/Slack interaction patterns (with consent)

**Design Mock:**
```
┌─────────────────────────────────────────────────────────────┐
│  COLLABORATION NETWORK - Q4 2025                           │
│                                                             │
│       ┌─────┐                                              │
│       │ Eng │◄────────────┐                                │
│       └──┬──┘             │                                │
│          │                │                                │
│          ▼          Strong collaboration                    │
│     ┌────────┐       ────────────                          │
│     │Product │◄─────►│  Design  │                          │
│     └────────┘       └──────────┘                          │
│          ▲                │                                │
│          │                ▼                                │
│     ┌────────┐       ┌──────────┐                          │
│     │ Sales  │       │Marketing │   Weak link (optimize!)  │
│     └────────┘ · · · └──────────┘   ·····················  │
│                                                             │
│  🔍 Insights:                                               │
│  - Sales ↔ Marketing collaboration 60% below benchmark     │
│  - Design is a hidden bottleneck (highest betweenness)     │
│  - Eng-Product sync optimal; maintain current practices    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Business Value:**
- Identify silos before they cause failures
- Discover hidden influencers and bottlenecks
- Optimize team structures based on actual work patterns
- Predict integration challenges in reorgs

#### 3.2 Influence Mapping

**Concept:** Identify who actually drives outcomes, regardless of title.

**Metrics:**
- **Outcome Influence:** People whose involvement correlates with objective success
- **Network Centrality:** Who connects otherwise-siloed teams
- **Amplification Score:** Whose updates/decisions propagate fastest

**Use Cases:**
- Change management: Identify informal leaders to champion new initiatives
- Succession planning: Who has hidden institutional knowledge?
- Meeting optimization: Who actually needs to be in which meetings?

#### 3.3 Dependency Intelligence

**Current State:** Users manually declare dependencies.

**Proposed Enhancement:**

**Automatic Dependency Detection:**
- AI analyzes objective descriptions to suggest likely dependencies
- Pattern matching: "Every time a team creates 'API' objectives, they need Platform team support"
- Historical analysis: "These two teams' objectives have co-failed 4 of 5 quarters"

**Design Mock - Dependency Risk Scoring:**
```
DEPENDENCY RISK ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your Objective: Launch Mobile App v2.0
Dependencies: 3 identified

┌─────────────────────────────────────────────────────────────┐
│ 1. Platform Team: Auth Service v3         RISK: 🔴 HIGH    │
│    └─ Reason: Team at 120% capacity, 2 objectives behind   │
│    └─ Suggested Action: Escalate to CTO, consider plan B   │
├─────────────────────────────────────────────────────────────┤
│ 2. Design Team: Mobile UI Kit             RISK: 🟡 MEDIUM  │
│    └─ Reason: On track but historically late               │
│    └─ Suggested Action: Request early preview deliverables │
├─────────────────────────────────────────────────────────────┤
│ 3. Legal Team: App Store Compliance       RISK: 🟢 LOW     │
│    └─ Reason: Standard process, team has capacity          │
│    └─ Suggested Action: None needed                        │
└─────────────────────────────────────────────────────────────┘
```

#### 3.4 Meeting Intelligence

**Expand Focus Rhythm into Meeting Optimization:**

- **Meeting ROI Dashboard:** Time spent in meetings vs. OKR progress correlation
- **Attendee Optimization:** "Based on agenda, you may not need [Person X] in this meeting"
- **Meeting Type Analysis:** Which meeting cadences correlate with success?
- **AI-Generated Prep:** Before each meeting, AI summarizes relevant OKR changes
- **Post-Meeting Action Extraction:** AI parses notes and creates/updates Big Rocks

---

### Pillar 4: Adaptive Learning System

**Vision:** Build a **self-improving organization** where every quarter makes the next quarter more successful.

#### 4.1 Automated Retrospectives

**At Quarter-End, AI Generates:**

```markdown
# Q3 2025 Organizational Retrospective
Generated by Vega AI | December 1, 2025

## Executive Summary
This quarter, [Company] achieved 67% of objectives (vs. 58% Q2).
Key improvements in Engineering execution (+23%); opportunities
remain in cross-functional coordination.

## What Worked
1. **Weekly Big Rock reviews** (introduced Q3): Teams using this
   practice achieved 28% more objectives
2. **Reduced objective count**: From avg 8 to 5 per team correlated
   with +15% completion rate
3. **Early dependency declaration**: Teams declaring dependencies
   in week 1 had 40% fewer blockers

## What Didn't Work
1. **Mid-quarter pivots**: 4 objectives were significantly changed
   mid-quarter; 0 achieved target
2. **Individual OKRs**: 23% completion rate (vs. 71% for team OKRs)
3. **Annual objective tracking**: Rarely updated, unclear value

## Data-Driven Recommendations for Q4
1. Cap objectives at 5 per team (data shows diminishing returns)
2. Consider eliminating individual-level OKRs (high overhead, low value)
3. Require dependency mapping in first week of quarter
4. Avoid mid-quarter scope changes unless willing to accept lower targets

## Benchmarking (anonymized, 847 similar organizations)
- Your Q3 completion rate: 67% (74th percentile)
- Check-in frequency: 2.1/week (45th percentile - opportunity!)
- Big Rock effectiveness: 4.2 KR impact per rock (89th percentile)
```

#### 4.2 OKR Quality Scoring

**Real-Time Feedback During OKR Creation:**

```
┌─────────────────────────────────────────────────────────────┐
│  OKR QUALITY SCORE: 72/100                                 │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  Objective: "Improve customer satisfaction"                 │
│                                                             │
│  ⚠️ Issues Found:                                           │
│  ├── Vague language (-10): What does "improve" mean?       │
│  ├── No timeframe (-8): When should this be achieved?      │
│  └── Missing context (-10): Which customers? Which aspect? │
│                                                             │
│  💡 AI Suggestion:                                          │
│  "Increase Enterprise customer NPS from 45 to 60 by        │
│   improving post-sales support response times"              │
│                                                             │
│  ✅ Strengths:                                              │
│  ├── Links to strategy (+10): Aligns with "Customer First" │
│  └── Reasonable scope (+10): Appropriate for team level    │
│                                                             │
│  [Apply AI Suggestion] [Edit Myself] [Skip Suggestions]    │
└─────────────────────────────────────────────────────────────┘
```

**Scoring Dimensions:**
- **Clarity:** Can anyone understand what success looks like?
- **Measurability:** Are Key Results truly quantifiable?
- **Achievability:** Based on historical data, is this realistic?
- **Alignment:** Does this ladder to higher-level objectives?
- **Time-Bound:** Is the timeline clear and appropriate?

#### 4.3 Pattern Library

**Curated best practices from successful organizations:**

- **OKR Templates:** "Here's how 23 high-growth SaaS companies structure their 'Market Expansion' objectives"
- **Big Rock Patterns:** "Most successful product launches include these 5 Big Rock categories"
- **Anti-Patterns:** "Objectives with more than 7 KRs succeed 42% less often"
- **Industry Benchmarks:** "Media companies typically achieve X% of objectives in Q4 (holiday impact)"

#### 4.4 Skill Gap Analysis

**Connect OKR outcomes to capability development:**

```
CAPABILITY ANALYSIS: Engineering Team

Based on Q1-Q3 2025 performance:

✅ Strengths (objectives in these areas achieve 80%+):
   - API Development
   - Infrastructure Scaling
   - Code Quality Initiatives

⚠️ Growth Areas (objectives achieve <50%):
   - Data Pipeline Projects (-23% vs. benchmark)
   - ML/AI Integration (-31% vs. benchmark)
   - Cross-Platform Development (-18% vs. benchmark)

💡 Recommendations:
   1. Consider training investment in Data Engineering
   2. Partner with external consultants for ML projects
   3. Hire 1-2 senior cross-platform specialists

📊 Training ROI Projection:
   If ML capability improves to benchmark:
   +2 additional objectives achievable per year
   Estimated business value: $800K-1.2M
```

---

### Pillar 5: Ecosystem Orchestration

**Vision:** Position Vega as the **strategic layer** that sits above all operational tools, providing unified visibility and orchestration.

#### 5.1 Universal Data Connectors

**Expand Beyond M365:**

| Category | Integrations | Value |
|----------|--------------|-------|
| **CRM** | Salesforce, HubSpot | Auto-populate revenue KRs from actual pipeline |
| **Product** | Jira, Linear, Asana | Big Rocks sync with epics/projects |
| **Analytics** | Mixpanel, Amplitude, GA4 | Real-time KR metrics from product data |
| **Finance** | QuickBooks, Xero, NetSuite | Financial KRs pull actual numbers |
| **HR** | Workday, BambooHR | Headcount, engagement data |
| **Engineering** | GitHub, GitLab | Deployment velocity, PR metrics |
| **Support** | Zendesk, Intercom | Customer satisfaction metrics |
| **Marketing** | HubSpot, Marketo | Pipeline, campaign metrics |

**Implementation Pattern:**
```
DATA SOURCE → Vega Metric → Key Result

Example:
Salesforce Closed-Won → KR: "$5M New ARR" → Auto-updates daily
GitHub Merged PRs → KR: "Ship 12 features" → Real-time progress
NPS Survey Tool → KR: "NPS > 50" → Updates after each survey
```

#### 5.2 Bi-Directional Action Orchestration

**Not just reading data—driving action:**

```
When KR "Reduce ticket resolution time to <4 hours" hits At Risk:
├── Auto-create Jira epic: "Support Optimization Sprint"
├── Slack notification to Support Lead
├── Add to next Monday's Focus Rhythm meeting agenda
└── Schedule AI-generated intervention meeting
```

**Workflow Automation Examples:**
- **OKR Created** → Auto-create Slack channel for objective
- **Big Rock Completed** → Trigger celebration message, update related KRs
- **Dependency Blocked** → Escalation workflow, notify stakeholders
- **Quarter Ends** → Generate reports, archive data, create next quarter structure

#### 5.3 Strategic Command Center

**Single pane of glass for executives:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  STRATEGIC COMMAND CENTER - Live                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  📊 COMPANY HEALTH                    🎯 QUARTERLY PULSE             │
│  ───────────────                      ─────────────────              │
│  Overall OKR Progress: 62%            Days Remaining: 34            │
│  Revenue vs Target: 94% ▲             At-Risk Items: 7 (↓2)         │
│  Customer NPS: 52 (▲4)                Blocked Dependencies: 3       │
│  Employee Engagement: 71%             Check-in Rate: 78%            │
│                                                                      │
│  🔥 NEEDS ATTENTION                   ✅ WINNING                     │
│  ─────────────────                    ────────                       │
│  • Platform Team at 140% capacity     • Mobile launch ahead 2 weeks │
│  • 3 unfilled critical roles          • Customer retention +12%     │
│  • Enterprise deal X stalled          • Engineering velocity +23%   │
│                                                                      │
│  📈 LIVE METRICS (from connected systems)                           │
│  ─────────────────────────────────────────                          │
│  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░│ ARR: $12.4M of $15M target                │
│  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░│ Pipeline: $8.2M of $10M target             │
│  │▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░│ MAU: 45K of 75K target                     │
│                                                                      │
│  [View Strategy Map] [Risk Dashboard] [Generate Board Report]       │
└─────────────────────────────────────────────────────────────────────┘
```

#### 5.4 AI Strategy Assistant

**Beyond Chat—Proactive Strategic Guidance:**

```
🤖 Vega Strategy Assistant
━━━━━━━━━━━━━━━━━━━━━━━━━

Good morning, Sarah. Here's your strategic briefing:

📊 OVERNIGHT CHANGES
• Pipeline deal "Enterprise Corp" moved to Closed-Won ($340K)
  → Revenue KR now at 94% (was 87%)
• GitHub: 3 major features merged
  → "Ship 12 features" KR now at 92% (was 75%)

⚠️ ATTENTION NEEDED
• Customer X escalated support ticket (NPS survey pending)
  → Risk to "NPS > 50" objective
  → Recommend: Proactive exec outreach before survey

💡 OPPORTUNITY DETECTED
• Your Q4 objectives are 89% aligned to Annual Goal #1
  but only 23% aligned to Annual Goal #3 (Market Expansion)
  → Consider adding objectives next quarter, or rebalance

📅 TODAY'S PRIORITIES (based on OKR impact)
1. Review stalled Platform dependency (blocks 2 objectives)
2. Approve Marketing budget (enables 3 Big Rocks)
3. 1:1 with Engineering Lead (2 at-risk items)

[Start Focus Mode] [View Full Dashboard] [Generate Report]
```

---

### Pillar 6: Consultant-as-a-Platform

**Vision:** Encode the expertise of the best OKR/strategy consultants into the platform, providing **enterprise-grade strategic consulting** at scale.

#### 6.1 Virtual Strategy Consultant

**AI-Powered Strategic Advisory:**

- **Annual Planning Facilitation:** AI guides executives through a structured annual planning process, asking the right questions, surfacing data, and documenting decisions
- **OKR Coaching:** Real-time guidance during OKR creation: "This objective seems tactical. Would you like to explore more strategic alternatives?"
- **Quarterly Review Facilitation:** AI-generated agendas, pre-populated with data and suggested discussion points
- **Best Practice Injection:** "Based on your industry and size, organizations typically set X objectives with Y KRs"

#### 6.2 Consultant Toolkit (for Human Consultants)

**Empower the Synozur Alliance consultants:**

- **Client Readiness Assessment:** Automated maturity scoring before engagement
- **Diagnostic Dashboard:** Instant view of client's strategic health
- **Intervention Playbooks:** Guided workflows for common challenges
- **Before/After Reporting:** Demonstrate impact of consulting engagements
- **Template Library:** Consultant-curated best-in-class examples

#### 6.3 Self-Service Strategic Transformation

**Guided journeys for organizations without consultants:**

```
VEGA TRANSFORMATION JOURNEYS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Choose your path:

🚀 First 90 Days with OKRs
   12-week guided implementation for OKR beginners
   ├── Week 1-2: Foundation setup (mission, vision, values)
   ├── Week 3-4: First OKR workshop (guided)
   ├── Week 5-8: First quarter execution with coaching
   └── Week 9-12: Review, learn, plan next quarter

📈 Scaling OKRs Company-Wide
   For organizations ready to expand beyond pilot teams
   ├── Alignment workshop template
   ├── Manager training modules
   ├── Rollout communication templates
   └── Success measurement framework

🔄 Turnaround: Fixing Broken OKRs
   For organizations struggling with OKR adoption
   ├── Diagnostic assessment
   ├── Common failure pattern identification
   ├── Reset playbook
   └── Sustained adoption program

💡 Advanced: OKRs + Culture Transformation
   Integrating OKRs with values and culture work
```

#### 6.4 Certification & Training Platform

**Build organizational capability:**

- **OKR Champion Certification:** Online course + assessment for internal OKR leaders
- **Executive OKR Briefing:** 30-minute interactive module for C-suite
- **Manager Coaching Modules:** How to coach teams on OKRs
- **Progress Tracking:** Which teams have certified champions?

---

### Competitive Differentiation

#### vs. Lattice/15Five/Culture Amp
These focus on performance management and engagement. Vega focuses on **strategic execution** with OKRs as the core, integrating with these tools rather than competing.

#### vs. Workboard/Perdoo/Gtmhub
These are OKR-focused but treat OKRs as a **tracking system**. Vega positions OKRs as part of a complete **Operating System** that includes AI-driven insights, behavioral science, and ecosystem orchestration.

#### vs. Asana/Monday/ClickUp
These are project/task management tools. Vega operates at the **strategy layer**, integrating with these tools to provide strategic context to tactical work.

#### Vega's Unique Position

```
                    STRATEGIC ────────────────────── TACTICAL
                         │
                         │   ┌─────────────────────┐
                         │   │       VEGA          │
                         │   │  Strategic Command  │
                         │   │  Center + AI        │
                         │   └─────────┬───────────┘
                         │             │
    HIGH ───────────────►│   ┌─────────▼───────────┐
    AI/INTELLIGENCE      │   │   OKR + Strategy    │
                         │   │   Engine            │
                         │   └─────────┬───────────┘
                         │             │
                         │   ┌─────────▼───────────┐
                         │   │  Ecosystem Layer    │
                         │   │  (Integrations)     │
    LOW ────────────────►│   └─────────────────────┘
                         │
```

---

### Next Steps

1. Prioritize proposals based on customer feedback and strategic fit
2. Create detailed technical specifications for Phase 1 items
3. Identify pilot customers for early access programs
4. Build POC for Probabilistic Forecasting (highest impact)
5. Begin integration partnerships (Salesforce, Jira)

> *"The best-run companies don't just set goals—they build systems that make achieving goals inevitable. Vega is that system."*

---

## KNOWN ISSUES & BUGS

### Production SSO Session Persistence Bug ✅ FIXED

**Status:** Resolved (December 2025)

Session cookie now persists correctly after Microsoft SSO redirect.

---

### Microsoft Planner Integration Issues

**Status:** Partially Working  
**Severity:** Medium

Current Issues:
1. Token dependency on Outlook connection
2. Scope limitations (read-only with Tasks.Read)
3. Rate limiting (100 req/10 sec)
4. No automatic sync scheduler

---

### Microsoft SharePoint Integration Issues

**Status:** Partially Working  
**Severity:** Medium

Current Issues:
1. Sites.Selected permission limitations
2. URL resolution issues on certain formats
3. Drive discovery may miss some libraries

---

### TypeScript Circular Reference in Schema

**Status:** Known  
**Severity:** Low

Self-referencing types in `shared/schema.ts` cause implicit 'any' warnings. Does not affect runtime.

---

## TECHNICAL DECISIONS

### ADR-001: Session-Based Authentication

Use Express sessions with PostgreSQL storage instead of JWT tokens.
- Server-side session control
- Easy to invalidate sessions
- Works with existing PostgreSQL infrastructure

### ADR-002: Multi-Tenancy via tenantId

Implement multi-tenancy through `tenantId` foreign key on all scoped tables.
- Single database to manage
- Cross-tenant reporting possible
- Easy backup/recovery

### ADR-003: PostgreSQL with Drizzle ORM

Use PostgreSQL (Neon) with Drizzle ORM for type-safe database access.
- TypeScript-first ORM
- Excellent type inference
- Simple migrations with `npm run db:push`

### ADR-004: UUID Primary Keys

Use PostgreSQL `gen_random_uuid()` for all primary keys.
- Globally unique
- Non-sequential (security benefit)
- Easier data merging/imports

### ADR-005: TanStack Query for State Management

Use TanStack Query (React Query) for server state.
- Built-in caching and deduplication
- Automatic loading states
- Optimistic updates

### ADR-006: Shadcn/UI Component Library

Use shadcn/ui (Radix UI primitives) for consistent, accessible UI components.
- Full design control
- No version conflicts
- Highly customizable

### ADR-007: Pacific Time for All Date Operations

All date/time operations use America/Los_Angeles timezone.
- Prevents timezone misdating issues
- Consistent period detection for OKRs
- Used in `isPeriodEnded()` helper

---

## COMPLETED FEATURES

### OKR Period Close-Out ✅ (December 31, 2025)

When checking in on objectives/KRs from a past period:
- Prompts user to continue in new period (opens clone dialog) or close
- Mandatory closing note when closing
- Uses Pacific Time for period detection
- Period-ended uses amber styling, target-exceeded uses green
- Closing notes persisted to database

### OKR Cloning ✅ (December 20, 2025)

Clone objectives with various scope options:
- Clone only objective, immediate children, or full hierarchy
- Target quarter/year selection
- Keep or reassign owner
- Progress reset to 0%

### Launchpad ✅ (December 20, 2025)

AI-powered document analysis for extracting and creating foundational company elements from uploaded strategic documents.

### Team Management ✅ (December 20, 2025)

Full CRUD UI in Tenant Admin:
- Team table with name, description, leader, member count
- Create/edit/delete teams
- Member management

### AI Usage Reporting ✅ (December 17, 2025)

Full implementation with Tenant + Platform admin UI for tracking AI provider/model usage and costs.

### Customizable Branding ✅ (December 2025)

White-label deployments:
- Logo URLs (primary, dark mode, favicon)
- Color scheme customization
- Report branding
- Dark mode logo support in sidebar

### Export/Import System ✅ (December 2025)

Export and import complete Company OS data:
- `.cos` JSON file format
- Duplicate handling strategies
- ID remapping for cross-tenant imports

### Custom Vocabulary ✅ (December 2025)

VocabularyContext with system-level defaults and tenant-level overrides for customizing terminology (Objective → Outcome, Key Result → Metric, etc.).

### Organized Navigation ✅ (December 30, 2025)

Collapsible sidebar sections organized by purpose (Execute, Plan & Align, Review & Learn, Manage, Platform, Personal).

---

## IMPLEMENTATION NOTES

### Quick Wins Available

1. **Unified Time Period Selector** - Foundational UX improvement, medium effort
2. **Contextual Breadcrumbs** - High value for navigation clarity
3. **Command Palette** - Uses already-installed `cmdk` package

### Schema Changes Required

For future features requiring database changes:
- Dependencies table (for cross-team dependencies)
- Health scores table (for predictive analytics)
- User dashboard layouts table (for personalized widgets)

### Dependencies

- `@xyflow/react` - For mind map/strategy visualization
- `cmdk` - Already installed for command palette
- `recharts` - Already installed for progress charts
- `pgvector` - For semantic search (extension to enable)

---

**For questions about this backlog, consult replit.md for project architecture context.**
