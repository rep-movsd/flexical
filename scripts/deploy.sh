#!/usr/bin/env bash
#
# One-command deploy for Wordtwist.
#
#   First run:  authenticates, creates the D1 database, wires its id into
#               wrangler.jsonc, applies migrations, builds and deploys.
#   Later runs: applies any new migrations, builds and deploys again.
#
# Usage:
#   npm run deploy          # normal use
#   bash scripts/deploy.sh  # same thing
#
# In CI, set CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID) to skip login.

set -euo pipefail
cd "$(dirname "$0")/.."

DB_NAME="wordtwist"
CONFIG="wrangler.jsonc"
PLACEHOLDER="REPLACE_WITH_YOUR_D1_DATABASE_ID"
UUID_RE='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

log() { printf '\n\033[1;35m==> %s\033[0m\n' "$*"; }

# ---------------------------------------------------------------------------
# 1. Authenticate
# ---------------------------------------------------------------------------
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  if ! npx wrangler whoami >/dev/null 2>&1; then
    log "Not logged in to Cloudflare"
    if [ -t 0 ]; then
      npx wrangler login
    else
      echo "Run 'npx wrangler login' (or set CLOUDFLARE_API_TOKEN) first." >&2
      exit 1
    fi
  fi
fi

# ---------------------------------------------------------------------------
# 2. Ensure a D1 database exists and its id is in the config
# ---------------------------------------------------------------------------
current_id="$(grep -oE '"database_id"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG" \
  | sed -E 's/.*"([^"]*)"[[:space:]]*$/\1/' | head -1 || true)"

if [ "${current_id}" = "$PLACEHOLDER" ] || [ -z "${current_id}" ]; then
  log "Looking for an existing D1 database named '$DB_NAME'"
  list_json="$(npx wrangler d1 list --json 2>/dev/null || echo '[]')"
  db_id="$(printf '%s' "$list_json" | DB_NAME="$DB_NAME" python3 -c '
import sys, json, os
name = os.environ["DB_NAME"]
try:
    data = json.load(sys.stdin)
except Exception:
    data = []
print(next((d.get("uuid") or d.get("id") or "" for d in data if d.get("name") == name), ""))
')"

  if [ -z "$db_id" ]; then
    log "Creating D1 database '$DB_NAME'"
    create_out="$(npx wrangler d1 create "$DB_NAME" 2>&1 || true)"
    printf '%s\n' "$create_out"
    db_id="$(printf '%s' "$create_out" | grep -oE "$UUID_RE" | head -1 || true)"
  fi

  if [ -z "$db_id" ]; then
    echo "Could not determine the D1 database id. Aborting." >&2
    exit 1
  fi

  python3 - "$CONFIG" "$db_id" <<'PY'
import re, sys
path, dbid = sys.argv[1], sys.argv[2]
src = open(path).read()
src = re.sub(r'("database_id"\s*:\s*")[^"]*(")',
             lambda m: m.group(1) + dbid + m.group(2), src, count=1)
open(path, "w").write(src)
PY
  echo "Wrote database_id = $db_id into $CONFIG"
else
  log "Using database_id from $CONFIG ($current_id)"
fi

# ---------------------------------------------------------------------------
# 3. Apply migrations to the remote database
# ---------------------------------------------------------------------------
log "Applying remote migrations"
npx wrangler d1 migrations apply "$DB_NAME" --remote --force

# ---------------------------------------------------------------------------
# 4. Build and deploy
# ---------------------------------------------------------------------------
log "Building"
npm run --silent build

log "Deploying"
deploy_log="$(mktemp)"
npx wrangler deploy | tee "$deploy_log"

url="$(grep -oE 'https://[A-Za-z0-9._-]+\.workers\.dev' "$deploy_log" | head -1 || true)"
rm -f "$deploy_log"

printf '\n\033[1;32m✓ Deployed\033[0m\n'
if [ -n "$url" ]; then
  echo "  Share this link: $url"
  echo "  (Add a custom domain any time under Workers → your Worker → Settings.)"
fi
