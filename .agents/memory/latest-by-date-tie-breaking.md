---
name: Deterministic ordering for "latest by date" queries
description: Sorting only by a user-editable/user-supplied date column to find the "latest" or "prior" record is nondeterministic when two rows share that date value.
---

When a feature lets users backdate or freely choose a business-meaningful date (e.g. "as of date" on a check-in, an effective date, a submission date), that column can have duplicate values across rows — either because two records legitimately share a date, or because the UI defaults to a fixed time-of-day (e.g. always noon) for a selected day.

A query like `ORDER BY that_date DESC LIMIT 1` to find "the latest record" or "the record immediately before X" is then nondeterministic on ties: the database may return either matching row, and behavior can flip between runs or environments.

**Why:** This surfaced in a check-in progress-tracking feature: two check-ins submitted for the same date caused the "is this the most recent check-in" check to sometimes treat a newly created check-in as stale, silently skipping the update to the entity's live progress/status.

**How to apply:** Whenever a "latest" or "immediately preceding" lookup is built on a user-controllable date/timestamp column, add a secondary deterministic sort key that reflects true insertion order — typically an auto-generated `createdAt` timestamp (set by `defaultNow()` server-side), or a monotonically increasing sequence/serial id. Do NOT rely on a random-UUID primary key as a tiebreaker — UUIDv4 has no chronological ordering. Apply the same composite ordering consistently everywhere "latest" is computed for that entity, so different code paths agree on which row wins a tie.
