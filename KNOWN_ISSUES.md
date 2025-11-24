# Known Issues & Technical Debt

**Last Updated:** November 24, 2025

---

## CRITICAL

No critical issues currently.

---

## HIGH SEVERITY

### Issue #1: Viva Goals Import - Hierarchical Objectives Not Imported

**Affected:** Viva Goals Import Feature  
**Severity:** High  
**Status:** Known Limitation (MVP)  
**Reported:** November 24, 2025

**Description:**
The import feature currently only imports top-level Viva Goals Big rocks (objectives). Any Big rocks that have a parent (nested objectives) are skipped during import.

**Symptoms:**
- User uploads Viva Goals export with hierarchical objectives
- Only root-level objectives are created in Vega
- Child objectives and their KPIs are skipped
- Import summary shows warnings about skipped items

**Root Cause:**
In `executeImport()` method (server/viva-goals-importer.ts line 394):
```typescript
const bigRocks = this.objectives.filter(obj => obj.Type === 'Big rock' && !obj['Parent IDs']?.length);
```

This filter explicitly excludes objectives with parent IDs.

**Impact:**
- Organizations with multi-level OKR hierarchies will lose nested structure
- Data loss during import for hierarchical objectives
- Misaligned parent-child relationships

**Planned Fix:**
Implement multi-pass import logic:
1. Pass 1: Import all objectives (regardless of parent)
2. Pass 2: Build parent-child relationships using entityMap
3. Pass 3: Update alignment/weight settings

**Workaround:**
Manually flatten Viva Goals hierarchy before export, or manually recreate child objectives after import.

**Priority:** High - Should be fixed in next sprint after MVP delivery.

---

### Issue #2: Viva Goals Import - Team Import Not Implemented

**Affected:** Viva Goals Import Feature  
**Severity:** Medium  
**Status:** Not Implemented (MVP)  
**Reported:** November 24, 2025

**Description:**
The import UI shows an "Import Teams" checkbox option, but team import functionality is not actually implemented in the backend.

**Impact:**
- User expects teams to be imported when checkbox is selected
- No teams are created even when option is enabled
- Misleading UI

**Planned Fix:**
Either:
- Option A: Remove "Import Teams" checkbox from UI until feature is implemented
- Option B: Implement team import pipeline in next sprint

**Priority:** Medium - Fix UI or implement feature in next sprint.

---

### Issue #3: Entity Relationship Linking - State Management Bug

**Affected:** Big Rock Edit Dialog  
**Severity:** High  
**Status:** In Progress  
**Reported:** November 22, 2025

**Description:**
When editing a Big Rock and toggling linked strategies, the `linkedStrategies` array is sent as empty `[]` to the server even though the user has selected strategies in the UI. The toggle function appears to work (badges change appearance), but the form state is not properly accumulating the selections.

**Symptoms:**
- User opens Big Rock edit dialog
- Clicks strategy badges to select/deselect
- Badges visually change (default ↔ outline)
- Clicks "Update Big Rock"
- Server receives `linkedStrategies: []` in request body
- Selected strategies do not persist

**Root Cause:**
Frontend state management issue in `PlanningEnhanced.tsx`. The `bigRockForm.linkedStrategies` state is not properly reflecting user selections before form submission.

**Investigation Notes:**
- `toggleBigRockStrategy()` function logic appears correct
- `handleEditBigRock()` properly initializes linkedStrategies from big rock object
- First test passed (200 response, no errors)
- Second comprehensive test showed regression
- May be related to data fetching or state initialization

**Potential Fixes:**
1. Verify big rock data from API includes `linkedStrategies` field
2. Add useEffect to log state changes for debugging
3. Check if form state is being reset between toggle and submit
4. Verify query cache is returning complete big rock objects

**Workaround:** None currently.

**Impact:** Users cannot link Big Rocks to Strategies through the UI.

---

## MEDIUM SEVERITY

### Issue #2: TypeScript/LSP Diagnostics in server/routes-okr.ts

**Affected:** `server/routes-okr.ts`  
**Severity:** Medium  
**Status:** Open  
**Reported:** November 22, 2025

**Description:**
24 LSP diagnostics (likely type errors or linting warnings) in the OKR routes file.

**Impact:**
- Code may have type safety issues
- Potential runtime errors
- Reduced code quality

**Next Steps:**
- Run `get_latest_lsp_diagnostics` to view specific errors
- Fix type mismatches
- Add proper TypeScript types where missing

**Priority:** Should be fixed before adding new OKR features.

---

### Issue #3: Foreign Key Constraint Violations (RESOLVED ✅)

**Affected:** Big Rock and Objective Update Endpoints  
**Severity:** Medium (was High)  
**Status:** ✅ RESOLVED  
**Fixed:** November 22, 2025

**Description:**
Empty strings for `objectiveId` and `keyResultId` were causing foreign key constraint violations when updating Big Rocks.

**Fix Applied:**
Added empty string → null conversion in PATCH routes:
```typescript
if (updateData.objectiveId === "") updateData.objectiveId = null;
if (updateData.keyResultId === "") updateData.keyResultId = null;
```

Applied to:
- `/api/okr/big-rocks/:id` PATCH route
- `/api/okr/objectives/:id` PATCH route (preventive)

**Verification:** Test passed with HTTP 200 response and no errors.

---

## LOW SEVERITY / TECHNICAL DEBT

### TD-1: Temporary Logging Code

**Location:** Multiple files  
**Severity:** Low  
**Type:** Technical Debt

**Files:**
- `client/src/pages/PlanningEnhanced.tsx` - Line 1330: `console.log('[Big Rock Submit] Form state:', bigRockForm);`
- `server/routes-okr.ts` - Lines 231, 233, 236: Big Rock update logging

**Impact:** None (logging doesn't affect functionality)

**Cleanup:** Remove console.log statements before production deployment.

---

### TD-2: Value Tagging on Big Rocks ✅ RESOLVED

**Location:** `client/src/pages/PlanningEnhanced.tsx`  
**Severity:** Low  
**Type:** Feature Removal  
**Status:** ✅ COMPLETED (November 22, 2025)

**Description:**
Big Rocks were implemented with value tagging, but this was identified as unnecessary data clutter since values should primarily link to Objectives and Strategies.

**Cleanup Completed:**
- ✅ Removed ValueTagSelector from Big Rock edit dialog
- ✅ Removed value badge display from Big Rock detail views
- ✅ Removed value tag sync calls in Big Rock mutations
- ✅ Removed bigRockValueTags state variables
- ✅ Removed ValueBadges component for Big Rocks
- ✅ Kept value tagging APIs (still used by Objectives/Strategies)

**Impact:** Reduced UI clutter, simplified data model.

---

### TD-3: Incomplete RBAC Implementation

**Location:** All API routes  
**Severity:** Low (but Critical for production)  
**Type:** Security Gap

**Description:**
User roles are defined and assigned but not enforced. See BACKLOG.md High Priority #1.

**Current State:**
- `requireAuth` middleware only checks if user is logged in
- No role checking
- No tenant isolation enforcement
- All authenticated users have full access

**Must Fix Before:** Production deployment

---

### TD-4: Unused Microsoft Graph Client Dependency

**Location:** `package.json`  
**Severity:** Low  
**Type:** Unused Dependency

**Description:**
`@microsoft/microsoft-graph-client` is installed but not actively used yet.

**Future:** Will be used in Entra SSO integration (see BACKLOG.md).

**Action:** Keep for now (planned feature).

---

### TD-5: SendGrid Integration Incomplete

**Location:** Email sending functions  
**Severity:** Low  
**Type:** Incomplete Feature

**Description:**
SendGrid connector is set up for email verification and password reset, but `SENDGRID_API_KEY` may not be configured in all environments.

**Impact:** Email sending may fail silently in development.

**Fix:** Ensure environment variable is set or add graceful fallback.

---

## RESOLVED ISSUES (Archive)

### ✅ RESOLVED: Query Invalidation for Value Tags

**Fixed:** November 22, 2025  
**Description:** Value tag changes didn't immediately reflect in UI due to missing cache invalidation.  
**Fix:** Added proper `queryClient.invalidateQueries()` calls after value tag mutations.

### ✅ RESOLVED: Authentication on Value Tagging APIs

**Fixed:** November 22, 2025  
**Description:** 9 value tagging endpoints were missing proper authentication checks.  
**Fix:** Converted all routes from `req.isAuthenticated()/req.user` to session-based `req.session.userId` pattern.

---

## Issue Reporting Guidelines

When reporting a new issue, include:

1. **Title:** Brief, descriptive summary
2. **Severity:** Critical | High | Medium | Low
3. **Status:** Open | In Progress | Resolved
4. **Description:** What's happening vs. what should happen
5. **Steps to Reproduce:** Exact steps to trigger the issue
6. **Expected Behavior:** What should happen
7. **Actual Behavior:** What actually happens
8. **Impact:** Who is affected and how
9. **Logs/Screenshots:** Relevant error messages or visuals
10. **Potential Fix:** Ideas for resolution (if known)

---

## Technical Debt Categories

- **TD-Code Quality:** Type safety, linting, code organization
- **TD-Performance:** Slow queries, inefficient algorithms
- **TD-Security:** Authentication gaps, authorization issues
- **TD-Testing:** Missing tests, low coverage
- **TD-Documentation:** Missing docs, outdated comments
- **TD-Cleanup:** Temporary code, unused dependencies
