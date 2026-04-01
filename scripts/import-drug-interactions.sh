#!/usr/bin/env bash
set -euo pipefail

CSV_PATH="${1:-/Users/saranshop/Downloads/db_drug_interactions.csv}"

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Error: SUPABASE_DB_URL is not set."
  echo "Example: export SUPABASE_DB_URL='postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require'"
  exit 1
fi

if [[ ! -f "$CSV_PATH" ]]; then
  echo "Error: CSV file not found at: $CSV_PATH"
  exit 1
fi

echo "Importing CSV: $CSV_PATH"

echo "Running import into public.medications_dataset ..."

psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -v csv_path="$CSV_PATH" <<'SQL'
BEGIN;

CREATE TEMP TABLE tmp_drug_interactions (
  drug_1 TEXT,
  drug_2 TEXT,
  interaction_description TEXT
);

\copy tmp_drug_interactions(drug_1, drug_2, interaction_description)
FROM :'csv_path'
WITH (FORMAT csv, HEADER true, QUOTE '"', ESCAPE '"');

INSERT INTO public.medications_dataset (drug_name, interacts_with, severity, description)
SELECT
  btrim(drug_1) AS drug_name,
  btrim(drug_2) AS interacts_with,
  CASE
    WHEN lower(interaction_description) ~ '(contraindicated|fatal|life-threatening|severe|major|anaphylaxis|torsades|arrhythmia|hemorrhage|bleeding risk|toxicity|serotonin syndrome|qt prolongation|myopathy|rhabdomyolysis)' THEN 'High'
    WHEN lower(interaction_description) ~ '(monitor|caution|increase|decrease|risk|moderate|dose adjustment|may reduce|may increase)' THEN 'Moderate'
    ELSE 'Low'
  END AS severity,
  btrim(interaction_description) AS description
FROM tmp_drug_interactions
WHERE btrim(coalesce(drug_1, '')) <> ''
  AND btrim(coalesce(drug_2, '')) <> ''
  AND btrim(coalesce(interaction_description, '')) <> '';

COMMIT;
SQL

echo "Import completed successfully."
