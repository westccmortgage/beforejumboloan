import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { hudForwardRows } from "../scripts/lib/hud-forward.mjs";
import { parseCSV } from "../scripts/lib/import-utils.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = rel => readFileSync(join(root, rel), "utf8");
const fhfa = JSON.parse(read("data/loan-limits/2026/fhfa-conforming.json"));
const fha = JSON.parse(read("data/loan-limits/2026/fha-forward.json"));
const hud = read("data/raw/2026/fha-forward-2026.txt");
const key = c => c.state_abbr + "|" + c.county_fips;
const amounts = ["one", "two", "three", "four"];

test("official source snapshots retain their recorded checksums", () => {
  const sources = JSON.parse(read("data/loan-limits/2026/sources.json"));
  for (const source of sources.files) {
    assert.equal(createHash("sha256").update(readFileSync(join(root, source.path))).digest("hex"), source.sha256);
  }
});

test("all 3,235 FHFA county records match all four official source limits", () => {
  const rows = parseCSV(read("data/raw/2026/fhfa-conforming-2026.csv"));
  assert.equal(rows.length - 1, 3235);
  assert.equal(fhfa.counties.length, 3235);
  assert.equal(new Set(fhfa.counties.map(c => c.state_abbr)).size, 56);
  const indexed = new Map(fhfa.counties.map(c => [key(c), c]));
  for (const row of rows.slice(1)) {
    const record = indexed.get(row[3] + "|" + row[0].padStart(2,"0") + row[1].padStart(3,"0"));
    assert.ok(record, row.join(","));
    for (let i=0; i<4; i++) {
      const expected = Number(row[5+i].replace(/[$,\s]/g, ""));
      assert.equal(record["conforming_" + amounts[i] + "_unit"], expected);
    }
  }
});

test("HUD county records resolve exact FIPS and preserve all four source limits", () => {
  const rows = hudForwardRows(hud, fhfa.counties);
  assert.equal(rows.length - 1, 3235);
  assert.equal(fha.counties.length, 3235);
  const indexed = new Map(fha.counties.map(c => [key(c),c]));
  for (const row of rows.slice(1)) {
    const record = indexed.get(row[0] + "|" + row[1]);
    assert.ok(record);
    assert.equal(record.county_name, row[2]);
    for (let i=0; i<4; i++) assert.equal(record["fha_" + amounts[i] + "_unit"], Number(row[4+i]));
  }
  const la = indexed.get("CA|06037");
  assert.equal(la.county_name, "Los Angeles County");
  assert.equal(la.fha_one_unit, 1249125);
  assert.equal(indexed.get("FL|12099").fha_one_unit, 667000);
});

test("HUD conversion rejects malformed records and never guesses a county", () => {
  const line = hud.split(/\r?\n/).find(l => l.slice(101,103) === "CA" && l.slice(103,106) === "037");
  assert.ok(line);
  assert.throws(() => hudForwardRows(line.slice(0,120), fhfa.counties), /truncated/);
  assert.throws(() => hudForwardRows(line.slice(0,103)+"999"+line.slice(106), fhfa.counties), /unknown county/);
  assert.throws(() => hudForwardRows(line.slice(0,73)+"invalid"+line.slice(80), fhfa.counties), /invalid unit limit/);
  assert.throws(() => hudForwardRows(line+"\n"+line, fhfa.counties), /duplicate county/);
});

test("production gate accepts full data and rejects missing county, year drift and unit loss", () => {
  const temp = mkdtempSync(join(tmpdir(), "bjl-official-"));
  try {
    cpSync(join(root,"scripts"),join(temp,"scripts"),{recursive:true});
    cpSync(join(root,"data/loan-limits"),join(temp,"data/loan-limits"),{recursive:true});
    const gate = () => execFileSync("node",[join(temp,"scripts/validate-loan-limits.mjs")],{encoding:"utf8",stdio:"pipe"});
    assert.match(gate(), /PRODUCTION READY/);
    const path = join(temp,"data/loan-limits/2026/fha-forward.json");
    for (const change of [
      ds => ds.counties.pop(),
      ds => { ds.effective_year=2025; },
      ds => { ds.counties[0].fha_four_unit=null; },
    ]) {
      const changed = structuredClone(fha);
      change(changed);
      writeFileSync(path,JSON.stringify(changed));
      assert.throws(gate, error => error.status===1 && /NOT PRODUCTION READY/.test(String(error.stderr)));
    }
  } finally { rmSync(temp,{recursive:true,force:true}); }
});

