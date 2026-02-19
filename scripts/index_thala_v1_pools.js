#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * ThalaSwap V1 pool indexer: enumerate weighted (and optionally stable) pools
 * on-chain and produce a mapping from pool identifier to type arguments and assets.
 *
 * Usage (from repo root):
 *   APTOS_RPC_URL=https://fullnode.mainnet.aptoslabs.com/v1 node SmartContractLists/scripts/index_thala_v1_pools.js
 *
 * Output: docs/thala-pools.json
 * Runtime type_arguments for swap/LP = pool_type_args.concat([fromType, toType]).
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const THALA_V1_ADDRESS = "0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af";
const RPC_URL = process.env.APTOS_RPC_URL || "https://fullnode.mainnet.aptoslabs.com/v1";
const OUT_PATH = path.join(ROOT, "docs", "thala-pools.json");

async function viewRequest(functionId, typeArgs = [], args = []) {
  const res = await fetch(`${RPC_URL.replace(/\/v1\/?$/, "")}/v1/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      function: functionId,
      type_arguments: typeArgs,
      arguments: args,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`View failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Parse LP token type name string into pool-defining type arguments.
 * Format is contract-specific; common pattern: "0x...::module::Type<A,B,C,...>".
 * Returns array of type strings (e.g. 9 for weighted pool) or empty if unparseable.
 */
function parseLpNameToTypeArgs(lpCoinName) {
  if (!lpCoinName || typeof lpCoinName !== "string") return [];
  const trimmed = lpCoinName.trim();
  if (!trimmed) return [];
  const match = trimmed.match(/<([^>]+)>/);
  if (!match) return [];
  const inner = match[1];
  const args = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "," && depth === 0) {
      args.push(current.trim());
      current = "";
    } else {
      if (c === "<") depth++;
      else if (c === ">") depth--;
      current += c;
    }
  }
  if (current) args.push(current.trim());
  return args;
}

async function indexWeightedPools() {
  const pools = [];
  let nextPoolId = 0;
  try {
    const raw = await viewRequest(
      `${THALA_V1_ADDRESS}::weighted_pool::next_pool_id`,
      [],
      []
    );
    nextPoolId = Number(raw);
  } catch (e) {
    console.warn("weighted_pool::next_pool_id not available:", e.message);
    return pools;
  }

  const swapEntrypoint = `${THALA_V1_ADDRESS}::weighted_pool_scripts::swap_exact_in`;
  const addLpEntrypoint = `${THALA_V1_ADDRESS}::weighted_pool_scripts::add_liquidity`;

  for (let id = 0; id < nextPoolId; id++) {
    try {
      const lpName = await viewRequest(
        `${THALA_V1_ADDRESS}::weighted_pool::lp_name_by_id`,
        [],
        [String(id)]
      );
      const lpCoinName = typeof lpName === "string" ? lpName : String(lpName ?? "");
      const poolTypeArgs = parseLpNameToTypeArgs(lpCoinName);
      // First two type args are the pool's coin/asset types (for resolver matching).
      const assets = poolTypeArgs.length >= 2 ? poolTypeArgs.slice(0, 2) : poolTypeArgs.slice();
      pools.push({
        pool_id: id,
        lp_coin_name: lpCoinName,
        pool_kind: "weighted",
        pool_type_args: poolTypeArgs,
        assets,
        swap_entrypoint: swapEntrypoint,
        add_liquidity_entrypoint: addLpEntrypoint,
        note: "Runtime type_arguments = pool_type_args.concat([fromType, toType])",
        pool_address: THALA_V1_ADDRESS,
      });
    } catch (e) {
      console.warn(`Pool id ${id}: ${e.message}`);
    }
  }
  return pools;
}

async function main() {
  console.log("Thala V1 pool indexer: fetching weighted pools...");
  const weighted = await indexWeightedPools();
  console.log(`Found ${weighted.length} weighted pool(s).`);

  const report = {
    version: 1,
    lastIndexedAt: new Date().toISOString(),
    rpcUrl: RPC_URL,
    thalaV1Address: THALA_V1_ADDRESS,
    contractRef: `${THALA_V1_ADDRESS}::weighted_pool`,
    sourceType: "indexer",
    pools: weighted,
    note: "Runtime type_arguments for swap/LP = pool_type_args + [fromType, toType]. Contract-scoped: data from views on contractRef.",
  };

  const outDir = path.dirname(OUT_PATH);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2), "utf-8");
  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
