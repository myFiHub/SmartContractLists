# Schema Data Required for Website Operation

This document describes the **data and information** that must (or should) be present in the Smart Contract List (SCL) and Interaction List (IL) for the FiHub website to operate correctly: building transactions, showing positions, pool ratios, receipts, and recommendations.

See also: [SCHEMA_EXTENSIONS.md](SCHEMA_EXTENSIONS.md) (extension keys and examples), [REGISTRY.md](../REGISTRY.md) (entry-point and type-args rules), [INTERACTION_LIST_INTERFACE.md](INTERACTION_LIST_INTERFACE.md) (params/arguments schema).

---

## 1. Transaction build and execution

The website builds transaction payloads from IL entries and validates them against the SCL.

### IL: required for every executable interaction

| Field | Required | Description |
|-------|----------|-------------|
| **type** | Yes | Interaction kind: `lend`, `borrow`, `swap`, `lp`, `vault`, `stake`, `claim`, etc. |
| **platform** | Yes | Protocol name (e.g. `Thala`, `Aries`, `Layerbank`). |
| **module** | Yes | Full module ref: `{address}::{moduleName}` (e.g. `0x...::controller`). Must exist in SCL. |
| **function** | Yes | Entry function name. The SCL must list this function with **is_entry: true**. |

### IL: required for generic (type-parameterized) functions

| Field | Required when | Description |
|-------|----------------|-------------|
| **type_arguments** | SCL function has `generic_type_params > 0` and args are fixed | Array of Move type strings, length = `generic_type_params`. |
| **type_arguments_source: "runtime"** | Type args come from pool/market resolver (e.g. Thala swap/LP) | Tells the app to resolve type args via resolver API (e.g. `/api/thala/resolve-pool`) instead of static list. |
| **runtimeDeps** | Interaction needs pool registry, market ID, or other runtime lookup | Array of `{ kind, platform }` (e.g. `{ "kind": "poolRegistry", "platform": "Thala" }`). App runs resolvers before build. |

### IL: optional but recommended for correct arguments

| Field | Description |
|-------|-------------|
| **params** or **arguments.schema** | Ordered argument spec (name, type, source: user/static/runtime). Ensures correct argument count and order; without it, the app uses type/platform heuristics that can be wrong. |
| **platformParamRef** | When an argument is market_id or market_index: `source: "scl"`, `extensionKey`, `symbolFromToken`. App reads value from SCL extensions. |

### SCL: required for execution

| Field | Description |
|-------|-------------|
| **Contract per module** | Every IL `module` must appear in the SCL (same address::moduleName). |
| **Function with is_entry: true** | The IL `function` must exist on that contract and have **is_entry: true** (from on-chain ABI when possible). |
| **generic_type_params** | For generic entry functions, set to the number of type parameters (0 if not generic). Used to validate IL `type_arguments` length or allow `type_arguments_source: "runtime"`. |

### SCL: optional for data-driven argument construction

| Field | Description |
|-------|-------------|
| **argumentSchema** (per function) | Array of `{ type, source }` defining ordered arguments. Used when IL does not define `arguments.schema` or `params`. |

---

## 2. Position and health (action cards)

The track page shows “Your position” (supplied, borrowed, health factor, LP balance, pool APR) when the user selects an action. Data comes from `GET /api/position`, which uses **SCL engagement extensions** when present.

### SCL: optional engagement extensions for live position

If the contract has **no** position extensions, the API returns **mock** values (for demo only).

| Extension | Type | Description |
|-----------|------|-------------|
| **positionSource** | `"view"` \| `"indexer"` | Where to fetch position. Omit = no live data (mock used). |
| **positionView** | object | When view: `{ "entry": "view_function_name", "args": ["address"] }`. App calls this view with user address. |
| **positionIndexerKey** | string | When indexer: key for the app’s indexer query. |
| **positionResponseMap** | object | Optional. Maps standard names (e.g. `suppliedBalance`, `healthFactor`) to view/indexer response paths. |

Standard position fields the app can display: `suppliedBalance`, `borrowBalance`, `healthFactor`, `withdrawableBalance`, `redeemableBalance`, `claimableAmount`, `vaultBalance`, `lpBalance`, `poolApr`.

---

## 3. Pool state (LP ratio suggestion)

For **LP** actions, the app can suggest the second token amount from the pool’s reserve ratio when the SCL contract has pool-state extensions.

### SCL: optional engagement extensions for pool state

| Extension | Type | Description |
|-----------|------|-------------|
| **poolStateSource** | `"view"` \| `"indexer"` | Where to fetch reserves/ratio. |
| **poolStateView** | object | When view: `{ "entry": "get_reserves_or_ratio", "args": ["pool_id_or_type"] }`. App gets pool id from resolver (e.g. Thala) and calls this view. |
| **poolStateIndexerKey** | string | When indexer: key for pool state in indexer. |

---

## 4. Market / pool parameters (build-time)

For protocols that require **market_id**, **market_index**, or **pool type args** at build time, the app resolves them as follows.

### SCL: optional extensions for platform params

| Extension | Description |
|-----------|-------------|
| **marketIdsBySymbol** | Symbol → hex (vector&lt;u8&gt;). Used by Aries-style deposit/withdraw. |
| **marketIndicesBySymbol** | Symbol → u8. Used by Echelon-style supply/withdraw. |

### IL: platformParamRef

When an interaction needs a market_id or market_index from SCL, set **platformParamRef** (e.g. `source: "scl"`, `extensionKey: "marketIdsBySymbol"`, `symbolFromToken: true`). For Thala swap/LP, use **runtimeDeps** + pool registry; type args come from the resolve-pool API.

---

## 5. Receipt and “You will receive”

The app shows what the user receives after an action (e.g. LP token, profile balance).

### SCL: optional extensions for receipt display

| Extension | Description |
|-----------|-------------|
| **receiptType** | Kind: `Profile`, `Coin`, `LPToken`, `Resource`, `MarketPosition`, etc. |
| **receiptStructName** | Move struct name for the receipt. |
| **receiptTypeNote** | Short human-readable label (e.g. “No transferable token; balance in Profile resource”). |
| **receiptAddress** | When receipt token is at another address (e.g. LP at resource owner). |
| **lpResourceOwner** | For AMMs: address where LP tokens live. |

### IL: optional receiptToken

When the receipt is a **transferable** token, the interaction can set **receiptToken** (symbol + address). When the receipt is not transferable (e.g. Aries Profile), SCL **receiptType** and **receiptTypeNote** are used for display.

---

## 6. APY and opportunities

The opportunities and recommendations APIs join IL routes with **APY** data. Currently APY is **static** per platform/type (MVP). For future live APY:

- SCL **estimatedApyByType** (optional) can provide per-type estimates (e.g. `{ "lend": 4.2, "lp": 11 }`); the app can show “Est. APY” when present.
- External feeds (DefiLlama, protocol APIs) can be wired later; schema does not require them for basic operation.

---

## 7. Summary checklist

When adding or editing an interaction:

1. **IL:** `type`, `platform`, `module`, `function`; ensure SCL has that module and function with **is_entry: true**.
2. **IL:** If the function is generic, set either `type_arguments` (correct length) or `type_arguments_source: "runtime"` and `runtimeDeps` if needed.
3. **IL:** Prefer **params** or **arguments.schema** for correct argument construction; add **platformParamRef** if the interaction needs market_id/market_index from SCL.
4. **SCL:** Add **extensions** for market IDs, receipt display, and (optional) **positionSource** / **poolStateSource** for live position and LP ratio.
5. Run **validate_registry_mappings.js**, **audit_il_scl_params.js**, and (for critical paths) **verify_onchain_registry.js** and simulation audit before release.
