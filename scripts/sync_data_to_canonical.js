#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sync updates from fihub/data/SmartContractLists back to the canonical SmartContractLists.
 * Use when edits were made in fihub/data (e.g. SCL extensions, IL entries) and the canonical
 * repo should reflect them. Run from repo root or SmartContractLists/.
 *
 * Usage (from repo root):
 *   node SmartContractLists/scripts/sync_data_to_canonical.js
 *
 * Copies:
 *   fihub/data/SmartContractLists/aptos/FiHub Aptos Smart Contract List.json → SmartContractLists/aptos/
 *   fihub/data/SmartContractLists/aptos/Interaction List/*.json → SmartContractLists/aptos/Interaction List/
 *   fihub/data/SmartContractLists/docs/*.json (thala-pools, aries-market-ids, etc.) → SmartContractLists/docs/
 *   fihub/data/SmartContractLists/FiHub Movement*.json → SmartContractLists/
 *   fihub/data/SmartContractLists/Interaction List/*.json → SmartContractLists/Interaction List/
 */

const fs = require("fs");
const path = require("path");

const SCRIPTS_DIR = __dirname;
const ROOT = path.resolve(SCRIPTS_DIR, "..");
const REPO_ROOT = path.resolve(ROOT, "..");
const FIHUB_DATA = path.join(REPO_ROOT, "fihub", "data", "SmartContractLists");

function copy(src, dest) {
  if (!fs.existsSync(src)) return false;
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log(`Copied ${path.relative(REPO_ROOT, src)} -> ${path.relative(REPO_ROOT, dest)}`);
  return true;
}

function copyAllJson(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir)) {
    if (name.endsWith(".json")) {
      copy(path.join(srcDir, name), path.join(destDir, name));
    }
  }
}

console.log("=== Sync fihub/data/SmartContractLists -> SmartContractLists (canonical) ===\n");

if (!fs.existsSync(FIHUB_DATA)) {
  console.error("fihub/data/SmartContractLists not found. Run from repo root.");
  process.exit(1);
}

// Aptos SCL
const aptosSclSrc = path.join(FIHUB_DATA, "aptos", "FiHub Aptos Smart Contract List.json");
const aptosSclDest = path.join(ROOT, "aptos", "FiHub Aptos Smart Contract List.json");
if (copy(aptosSclSrc, aptosSclDest)) {
  // ensure aptos dir exists for next step
  if (!fs.existsSync(path.join(ROOT, "aptos"))) {
    fs.mkdirSync(path.join(ROOT, "aptos"), { recursive: true });
  }
}

// Aptos Interaction List
const aptosIlSrc = path.join(FIHUB_DATA, "aptos", "Interaction List");
const aptosIlDest = path.join(ROOT, "aptos", "Interaction List");
if (fs.existsSync(aptosIlSrc)) {
  copyAllJson(aptosIlSrc, aptosIlDest);
}

// Docs (runtime data: thala-pools, aries-market-ids, echelon-market-indices, etc.)
const docsSrc = path.join(FIHUB_DATA, "docs");
const docsDest = path.join(ROOT, "docs");
if (fs.existsSync(docsSrc)) {
  copyAllJson(docsSrc, docsDest);
}

// Movement SCL (root-level)
const movementScl = path.join(FIHUB_DATA, "FiHub Movement Smart Contract List.json");
copy(movementScl, path.join(ROOT, "FiHub Movement Smart Contract List.json"));
const movementSclGen = path.join(FIHUB_DATA, "FiHub Movement Smart Contract List Generated.json");
copy(movementSclGen, path.join(ROOT, "FiHub Movement Smart Contract List Generated.json"));

// Movement Interaction List (root-level)
const movementIlSrc = path.join(FIHUB_DATA, "Interaction List");
const movementIlDest = path.join(ROOT, "Interaction List");
if (fs.existsSync(movementIlSrc)) {
  copyAllJson(movementIlSrc, movementIlDest);
}

console.log("\nSync complete. Canonical SmartContractLists now reflects fihub/data.");
