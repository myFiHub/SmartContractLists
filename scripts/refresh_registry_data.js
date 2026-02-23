#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * One-command registry data refresh: run Thala indexer, copy artifacts to fihub/data when present,
 * optionally run audit. Use before release or when refreshing runtime data.
 *
 * Usage (from repo root, or from SmartContractLists/):
 *   node SmartContractLists/scripts/refresh_registry_data.js
 *   node SmartContractLists/scripts/refresh_registry_data.js [--no-audit]
 *
 * Steps:
 * 1. Run index_thala_v1_pools.js (writes SmartContractLists/docs/thala-pools.json).
 * 2. Copy docs/thala-pools.json and docs/aries-market-ids.json to fihub/data/SmartContractLists/docs/ if that dir exists.
 * 3. Copy aptos/Interaction List/*.json to fihub/data/SmartContractLists/aptos/Interaction List/ if present.
 * 4. If not --no-audit, run audit_il_scl_params.js --network aptos (exit non-zero on mismatch).
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPTS_DIR = __dirname;
const ROOT = path.resolve(SCRIPTS_DIR, "..");
const REPO_ROOT = path.resolve(ROOT, "..");
const FIHUB_DATA = path.join(REPO_ROOT, "fihub", "data", "SmartContractLists");

const argv = process.argv.slice(2);
const skipAudit = argv.includes("--no-audit");

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, {
    cwd: cwd || REPO_ROOT,
    stdio: "inherit",
    shell: false,
  });
  return r.status;
}

function copy(src, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log(`Copied ${path.relative(REPO_ROOT, src)} -> ${path.relative(REPO_ROOT, dest)}`);
}

console.log("=== Registry data refresh ===\n");

// 1. Thala pool indexer
console.log("Step 1: Running Thala V1 pool indexer...");
const indexStatus = run("node", ["SmartContractLists/scripts/index_thala_v1_pools.js"], REPO_ROOT);
if (indexStatus !== 0) {
  console.error("Thala indexer failed. Fix and re-run.");
  process.exit(indexStatus);
}

// 2 & 3. Copy to fihub/data when present
if (fs.existsSync(FIHUB_DATA)) {
  console.log("\nStep 2–3: Copying artifacts to fihub/data/SmartContractLists/...");
  const docsSrc = path.join(ROOT, "docs");
  const docsDest = path.join(FIHUB_DATA, "docs");
  if (fs.existsSync(docsSrc)) {
    if (!fs.existsSync(docsDest)) fs.mkdirSync(docsDest, { recursive: true });
    const thalaPools = path.join(docsSrc, "thala-pools.json");
    if (fs.existsSync(thalaPools)) {
      copy(thalaPools, path.join(docsDest, "thala-pools.json"));
    }
    const ariesMarketIds = path.join(docsSrc, "aries-market-ids.json");
    if (fs.existsSync(ariesMarketIds)) {
      copy(ariesMarketIds, path.join(docsDest, "aries-market-ids.json"));
    }
  }
  const aptosScl = path.join(ROOT, "aptos", "FiHub Aptos Smart Contract List.json");
  const aptosSclDest = path.join(FIHUB_DATA, "aptos", "FiHub Aptos Smart Contract List.json");
  if (fs.existsSync(aptosScl) && fs.existsSync(path.dirname(aptosSclDest))) {
    copy(aptosScl, aptosSclDest);
  }
  const aptosIlSrc = path.join(ROOT, "aptos", "Interaction List");
  const aptosIlDest = path.join(FIHUB_DATA, "aptos", "Interaction List");
  if (fs.existsSync(aptosIlSrc) && fs.existsSync(path.join(FIHUB_DATA, "aptos"))) {
    if (!fs.existsSync(aptosIlDest)) fs.mkdirSync(aptosIlDest, { recursive: true });
    for (const name of fs.readdirSync(aptosIlSrc)) {
      if (name.endsWith(".json")) {
        copy(path.join(aptosIlSrc, name), path.join(aptosIlDest, name));
      }
    }
  }
} else {
  console.log("\nSkipping copy to fihub/data (path not found).");
}

// 4. Optional audit
if (!skipAudit) {
  console.log("\nStep 4: Running IL/SCL param audit (aptos)...");
  const auditStatus = run("node", [
    "SmartContractLists/scripts/audit_il_scl_params.js",
    "--network",
    "aptos",
  ], REPO_ROOT);
  if (auditStatus !== 0) {
    console.error("Audit reported mismatches. Fix SCL/IL and re-run.");
    process.exit(auditStatus);
  }
} else {
  console.log("\nStep 4: Skipped (--no-audit).");
}

console.log("\nRefresh complete.");
