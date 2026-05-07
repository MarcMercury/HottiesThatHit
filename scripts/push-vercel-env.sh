#!/usr/bin/env bash
# Push new API integration env vars to the Vercel `web` project.
#
# Usage (from the terminal where VERCEL_TOKEN + TEAM are exported):
#   ./scripts/push-vercel-env.sh
#
# Edit the VALUES below before running. Empty values are skipped.
# Re-running with a different value updates the existing variable.

set -euo pipefail

: "${VERCEL_TOKEN:?VERCEL_TOKEN not set}"
: "${TEAM:?TEAM not set}"

PROJECT="web"

# ───── EDIT THESE BEFORE RUNNING ─────────────────────────────────────────────
# Leave a value blank ("") to skip pushing that variable.
declare -A VARS=(
  # LLM providers (set whichever you want to use; leave others blank).
  [GROQ_API_KEY]=""
  [GROQ_MODEL]="llama-3.3-70b-versatile"
  [GEMINI_API_KEY]=""
  [GEMINI_MODEL]="gemini-2.0-flash"
  # [LLM_PROVIDER]="groq"  # uncomment to force a specific provider

  # Google Maps Platform (one secret server key + one referrer-restricted browser key).
  [GOOGLE_MAPS_API_KEY]=""
  [NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY]=""

  # Unsplash (facility imagery).
  [UNSPLASH_ACCESS_KEY]=""

  # Optional future integrations — uncomment/fill when ready.
  # [ASSEMBLYAI_API_KEY]=""
  # [HUGGINGFACE_API_KEY]=""
  # [AIRNOW_API_KEY]=""
)

# Sensitive vars (encrypted). Public NEXT_PUBLIC_* must be "plain" so they
# can be inlined into the browser bundle.
is_public() { [[ "$1" == NEXT_PUBLIC_* ]]; }

upsert_var() {
  local key="$1" value="$2" type
  if is_public "$key"; then type="plain"; else type="encrypted"; fi

  # Try to find an existing var with this key.
  local existing_id
  existing_id=$(curl -sS "https://api.vercel.com/v9/projects/${PROJECT}/env?teamId=${TEAM}" \
      -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(next((e['id'] for e in d.get('envs',[]) if e['key']=='${key}'), ''))")

  local payload
  payload=$(python3 -c "import json; print(json.dumps({'key':'${key}','value':'''${value}''','type':'${type}','target':['production','preview','development']}))")

  if [[ -n "$existing_id" ]]; then
    echo "  ↻ updating ${key}"
    curl -sS -X PATCH "https://api.vercel.com/v9/projects/${PROJECT}/env/${existing_id}?teamId=${TEAM}" \
      -H "Authorization: Bearer ${VERCEL_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$(python3 -c "import json; print(json.dumps({'value':'''${value}''','type':'${type}','target':['production','preview','development']}))")" \
      > /dev/null
  else
    echo "  + creating ${key}"
    curl -sS -X POST "https://api.vercel.com/v10/projects/${PROJECT}/env?teamId=${TEAM}&upsert=true" \
      -H "Authorization: Bearer ${VERCEL_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$payload" > /dev/null
  fi
}

echo "Pushing env vars to Vercel project '${PROJECT}'…"
for k in "${!VARS[@]}"; do
  v="${VARS[$k]}"
  if [[ -z "$v" ]]; then
    echo "  · skipping ${k} (empty)"
    continue
  fi
  upsert_var "$k" "$v"
done
echo "Done. Trigger a redeploy for new vars to take effect."
