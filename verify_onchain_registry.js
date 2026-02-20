#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * On-chain registry verifier for Interaction Lists (IL).
 *
 * What this script does:
 * 1) Loads IL interactions for a target network.
 * 2) Fetches account transactions for reference wallets and extracts observed
 *    entry-function payload identifiers (`module::function`).
 * 3) Checks whether each IL module exists on-chain via `/accounts/{addr}/modules`.
 * 4) Writes a JSON report for auditability and CI-friendly inspection.
 *
 * Usage examples:
 *   node SmartContractLists/verify_onchain_registry.js
 *   node SmartContractLists/verify_onchain_registry.js --network aptos
 *   node SmartContractLists/verify_onchain_registry.js --network movement --limit 150
 *   node SmartContractLists/verify_onchain_registry.js --network aptos --strict
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const argv = process.argv.slice(2);

const DEFAULTS = {
  movement: {
    rpc: "https://mainnet.movementnetwork.xyz/v1",
    ilDir: path.join(ROOT, "Interaction List"),
    wallets: [
      "0x492eb16d46a91af7b2cf0dcdfdf70bfeee33ef12cc5f5441b7d73809630ffe41",
    ],
    outputPath: path.join(ROOT, "docs", "observed_functions_movement.json"),
  },
  aptos: {
    rpc: "https://fullnode.mainnet.aptoslabs.com/v1",
    ilDir: path.join(ROOT, "aptos", "Interaction List"),
    wallets: [
      "0xc4df96883bf084870b365b53841598e17d04a721cac761a6c0e22537964d44eb",
      "0x6b13ac8af6993a87f19fd3cd2c6b31b7cc24ac846d127922078cf8ba888c7c23",
    ],
    outputPath: path.join(ROOT, "docs", "observed_functions_aptos.json"),
  },
};

function argValue(flag, fallback = null) {
  const index = argv.indexOf(flag);
  if (index < 0 || index + 1 >= argv.length) return fallback;
  return argv[index + 1];
}

function hasFlag(flag) {
  return argv.includes(flag);
}

function normalizeNetwork(raw) {
  const value = String(raw || "movement").toLowerCase();
  return value.includes("aptos") ? "aptos" : "movement";
}

function normalizeAddress(addr) {
  const text = String(addr || "").trim();
  if (!text.startsWith("0x")) return text.toLowerCase();
  const hex = text.slice(2).replace(/^0+/, "") || "0";
  return `0x${hex.toLowerCase()}`;
}

function parseWalletArgs(defaultWallets) {
  const wallets = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--wallet" && argv[i + 1]) {
      wallets.push(argv[i + 1]);
      i += 1;
    }
  }
  return wallets.length > 0 ? wallets : defaultWallets;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadIlData(ilDir) {
  if (!fs.existsSync(ilDir)) {
    throw new Error(`Interaction List directory not found: ${ilDir}`);
  }
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

function collectIlIdentifiers(ilLists) {
  const moduleSet = new Set();
  const functionSet = new Set();
  const byToken = {};

  for (const { file, data } of ilLists) {
    const token = String(data?.token?.symbol || file.replace(".json", "")).toUpperCase();
    byToken[token] = [];
    for (const interaction of data.interactions || []) {
      if (!interaction.module || !interaction.function) continue;
      moduleSet.add(interaction.module);
      functionSet.add(`${interaction.module}::${interaction.function}`);
      byToken[token].push({
        type: interaction.type,
        platform: interaction.platform,
        module: interaction.module,
        function: interaction.function,
      });
    }
  }

  return { moduleSet, functionSet, byToken };
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

function extractEntryFunctionId(tx) {
  const payload = tx?.payload;
  if (!payload || payload.type !== "entry_function_payload") return null;
  const fn = payload.function;
  if (!fn || typeof fn !== "string") return null;
  return fn;
}

async function fetchObservedFunctionsFromWallets({ rpc, wallets, limit }) {
  const observedSet = new Set();
  const byWallet = {};
  const fetchErrors = [];

  for (const wallet of wallets) {
    const normalized = normalizeAddress(wallet);
    const url = `${rpc}/accounts/${normalized}/transactions?limit=${limit}`;
    console.log(`- Fetching transactions for ${normalized}`);

    try {
      const txs = await fetchJson(url);
      const walletFns = new Set();
      for (const tx of txs) {
        const fn = extractEntryFunctionId(tx);
        if (!fn) continue;
        walletFns.add(fn);
        observedSet.add(fn);
      }
      byWallet[normalized] = Array.from(walletFns).sort();
      console.log(`  observed entry functions: ${walletFns.size}`);
    } catch (error) {
      fetchErrors.push({
        wallet: normalized,
        error: String(error.message || error),
      });
      byWallet[normalized] = [];
      console.log(`  failed: ${String(error.message || error)}`);
    }
  }

  return {
    observedSet,
    byWallet,
    fetchErrors,
  };
}

function splitModuleId(moduleId) {
  const pieces = String(moduleId || "").split("::");
  if (pieces.length < 2) return { account: "", moduleName: "" };
  return {
    account: pieces[0],
    moduleName: pieces[1],
  };
}

async function checkModuleExistence({ rpc, modules }) {
  const accountModulesCache = new Map(); // accountKey -> { names: Set, abiList: array of { name, exposed_functions } }
  const moduleResults = [];
  const fetchErrors = [];

  for (const moduleId of modules) {
    const { account, moduleName } = splitModuleId(moduleId);
    if (!account || !moduleName) {
      moduleResults.push({ module: moduleId, exists: false, reason: "invalid_module_id" });
      continue;
    }

    const accountKey = normalizeAddress(account);
    if (!accountModulesCache.has(accountKey)) {
      const url = `${rpc}/accounts/${accountKey}/modules`;
      try {
        const modulesResponse = await fetchJson(url);
        const names = new Set();
        const abiList = [];
        for (const mod of modulesResponse) {
          const name = mod?.abi?.name || mod?.name || "";
          if (name) names.add(name);
          abiList.push({
            name,
            exposed_functions: mod?.abi?.exposed_functions || [],
          });
        }
        accountModulesCache.set(accountKey, { names, abiList });
      } catch (error) {
        fetchErrors.push({
          account: accountKey,
          error: String(error.message || error),
        });
        accountModulesCache.set(accountKey, null);
      }
    }

    const cached = accountModulesCache.get(accountKey);
    if (cached === null) {
      moduleResults.push({ module: moduleId, exists: false, reason: "account_modules_fetch_failed" });
      continue;
    }
    moduleResults.push({
      module: moduleId,
      exists: cached.names.has(moduleName),
      reason: cached.names.has(moduleName) ? "ok" : "module_not_found",
    });
  }

  return { moduleResults, fetchErrors, accountModulesCache };
}

/**
 * For each IL module::function, check that the function exists on the module ABI and is_entry === true.
 * Uses the same account/modules cache as checkModuleExistence.
 */
function checkFunctionEntry(moduleFunctionPairs, accountModulesCache) {
  const functionResults = [];
  for (const { moduleId, functionName } of moduleFunctionPairs) {
    const { account, moduleName } = splitModuleId(moduleId);
    if (!account || !functionName) {
      functionResults.push({
        module: moduleId,
        function: functionName,
        ok: false,
        reason: "invalid_module_or_function",
      });
      continue;
    }
    const accountKey = normalizeAddress(account);
    const cached = accountModulesCache.get(accountKey);
    if (!cached) {
      functionResults.push({
        module: moduleId,
        function: functionName,
        ok: false,
        reason: "account_modules_fetch_failed",
      });
      continue;
    }
    const modAbi = cached.abiList.find((m) => m.name === moduleName);
    if (!modAbi) {
      functionResults.push({
        module: moduleId,
        function: functionName,
        ok: false,
        reason: "module_not_found",
      });
      continue;
    }
    const exposed = modAbi.exposed_functions || [];
    const fn = exposed.find((f) => (f.name || f) === functionName);
    if (!fn) {
      functionResults.push({
        module: moduleId,
        function: functionName,
        ok: false,
        reason: "function_not_found",
      });
      continue;
    }
    const isEntry = typeof fn.is_entry === "boolean" ? fn.is_entry : fn.is_entry === true;
    if (!isEntry) {
      functionResults.push({
        module: moduleId,
        function: functionName,
        ok: false,
        reason: "not_entry",
      });
      continue;
    }
    functionResults.push({
      module: moduleId,
      function: functionName,
      ok: true,
      reason: "ok",
    });
  }
  return functionResults;
}

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function main() {
  const network = normalizeNetwork(argValue("--network", "movement"));
  const cfg = DEFAULTS[network];
  const rpc = argValue("--rpc", cfg.rpc);
  const limit = Number.parseInt(argValue("--limit", "200"), 10);
  const strict = hasFlag("--strict");
  const outputPath = argValue("--output", cfg.outputPath);
  const wallets = parseWalletArgs(cfg.wallets);

  console.log("=== FiHub On-chain Registry Verifier ===");
  console.log(`network: ${network}`);
  console.log(`rpc: ${rpc}`);
  console.log(`wallets: ${wallets.join(", ")}`);
  console.log(`tx limit per wallet: ${limit}`);

  const ilLists = loadIlData(cfg.ilDir);
  const { moduleSet, functionSet, byToken } = collectIlIdentifiers(ilLists);

  console.log(`loaded IL files: ${ilLists.length}`);
  console.log(`unique IL modules: ${moduleSet.size}`);
  console.log(`unique IL functions: ${functionSet.size}`);

  const observed = await fetchObservedFunctionsFromWallets({ rpc, wallets, limit });
  const observedInIl = [];
  const observedNotInIl = [];

  for (const fn of observed.observedSet) {
    if (functionSet.has(fn)) observedInIl.push(fn);
    else observedNotInIl.push(fn);
  }

  const moduleCheck = await checkModuleExistence({
    rpc,
    modules: Array.from(moduleSet).sort(),
  });
  const missingModules = moduleCheck.moduleResults
    .filter((item) => !item.exists)
    .map((item) => item.module);

  const moduleFunctionPairs = Array.from(functionSet).map((mf) => {
    const idx = mf.lastIndexOf("::");
    const moduleId = idx >= 0 ? mf.slice(0, idx) : mf;
    const functionName = idx >= 0 ? mf.slice(idx + 2) : "";
    return { moduleId, functionName };
  });
  const functionCheck = checkFunctionEntry(
    moduleFunctionPairs,
    moduleCheck.accountModulesCache || new Map()
  );
  const missingOrNotEntry = functionCheck.filter((item) => !item.ok);

  const report = {
    generatedAt: new Date().toISOString(),
    network,
    rpc,
    wallets: wallets.map(normalizeAddress),
    il: {
      fileCount: ilLists.length,
      interactionCount: ilLists.reduce(
        (sum, { data }) => sum + (data.interactions || []).length,
        0
      ),
      uniqueModules: moduleSet.size,
      uniqueFunctions: functionSet.size,
      byToken,
    },
    observed: {
      uniqueEntryFunctions: observed.observedSet.size,
      byWallet: observed.byWallet,
      inIlCount: observedInIl.length,
      notInIlCount: observedNotInIl.length,
      inIl: observedInIl.sort(),
      notInIl: observedNotInIl.sort(),
      walletFetchErrors: observed.fetchErrors,
    },
    moduleExistence: {
      checked: moduleCheck.moduleResults.length,
      missingCount: missingModules.length,
      missingModules,
      accountFetchErrors: moduleCheck.fetchErrors,
    },
    functionEntry: {
      checked: functionCheck.length,
      missingOrNotEntryCount: missingOrNotEntry.length,
      missingOrNotEntry: missingOrNotEntry.map((item) => ({
        module: item.module,
        function: item.function,
        reason: item.reason,
      })),
      results: functionCheck,
    },
  };

  ensureDirForFile(outputPath);
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`report written: ${outputPath}`);

  if (missingOrNotEntry.length > 0) {
    console.log(`function entry check: ${missingOrNotEntry.length} missing or not_entry`);
  }
  if (strict && (missingModules.length > 0 || missingOrNotEntry.length > 0 || observed.fetchErrors.length > 0)) {
    console.error("strict mode failed: missing modules, function_not_found/not_entry, or wallet fetch errors.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("fatal:", String(error.message || error));
  process.exit(1);
});
