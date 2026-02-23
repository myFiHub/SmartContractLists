#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Registry mapping validator for SCL <-> IL <-> protocol matrix.
 *
 * Usage:
 *   node SmartContractLists/validate_registry_mappings.js
 *
 * What it checks:
 * 1) IL interaction module exists in curated SCL.
 * 2) IL interaction module::function exists in curated SCL.
 * 3) Every IL route step (type/platform) has a matching interaction.
 * 4) Protocol matrix entries exist in token ILs with exact module/function.
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const argv = process.argv.slice(2);
const networkArgIndex = argv.indexOf("--network");
const networkArg =
  networkArgIndex >= 0 && argv[networkArgIndex + 1]
    ? argv[networkArgIndex + 1]
    : "movement";
const network = String(networkArg).toLowerCase().includes("aptos")
  ? "aptos"
  : "movement";

const NETWORK_CONFIG = {
  movement: {
    sclPath: path.join(ROOT, "FiHub Movement Smart Contract List.json"),
    fallbackSclPath: path.join(ROOT, "FiHub Movement Smart Contract List Generated.json"),
    ilDir: path.join(ROOT, "Interaction List"),
    matrixPath: path.join(ROOT, "docs", "protocol-interaction-matrix.json"),
  },
  aptos: {
    sclPath: path.join(ROOT, "aptos", "FiHub Aptos Smart Contract List.json"),
    fallbackSclPath: path.join(ROOT, "aptos", "FiHub Aptos Smart Contract List Generated.json"),
    ilDir: path.join(ROOT, "aptos", "Interaction List"),
    matrixPath: path.join(ROOT, "docs", "aptos-protocol-interaction-matrix.json"),
  },
};

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function assertPathExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file or directory: ${filePath}`);
  }
}

function loadIndexFromScl(scl) {
  const moduleSet = new Set();
  const functionSet = new Set();

  for (const contract of scl.smartContracts || []) {
    const moduleId = `${contract.address}::${contract.moduleName}`;
    moduleSet.add(moduleId);
    for (const fn of contract.functions || []) {
      functionSet.add(`${moduleId}::${fn.name}`);
    }
  }

  return { moduleSet, functionSet };
}

function loadInteractionLists() {
  const { ilDir } = NETWORK_CONFIG[network];
  const files = fs
    .readdirSync(ilDir)
    .filter((file) => file.endsWith(".json"))
    .sort();
  const lists = [];
  for (const file of files) {
    const data = readJson(path.join(ilDir, file));
    lists.push({ file, data });
  }
  return lists;
}

function buildInteractionLookup(interactions) {
  const lookup = new Map();
  for (const ix of interactions || []) {
    const key = `${ix.type}::${ix.platform}`;
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key).push(ix);
  }
  return lookup;
}

function validateIlAgainstScl(ilFile, ilData, sclIndex) {
  const errors = [];

  for (const ix of ilData.interactions || []) {
    if (!ix.module || !ix.function) {
      errors.push(`${ilFile}: interaction missing module/function`);
      continue;
    }
    if (!sclIndex.moduleSet.has(ix.module)) {
      errors.push(`${ilFile}: module not in SCL -> ${ix.module}`);
    }
    const fnId = `${ix.module}::${ix.function}`;
    if (!sclIndex.functionSet.has(fnId)) {
      errors.push(`${ilFile}: function not in SCL -> ${fnId}`);
    }
  }

  const interactionLookup = buildInteractionLookup(ilData.interactions || []);
  for (const [routeKey, steps] of Object.entries(ilData.routes || {})) {
    for (const step of steps) {
      const key = `${step.type}::${step.platform}`;
      if (!interactionLookup.has(key)) {
        errors.push(
          `${ilFile}: route step missing interaction -> route=${routeKey} step=${key}`
        );
      }
    }
  }

  return errors;
}

function validateMatrix(matrix, ilMap) {
  const errors = [];

  for (const protocol of matrix.protocols || []) {
    for (const mapping of protocol.interactions || []) {
      const expectedRouteKeys = new Set(mapping.routeKeys || []);
      const expectedModule = mapping.module;
      const expectedFunction = mapping.function;

      for (const token of mapping.tokens || []) {
        const il = ilMap.get(token.toUpperCase());
        if (!il) {
          errors.push(
            `matrix: token ${token} missing IL while validating ${protocol.name}/${mapping.type}`
          );
          continue;
        }

        const candidates = (il.interactions || []).filter(
          (ix) => ix.type === mapping.type && ix.platform === protocol.name
        );
        if (candidates.length === 0) {
          errors.push(
            `matrix: no IL interaction for ${token} ${protocol.name} ${mapping.type}`
          );
          continue;
        }

        const exact = candidates.some(
          (ix) => ix.module === expectedModule && ix.function === expectedFunction
        );
        if (!exact) {
          errors.push(
            `matrix: ${token} ${protocol.name} ${mapping.type} mismatched module/function`
          );
        }

        const routes = il.routes || {};
        for (const routeKey of expectedRouteKeys) {
          if (!(routeKey in routes)) continue;
          const hasExpectedStep = (routes[routeKey] || []).some(
            (step) => step.type === mapping.type && step.platform === protocol.name
          );
          if (!hasExpectedStep) {
            errors.push(
              `matrix: route ${routeKey} in ${token} missing ${mapping.type}/${protocol.name}`
            );
          }
        }
      }
    }
  }

  return errors;
}

function main() {
  console.log("=== FiHub Registry Mapping Validator ===");
  console.log(`Network: ${network}`);

  const { sclPath, fallbackSclPath, ilDir, matrixPath } = NETWORK_CONFIG[network];
  const effectiveSclPath = fs.existsSync(sclPath) ? sclPath : fallbackSclPath;
  assertPathExists(effectiveSclPath);
  assertPathExists(ilDir);
  assertPathExists(matrixPath);

  const scl = readJson(effectiveSclPath);
  const sclIndex = loadIndexFromScl(scl);
  const ilLists = loadInteractionLists();
  const matrix = readJson(matrixPath);

  const ilMap = new Map();
  for (const { data } of ilLists) {
    const symbol = (data.token?.symbol || "").toUpperCase();
    if (symbol) ilMap.set(symbol, data);
  }

  const errors = [];
  for (const { file, data } of ilLists) {
    const ilErrors = validateIlAgainstScl(file, data, sclIndex);
    if (ilErrors.length > 0) {
      console.log(`- ${file}: ${ilErrors.length} issue(s)`);
      errors.push(...ilErrors);
    } else {
      console.log(`- ${file}: OK`);
    }
  }

  const matrixErrors = validateMatrix(matrix, ilMap);
  if (matrixErrors.length > 0) {
    console.log(`- protocol matrix: ${matrixErrors.length} issue(s)`);
    errors.push(...matrixErrors);
  } else {
    console.log("- protocol matrix: OK");
  }

  if (errors.length > 0) {
    console.error("\nValidation failed. First issues:");
    for (const err of errors.slice(0, 25)) {
      console.error(`  • ${err}`);
    }
    console.error(`\nTotal issues: ${errors.length}`);
    process.exit(1);
  }

  console.log("\nValidation passed.");
}

try {
  main();
} catch (err) {
  console.error("Fatal error:", err.message);
  process.exit(1);
}
