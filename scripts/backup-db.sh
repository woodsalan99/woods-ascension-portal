#!/bin/bash
# Full logical backup of the production database, one CSV per table.
#
# Deliberately NOT pg_dump: the Railway server runs Postgres 18 and the
# newest client Homebrew will install on this Mac is 16, which pg_dump
# refuses to talk to. `\copy` runs entirely client-side and doesn't care
# about the version gap. CSVs also stay readable and restorable one table
# at a time, which matters when the thing you need back is a single row.
#
# Usage:  ./scripts/backup-db.sh [label]
# Output: backups/<label>-<timestamp>/<Table>.csv

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set (looked in .env)." >&2
  exit 1
fi

LABEL="${1:-manual}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DIR="backups/${LABEL}-${STAMP}"
mkdir -p "$DIR"

echo "Backing up to $DIR"

# Ask the database itself which tables exist, so a table added later is
# never silently missed by a hardcoded list.
TABLES="$(psql "$DATABASE_URL" -At -c "
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
")"

COUNT=0
for TABLE in $TABLES; do
  psql "$DATABASE_URL" -c "\copy \"$TABLE\" TO '$DIR/$TABLE.csv' WITH CSV HEADER"
  ROWS=$(psql "$DATABASE_URL" -At -c "SELECT count(*) FROM \"$TABLE\";")
  printf '  %-24s %s rows\n' "$TABLE" "$ROWS"
  COUNT=$((COUNT + 1))
done

psql "$DATABASE_URL" -At -c "SHOW server_version;" > "$DIR/_server_version.txt"
echo "$TABLES" > "$DIR/_table_list.txt"

echo
echo "Done — $COUNT table(s) in $DIR"
echo "To restore one table:  psql \"\$DATABASE_URL\" -c '\\copy \"TableName\" FROM $DIR/TableName.csv WITH CSV HEADER'"
