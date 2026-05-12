#!/bin/sh
set -e

# Create all required directories
mkdir -p /app/uploads/screens
mkdir -p /app/uploads/firmware
mkdir -p /app/uploads/widgets
mkdir -p /app/uploads/captures
mkdir -p /app/uploads/drawings
mkdir -p /app/logs
mkdir -p /app/data

# Sync SQLite schema before start.
node ./node_modules/prisma/build/index.js db push --skip-generate 2>&1 || echo "Warning: prisma db push failed (may need manual migration)"

# Execute the main command
exec "$@"
