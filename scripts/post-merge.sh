#!/bin/bash
set -e

# Install any new npm packages added by the task agent
npm install

# Apply only safe, additive schema changes (new tables, new columns with defaults).
# The --force flag auto-accepts unique constraint additions without truncation.
# We intentionally do NOT use --force for data-loss statements (column/table drops)
# to protect production data. Destructive schema changes must be reviewed manually.
echo "" | timeout 30 npx drizzle-kit push || true
