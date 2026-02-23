# SCL and IL Schema Extensions for Protocol Data

This document defines **standard extension keys and interaction fields** so market IDs, pool references, and receipt types are codified in the Smart Contract List (SCL) and Interaction List (IL) and resolve to a workable website interface.

## 1. SCL contract extensions (extensions)

These keys may appear on any contract in the SCL. Consumers (e.g. the website) use them to build arguments and to display or verify receipt tokens.

| Key | Type | Description |
|-----|------|-------------|
| **receiptType** | string | Kind of receipt after the interaction: `"Profile"` (resource, no transferable token), `"Coin"`, `"LPToken"`, `"Resource"`, `"MarketPosition"`, `"NFT_POSITION"`. |
| **receiptStructName** | string | Move struct name for the receipt (e.g. `"Position"`, `"CollateralPosition"`, `"MarketPosition"`). |
| **receiptAddress** | string | When receipt is a token at a different address (e.g. LP at resource owner): full type or address. |
| **receiptTypeNote** | string | Human-readable note (e.g. "No transferable token; balance in Profile resource"). |
| **lpResourceOwner** | string | For AMMs: address where LP tokens live (e.g. Liquidswap `0x05a9...`). Used for receipt verification. |
| **marketIdsBySymbol** | object | Symbol → hex string (vector<u8> as hex) for deposit/withdraw. Key: token symbol (e.g. `"APT"`, `"USDC"`). Value: market_id encoded as hex (e.g. `"0x00"`, `"0x01"`). Used when the chain expects a market_id argument. |
| **marketIndicesBySymbol** | object | Symbol → u8 market index. Key: token symbol. Value: number (0–255). Used when the chain expects a u8 market index (e.g. Echelon supply/withdraw). |

### 1.1 Engagement extensions (position, pool state, APY)

These optional keys let the website fetch **position** (user balances, health, LP position) and **pool state** (reserves/ratio for balanced LP) generically. The app resolves the contract by interaction `module`, reads the extension, and calls the configured view or indexer—no protocol-specific branches in app code.

**Position (user position for this contract)**

| Key | Type | Description |
|-----|------|-------------|
| **positionSource** | string | `"view"` = use chain view function; `"indexer"` = use indexer. Omit = no position support (UI shows "—"). |
| **positionView** | object | When positionSource is view. `{ "entry": "function_name", "args": ["address"] }` — view entry name and ordered arg names; app passes user address and optional token/pool from context. |
| **positionIndexerKey** | string | When positionSource is indexer. Key or query name the app uses to look up position (e.g. `"thala_lp_positions"`). App maps key to actual query per network. |
| **positionResponseMap** | object | Optional. Maps standard field names to view/indexer response paths (e.g. `{ "suppliedBalance": "supply_balance", "healthFactor": "health" }`). |

**Pool state (reserves / ratio for balanced LP)**

| Key | Type | Description |
|-----|------|-------------|
| **poolStateSource** | string | `"view"` or `"indexer"`. Omit = no ratio/reserves support. |
| **poolStateView** | object | When poolStateSource is view. `{ "entry": "get_reserves_or_ratio", "args": ["pool_id_or_type"] }` — app gets pool id from existing resolver (e.g. Thala pool from runtimeDeps) and calls this view. |
| **poolStateIndexerKey** | string | When poolStateSource is indexer. Key for pool reserves/ratio in the app’s indexer integration. |

**APY / metadata (optional)**

| Key | Type | Description |
|-----|------|-------------|
| **estimatedApyByType** | object | Optional. Interaction type → estimated APY (e.g. `{ "lend": 4.2, "lp": 11, "vault": 6.1 }`). App shows "Est. APY" when present. External feeds can override later. |

**Example (Aries controller)**

```json
"extensions": {
  "audited": true,
  "verified": true,
  "receiptType": "Profile",
  "receiptStructName": "Profile",
  "receiptTypeNote": "No transferable token; balance and collateral in Profile resource.",
  "marketIdsBySymbol": { "APT": "0x00", "USDC": "0x01", "USDT": "0x02" }
}
```

**Example (Echelon scripts)**

```json
"extensions": {
  "receiptType": "MarketPosition",
  "receiptStructName": "MarketPosition",
  "marketIndicesBySymbol": { "APT": 0, "USDC": 1, "USDT": 2 }
}
```

**Example (Liquidswap scripts_v2)**

```json
"extensions": {
  "receiptType": "LPToken",
  "receiptAddress": "0x05a97986a9d031c4567e15b797be516910cfcb4156312482efc6a19c0a30c948::lp_coin::LP",
  "lpResourceOwner": "0x05a97986a9d031c4567e15b797be516910cfcb4156312482efc6a19c0a30c948",
  "receiptTypeNote": "LP receipt at resource owner. Router v2 only."
}
```

## 2. IL interaction fields for platform params

Interactions that require a **market ID**, **market index**, or **pool ID** at runtime can reference the SCL so the website resolves the value from contract extensions.

| Field | Type | Description |
|-------|------|-------------|
| **platformParamRef** | object | Where to get a platform-specific parameter (e.g. market_id, market_index). |
| **platformParamRef.source** | string | `"scl"` = read from SCL contract extensions; `"api"` = call app API; `"runtime"` = from pool/market resolver. |
| **platformParamRef.extensionKey** | string | When source is `"scl"`: extension key (e.g. `"marketIdsBySymbol"`, `"marketIndicesBySymbol"`). |
| **platformParamRef.symbolFromToken** | boolean | When true, the lookup key is the interaction’s primary token symbol (e.g. from `tokens[0].symbol`). |
| **platformParamRef.contractRef** | string | Optional. When source is `"scl"`: address::module of the contract (e.g. `0x...::controller`). If omitted, use the interaction’s `module` to find the contract. |

**Example (Aries lend)**

```json
{
  "type": "lend",
  "platform": "Aries",
  "module": "0x9770fa9c...::controller",
  "function": "deposit",
  "platformParamRef": {
    "source": "scl",
    "extensionKey": "marketIdsBySymbol",
    "symbolFromToken": true
  }
}
```

The website resolves market_id by: (1) finding the SCL entry for the interaction’s module, (2) reading `extensions.marketIdsBySymbol[symbol]` where `symbol` is the selected token’s symbol.

**Example (Echelon supply)**

```json
{
  "type": "lend",
  "platform": "Echelon",
  "module": "0xc6bc659f...::scripts",
  "function": "supply",
  "platformParamRef": {
    "source": "scl",
    "extensionKey": "marketIndicesBySymbol",
    "symbolFromToken": true
  }
}
```

## 3. Receipt token in IL

The existing **receiptToken** on an interaction (symbol + address) remains the primary way to describe a **transferable** receipt (e.g. LP token, cToken). When the receipt is **not** a transferable token (e.g. Aries Profile, Thala CollateralPosition), the SCL **receiptType** and **receiptStructName** document that; the IL may omit `receiptToken` or set it to a placeholder and rely on SCL for display text.

## 4. Resolving to the website

- **Market ID (Aries):** For Aries lend/withdraw, the app loads the Aptos SCL, finds the controller contract, and reads `extensions.marketIdsBySymbol[symbol]`. That value is passed as the first argument (vector<u8> hex). Fallback: `/api/aries/market-id?symbol=...` or static docs file.
- **Market index (Echelon):** For Echelon supply/withdraw/borrow/repay, the app reads `extensions.marketIndicesBySymbol[symbol]` from the SCL scripts contract. Fallback: echelon-market-indices.json or API.
- **Pool ID / type args (Thala):** Thala swap/LP use `runtimeDeps` (poolRegistry) and the resolve-pool API; type_arguments come from the resolver response. No change.
- **Receipt display:** When showing “You will receive…”, the app can use interaction.receiptToken when present; otherwise use SCL `extensions.receiptType` and `receiptTypeNote` for the contract to show a short label (e.g. “Profile balance” for Aries).

- **Position:** The app finds the SCL contract by the interaction's `module`, reads `extensions.positionSource` and (when view) `positionView` or (when indexer) `positionIndexerKey`. It then calls the chain view or indexer with the user address and maps the result via `positionResponseMap` (if present) to the standard position shape (suppliedBalance, lpBalance, healthFactor, etc.). If no extension or source is set, the UI shows "—".
- **Pool state (balanced LP):** For LP interactions, pool identity comes from IL `runtimeDeps` and the existing pool resolver. The app reads `extensions.poolStateSource` and `poolStateView` or `poolStateIndexerKey` from the contract, then fetches reserves/ratio and uses them to suggest or validate the second LP amount.

## 5. Argument construction (argumentSchema)

Data-driven argument construction lets the app build `function_arguments` from schema in the SCL or IL instead of hardcoded (type, platform) branches.

### SCL: optional `argumentSchema` per function

On each **function** in the SCL, an optional **argumentSchema** array defines the ordered argument slots:

- Each entry: `{ "type": "string", "source": "string" }` (e.g. `"type": "u64"`, `"source": "user.primary"`).
- **source** uses a standard vocabulary: `user.primary`, `user.secondary`, `interaction.type_arguments_as_vector`, `platformParam`, `static.true`, `static.false`, `resolver.<id>` (e.g. `resolver.route`, `resolver.pool_address`).

When present, the app uses this schema to build the arguments array; otherwise it falls back to (type, platform) rules.

### IL: optional overrides

- **arguments.schema** — Optional. Same shape as SCL `argumentSchema`. When present, it **overrides** the SCL for this interaction.
- **arguments.resolver** — Optional. For dynamic cases (e.g. Thala swap route), the IL can reference a resolver by id; the app builds resolver-dependent args in code and passes the result into the same payload builder.

See [FUTURE_DEVELOPMENT_ARCHITECTURE.md](FUTURE_DEVELOPMENT_ARCHITECTURE.md) for the full data-driven design and implementation status.

## 6. Standalone docs files (fallback)

The files in `docs/` (aries-market-ids.json, echelon-market-indices.json, canonical-to-thala-asset-types.json) remain as **fallback and source of truth for scripts** that generate or validate the SCL. The website should prefer SCL extensions when present so a single load of the SCL provides both contract metadata and market/pool references.
