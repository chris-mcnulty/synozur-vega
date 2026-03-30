#!/bin/bash
set -e

# Install any new npm packages added by the task agent
npm install

# We do NOT run drizzle-kit push here because it prompts interactively to drop
# the 'session' table (managed by connect-pg-simple) and 'start_value' column
# in key_results (still referenced by the frontend). Dropping either would cause
# data loss and break the app.
#
# Schema changes are applied safely at server startup via ensureSchemaColumns()
# in server/init.ts, which only adds columns/tables and never drops anything.
echo "Post-merge setup complete. Schema migrations handled by server/init.ts on startup."
