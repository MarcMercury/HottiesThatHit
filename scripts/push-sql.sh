#!/usr/bin/env bash
# Push a SQL file to Supabase via the Management API.
# Usage: scripts/push-sql.sh path/to/file.sql
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is required}"

FILE="${1:?path to .sql file required}"

# JSON-escape the file contents (no jq required).
PAYLOAD=$(python3 -c 'import json,sys; print(json.dumps({"query": open(sys.argv[1]).read()}))' "$FILE")

HTTP_CODE=$(curl -sS -o /tmp/push-sql.out -w '%{http_code}' \
  -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "$PAYLOAD")

echo "==> $FILE  (HTTP $HTTP_CODE)"
head -c 4000 /tmp/push-sql.out
echo
[[ "$HTTP_CODE" =~ ^2 ]]
