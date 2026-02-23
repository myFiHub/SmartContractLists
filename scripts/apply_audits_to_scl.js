#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Apply audit links from discovery output (docs/audits-*.json) to SCL entries.
 * Adds extensions.auditReportUrls and extensions.auditSource for Thala and Echo.
 *
 * Usage (from repo root):
 *   node SmartContractLists/scripts/apply_audits_to_scl.js
 *
 * Reads: SmartContractLists/docs/audits-thala.json, audits-echo.json
 * Updates: fihub/data/SmartContractLists/aptos/FiHub Aptos Smart Contract List.json
 *          (and SmartContractLists/aptos/... if present)
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const SCL_PATHS = [
  path.join(ROOT, "..", "fihub", "data", "SmartContractLists", "aptos", "FiHub Aptos Smart Contract List.json"),
  path.join(ROOT, "aptos", "FiHub Aptos Smart Contract List.json"),
];

const AUDIT_SOURCE_URLS = {
  Thala: "https://docs.thala.fi/overview/operations/audits",
  Echo: "https://echo-protocol.gitbook.io/echo-protocol/faq/audits",
};

function loadAudits(protocol) {
  const p = path.join(DOCS, `audits-${protocol.toLowerCase()}.json`);
  if (!fs.existsSync(p)) return [];
  const data = JSON.parse(fs.readFileSync(p, "utf-8"));
  const links = Array.isArray(data.links) ? data.links : [];
  return links.filter((u) => u && u.startsWith("http")).slice(0, 10);
}

function addAuditExtensions(contract, platform, urls) {
  if (!contract.extensions) contract.extensions = {};
  contract.extensions.auditReportUrls = urls;
  contract.extensions.auditSource = AUDIT_SOURCE_URLS[platform] || "";
}

function main() {
  const thalaUrls = loadAudits("thala");
  const echoUrls = loadAudits("echo");

  for (const sclPath of SCL_PATHS) {
    if (!fs.existsSync(sclPath)) continue;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(sclPath, "utf-8"));
    } catch (e) {
      console.warn("Skip (invalid JSON):", sclPath, e.message);
      continue;
    }
    const contracts = data.smartContracts || data.contracts || data.list || (Array.isArray(data) ? data : []);
    let thalaDone = false;
    let echoDone = false;
    for (const c of contracts) {
      if (c.platform === "Thala" && !thalaDone && thalaUrls.length) {
        addAuditExtensions(c, "Thala", thalaUrls);
        thalaDone = true;
      }
      if (c.platform === "Echo" && !echoDone && echoUrls.length) {
        addAuditExtensions(c, "Echo", echoUrls);
        echoDone = true;
      }
      if (thalaDone && echoDone) break;
    }
    fs.writeFileSync(sclPath, JSON.stringify(data, null, 2), "utf-8");
    console.log("Updated", sclPath, "Thala:", thalaDone, "Echo:", echoDone);
  }
}

main();
