#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Param-count audit: for every IL interaction (module + function), ensure the
 * number of arguments the app would send (from il-param-matrix) matches the
 * SCL function's params.length.
 *
 * Usage (from repo root):
 *   node SmartContractLists/scripts/audit_il_scl_params.js
 *   node SmartContractLists/scripts/audit_il_scl_params.js [--network aptos|movement]
 *
 * Exits 0 if no mismatches, 1 if any mismatch (and prints report).
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const networkArgIndex = argv.indexOf("--network");
const singleNetwork =
  networkArgIndex >= 0 && argv[networkArgIndex + 1]
    ? String(argv[networkArgIndex + 1]).toLowerCase()
    : null;

const NETWORK_CONFIG = {
  movement: {
    sclPath: path.join(ROOT, "FiHub Movement Smart Contract List.json"),
    fallbackSclPath: path.join(ROOT, "FiHub Movement Smart Contract List Generated.json"),
    ilDir: path.join(ROOT, "Interaction List"),
  },
  aptos: {
    sclPath: path.join(ROOT, "aptos", "FiHub Aptos Smart Contract List.json"),
    fallbackSclPath: path.join(ROOT, "aptos", "FiHub Aptos Smart Contract List Generated.json"),
    ilDir: path.join(ROOT, "aptos", "Interaction List"),
  },
};

const MATRIX_PATH = path.join(ROOT, "docs", "il-param-matrix.json");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

/** Normalize Move address to 0x + 64 lowercase hex (align with semantic tests). */
function normalizeAddress(addr) {
  if (!addr || typeof addr !== "string") return addr;
  let hex = addr.startsWith("0x") ? addr.slice(2) : addr;
  hex = hex.padStart(64, "0").toLowerCase();
  return "0x" + hex;
}

/**
 * Build map: normalized module::function -> { paramsLength } from SCL.
 */
function buildSclFunctionMap(scl) {
  const map = new Map();
  for (const contract of scl.smartContracts || []) {
    const moduleId = `${normalizeAddress(contract.address)}::${contract.moduleName}`;
    for (const fn of contract.functions || []) {
      const key = `${moduleId}::${fn.name}`;
      const params = Array.isArray(fn.params) ? fn.params : [];
      map.set(key, { paramsLength: params.length, params });
    }
  }
  return map;
}

/**
 * Load param matrix and return (defaultsMap, overridesMap).
 * defaultsMap: type -> expectedArgCount
 * overridesMap: "type::platform" -> expectedArgCount
 */
function loadParamMatrix(matrixPath) {
  if (!fs.existsSync(matrixPath)) {
    throw new Error(`Param matrix not found: ${matrixPath}`);
  }
  const data = readJson(matrixPath);
  const defaultsMap = new Map();
  for (const row of data.defaults || []) {
    if (row.type != null) defaultsMap.set(String(row.type), row.expectedArgCount);
  }
  const overridesMap = new Map();
  for (const row of data.overrides || []) {
    if (row.type != null && row.platform != null) {
      overridesMap.set(`${row.type}::${row.platform}`, row.expectedArgCount);
    }
  }
  return { defaultsMap, overridesMap };
}

/** Get "our" argument count from matrix: override (type+platform) first, else default (type). */
function getOurArgCount(type, platform, defaultsMap, overridesMap) {
  const overrideKey = `${type}::${platform}`;
  if (overridesMap.has(overrideKey)) return overridesMap.get(overrideKey);
  if (defaultsMap.has(type)) return defaultsMap.get(type);
  return undefined;
}

/**
 * Parse IL interaction module string "0x...::moduleName" into { address, moduleName }.
 */
function parseModule(moduleStr) {
  if (!moduleStr || typeof moduleStr !== "string") return null;
  const idx = moduleStr.indexOf("::");
  if (idx === -1) return null;
  return {
    address: moduleStr.slice(0, idx),
    moduleName: moduleStr.slice(idx + 2),
  };
}

function loadInteractionLists(ilDir) {
  if (!fs.existsSync(ilDir)) return [];
  const files = fs
    .readdirSync(ilDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const lists = [];
  for (const file of files) {
    lists.push({ file, data: readJson(path.join(ilDir, file)) });
  }
  return lists;
}

function runAudit(network) {
  const config = NETWORK_CONFIG[network];
  const sclPath = fs.existsSync(config.sclPath) ? config.sclPath : config.fallbackSclPath;
  if (!fs.existsSync(sclPath)) {
    return { mismatches: [], errors: [`SCL not found: ${sclPath}`] };
  }
  const scl = readJson(sclPath);
  const sclMap = buildSclFunctionMap(scl);
  const { defaultsMap, overridesMap } = loadParamMatrix(MATRIX_PATH);
  const ilLists = loadInteractionLists(config.ilDir);
  const mismatches = [];
  const errors = [];

  for (const { file, data } of ilLists) {
    for (const ix of data.interactions || []) {
      if (!ix.module || !ix.function) continue;
      const parsed = parseModule(ix.module);
      if (!parsed) continue;
      const key = `${normalizeAddress(parsed.address)}::${parsed.moduleName}::${ix.function}`;
      const sclEntry = sclMap.get(key);
      if (!sclEntry) {
        errors.push(`${file}: SCL has no function ${key}`);
        continue;
      }
      const expectedCount = sclEntry.paramsLength;
      const ourCount = getOurArgCount(ix.type, ix.platform, defaultsMap, overridesMap);
      if (ourCount === undefined) {
        continue;
      }
      if (expectedCount !== ourCount) {
        mismatches.push({
          file,
          token: data.token?.symbol,
          platform: ix.platform,
          type: ix.type,
          moduleFunction: `${ix.module}::${ix.function}`,
          expectedCount,
          ourCount,
        });
      }
    }
  }

  return { mismatches, errors };
}

function main() {
  console.log("=== FiHub IL/SCL param-count audit ===\n");

  const networks = singleNetwork
    ? [singleNetwork.includes("aptos") ? "aptos" : "movement"]
    : ["movement", "aptos"];

  const allMismatches = [];
  const allErrors = [];

  for (const network of networks) {
    if (!NETWORK_CONFIG[network]) continue;
    console.log(`Network: ${network}`);
    const { mismatches, errors } = runAudit(network);
    allMismatches.push(...mismatches.map((m) => ({ ...m, network })));
    allErrors.push(...errors);
    if (mismatches.length > 0) {
      console.log(`  Mismatches: ${mismatches.length}`);
    }
    if (errors.length > 0) {
      console.log(`  Errors: ${errors.length}`);
    }
    if (mismatches.length === 0 && errors.length === 0) {
      console.log("  OK");
    }
  }

  if (allErrors.length > 0) {
    console.error("\nErrors (missing SCL or matrix entry):");
    allErrors.slice(0, 20).forEach((e) => console.error(`  • ${e}`));
    if (allErrors.length > 20) console.error(`  ... and ${allErrors.length - 20} more`);
  }

  if (allMismatches.length > 0) {
    console.error("\nParam count mismatches (SCL expected vs our app count):");
    allMismatches.forEach((m) => {
      console.error(
        `  • ${m.file} ${m.token || "?"} ${m.platform} ${m.type} ${m.moduleFunction} => SCL=${m.expectedCount} our=${m.ourCount}`
      );
    });
    console.error(`\nTotal mismatches: ${allMismatches.length}`);
    process.exit(1);
  }

  if (allErrors.length > 0) {
    process.exit(1);
  }

  console.log("\nAudit passed: all IL interactions match param matrix vs SCL.");
}

main();
