# FiHub Smart Contract Lists

A **decentralized registry standard** for smart contracts and strategies on the **Movement Network**.  
Inspired by the success of token lists in wallets like Uniswap, FiHub’s **Smart Contract Lists** extend the concept to **DeFi protocols, vaults, staking pools, AMMs, and ecosystem assets** — making it easier for users, communities, and developers to discover, evaluate, and interact with Web3.

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

Smart Contract Lists follow a **JSON schema** (see [`FiHub Rapid Smart Contract List Schema.json`](./FiHub%20Rapid%20Smart%20Contract%20List%20Schema.json)) that ensures consistency and trust.

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

- `chainId` – Network chain ID (e.g. `43114` for Avalanche C-Chain)  
- `address` – Checksummed contract address  
- `platform` – Platform/project name (e.g. `"TraderJoe"`, `"Aave"`)  
- `name` – Human-readable contract name  
- `symbol` – (optional) Token symbol if applicable  
- `decimals` – Token decimals (if relevant)  
- `tags` – Array of tag identifiers (e.g. `["AMM", "vault", "stakingRewards"]`)  
- `logoURI` – Logo of the token or contract  
- `extensions` – Extra metadata, such as:  
  - **ABI functions** (`inputs`, `outputs`, `stateMutability`, `audited`, `verified`, `auditors`)  
  - **Proxy information** (e.g. implementation contract, upgradeability)  
  - **Ownership details** (owner address, multisig flags)  
  - **Risk annotations**  

---

## 📝 Example

```json
{
  "name": "FiHub Rapid Smart Contract List",
  "logoURI": "ipfs://QmXmGmc6FihcjpRGiZEvzr5",
  "keywords": ["audited", "verified", "DeFi"],
  "tags": {
    "AMM": {
      "name": "AMM",
      "description": "Automated Market Maker Protocol"
    },
    "stakingRewards": {
      "name": "Staking Rewards",
      "description": "Pools that distribute token incentives"
    }
  },
  "timestamp": "2025-09-10T16:00:00+00:00",
  "version": { "major": 1, "minor": 1, "patch": 1 },
  "smartContracts": [
    {
      "chainId": 43114,
      "address": "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
      "platform": "Avax C-Chain",
      "name": "WAVAX",
      "symbol": "WAVAX",
      "decimals": 18,
      "logoURI": "https://raw.githubusercontent.com/pangolindex/tokens/main/assets/11111/0x21cf0eB2e3Ab48356dD78afe5D386D9/logo.png",
      "tags": ["wrapped", "ERC20"],
      "extensions": {
        "abi": {
          "approve": {
            "audited": true,
            "verified": true,
            "auditors": ["FiHub"],
            "inputs": [
              { "internalType": "address", "name": "spender", "type": "address" },
              { "internalType": "uint256", "name": "amount", "type": "uint256" }
            ],
            "name": "approve",
            "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
            "stateMutability": "nonpayable",
            "type": "function"
          }
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

## ⚡ Getting Started

### Prerequisites
- Node.js v18+  
- Git  
- (Optional) Movement Network toolchain for on-chain registry work

### Installation
```bash
# Clone the repository
git clone https://github.com/FiHub/smart-contract-lists.git
cd smart-contract-lists

# Install dependencies (if this repo includes too
