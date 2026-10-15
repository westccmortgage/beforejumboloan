# Importing the national loan-limit dataset

## Verified CY2026 snapshot (October 15, 2026)

The installed datasets contain 3,235 FHFA counties and 3,235 HUD/FHA counties,
covering 56 states/territories. All four unit limits are populated. Exact source
URLs, byte sizes and SHA-256 digests are in `2026/sources.json`; original files
are retained in `data/raw/2026/`.

HUD publishes fixed-width text, not CSV. The FHA importer accepts the original
`.txt` directly and joins truncated HUD county names to FHFA by exact state and
county FIPS. Unknown FIPS, invalid amounts and duplicate counties stop import.

Reproduce without exporting or editing source values:

```bash
node scripts/import-fhfa-limits.mjs --verified 2026-10-15 --source https://www.fhfa.gov/document/d/cll/fullcountyloanlimitlist2026_hera-based_final_flat.csv
node scripts/import-fha-limits.mjs data/raw/2026/fha-forward-2026.txt --verified 2026-10-15 --source https://apps.hud.gov/pub/chums/cy2026-forward-limits.txt
npm run build:geo
npm run validate:loan-limits
npm test
```

The readiness gate validates reference data only; it does not certify lending
eligibility, live AI quality, security, or the production deployment.

The JSON files in `data/loan-limits/<YEAR>/` are **build artifacts of the import
scripts** — never hand-edit limits. Place the official source files in
`data/raw/<YEAR>/` (see `data/raw/2026/README.md`) and run the importers.

## Commands
```bash
# 1. FHFA conforming / high-balance (all counties)
npm run import:fhfa -- --year 2026 --verified 2026-12-01
#    → writes data/loan-limits/2026/fhfa-conforming.json

# 2. HUD / FHA forward limits
npm run import:fha  -- --year 2026 --verified 2026-12-01
#    → writes data/loan-limits/2026/fha-forward.json

# 3. Rebuild the State→County dropdown from the official FHFA county list
npm run build:geo   -- --year 2026
#    → writes data/geo/us-counties.json

# Or all three:
npm run import:all
```
Each script prints the record count and fails loudly (non-zero exit) on a
missing required column, a duplicate state/county or FIPS, or a missing/invalid
one-unit limit. Nothing is invented.

## Official source files (do this for a real nationwide dataset)

**FHFA 2026 — All Counties:**
1. Go to the FHFA **Conforming Loan Limit Values** page: https://www.fhfa.gov/data/conforming-loan-limit
2. Download the **all-county** file for 2026
   (`fullcountyloanlimitlist2026_hera-based_final_flat.xlsx`, ~3,200+ rows).
3. Open it and **Save As CSV** → `data/raw/2026/fhfa-conforming-2026.csv`.

**HUD CY2026 FHA Forward Limits — Full File:**
1. Go to HUD's **FHA Mortgage Limits / CHUMS file layouts** page:
   https://www.hud.gov/program_offices/housing/sfh/lender/origination/mortgage_limits
2. Download the **CY2026 Forward Mortgage Limits full file** (CHUMS).
3. Save As CSV → `data/raw/2026/fha-forward-2026.csv`.

Then:
```bash
npm run import:all                 # imports both + rebuilds the county dropdown
npm run validate:loan-limits       # production gate — must print "PRODUCTION READY"
```

Header names are matched flexibly (see `COLS` in each script). Required:
- FHFA — County Name, State (2-letter), One-Unit Limit, and FIPS (combined or
  State+County). Two/Three/Four-Unit must be present for production.
- FHA — State, County Name, One-Family. Two/Three/Four-Family + County Code optional.

## Sample vs official_full (coverage guard)
Each dataset carries `dataset_type`:
- `"sample"` — the committed seed (a handful of verified counties). The studio
  shows "County limit database is being finalized…" and logs a developer console
  warning; it does **not** claim full nationwide coverage.
- `"official_full"` — set automatically when an imported file has ≥ 3,000 county
  records (the seed `*.sample.csv` is always tagged `sample`).

`npm run validate:loan-limits` **fails (exit 1)** unless BOTH datasets are
`official_full`, above the record threshold, carry required metadata, have every
one-unit limit, and (FHFA) have all 2–4 unit limits populated. Run it in CI / a
pre-launch check — green is the proof production data is installed.

## Output metadata (each JSON carries provenance)
`source_name`, `source_url_or_label`, `effective_year`, `imported_at`,
`verified_at`, `record_count`, plus the `compliance` line. The resolver surfaces
these as `sourceMeta`.

## Seed / sample
Committed `data/raw/2026/*.sample.csv` files (FHFA-verified seed counties only)
let the pipeline run out of the box. The current committed JSON was produced from
them: **5 FHFA county records, 2 FHA county records in the original sample.** The installed JSON now uses the complete official snapshot. Replace the raw sources with
the official full files (git-ignored) and re-run to import the whole nation.

## Next year
`data/raw/<YEAR>/` + the same commands with `--year <YEAR>`. Point the studio
loader (`js/loan-limits.js`) at the new year's folder.
