# Vega Feature Implementation Plans

**Status**: Import MVP Complete ✅  
**Remaining Features**: 7 major enhancements  
**Total Estimated Effort**: 3-4 weeks (spread across sprints)

---

## ✅ COMPLETED: Viva Goals Import Feature

**Status**: MVP Complete  
**Deliverables**:
- ✅ Database schema extended (phased targets, goal type, teams, review snapshots, import history)
- ✅ Backend import service (server/viva-goals-importer.ts)
- ✅ API endpoint (/api/import/viva-goals)
- ✅ Frontend UI (/import page with file upload, options, history)
- ✅ Entity mapping (Viva Big rocks → Vega Objectives, Viva KPIs → Vega Key Results, Viva Projects → Vega Big Rocks)
- ✅ Check-in history import
- ✅ Phased targets preservation (stored for future feature)

**How to Use**:
1. Export data from Viva Goals (Organization > Settings > Export)
2. Go to /import page in Vega
3. Upload ZIP file, configure options
4. Review import summary and warnings

---

## 🎯 FEATURE 1: Phased Targets / Milestones UI

**Priority**: HIGH  
**Effort**: 1-2 weeks  
**Business Value**: Critical for long-term annual objectives

### Description
Allow users to define progressive target values over time (milestones) for Objectives and Key Results. This helps teams track if they're on pace and provides early warning signals.

### Database Schema
✅ Already added:
```typescript
phasedTargets: jsonb("phased_targets").$type<{
  interval: 'monthly' | 'quarterly' | 'custom';
  targets: Array<{
    targetValue: number;
    targetDate: string;
  }>;
}>()
```

### Implementation Plan

#### Phase 1: Backend API (2-3 days)
1. **Storage methods** (`server/storage.ts`):
   ```typescript
   updateObjectivePhasedTargets(id: string, phasedTargets: PhasedTargets): Promise<Objective>
   updateKeyResultPhasedTargets(id: string, phasedTargets: PhasedTargets): Promise<KeyResult>
   ```

2. **API endpoints** (`server/routes-okr.ts`):
   ```
   PATCH /api/okr/objectives/:id/phased-targets
   PATCH /api/okr/key-results/:id/phased-targets
   ```

3. **Validation**:
   - Target dates must be chronologically ordered
   - Target values must be progressive (increasing for "increase" metrics, decreasing for "decrease")
   - Dates must fall within objective/KR time period

#### Phase 2: Frontend Components (4-5 days)
1. **Milestone Editor Component** (`client/src/components/okr/MilestoneEditor.tsx`):
   - Add/edit/remove milestones
   - Auto-suggest monthly/quarterly intervals
   - Date picker for custom milestones
   - Value input with unit display

2. **Milestone Timeline Visualization** (`client/src/components/okr/MilestoneTimeline.tsx`):
   - Horizontal timeline with milestones marked
   - Current progress indicator
   - "On pace" / "Behind pace" / "Ahead of pace" status
   - Visual distinction between achieved and upcoming milestones

3. **Integration Points**:
   - Add "Set Milestones" button to Objective/KR detail view
   - Show milestone progress in OKR tree view (mini timeline)
   - Display milestone status in check-in modal

#### Phase 3: Progress Tracking (2-3 days)
1. **Milestone Achievement Detection**:
   - Automatically mark milestones as achieved when progress crosses target
   - Calculate "pace" metric: compare current progress to expected progress at current date

2. **Alerts**:
   - Show warning badge if behind pace by >10%
   - Highlight next upcoming milestone in UI

### UI/UX Mock

```
┌─────────────────────────────────────────────────────┐
│ Objective: Launch new website                      │
│ Progress: 45% (Behind Pace: 5%)                     │
│                                                      │
│ Milestones                                           │
│ ┌──────────────────────────────────────────┐       │
│ │ ●───●───●───○───○   Timeline              │       │
│ │ Jan Mar Jun Sep Dec                        │       │
│ │ 20% 40% 60% 80% 100%                       │       │
│ │                                            │       │
│ │ ✓ Design complete (Mar 31) - 40%         │       │
│ │ → Development (Jun 30) - 60% [NEXT]       │       │
│ │ ○ Testing (Sep 30) - 80%                  │       │
│ │ ○ Launch (Dec 31) - 100%                  │       │
│ └────────────────────────────────────────────┘       │
│                                                      │
│ [+ Add Milestone] [Edit Milestones]                │
└─────────────────────────────────────────────────────┘
```

### Testing
- Test milestone CRUD operations
- Test timeline rendering with various intervals
- Test pace calculation accuracy
- Test edge cases (past due milestones, future objectives)

---

## 📊 FEATURE 2: Progress Line Charts

**Priority**: HIGH  
**Effort**: 4-5 days  
**Business Value**: Visual insight into progress trends

### Description
Historical line charts showing how Objective/KR progress changed over time. Helps identify momentum, stalls, and trends.

### Implementation Plan

#### Phase 1: Data Aggregation (2 days)
1. **Check-in history query**:
   - Already have check_ins table with `as_of_date` and `new_progress`
   - Group by week/month for chart data points
   - Include phased targets as reference lines

2. **API endpoint** (`server/routes-okr.ts`):
   ```
   GET /api/okr/objectives/:id/progress-history?groupBy=week|month
   GET /api/okr/key-results/:id/progress-history?groupBy=week|month
   ```

#### Phase 2: Chart Component (2-3 days)
1. **Line Chart Component** (`client/src/components/okr/ProgressChart.tsx`):
   - Use recharts library (already installed)
   - X-axis: Time (weeks or months)
   - Y-axis: Progress percentage (0-100%)
   - Multiple lines:
     - Actual progress (blue)
     - Phased target line (gray dashed)
     - Trend line (green if on track, red if behind)

2. **Features**:
   - Tooltip showing check-in notes on hover
   - Toggle between weekly/monthly granularity
   - Export chart as image
   - Zoom/pan for long time periods

3. **Integration**:
   - Add "Progress Chart" tab in Objective/KR detail view
   - Embed mini chart in dashboard for key objectives

### UI/UX Mock

```
┌─────────────────────────────────────────────────────┐
│ Progress Over Time - Q1 2025                        │
│                                                      │
│ 100% ┤                                        ╭─    │
│      │                                    ╭──╯      │
│  80% ┤                                ╭──╯   Target │
│      │                            ╭──╯              │
│  60% ┤                        ╭──╯                  │
│      │                    ╭──╯                      │
│  40% ┤                ╭──╯   Actual                 │
│      │            ╭──╯                              │
│  20% ┤        ╭──╯                                  │
│      │    ╭──╯                                      │
│   0% └────┴───┴───┴───┴───┴───┴───┴───┴───┴───┴──  │
│      Jan  Feb  Mar  Apr  May  Jun                   │
│                                                      │
│ ● Check-ins (5)  --- Target  — Actual               │
│ [Weekly] [Monthly] [Export PNG]                     │
└─────────────────────────────────────────────────────┘
```

### Technical Details
```typescript
// API Response
{
  dataPoints: [
    { date: '2025-01-05', progress: 10, note: 'Kickoff complete' },
    { date: '2025-01-12', progress: 15, note: null },
    { date: '2025-01-19', progress: 22, note: 'Phase 1 done' },
    // ...
  ],
  targetLine: [
    { date: '2025-01-01', value: 0 },
    { date: '2025-03-31', value: 100 }
  ]
}

// Chart Configuration
<Line type="monotone" dataKey="progress" stroke="#810FFB" strokeWidth={2} />
<Line type="monotone" dataKey="target" stroke="#888" strokeDasharray="5 5" />
```

---

## 🏢 FEATURE 3: Team/Divisional OKRs with Rollup

**Priority**: HIGH  
**Effort**: 2 weeks  
**Business Value**: Essential for medium/large organizations

### Description
Create team-level OKRs that roll up to organization-level OKRs. Enables divisions/departments to have their own objectives while contributing to company goals.

### Database Schema
✅ Already added `teams` table with hierarchical structure

### Implementation Plan

#### Phase 1: Team Management (3-4 days)
1. **Team CRUD** (`server/storage.ts`, `server/routes-okr.ts`):
   ```
   GET /api/teams
   POST /api/teams
   PATCH /api/teams/:id
   DELETE /api/teams/:id
   ```

2. **Team hierarchy**:
   - Parent-child relationships
   - Level 0: Organization
   - Level 1: Divisions (e.g., Sales, Marketing, Engineering)
   - Level 2: Departments (e.g., Sales North America, Sales EMEA)

3. **Team UI** (`client/src/pages/Teams.tsx`):
   - Tree view of team hierarchy
   - Add/edit/delete teams
   - Assign team leaders and members

#### Phase 2: Team-level Objectives (4-5 days)
1. **Extend objectives table** (already has `teamId` field):
   - Filter objectives by team
   - Assign ownership at team level

2. **Team OKR View** (`client/src/pages/PlanningEnhanced.tsx` enhancement):
   - Toggle between Organization view and Team view
   - Filter dropdown to select specific team
   - Show parent objectives (from organization or parent team)

3. **Alignment logic**:
   - Team objectives can align to organization objectives
   - Department objectives can align to division objectives
   - Key results always contribute to parent objective progress

#### Phase 3: Progress Rollup (3-4 days)
1. **Rollup calculation**:
   - Organization progress = weighted average of division progress
   - Division progress = weighted average of department progress
   - Auto-update parent progress when child progress changes

2. **API enhancement**:
   ```
   GET /api/okr/objectives/:id/rollup-summary
   Returns:
   {
     teamContributions: [
       { teamId, teamName, progress, weight },
       ...
     ],
     totalProgress: 65
   }
   ```

3. **Rollup visualization**:
   - Stacked bar chart showing team contributions
   - Breakdown modal showing which teams are on/off track

### UI/UX Mock

```
┌─────────────────────────────────────────────────────┐
│ Planning - 2025 Q1                                  │
│ View: [Organization ▼] [Sales Division ▼]          │
│                                                      │
│ ┌ Organization Objectives (3)                      │
│ │ ○ Increase revenue by 25%  [75%] ────────●──     │
│ │   ├─ Sales Division [80%]  ■■■■■■■■□□          │
│ │   ├─ Marketing Division [70%]  ■■■■■■■□□□       │
│ │   └─ Product Division [75%]  ■■■■■■■■□□         │
│ │                                                    │
│ │ ○ Launch 3 new products  [33%] ──●─────────      │
│ │   ├─ Product Division [50%]  ■■■■■□□□□□         │
│ │   └─ Engineering Division [25%]  ■■□□□□□□□□     │
│ └                                                    │
│                                                      │
│ [+ Add Organization Objective]                      │
└─────────────────────────────────────────────────────┘
```

### Testing
- Test team CRUD operations
- Test hierarchical team structure (3 levels)
- Test objective assignment to teams
- Test rollup calculation accuracy
- Test cascading updates (child → parent)

---

## 📧 FEATURE 4: Weekly Email Reminders

**Priority**: MEDIUM  
**Effort**: 1 week  
**Business Value**: Increases check-in completion rates

### Description
Automated weekly email reminders to Objective/KR owners for overdue check-ins. Uses SendGrid (already configured).

### Implementation Plan

#### Phase 1: Detection Logic (2 days)
1. **Overdue check-in query** (`server/storage.ts`):
   ```typescript
   getOverdueCheckIns(tenantId: string): Promise<{
     objective?: Objective,
     keyResult?: KeyResult,
     owner: User,
     daysSinceLastCheckIn: number
   }[]>
   ```

2. **Criteria for "overdue"**:
   - No check-in in last 7 days (configurable per objective)
   - Objective/KR is active (not completed/cancelled)
   - Within current time period

#### Phase 2: Email Service (2-3 days)
1. **Email template** (`server/email-templates/check-in-reminder.ts`):
   ```html
   Subject: [Vega] Check-in reminder for "{Objective Title}"
   
   Hi {Owner Name},
   
   You haven't checked in on "{Objective Title}" in {X} days.
   
   Current progress: {Y}%
   Target: {Z}% by {Date}
   
   [Update Progress →]
   
   Quick update helps your team stay aligned!
   ```

2. **SendGrid integration** (`server/email.ts`):
   - Use existing SendGrid connector
   - Batch send (max 100 per request)
   - Track sent reminders to avoid duplicates

#### Phase 3: Scheduler (2-3 days)
1. **Cron job** (Node.js or external scheduler):
   - Run every Monday 9am (configurable)
   - Query overdue check-ins
   - Send reminder emails
   - Log reminder history

2. **Implementation options**:
   - Option A: Use `node-cron` library (simpler)
   - Option B: Use external service (GitHub Actions, Cloudflare Workers) for reliability

3. **User preferences**:
   - Allow users to opt out of reminders
   - Configure reminder frequency (daily, weekly, biweekly)
   - Set preferred time

### Email Design

```
┌─────────────────────────────────────────────────────┐
│ [VEGA Logo]                                         │
│                                                      │
│ Hi Chris,                                           │
│                                                      │
│ You haven't checked in on your objective in 8 days:│
│                                                      │
│ ┌──────────────────────────────────────────────┐  │
│ │ "Increase brand awareness and credibility"   │  │
│ │                                               │  │
│ │ Current: 45% ■■■■□□□□□□                     │  │
│ │ Target: 60% by Mar 31                         │  │
│ │                                               │  │
│ │ Status: Behind (15% gap)                      │  │
│ └──────────────────────────────────────────────┘  │
│                                                      │
│ [Update Progress →] Button                          │
│                                                      │
│ Quick check-ins help your team stay aligned and     │
│ identify blockers early.                            │
│                                                      │
│ ─────────                                           │
│ Unsubscribe | Notification Settings                 │
└─────────────────────────────────────────────────────┘
```

### Testing
- Test overdue detection query
- Test email template rendering
- Test SendGrid batch sending
- Test reminder deduplication
- Test opt-out functionality

---

## 🤖 FEATURE 5: AI-Powered OKR Generator

**Priority**: MEDIUM  
**Effort**: 2 weeks  
**Business Value**: Massive time savings, better OKR quality

### Description
Upload a strategic document (PDF, Word, text) and use OpenAI to automatically propose a hierarchy of Objectives and Key Results.

### Implementation Plan

#### Phase 1: Document Upload & Parsing (2-3 days)
1. **File upload endpoint** (`server/routes-import.ts`):
   ```
   POST /api/ai/generate-okrs
   Content-Type: multipart/form-data
   Body: file (PDF, DOCX, TXT)
   ```

2. **Text extraction**:
   - PDF: Use `pdf-parse` library
   - DOCX: Use `mammoth` library
   - TXT: Direct read

3. **Document preprocessing**:
   - Extract headings and structure
   - Chunk long documents (max 8000 tokens per chunk)

#### Phase 2: OpenAI Integration (3-4 days)
1. **Use existing OpenAI integration** (already configured):
   ```typescript
   import OpenAI from 'openai';
   const openai = new OpenAI({
     apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
   });
   ```

2. **Prompt engineering**:
   ```
   You are an expert OKR (Objectives and Key Results) consultant.
   
   Given this strategic document, generate 3-5 quarterly objectives with 3-4 key results each.
   
   Rules:
   - Objectives must be ambitious, qualitative, and inspirational
   - Key Results must be specific, measurable, and time-bound
   - Include metric type (increase/decrease), unit, start value, and target value
   - Align with best practices (Google, Intel OKR frameworks)
   
   Document:
   {text}
   
   Output as JSON: { objectives: [ { title, description, keyResults: [...] } ] }
   ```

3. **Response parsing**:
   - Extract JSON from GPT response
   - Validate structure
   - Map to Vega schema

#### Phase 3: Review & Edit UI (4-5 days)
1. **AI Generation Page** (`client/src/pages/AIGenerator.tsx`):
   - Upload document
   - Show loading state (can take 10-30 seconds)
   - Display generated OKR hierarchy in tree view

2. **Edit interface**:
   - Inline editing of titles, descriptions
   - Add/remove objectives and key results
   - Adjust metrics and targets
   - Regenerate specific sections

3. **Import flow**:
   - Review proposed OKRs
   - Select which ones to import
   - Bulk create selected OKRs
   - Assign owners after import

### UI/UX Mock

```
┌─────────────────────────────────────────────────────┐
│ AI-Powered OKR Generator                            │
│                                                      │
│ Step 1: Upload Document                             │
│ ┌────────────────────────────────────────┐         │
│ │ Drop strategic plan PDF here or browse │         │
│ └────────────────────────────────────────┘         │
│ Supported: PDF, DOCX, TXT (max 10MB)                │
│                                                      │
│ [Upload & Generate] Button                          │
│                                                      │
│ ───────────────────────────────────────────         │
│                                                      │
│ Generated OKRs (Review & Edit)                      │
│                                                      │
│ ☑ Objective 1: Accelerate market expansion          │
│   ☑ KR1: Increase revenue from $5M to $8M (+60%)   │
│   ☑ KR2: Launch in 3 new markets (0 → 3)           │
│   ☑ KR3: Acquire 500 new customers (150 → 650)     │
│   ☐ KR4: Reduce CAC from $200 to $150 (-25%)       │
│                                                      │
│ ☑ Objective 2: Build world-class product            │
│   ☑ KR1: Achieve 4.5/5 star rating (3.8 → 4.5)     │
│   ☐ KR2: Reduce bug count by 50% (100 → 50)        │
│                                                      │
│ [← Back] [Import Selected (6/8)] Button             │
└─────────────────────────────────────────────────────┘
```

### Testing
- Test document upload (various formats)
- Test text extraction quality
- Test OpenAI API response handling
- Test JSON parsing robustness
- Test bulk import of generated OKRs

---

## 📸 FEATURE 6: Custom Review Dashboards (Focus Rhythm Integration)

**Priority**: MEDIUM  
**Effort**: 1.5 weeks  
**Business Value**: Executive-level reporting, board presentations

### Description
Create point-in-time snapshots of OKR progress for quarterly business reviews. Frozen state with executive summary, achievements, challenges, and commentary.

### Database Schema
✅ Already added `review_snapshots` table

### Implementation Plan

#### Phase 1: Snapshot Creation (3-4 days)
1. **Snapshot API** (`server/routes-okr.ts`):
   ```
   POST /api/reviews/snapshot
   {
     quarter: 1,
     year: 2025,
     title: "Q1 2025 Business Review"
   }
   ```

2. **Snapshot logic**:
   - Query all objectives/KRs for quarter
   - Freeze current state (progress, status, last check-in)
   - Calculate summary metrics:
     - Overall progress
     - Objectives completed / total
     - Key results completed / total
     - Team breakdown

3. **Storage**:
   - Save frozen data in `review_snapshots.objectives_snapshot`
   - Immutable once published

#### Phase 2: Review Editor (4-5 days)
1. **Review Page** (`client/src/pages/ReviewDashboard.tsx`):
   - Executive summary (rich text editor)
   - Key achievements (bullet list)
   - Challenges faced (bullet list)
   - Lessons learned (bullet list)
   - Next quarter priorities (bullet list)

2. **Data visualization**:
   - Overall progress gauge
   - Team progress breakdown (stacked bar)
   - Top performers / Lagging areas
   - Progress heatmap by objective

3. **Status workflow**:
   - Draft → Published → Archived
   - Assign presenters and attendees
   - Link to Focus Rhythm meeting

#### Phase 3: Export & Sharing (2-3 days)
1. **Export formats**:
   - PDF report (executive summary + charts)
   - PowerPoint slides (auto-generated)
   - Public link (read-only)

2. **Templates**:
   - Quarterly business review
   - Board presentation
   - Investor update

### UI/UX Mock

```
┌─────────────────────────────────────────────────────┐
│ Q1 2025 Business Review (Draft)                     │
│ [Edit] [Publish] [Export PDF]                       │
│                                                      │
│ ┌─ Executive Summary ────────────────────┐         │
│ │ Strong start to the year with 75%      │         │
│ │ overall progress. Marketing exceeded    │         │
│ │ targets while Product fell short...     │         │
│ └─────────────────────────────────────────┘         │
│                                                      │
│ Overall Progress: 75% ██████████░░                  │
│                                                      │
│ ┌─ Progress by Team ─────────────────────┐         │
│ │ Sales:       [80%] ████████░░          │         │
│ │ Marketing:   [85%] █████████░          │         │
│ │ Product:     [60%] ██████░░░░          │         │
│ │ Engineering: [70%] ███████░░░          │         │
│ └─────────────────────────────────────────┘         │
│                                                      │
│ Key Achievements                                     │
│ • Launched 2 new features ahead of schedule         │
│ • Exceeded revenue target by 10%                    │
│ • Hired 15 new team members                         │
│                                                      │
│ Challenges                                           │
│ • Product roadmap delays due to tech debt           │
│ • Marketing budget constraints in Q1                │
│                                                      │
│ Next Quarter Priorities                             │
│ • Focus on product velocity                         │
│ • Expand sales team by 20%                          │
└─────────────────────────────────────────────────────┘
```

### Testing
- Test snapshot creation and freezing
- Test rich text editing
- Test PDF export quality
- Test public link sharing
- Test permission controls

---

## 📋 Implementation Roadmap

### Sprint 1 (2 weeks)
- ✅ Import MVP (COMPLETE)
- 🎯 Phased Targets UI (Feature 1)

### Sprint 2 (2 weeks)
- 📊 Progress Line Charts (Feature 2)
- 🏢 Team/Divisional OKRs - Phase 1 & 2 (Feature 3)

### Sprint 3 (2 weeks)
- 🏢 Team/Divisional OKRs - Phase 3 (Feature 3 completion)
- 📧 Weekly Email Reminders (Feature 4)

### Sprint 4 (2 weeks)
- 🤖 AI-Powered OKR Generator (Feature 5)
- 📸 Custom Review Dashboards (Feature 6)

---

## 🎯 Quick Wins (Can Be Done Independently)

1. **Progress Line Charts** - Self-contained, uses existing check-in data
2. **Phased Targets UI** - Schema already added, just needs frontend
3. **Weekly Email Reminders** - Small scope, high impact

## 🔗 Dependencies

- **Team OKRs** depends on Team Management being complete
- **Review Dashboards** works better after Progress Charts are done
- **AI Generator** requires OpenAI credits/quota

---

## 📚 Resources & References

### Libraries to Install
```bash
npm install pdf-parse mammoth node-cron
```

### Documentation Links
- **Recharts**: https://recharts.org/en-US/
- **SendGrid Node.js**: https://github.com/sendgrid/sendgrid-nodejs
- **OpenAI Node.js**: https://platform.openai.com/docs/libraries/node-js-library
- **PDF Parse**: https://www.npmjs.com/package/pdf-parse
- **Mammoth.js**: https://github.com/mwilliamson/mammoth.js

### Design Inspiration
- **Viva Goals**: Microsoft's OKR tool (reference for UX patterns)
- **Lattice**: Performance management dashboard design
- **15Five**: Check-in reminder emails

---

## 💡 Next Steps

1. **User Validation**: Show import MVP to users, gather feedback
2. **Prioritize**: Confirm which features to build first based on user needs
3. **Estimate**: Break down selected features into detailed tasks
4. **Build**: Execute sprint by sprint with continuous testing

**Questions? Contact the development team!**
