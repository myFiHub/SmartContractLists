# FiHub Movement Smart Contract Lists

A **decentralized registry standard** for smart contracts and strategies on the **Movement Network**.  
Inspired by the success of token lists in wallets like Uniswap, FiHub's **Smart Contract Lists** extend the concept to **DeFi protocols, vaults, staking pools, AMMs, and ecosystem assets** — making it easier for users, communities, and developers to discover, evaluate, and interact with Web3 on Movement.

## 🚀 Current Implementation

This repository contains a **complete Movement-focused implementation** with:

- **📋 Comprehensive Schema** - Movement-native smart contract list specification
- **🔍 Automated Fetcher** - Python script to fetch real-time contract data from Movement RPC
- **📊 Rich Metadata** - Off-chain information including audits, governance, and performance data
- **⚡ Surgical Updates** - Targeted updates without full regeneration
- **✅ 238 Contracts** - Movement framework and ecosystem protocols (MovePosition, YUZU, Mosaic, etc.)

---

## 🌍 Vision

FiHub is building the **discovery dashboard for Web3 & DeFi**.  
Smart Contract Lists are the foundation of that vision:

- **Standardization** – Unified metadata for smart contracts across ecosystems.  
- **Safety** – Clear audit and verification data to reduce risks.  
- **Composability** – Strategies that bundle multiple contract interactions.  
- **Community Ownership** – Decentralized registries curated by DAOs, projects, and trusted creators.  
- **Onboarding** – A safer, more contextual way for newcomers to enter Web3 and DeFi.  

---

## 📦 Smart Contract List Specification

Smart Contract Lists follow a **JSON schema** (see [`FiHub Movement Smart Contract List Schema.json`](./FiHub%20Movement%20Smart%20Contract%20List%20Schema.json)) that ensures consistency and trust.

### Movement-Specific Features

- **Move Module Support** - Native support for Move modules, functions, and structs
- **Fungible Asset (FA) Standard** - Support for Aptos FA token standard
- **Digital Asset (DA) Standard** - Support for Aptos DA NFT standard
- **API Verification** - RPC endpoint verification and data integrity checks
- **Enhanced Security** - Comprehensive audit, governance, and compliance metadata

### Top-Level Fields

| Field            | Type      | Description |
|------------------|-----------|-------------|
| `name`           | string    | Human-readable name of the list (e.g. `"FiHub Rapid Smart Contract List"`) |
| `logoURI`        | string    | URI for the list logo (PNG/SVG, 256×256 recommended) |
| `keywords`       | string[]  | Tags for discoverability (e.g. `["lending", "stablecoin"]`) |
| `timestamp`      | string    | ISO 8601 timestamp when the list was generated |
| `version`        | object    | Semantic versioning: `{ "major": X, "minor": Y, "patch": Z }` |
| `tags`           | object    | Mapping of tag identifiers to names and descriptions |
| `smartContracts` | array     | Array of smart contract metadata objects |

### Smart Contract Object

Each entry inside `smartContracts` includes:

- `chainId` – Network chain ID (e.g. `1` for Movement Mainnet)  
- `address` – Contract address (e.g. `0xccd2621d2897d407e06d18e6ebe3be0e6d9b61f1e809dd49360522b9105812cf`)  
- `moduleName` – Move module name (e.g. `"lend"`, `"vault"`)  
- `platform` – Platform/project name (e.g. `"MovePosition"`, `"YUZU"`)  
- `name` – Human-readable contract name  
- `description` – Detailed protocol description  
- `website` – Official project website  
- `tags` – Array of tag identifiers (e.g. `["lending", "vault", "crossChain"]`)  
- `functions` – Move function definitions with parameters, return types, and audit status  
- `structs` – Move struct definitions with fields and abilities  
- `security` – Audit scores, security levels, penetration testing status  
- `governance` – Upgrade mechanisms, multisig requirements, timelock delays  
- `compliance` – KYC/AML requirements, regulatory status  
- `performance` – Gas optimization, parallel execution capabilities  
- `interoperability` – Cross-chain capabilities, bridge protocols  
- `apiVerification` – RPC endpoints, verification instructions, data integrity checks  

---

## 📝 Example

```json
{
  "name": "FiHub Movement Smart Contract List",
  "logoURI": "ipfs://QmXfzKRvjZz3u5JRgC4v5mGVbm9ahrUiB4DgzHBsnWbTMM",
  "keywords": ["movement", "aptos", "move", "defi", "audited", "verified"],
  "tags": {
    "lending": {
      "name": "Lending",
      "description": "A protocol that allows users to lend and borrow digital assets"
    },
    "vault": {
      "name": "Vault",
      "description": "A destination deposit location that provides a mapping of ownership or receipt token"
    }
  },
  "timestamp": "2025-09-11T01:26:59.582146Z",
  "version": { "major": 1, "minor": 0, "patch": 1 },
  "smartContracts": [
    {
      "chainId": 1,
      "address": "0xccd2621d2897d407e06d18e6ebe3be0e6d9b61f1e809dd49360522b9105812cf",
      "moduleName": "lend",
      "platform": "MovePosition",
      "name": "MovePosition Lend",
      "description": "Cross-chain lending with intelligent leverage optimization",
      "website": "https://www.moveposition.xyz/",
      "tags": ["lending", "vault", "crossChain"],
      "functions": [
        {
          "name": "lend_to_portfolio",
          "visibility": "friend",
          "is_entry": false,
          "params": ["&signer", "address", "vector<u8>"],
          "return": [],
          "acquires": [],
          "audited": true,
          "verified": true,
          "auditors": ["MoveBit"]
        }
      ],
      "structs": [
        {
          "name": "LendEvent",
          "abilities": ["drop", "store"],
          "fields": [
            {"name": "actor", "type": "address"},
            {"name": "amount", "type": "u64"}
          ],
          "is_resource": false
        }
      ],
      "security": {
        "auditScore": 90,
        "lastAuditDate": "2024-12-01",
        "securityLevel": "high",
        "penetrationTested": true,
        "formalVerification": false
      },
      "governance": {
        "isUpgradeable": true,
        "upgradeDelay": 2592000,
        "governanceType": "multisig",
        "multisigRequired": true,
        "multisigThreshold": 3,
        "timelockDelay": 86400
      },
      "performance": {
        "gasOptimized": true,
        "parallelExecutable": true,
        "estimatedGasCost": {
          "lend": 2000,
          "repay": 1800
        }
      },
      "interoperability": {
        "crossChainCapable": true,
        "bridgeProtocols": ["Concordia", "LayerZero"]
      },
      "apiVerification": {
        "rpcEndpoint": "https://full.mainnet.movementinfra.xyz/v1",
        "verificationStatus": "verified",
        "dataIntegrity": {
          "functionsVerified": true,
          "structsVerified": true
        }
      }
    }
  ]
}
```

---

## 🔗 How It Works in FiHub

1. **Discovery** – Users explore curated, tagged contract lists directly in the FiHub Dashboard.  
2. **Education** – Each contract can link to **guides, videos, and risk assessments**.  
3. **Execution** – Contracts and strategies are **directly callable** via ABIs (e.g., `deposit`, `swap`, `stake`).  
4. **Composability** – Lists can reference other lists or predecessor contracts, enabling **multi-step DeFi strategies**.  
5. **Trust & Safety** – Audit metadata, owner verification, and proxy data provide transparency against malicious contracts.  

---

## 🛠️ Tools & Automation

### Automated Contract Fetcher

The `movement_contract_fetcher.py` script automatically fetches real-time contract data from Movement RPC endpoints:

```bash
# Generate complete smart contract list
python3 movement_contract_fetcher.py --networks movement_mainnet

# Use custom metadata configuration
python3 movement_contract_fetcher.py --networks movement_mainnet --metadata contract_metadata.json
```

### Surgical Updates

The `surgical_update.py` script allows targeted updates without full regeneration:

```bash
# Sync all contracts with metadata
python3 surgical_update.py --action sync

# Update specific contract
python3 surgical_update.py --action update-contract \
  --address 0xccd2621d2897d407e06d18e6ebe3be0e6d9b61f1e809dd49360522b9105812cf \
  --module "lend" \
  --updates '{"description": "Updated description"}'

# Update all contracts for a platform
python3 surgical_update.py --action update-platform \
  --platform "MovePosition" \
  --updates '{"security": {"auditScore": 95}}'
```

### Metadata Configuration

The `contract_metadata.json` file contains off-chain metadata for all contracts:

- **Audit information** - Scores, dates, auditors
- **Governance details** - Upgrade mechanisms, multisig requirements
- **Performance metrics** - Gas optimization, parallel execution
- **Compliance data** - KYC/AML requirements, regulatory status
- **Interoperability** - Cross-chain capabilities, bridge protocols

## ⚡ Getting Started

### Prerequisites
- Python 3.8+
- Git  
- Movement Network RPC access

### Installation
```bash
# Clone the repository
git clone https://github.com/FiHub/smart-contract-lists.git
cd smart-contract-lists

# Install Python dependencies
pip install requests

# Generate the smart contract list
python3 movement_contract_fetcher.py --networks movement_mainnet
```

## 📁 File Structure

```
├── FiHub Movement Smart Contract List Schema.json    # JSON schema definition
├── FiHub Movement Smart Contract List.json           # Manual curated list
├── FiHub Movement Smart Contract List Generated.json # Auto-generated list (238 contracts)
├── contract_metadata.json                            # Off-chain metadata configuration
├── movement_contract_fetcher.py                      # Automated contract fetcher
├── surgical_update.py                                # Targeted update tool
├── docs/                                             # Documentation and standards
└── README.md                                         # This file
```

## 🎯 Current Contract Coverage

### Movement Framework (4 addresses)
- **0x1** - Core framework modules (95 modules)
- **0x3** - Legacy token contracts (5 modules)  
- **0x4** - Digital asset contracts (5 modules)
- **0xA** - MOVE Coin Fungible Asset

### Ecosystem Protocols (8 addresses)
- **MovePosition** - Cross-chain lending with intelligent leverage optimization
- **Echelon** - Advanced DeFi vault with yield optimization strategies
- **Layerbank** - Multi-layer lending protocol with advanced risk management
- **Mosaic** - Comprehensive DeFi protocol with multiple financial primitives
- **Interest DEX** - Decentralized exchange with interest-bearing assets
- **YUZU** - Decentralized exchange with concentrated liquidity
- **Move.Fun** - Fun and gamified DeFi platform with social features

### Audit Coverage
- **MoveBit** - Audited MovePosition, Mosaic, YUZU, and Move.Fun
- **Movement Labs** - Audited all framework contracts
- **Team Audits** - Echelon, Layerbank, and Interest DEX have team audits

## 🔄 Version Control

The system includes automatic version tracking:
- **Timestamp** - ISO 8601 timestamp for each update
- **Semantic Versioning** - Major.Minor.Patch versioning
- **Surgical Updates** - Increment patch version for targeted changes
- **Full Regeneration** - Increment minor version for schema changes
