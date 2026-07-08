---
name: GPT-5 empty responses caused by low max_completion_tokens
description: Why GPT-5 (and other OpenAI reasoning models) can appear "broken" (empty content, 0 streaming chunks) through the Replit AI OpenAI-compatible endpoint, and the actual fix.
---

GPT-5 consumes part of `max_completion_tokens` for internal "reasoning tokens" before emitting any visible content. If the budget passed to the API is too low (e.g. 100-500), the model can spend the entire budget reasoning and return `finish_reason: "length"` with an **empty** `content` string — and in streaming mode this shows up as 0 chunks.

**Why this matters:** a codebase had previously concluded "gpt-5 is broken for streaming on the Replit AI endpoint" and added a startup migration that silently downgraded any `gpt-5` config back to `gpt-4o` on every restart. That conclusion was wrong — the model works fine once `max_completion_tokens` is raised (tested: 100 tokens → empty content; 2000 tokens → normal response with ~256 reasoning tokens consumed first).

**How to apply:** Before concluding a reasoning model (gpt-5, gpt-5-mini, o-series, etc.) is broken/unavailable on an endpoint, retest with a generous `max_completion_tokens` (>=1500-2000) rather than assuming the model itself is faulty. When wiring up gpt-5 as a default model, audit every call site for low token budgets (helper defaults, short-summary/narrative generators, etc.) and raise them — a working fallback/deterministic-template path can mask this failure mode for a long time.
