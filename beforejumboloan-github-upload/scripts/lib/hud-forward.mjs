#!/usr/bin/env node
// HUD CHUMS CY2026 forward file, using the published fixed-width layout:
// https://apps.hud.gov/pub/chums/file_layouts.html
// County names in HUD's 15-character field are truncated. Resolve names only
// through the exact state + county FIPS key in the official FHFA county list.
export function hudForwardRows(text, fhfaCounties) {
  const lookup = new Map(fhfaCounties.map(c => [c.state_abbr + "|" + c.county_fips.slice(-3), c]));
  const rows = [["State", "County Code", "County Name", "MSA Name", "One-Family", "Two-Family", "Three-Family", "Four-Family"]];
  const seen = new Set();
  let headerCount = 0;
  for (const [index, line] of String(text).split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    if (line.length < 147) throw new Error("HUD row " + (index + 1) + ": truncated fixed-width record");
    const state = line.slice(101, 103);
    const county = line.slice(103, 106);
    if (!state.trim() && !county.trim()) {
      const code = line.slice(60, 65).trim();
      if (rows.length !== 1 || headerCount >= 2 || !["ZZ203", "203B"].includes(code))
        throw new Error("HUD row " + (index + 1) + ": unexpected non-county record");
      headerCount++;
      continue;
    }
    const key = state + "|" + county;
    if (seen.has(key)) throw new Error("HUD row " + (index + 1) + ": duplicate county " + key);
    const canonical = lookup.get(key);
    if (!canonical) throw new Error("HUD row " + (index + 1) + ": unknown county FIPS " + key);
    const amounts = [[73,80],[80,87],[87,94],[94,101]].map(([a,b]) => line.slice(a,b));
    if (amounts.some(n => !/^\d{7}$/.test(n) || Number(n) <= 0))
      throw new Error("HUD row " + (index + 1) + ": invalid unit limit");
    seen.add(key);
    rows.push([state, canonical.county_fips, canonical.county_name, line.slice(10,60).trim(), ...amounts]);
  }
  if (rows.length === 1) throw new Error("HUD file has no county records");
  return rows;
}

