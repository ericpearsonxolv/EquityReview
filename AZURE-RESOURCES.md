# EquityReview Azure Resources - Dev Environment

## Deployed Resources

| Resource | Name | Endpoint |
|----------|------|----------|
| **Static Web App** | `catalight-er-swa-dev` | <https://gray-bush-0c67d5710.6.azurestaticapps.net> |
| **Function App** | `catalight-er-func-dev` | <https://catalight-er-func-dev.azurewebsites.net> |
| **Cosmos DB** | `catalightercosmosdev` | <https://catalightercosmosdev.documents.azure.com:443/> |
| **Key Vault** | `catalight-er-kv-dev` | <https://catalight-er-kv-dev.vault.azure.net/> |
| **Storage Account** | `st630346` | - |
| **App Insights** | `catalight-er-insights-dev` | - |
| **Log Analytics** | `catalight-er-logs-dev` | - |

## Configuration Files

- `.env.dev` - Development environment variables with Azure resource names
- `.env.production` - Production configuration with Key Vault references
- `staticwebapp.config.json` - Static Web App authentication and routing
- `infrastructure/deployment-outputs.json` - Complete deployment details

## Environment Setup

1. Copy `.env.dev` to `.env`:

   ```bash
   cp .env.dev .env
   ```

2. Update missing values in `.env`:
   - Get Cosmos DB connection string from Key Vault
   - Get App Insights connection string from Azure Portal
   - Get Azure AD Client ID after creating App Registration
   - Get Azure AD Client Secret from Key Vault

3. For local development, ensure you have:
   - Azure CLI installed and logged in
   - Access to the `rg-catalight-er-dev` resource group
   - Appropriate RBAC permissions on Key Vault

## Next Steps

See [`infrastructure/post-deployment-steps.md`](../infrastructure/post-deployment-steps.md) for:

- Creating Entra ID App Registration
- Configuring authentication
- Assigning user roles
- Deploying to Azure
