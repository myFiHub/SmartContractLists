#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Enrich SCL contracts that have empty functions (e.g. those added from thala-pools sync)
 * by fetching module ABI from Aptos RPC and filling in functions + structs.
 *
 * Usage (from repo root):
 *   node SmartContractLists/scripts/enrich_scl_from_onchain.js
 *   APTOS_RPC_URL=https://fullnode.mainnet.aptoslabs.com/v1 node SmartContractLists/scripts/enrich_scl_from_onchain.js
 *
 * Targets: contracts in Aptos SCL with functions.length === 0 and description containing
 * "Referenced in Thala V1 pool registry" (or all empty-function contracts if --all-empty).
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SCL_PATH = path.join(ROOT, "aptos", "FiHub Aptos Smart Contract List.json");
const RPC_BASE = (process.env.APTOS_RPC_URL || "https://fullnode.mainnet.aptoslabs.com/v1").replace(/\/v1\/?$/, "");

const argv = process.argv.slice(2);
const allEmpty = argv.includes("--all-empty");

function normalizeAddress(addr) {
  if (!addr || typeof addr !== "string") return addr;
  let hex = addr.startsWith("0x") ? addr.slice(2) : addr;
  hex = hex.replace(/^0+/, "") || "0";
  hex = hex.padStart(64, "0").toLowerCase();
  return "0x" + hex;
}

function transformFunction(f) {
  const genericTypeParams = Array.isArray(f.generic_type_params) ? f.generic_type_params.length : 0;
  return {
    name: f.name || "",
    visibility: f.visibility || "public",
    is_entry: Boolean(f.is_entry),
    generic_type_params: genericTypeParams,
    params: Array.isArray(f.params) ? f.params : [],
    return: Array.isArray(f.return) ? f.return : [],
    acquires: Array.isArray(f.acquires) ? f.acquires : [],
    audited: false,
    verified: true,
    auditors: [],
  };
}

function transformStruct(s) {
  return {
    name: s.name || "",
    abilities: Array.isArray(s.abilities) ? s.abilities : [],
    fields: Array.isArray(s.fields)
      ? s.fields.map((f) => ({ name: f.name || "", type: f.type || "" }))
      : [],
  };
}

async function fetchAccountModules(address) {
  const url = `${RPC_BASE}/v1/accounts/${address}/modules`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data)) return null;
  return data
    .filter((m) => m && m.abi)
    .map((m) => ({ ...m.abi, address: m.abi.address || address }));
}

async function run() {
  const sclRaw = fs.readFileSync(SCL_PATH, "utf-8");
  const scl = JSON.parse(sclRaw);
  const contracts = scl.smartContracts || [];

  const toEnrich = contracts.filter((c) => {
    const hasNoFunctions = !Array.isArray(c.functions) || c.functions.length === 0;
    if (!hasNoFunctions) return false;
    if (allEmpty) return true;
    const desc = (c.description || "");
    return desc.includes("Referenced in Thala V1 pool registry") || desc.includes("Thala pool ref");
  });

  if (toEnrich.length === 0) {
    console.log("No contracts to enrich (empty functions + Thala ref). Use --all-empty to target any empty-function entry.");
    return;
  }

  const byAddress = new Map();
  for (const c of toEnrich) {
    const addr = normalizeAddress(c.address);
    if (!byAddress.has(addr)) byAddress.set(addr, []);
    byAddress.get(addr).push(c);
  }

  console.log(`Enriching ${toEnrich.length} contract(s) across ${byAddress.size} address(es)...\n`);

  let updated = 0;
  for (const [addr, list] of byAddress) {
    const displayAddr = addr.slice(0, 10) + "..." + addr.slice(-6);
    try {
      const modules = await fetchAccountModules(addr);
      if (!modules || modules.length === 0) {
        console.log(`  ${displayAddr}: no modules returned (skip)`);
        continue;
      }
      const byModuleName = new Map(modules.map((m) => [m.name, m]));
      for (const contract of list) {
        const mod = byModuleName.get(contract.moduleName);
        if (!mod) {
          console.log(`  ${displayAddr}::${contract.moduleName}: not in ABI (skip)`);
          continue;
        }
        const fns = (mod.exposed_functions || []).map(transformFunction);
        const structs = (mod.structs || []).map(transformStruct);
        contract.functions = fns;
        contract.structs = structs;
        if (Array.isArray(mod.friends) && mod.friends.length > 0) {
          contract.extensions = contract.extensions || {};
          contract.extensions.friends = mod.friends;
        }
        contract.extensions = contract.extensions || {};
        contract.extensions.verified = true;
        updated++;
        console.log(`  ${displayAddr}::${contract.moduleName}: ${fns.length} functions, ${structs.length} structs`);
      }
    } catch (e) {
      console.warn(`  ${displayAddr}: fetch failed:`, e.message);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  fs.writeFileSync(SCL_PATH, JSON.stringify(scl, null, 2), "utf-8");
  console.log(`\nUpdated ${updated} contract(s). Wrote ${SCL_PATH}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
