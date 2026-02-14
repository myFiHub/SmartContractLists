#!/usr/bin/env python3

"""
Aptos Smart Contract List Fetcher

Generates FiHub Aptos Smart Contract List artifacts from:
- Aptos RPC module ABIs
- aptos-protocol-addresses.json seed list
- aptos_contract_metadata.json enrichment
"""

import argparse
import json
import os
import re
import time
from datetime import datetime
from typing import Dict, List, Set

from movement_contract_fetcher import CONFIG, MovementContractFetcher


ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]+$")


def load_seed_addresses(seed_file: str) -> List[str]:
    """Load and deduplicate valid addresses from the Aptos seed file."""
    if not os.path.exists(seed_file):
        raise FileNotFoundError(f"Seed file not found: {seed_file}")

    with open(seed_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    addresses: Set[str] = set()
    for protocol in data.get("protocols", []):
        for entry in protocol.get("addresses", []):
            address = (entry.get("address") or "").strip()
            if not ADDRESS_RE.match(address):
                continue
            addresses.add(address.lower())

    # Keep deterministic output for stable diffs.
    return sorted(addresses)


def build_tags() -> Dict[str, Dict[str, str]]:
    """Merged Aptos-oriented tag dictionary for generated SCL."""
    return {
        "AMM": {
            "name": "AMM",
            "description": "Automated market maker protocols for spot/liquidity operations",
        },
        "lending": {
            "name": "Lending",
            "description": "Collateralized lending and borrowing protocols",
        },
        "vault": {
            "name": "Vault",
            "description": "Yield or allocation vault strategies",
        },
        "liquidStaking": {
            "name": "Liquid Staking",
            "description": "Staking with liquid receipt assets",
        },
        "stablecoin": {
            "name": "Stablecoin",
            "description": "Fiat-pegged token and issuer modules",
        },
        "bridge": {
            "name": "Bridge",
            "description": "Cross-chain asset movement protocols",
        },
        "native": {
            "name": "Native",
            "description": "Aptos native framework/system modules",
        },
        "framework": {
            "name": "Framework",
            "description": "Core framework module set",
        },
        "gaming": {
            "name": "Gaming",
            "description": "Gaming-related modules",
        },
        "marketplace": {
            "name": "Marketplace",
            "description": "Marketplace and trade modules",
        },
        "social": {
            "name": "Social",
            "description": "Social and community modules",
        },
        "nft": {
            "name": "NFT",
            "description": "NFT minting and trading modules",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate Aptos Smart Contract List from seed addresses"
    )
    parser.add_argument(
        "--network",
        default="aptos_mainnet",
        choices=["aptos_mainnet", "aptos_testnet"],
        help="Aptos network to fetch",
    )
    parser.add_argument(
        "--seed",
        default="docs/aptos-protocol-addresses.json",
        help="Path to aptos protocol seed list",
    )
    parser.add_argument(
        "--metadata",
        default="aptos_contract_metadata.json",
        help="Path to Aptos metadata file",
    )
    parser.add_argument(
        "--output",
        default="aptos/FiHub Aptos Smart Contract List Generated.json",
        help="Output file path",
    )
    parser.add_argument("--timeout", type=int, default=30)

    args = parser.parse_args()

    print("=== Aptos SCL Fetcher ===")
    print(f"Network: {args.network}")
    print(f"Seed file: {args.seed}")
    print(f"Metadata file: {args.metadata}")
    print(f"Output: {args.output}")

    if args.network not in CONFIG["networks"]:
        raise ValueError(f"Unsupported network: {args.network}")

    addresses = load_seed_addresses(args.seed)
    print(f"Loaded {len(addresses)} valid seed addresses")
    if not addresses:
        raise RuntimeError("No valid addresses found in seed file")

    fetcher = MovementContractFetcher(timeout=args.timeout, metadata_file=args.metadata)
    network = CONFIG["networks"][args.network]
    rpc_url = network["rpcUrl"]
    chain_id = network["chainId"]
    contracts = []

    for idx, address in enumerate(addresses, start=1):
        print(f"[{idx}/{len(addresses)}] Fetching modules for {address}")
        modules = fetcher.fetch_account_modules(rpc_url, address)
        print(f"  -> modules returned: {len(modules)}")
        for module in modules:
            contract = fetcher.transform_module_to_contract(module, chain_id, address)
            contracts.append(contract)
        time.sleep(0.1)

    # Build list and override Aptos-specific identity fields.
    out = fetcher.generate_smart_contract_list(contracts)
    out["name"] = "FiHub Aptos Smart Contract List"
    out["keywords"] = ["aptos", "move", "defi", "stablecoin", "nft"]
    out["timestamp"] = datetime.now().isoformat() + "Z"
    out["tags"] = build_tags()

    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)

    print(f"Wrote {len(contracts)} contracts to {args.output}")


if __name__ == "__main__":
    main()
