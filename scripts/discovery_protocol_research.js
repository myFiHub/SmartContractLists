#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Protocol discovery for outside research: fetch on-chain modules, docs (audits),
 * and external registries to update SCL/IL and docs.
 *
 * Usage (from repo root):
 *   node SmartContractLists/scripts/discovery_protocol_research.js [thala|liquidswap|echo|all]
 *   APTOS_RPC_URL=https://fullnode.mainnet.aptoslabs.com/v1 node SmartContractLists/scripts/discovery_protocol_research.js all
 *
 * Outputs: docs/discovery-report-<protocol>.json and docs/audits-<protocol>.json (when applicable).
 * Runbook: SmartContractLists/docs/DISCOVERY_RUNBOOK.md
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const RPC_BASE = (process.env.APTOS_RPC_URL || "https://fullnode.mainnet.aptoslabs.com/v1").replace(/\/v1\/?$/, "");

// Protocol addresses (from protocol matrix and user-provided explorer links)
const ADDRESSES = {
  thala: {
    thalaSwapV1: "0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af",
    thalaProtocol: "0x6f986d146e4a90b828d8c12c14b6f4e003fdff11a8eecceceb63744363eaac01",
    thalaStakingOrScripts: "0xfaf4e633ae9eb31366c9ca24214231760926576c7b625313b3688b5e900731f6",
  },
  liquidswap: {
    routerV2: "0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12",
    harvest: "0xb247ddeee87e848315caf9a33b8e4c71ac53db888cb88143d62d2370cca0ead2",
    liquidswapV1Deployer: "0x54cb0bb2c18564b86e34539b9f89cfe1186e39d89fce54e1cd007b8e61673a85",
  },
  echo: {
    vault: "0xb2c7780f0a255a6137e5b39733f5a4c85fe093c549de5c359c1232deef57d1b7",
  },
};

const AUDIT_SOURCES = {
  thala: "https://docs.thala.fi/overview/operations/audits",
  echo: "https://echo-protocol.gitbook.io/echo-protocol/faq/audits",
};

const GITHUB_RAW = {
  liquidswapPools: "https://raw.githubusercontent.com/pontem-network/coins-registry/main/src/pools.json",
  liquidswapCoins: "https://raw.githubusercontent.com/pontem-network/coins-registry/main/src/coins.json",
};

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000), ...opts });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.text();
}

async function fetchAccountModules(address) {
  const url = `${RPC_BASE}/v1/accounts/${address}/modules`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data)) return null;
  return data.filter((m) => m && m.abi).map((m) => ({ name: m.abi.name, address: m.abi.address || address, entryFunctions: (m.abi.exposed_functions || []).filter((f) => f.is_entry).map((f) => ({ name: f.name, params: f.params })) }));
}

function extractPdfLinksFromHtml(html, baseUrl) {
  const links = [];
  const hrefRegex = /href=["']([^"']+\.pdf[^"']*)["']/gi;
  let m;
  while ((m = hrefRegex.exec(html)) !== null) {
    let url = m[1];
    if (url.startsWith("//")) url = "https:" + url;
    else if (url.startsWith("/")) url = new URL(url, baseUrl).href;
    else if (!url.startsWith("http")) url = new URL(url, baseUrl).href;
    links.push(url);
  }
  const gitbookRegex = /(https?:\/\/[^\s"']+\.gitbook\.io[^\s"']*\.pdf[^\s"']*)/gi;
  while ((m = gitbookRegex.exec(html)) !== null) links.push(m[1]);
  return [...new Set(links)];
}

async function runThala() {
  const report = { protocol: "Thala", fetchedAt: new Date().toISOString(), addresses: ADDRESSES.thala, modulesByAccount: {}, auditLinks: [] };

  for (const [label, addr] of Object.entries(ADDRESSES.thala)) {
    const modules = await fetchAccountModules(addr);
    if (modules) {
      report.modulesByAccount[label] = modules.map((m) => ({ name: m.name, entryFunctions: m.entryFunctions }));
      const hasFarmStake = modules.some((m) => m.entryFunctions.some((f) => /stake|farm|gauge|deposit/i.test(f.name)) && m.entryFunctions.some((f) => f.params.some((p) => typeof p === "string" && (p.includes("LPPosition") || p.includes("WeightedPoolToken")))));
      report.farmOrGaugeFound = report.farmOrGaugeFound || hasFarmStake;
    } else {
      report.modulesByAccount[label] = null;
    }
  }

  try {
    const html = await fetchText(AUDIT_SOURCES.thala);
    report.auditLinks = extractPdfLinksFromHtml(html, AUDIT_SOURCES.thala);
  } catch (e) {
    report.auditFetchError = e.message;
  }

  const outPath = path.join(DOCS, "discovery-report-thala.json");
  fs.mkdirSync(DOCS, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");
  console.log("Thala report written to", outPath);
  if (report.auditLinks.length) {
    const auditPath = path.join(DOCS, "audits-thala.json");
    fs.writeFileSync(auditPath, JSON.stringify({ source: AUDIT_SOURCES.thala, fetchedAt: new Date().toISOString(), links: report.auditLinks }, null, 2), "utf-8");
    console.log("Thala audit links to", auditPath);
  }
  return report;
}

async function runLiquidswap() {
  const report = { protocol: "Liquidswap", fetchedAt: new Date().toISOString(), addresses: ADDRESSES.liquidswap, modulesByAccount: {}, poolsRegistry: null, farmFound: false };

  for (const [label, addr] of Object.entries(ADDRESSES.liquidswap)) {
    const modules = await fetchAccountModules(addr);
    if (modules) {
      report.modulesByAccount[label] = modules.map((m) => ({ name: m.name, entryFunctions: m.entryFunctions }));
      if (label === "harvest") report.farmFound = true;
    } else {
      report.modulesByAccount[label] = null;
    }
  }

  try {
    report.poolsRegistry = await fetchJson(GITHUB_RAW.liquidswapPools);
    const usdcRelated = (report.poolsRegistry || []).filter((p) => {
      const x = (p.coinX || "").toLowerCase();
      const y = (p.coinY || "").toLowerCase();
      return x.includes("usdc") || y.includes("usdc");
    });
    report.usdcRelatedPoolsCount = usdcRelated.length;
    report.usdcRelatedPoolsSample = usdcRelated.slice(0, 5);
    const poolsPath = path.join(DOCS, "liquidswap-pools-registry.json");
    fs.writeFileSync(poolsPath, JSON.stringify(report.poolsRegistry, null, 2), "utf-8");
    console.log("Liquidswap pools copy written to", poolsPath);
  } catch (e) {
    report.poolsFetchError = e.message;
  }

  const outPath = path.join(DOCS, "discovery-report-liquidswap.json");
  fs.mkdirSync(DOCS, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");
  console.log("Liquidswap report written to", outPath);
  return report;
}

async function runEcho() {
  const report = { protocol: "Echo", fetchedAt: new Date().toISOString(), addresses: ADDRESSES.echo, modulesByAccount: {}, auditLinks: [], secondaryActionFound: false };

  const modules = await fetchAccountModules(ADDRESSES.echo.vault);
  if (modules) {
    report.modulesByAccount.vault = modules.map((m) => ({ name: m.name, entryFunctions: m.entryFunctions }));
    const hasSecondary = modules.some((m) => m.entryFunctions.some((f) => f.params.some((p) => typeof p === "string" && (p.includes("VaultPosition") || p.includes("VaultToken")))));
    report.secondaryActionFound = hasSecondary;
  } else {
    report.modulesByAccount.vault = null;
  }

  try {
    const html = await fetchText(AUDIT_SOURCES.echo);
    report.auditLinks = extractPdfLinksFromHtml(html, AUDIT_SOURCES.echo);
  } catch (e) {
    report.auditFetchError = e.message;
  }

  const outPath = path.join(DOCS, "discovery-report-echo.json");
  fs.mkdirSync(DOCS, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");
  console.log("Echo report written to", outPath);
  if (report.auditLinks.length) {
    const auditPath = path.join(DOCS, "audits-echo.json");
    fs.writeFileSync(auditPath, JSON.stringify({ source: AUDIT_SOURCES.echo, fetchedAt: new Date().toISOString(), links: report.auditLinks }, null, 2), "utf-8");
    console.log("Echo audit links to", auditPath);
  }
  return report;
}

async function main() {
  const target = (process.argv[2] || "all").toLowerCase();
  if (!["thala", "liquidswap", "echo", "all"].includes(target)) {
    console.log("Usage: node discovery_protocol_research.js [thala|liquidswap|echo|all]");
    process.exit(1);
  }

  if (target === "thala" || target === "all") await runThala();
  if (target === "liquidswap" || target === "all") await runLiquidswap();
  if (target === "echo" || target === "all") await runEcho();

  console.log("Discovery done. See SmartContractLists/docs/DISCOVERY_RUNBOOK.md for how to use outputs to update SCL/IL.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
