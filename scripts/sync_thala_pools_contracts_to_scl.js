#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Extract every unique smart contract (address::module) referenced in thala-pools.json
 * and ensure each appears in the Aptos SCL. Adds missing entries with minimal metadata.
 *
 * Usage (from repo root):
 *   node SmartContractLists/scripts/sync_thala_pools_contracts_to_scl.js
 *
 * Writes: SmartContractLists/aptos/FiHub Aptos Smart Contract List.json (in place).
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const THALA_POOLS_PATH = path.join(ROOT, "docs", "thala-pools.json");
const SCL_PATH = path.join(ROOT, "aptos", "FiHub Aptos Smart Contract List.json");

function normalizeAddress(addr) {
  if (!addr || typeof addr !== "string") return addr;
  let hex = addr.startsWith("0x") ? addr.slice(2) : addr;
  hex = hex.replace(/^0+/, "") || "0";
  hex = hex.padStart(64, "0").toLowerCase();
  return "0x" + hex;
}

/**
 * From a Move type string "0x...::module::Type" or "0x...::module", return { address, moduleName } or null.
 */
function parseTypeRef(typeStr) {
  if (!typeStr || typeof typeStr !== "string") return null;
  const parts = typeStr.split("::");
  if (parts.length < 2) return null;
  const address = normalizeAddress(parts[0]);
  const moduleName = parts[1].trim();
  if (!moduleName) return null;
  return { address, moduleName };
}

/**
 * Collect all unique (address, moduleName) from thala-pools.json.
 */
function extractContractRefsFromThalaPools() {
  const raw = fs.readFileSync(THALA_POOLS_PATH, "utf-8");
  const data = JSON.parse(raw);
  const set = new Map();
  function add(ref) {
    if (!ref) return;
    const key = `${ref.address}::${ref.moduleName}`;
    if (!set.has(key)) set.set(key, ref);
  }
  for (const pool of data.pools || []) {
    for (const t of pool.pool_type_args || []) {
      add(parseTypeRef(t));
    }
    for (const a of pool.assets || []) {
      add(parseTypeRef(a));
    }
    if (pool.lp_coin_name) {
      add(parseTypeRef(pool.lp_coin_name));
    }
  }
  return Array.from(set.values());
}

/**
 * Known platform / name by normalized address (0x+64 hex). Used for new SCL entries from pool refs.
 */
const KNOWN_METADATA_BY_NORMALIZED = {
  "0x0000000000000000000000000000000000000000000000000000000000000001": { platform: "Aptos", name: "Aptos", tags: ["native"] },
  "0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af": { platform: "Thala", name: "ThalaSwap", tags: ["AMM"] },
  "0x6f986d146e4a90b828d8c12c14b6f4e003fdff11a8eecceceb63744363eaac01": { platform: "Thala", name: "Thala", tags: ["lending", "stablecoin"] },
  "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa": { platform: "Panora", name: "Panora Asset", tags: ["bridge"] },
  "0x07fd500c11216f0fe3095d0c4b8aa4d64a4e2e04f83758462f2b127255643615": { platform: "Thala", name: "Thala THL", tags: ["AMM"] },
};

function defaultMetadata(address, moduleName) {
  const meta = KNOWN_METADATA_BY_NORMALIZED[address];
  const platform = meta?.platform || "Third-party";
  const name = meta?.name ? `${meta.name} ${moduleName}` : `${moduleName} (Thala pool ref)`;
  const description = `Referenced in Thala V1 pool registry (docs/thala-pools.json). Module: ${moduleName}. Add full ABI/metadata from chain or SDK if needed.`;
  const tags = meta?.tags ? [...meta.tags] : ["reference"];
  return { platform, name, description, tags };
}

function newSclEntry(ref) {
  const { address, moduleName } = ref;
  const { platform, name, description, tags } = defaultMetadata(address, moduleName);
  return {
    chainId: 1,
    address,
    moduleName,
    platform,
    name,
    description,
    website: platform === "Thala" ? "https://thala.fi" : "",
    tags,
    functions: [],
    structs: [],
    extensions: { audited: false, verified: false },
  };
}

function main() {
  console.log("Syncing Thala pool contract refs to Aptos SCL...\n");

  const refs = extractContractRefsFromThalaPools();
  console.log(`Found ${refs.length} unique contract references in thala-pools.json.`);

  const sclRaw = fs.readFileSync(SCL_PATH, "utf-8");
  const scl = JSON.parse(sclRaw);
  const existing = new Set(
    (scl.smartContracts || []).map((c) => `${normalizeAddress(c.address)}::${c.moduleName}`)
  );

  const toAdd = refs.filter((r) => !existing.has(`${r.address}::${r.moduleName}`));
  if (toAdd.length === 0) {
    console.log("All referenced contracts already exist in the SCL. Nothing to add.");
    return;
  }

  console.log(`Adding ${toAdd.length} missing contract(s) to SCL:\n`);
  for (const r of toAdd) {
    console.log(`  + ${r.address}::${r.moduleName}`);
    scl.smartContracts.push(newSclEntry(r));
  }

  fs.writeFileSync(SCL_PATH, JSON.stringify(scl, null, 2), "utf-8");
  console.log(`\nWrote ${SCL_PATH}`);
}

main();
