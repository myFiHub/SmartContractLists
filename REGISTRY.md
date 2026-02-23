# Registry creation and curation (SCL + IL)

This document describes how to keep Smart Contract Lists (SCL) and Interaction Lists (IL) consistent so that validation and semantic tests pass, and so that creation (manual or scripted) fails fast when entry or type-args rules are violated.

## Smart Contract List (SCL)

- **`is_entry`**: Always set from the on-chain ABI when possible. Only functions that are valid transaction entry points should have `is_entry: true`. The semantic tests require that every IL interaction that references a function in the SCL must reference a function with `is_entry: true`.
- **`generic_type_params`**: When a function is generic (expects type arguments at invocation), set this to the number of type parameters (non-negative integer, default 0). This is used by validation and semantic tests to ensure IL entries either provide `type_arguments` of the correct length or document runtime derivation.

## Interaction List (IL)

- **Entry points**: Interactions that call a `module::function` listed in the SCL must reference a function with `is_entry: true` in the SCL. Otherwise the chain will reject with "is not an entry function."
- **Type arguments**: For generic entry functions (SCL `generic_type_params > 0`), either:
  - Set **`type_arguments`** to an array of Move type strings (e.g. `["0x1::aptos_coin::AptosCoin"]`) with length equal to `generic_type_params`, or
  - Set **`type_arguments_source: "runtime"`** when type arguments are built at runtime (e.g. Liquidswap swap from UI from/to, or ThalaSwap V1 swap/LP from pool registry). Semantic tests will allow missing or variable `type_arguments` when this is set.

### Thala V1 (Aptos)

- **ThalaSwap V1** canonical address: `0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af`. Swap and LP entry points use **pool-derived type arguments**: the first 9 type parameters come from the pool (see pool registry artifact), plus the from/to asset types (X, Y). The pool list is produced by the Thala V1 pool indexer and stored in `docs/thala-pools.json` (or equivalent); the website resolves type_arguments at runtime from this artifact. IL entries for Thala swap and LP must set `type_arguments_source: "runtime"` and must **not** set static `type_arguments`. ThalaSwapLens (`0xff1ac437457a839f7d07212d789b85dd77b3df00f59613fcba02388464bfcacb`) is listed in the SCL for pool discovery reference.

## Validation and semantic tests

- **Checklist UI** runs `checkMoveSmartContractList` and `checkMoveInteractionsList`; new checks include `generic_type_params`, `type_arguments` format, and optional `entryPoint` status.
- **CI** runs schema validation for both Movement and Aptos SCL/IL (when present) and semantic tests that enforce:
  - IL interactions reference only entry functions (when the function is in the SCL).
  - When SCL function has `generic_type_params > 0`, IL has either matching `type_arguments` length or `type_arguments_source: "runtime"`.

Keeping SCL and IL aligned with these rules ensures that new or edited entries are caught by validation or semantic tests before merge.
