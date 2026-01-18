# Azure Resource Naming Limitation Issue

## Problem

The prefix `catalight-equityreview` exceeds Azure's strict character limits for several resources:

- **Storage Account**: Max 24 chars (lowercase letters and numbers only, no hyphens)
- **Key Vault**: Max 24 chars
- **Cosmos DB**: Max 44 chars (lowercase, numbers, hyphens allowed)

Current names being generated:

- `catalight-equityreview-kv-dev` = **30 characters** ❌ (exceeds 24)
- `catalightequityreviewstoragedev` = **33 characters** ❌ (exceeds 24)

## Options

### Option 1: Use Shorter Prefix (Recommended)

Change prefix from `catalight-equityreview` to `catalight-er` or `ctl-er`

**Resulting names:**

- Storage: `catalighterstorage` (20 chars) ✅
- Key Vault: `catalight-er-kv-dev` (20 chars) ✅  
- Cosmos: `catalight-er-cosmos-dev` (24 chars) ✅

### Option 2: Use Abbreviated Resource Names

Keep full prefix but abbreviate specific resource types

**Example:**

- Storage: Use uniqueString hash
- Key Vault: `catalight-er-kv-dev`
- Cosmos: `catalight-er-cosmos-dev`

### Option 3: Use Hash-Based Names

Generate short unique names using hashes (less readable)

**Example:**

- All resources: `st<hash>`, `kv<hash>`, etc.

## Recommendation

**Use Option 1** with prefix `catalight-er`:

- Short enough to fit limits
- Still recognizable
- Consistent naming
- Easy to identify resources

Would you like to proceed with Option 1 (`catalight-er`)?
