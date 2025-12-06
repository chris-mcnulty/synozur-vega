# Known Issues & Technical Debt

**Last Updated:** December 6, 2025

---

## CRITICAL

No critical issues currently.

---

## HIGH SEVERITY

### Issue #1: Viva Goals Import - Hierarchical Objectives Not Imported ✅ RESOLVED

**Affected:** Viva Goals Import Feature  
**Severity:** High  
**Status:** ✅ RESOLVED  
**Reported:** November 24, 2025  
**Fixed:** November 27, 2025

**Description:**
The import feature now supports multi-pass import for hierarchical objectives.

**Fix Applied:**
Multi-pass import logic implemented in `server/viva-goals-importer.ts`:
- Phase 1: Import organization-level objectives (no parents)
- Phase 2: Import child objectives with parent linking via `parentId`
- Phase 3: Import Key Results under their parent objectives
- Phase 4: Import Big Rocks (Projects) linked to objectives
- Phase 5: Import check-ins for all entities

**Verification:** Hierarchical objectives with parent IDs are now imported and linked correctly.

---

### Issue #2: Viva Goals Import - Team Import ✅ RESOLVED

**Affected:** Viva Goals Import Feature  
**Severity:** Medium  
**Status:** ✅ RESOLVED  
**Reported:** November 24, 2025  
**Fixed:** November 27, 2025

**Description:**
Team import is now fully implemented in the backend.

**Fix Applied:**
- Phase 0 in importer creates/maps teams from `Teams_export_*.json`
- Uses `storage.getTeamByName()` to check for existing teams
- Creates new teams via `storage.createTeam()` when needed
- Maps `teamId` to objectives during import
- Teams referenced in objective data are also auto-created

**Verification:** Teams are created when "Import Teams" checkbox is enabled.

---

### Issue #3: Entity Relationship Linking - State Management Bug ✅ RESOLVED

**Affected:** Big Rock Edit Dialog  
**Severity:** High  
**Status:** ✅ RESOLVED  
**Reported:** November 22, 2025  
**Fixed:** December 6, 2025

**Description:**
When editing a Big Rock and toggling linked strategies, the `linkedStrategies` array was sent as empty `[]` to the server even though the user selected strategies in the UI.

**Fix Applied:**
- State management in `PlanningEnhanced.tsx` now correctly tracks strategy selections
- Big Rock → Strategy linking works properly through the UI
- Many-to-many relationship persists correctly to database

**Verification:** Big Rock strategy linking tested and confirmed working.

---

## MEDIUM SEVERITY

### Issue #2: TypeScript/LSP Diagnostics in server/routes-okr.ts ✅ RESOLVED

**Affected:** `server/routes-okr.ts`  
**Severity:** Medium  
**Status:** ✅ RESOLVED  
**Reported:** November 22, 2025  
**Fixed:** December 6, 2025

**Description:**
24 LSP diagnostics (type errors or linting warnings) were present in the OKR routes file.

**Fix Applied:**
- All type errors and linting warnings have been resolved
- LSP diagnostics now show zero errors across the codebase

**Verification:** `get_latest_lsp_diagnostics` returns no errors.

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
