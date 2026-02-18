#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * verify_overlap.js — generates a token–protocol and route-step overlap report.
 *
 * For each IL file (token), collects (platform, type) pairs from both interactions
 * and route steps. Outputs:
 *   - tokenToProtocols: for each token, all (platform, type) pairs.
 *   - protocolToTokens: for each "platform::type", the tokens that have it.
 *   - routeSteps: for each named route key, the ordered steps.
 *   - routeOverlap: pairs of routes that share at least one (platform, type).
 *
 * Usage:
 *   node SmartContractLists/scripts/verify_overlap.js
 *   node SmartContractLists/scripts/verify_overlap.js --network aptos
 *
 * Output: SmartContractLists/docs/overlap-report.json
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
  aptos: {
    ilDir: path.join(ROOT, "aptos", "Interaction List"),
  },
  movement: {
    ilDir: path.join(ROOT, "Interaction List"),
  },
};

const OUTPUT_PATH = path.join(ROOT, "docs", "overlap-report.json");

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Load all IL JSON files from a directory.
 * Returns an array of { symbol, data } objects.
 */
function loadILs(ilDir) {
  if (!fs.existsSync(ilDir)) return [];
  return fs
    .readdirSync(ilDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(ilDir, f), "utf8");
      try {
        const data = JSON.parse(raw);
        const symbol = data.token?.symbol || path.basename(f, ".json");
        return { symbol, data };
      } catch {
        console.warn(`  [warn] Could not parse ${f}`);
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Collect unique (platform, type) pairs from an IL's interactions and routes.
 */
function collectPairs(ilData) {
  const pairs = new Set();

  // From interactions
  if (Array.isArray(ilData.interactions)) {
    for (const ix of ilData.interactions) {
      if (ix.platform && ix.type) {
        pairs.add(`${ix.platform}::${ix.type}`);
      }
    }
  }

  // From route steps
  if (ilData.routes && typeof ilData.routes === "object") {
    for (const steps of Object.values(ilData.routes)) {
      if (Array.isArray(steps)) {
        for (const step of steps) {
          if (step.platform && step.type) {
            pairs.add(`${step.platform}::${step.type}`);
          }
        }
      }
    }
  }

  return pairs;
}

// ── Main ──────────────────────────────────────────────────────────────

function run() {
  const networks = singleNetwork
    ? [singleNetwork]
    : Object.keys(NETWORK_CONFIG);

  const tokenToProtocols = {};
  const protocolToTokens = {};
  const routeSteps = {};
  const processedNetworks = [];

  for (const network of networks) {
    const config = NETWORK_CONFIG[network];
    if (!config) {
      console.warn(`Unknown network: ${network}`);
      continue;
    }
    processedNetworks.push(network);
    console.log(`\n── Processing ${network} ──`);

    const ils = loadILs(config.ilDir);
    console.log(`  Found ${ils.length} IL file(s)`);

    for (const { symbol, data } of ils) {
      // Token → Protocols
      const pairs = collectPairs(data);
      const pairArr = Array.from(pairs).map((p) => {
        const [platform, type] = p.split("::");
        return { platform, type };
      });
      tokenToProtocols[symbol] = pairArr;

      // Protocol → Tokens
      for (const pair of pairs) {
        if (!protocolToTokens[pair]) protocolToTokens[pair] = [];
        if (!protocolToTokens[pair].includes(symbol)) {
          protocolToTokens[pair].push(symbol);
        }
      }

      // Route steps
      if (data.routes && typeof data.routes === "object") {
        for (const [routeKey, steps] of Object.entries(data.routes)) {
          if (!Array.isArray(steps)) continue;
          // Prefix with token to avoid collisions across ILs
          const fullKey = `${symbol}/${routeKey}`;
          routeSteps[fullKey] = steps.map((s) => ({
            platform: s.platform,
            type: s.type,
          }));
        }
      }
    }
  }

  // Compute route overlap: pairs of routes sharing at least one (platform, type) step
  const routeKeys = Object.keys(routeSteps);
  const routeOverlap = [];
  for (let i = 0; i < routeKeys.length; i++) {
    const stepsA = routeSteps[routeKeys[i]];
    const setA = new Set(stepsA.map((s) => `${s.platform}::${s.type}`));
    for (let j = i + 1; j < routeKeys.length; j++) {
      const stepsB = routeSteps[routeKeys[j]];
      const shared = stepsB.filter((s) => setA.has(`${s.platform}::${s.type}`));
      if (shared.length > 0) {
        routeOverlap.push({
          routeA: routeKeys[i],
          routeB: routeKeys[j],
          sharedSteps: shared,
        });
      }
    }
  }

  // Build report
  const report = {
    generatedAt: new Date().toISOString(),
    networks: processedNetworks,
    tokenToProtocols,
    protocolToTokens,
    routeSteps,
    routeOverlap,
  };

  // Summary
  const tokenCount = Object.keys(tokenToProtocols).length;
  const protocolCount = Object.keys(protocolToTokens).length;
  const routeCount = Object.keys(routeSteps).length;
  console.log(`\n── Summary ──`);
  console.log(`  Tokens: ${tokenCount}`);
  console.log(`  Unique (platform, type) pairs: ${protocolCount}`);
  console.log(`  Named routes: ${routeCount}`);
  console.log(`  Route overlap pairs: ${routeOverlap.length}`);

  // Write output
  const docsDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2) + "\n");
  console.log(`\n  Report written to: ${OUTPUT_PATH}`);
}

run();
