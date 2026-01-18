# Azure Resource Setup Guide

Step-by-step guide to create Azure resources for EquityReview with:
- Azure Static Web Apps (frontend)
- Azure Function App (API backend)
- Azure Cosmos DB (database)
- Azure Key Vault (secrets)
- Microsoft Entra ID with RBAC (authentication)

---

## Prerequisites

1. Azure CLI installed: `az --version`
2. Logged into Azure: `az login`
3. Correct subscription selected

```bash
# List subscriptions
az account list --output table

# Set your subscription
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

---

## Stage 1: Environment Setup

Set these variables (customize for your environment):

```bash
# Core naming
export PREFIX="equityreview"
export ENVIRONMENT="prod"
export LOCATION="eastus"
export RESOURCE_GROUP="rg-${PREFIX}-${ENVIRONMENT}"

# Resource names
export COSMOS_ACCOUNT="${PREFIX}cosmos${ENVIRONMENT}"
export FUNCTION_APP="${PREFIX}-func-${ENVIRONMENT}"
export STORAGE_ACCOUNT="${PREFIX}storage${ENVIRONMENT}"
export KEYVAULT_NAME="${PREFIX}-kv-${ENVIRONMENT}"
export SWA_NAME="${PREFIX}-swa-${ENVIRONMENT}"
export APP_INSIGHTS="${PREFIX}-insights-${ENVIRONMENT}"
export LOG_ANALYTICS="${PREFIX}-logs-${ENVIRONMENT}"

# Entra ID App Registration
export APP_NAME="EquityReview ${ENVIRONMENT}"
```

---

## Stage 2: Create Resource Group

```bash
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION \
  --tags Environment=$ENVIRONMENT Project=EquityReview
```

---

## Stage 3: Create Cosmos DB

```bash
# Create Cosmos DB account (Serverless for cost efficiency)
az cosmosdb create \
  --name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --locations regionName=$LOCATION \
  --capabilities EnableServerless \
  --default-consistency-level Session

# Create database
az cosmosdb sql database create \
  --account-name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --name "equityreview"

# Create containers
az cosmosdb sql container create \
  --account-name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --database-name "equityreview" \
  --name "jobs" \
  --partition-key-path "/id"

az cosmosdb sql container create \
  --account-name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --database-name "equityreview" \
  --name "employees" \
  --partition-key-path "/jobId"

az cosmosdb sql container create \
  --account-name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --database-name "equityreview" \
  --name "auditLogs" \
  --partition-key-path "/eventType"

# Get connection string (save for later)
az cosmosdb keys list \
  --name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv
```

---

## Stage 4: Create Log Analytics & App Insights

```bash
# Create Log Analytics workspace
az monitor log-analytics workspace create \
  --resource-group $RESOURCE_GROUP \
  --workspace-name $LOG_ANALYTICS \
  --location $LOCATION

# Create Application Insights
az monitor app-insights component create \
  --resource-group $RESOURCE_GROUP \
  --app $APP_INSIGHTS \
  --location $LOCATION \
  --kind web \
  --application-type web \
  --workspace $LOG_ANALYTICS

# Get App Insights connection string
export APP_INSIGHTS_CONNECTION=$(az monitor app-insights component show \
  --resource-group $RESOURCE_GROUP \
  --app $APP_INSIGHTS \
  --query connectionString \
  --output tsv)
```

---

## Stage 5: Create Storage Account (for Function App)

```bash
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2
```

---

## Stage 6: Create Function App

```bash
# Create Function App (Node.js 20)
az functionapp create \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --storage-account $STORAGE_ACCOUNT \
  --consumption-plan-location $LOCATION \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4 \
  --os-type Linux

# Enable system-assigned managed identity
az functionapp identity assign \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP

# Get the managed identity principal ID
export FUNC_PRINCIPAL_ID=$(az functionapp identity show \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --query principalId \
  --output tsv)

# Configure App Insights
az functionapp config appsettings set \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --settings APPLICATIONINSIGHTS_CONNECTION_STRING="$APP_INSIGHTS_CONNECTION"
```

---

## Stage 7: Create Key Vault

```bash
# Create Key Vault with RBAC authorization
az keyvault create \
  --name $KEYVAULT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --enable-rbac-authorization true

# Get Key Vault resource ID
export KEYVAULT_ID=$(az keyvault show \
  --name $KEYVAULT_NAME \
  --resource-group $RESOURCE_GROUP \
  --query id \
  --output tsv)

# Grant Function App access to Key Vault secrets
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee $FUNC_PRINCIPAL_ID \
  --scope $KEYVAULT_ID
```

---

## Stage 8: Store Secrets in Key Vault

```bash
# Get Cosmos DB connection string
export COSMOS_CONNECTION=$(az cosmosdb keys list \
  --name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv)

# Store secrets
az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name "COSMOS-DB-CONNECTION" \
  --value "$COSMOS_CONNECTION"

az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name "SESSION-SECRET" \
  --value "$(openssl rand -hex 32)"
```

---

## Stage 9: Grant Function App Access to Cosmos DB

```bash
# Get Cosmos DB account ID
export COSMOS_ID=$(az cosmosdb show \
  --name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query id \
  --output tsv)

# Grant Cosmos DB Data Contributor role to Function App
az role assignment create \
  --role "Cosmos DB Built-in Data Contributor" \
  --assignee $FUNC_PRINCIPAL_ID \
  --scope $COSMOS_ID
```

---

## Stage 10: Create Microsoft Entra ID App Registration

```bash
# Create App Registration
az ad app create \
  --display-name "$APP_NAME" \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris "https://${SWA_NAME}.azurestaticapps.net/.auth/login/aad/callback"

# Get App ID
export APP_ID=$(az ad app list \
  --display-name "$APP_NAME" \
  --query "[0].appId" \
  --output tsv)

# Create client secret
export CLIENT_SECRET=$(az ad app credential reset \
  --id $APP_ID \
  --display-name "SWA Auth" \
  --years 2 \
  --query password \
  --output tsv)

# Store in Key Vault
az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name "AZURE-AD-CLIENT-SECRET" \
  --value "$CLIENT_SECRET"

# Get Tenant ID
export TENANT_ID=$(az account show --query tenantId --output tsv)

echo "App ID: $APP_ID"
echo "Tenant ID: $TENANT_ID"
```

---

## Stage 11: Create App Roles (RBAC)

```bash
# Define app roles
cat > app-roles.json << 'EOF'
[
  {
    "allowedMemberTypes": ["User"],
    "description": "HR Analysts can view and analyze reviews",
    "displayName": "HR Analyst",
    "isEnabled": true,
    "value": "HR.Analyst"
  },
  {
    "allowedMemberTypes": ["User"],
    "description": "HR Admins can configure settings",
    "displayName": "HR Admin",
    "isEnabled": true,
    "value": "HR.Admin"
  },
  {
    "allowedMemberTypes": ["User"],
    "description": "Compliance officers can view audit logs",
    "displayName": "Compliance Officer",
    "value": "Compliance.Officer",
    "isEnabled": true
  }
]
EOF

# Update app registration with roles
az ad app update \
  --id $APP_ID \
  --app-roles @app-roles.json

rm app-roles.json
```

---

## Stage 12: Create Static Web App

```bash
# Create Static Web App (Free tier for dev, Standard for prod)
az staticwebapp create \
  --name $SWA_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Free

# Link to Function App backend
az staticwebapp backends link \
  --name $SWA_NAME \
  --resource-group $RESOURCE_GROUP \
  --backend-resource-id $(az functionapp show \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --query id \
    --output tsv)

# Get deployment token (for CI/CD)
export SWA_TOKEN=$(az staticwebapp secrets list \
  --name $SWA_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "properties.apiKey" \
  --output tsv)

echo "SWA Deployment Token: $SWA_TOKEN"
```

---

## Stage 13: Configure SWA Authentication

Create `staticwebapp.config.json` in your repo:

```json
{
  "auth": {
    "identityProviders": {
      "azureActiveDirectory": {
        "registration": {
          "openIdIssuer": "https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0",
          "clientIdSettingName": "AZURE_AD_CLIENT_ID",
          "clientSecretSettingName": "AZURE_AD_CLIENT_SECRET"
        }
      }
    }
  },
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["authenticated"]
    },
    {
      "route": "/admin/*",
      "allowedRoles": ["HR.Admin"]
    }
  ],
  "responseOverrides": {
    "401": {
      "redirect": "/.auth/login/aad",
      "statusCode": 302
    }
  }
}
```

Set the app settings:

```bash
az staticwebapp appsettings set \
  --name $SWA_NAME \
  --resource-group $RESOURCE_GROUP \
  --setting-names \
    AZURE_AD_CLIENT_ID=$APP_ID \
    AZURE_AD_CLIENT_SECRET="@Microsoft.KeyVault(VaultName=${KEYVAULT_NAME};SecretName=AZURE-AD-CLIENT-SECRET)"
```

---

## Stage 14: Configure Function App Settings

```bash
az functionapp config appsettings set \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --settings \
    COSMOS_DB_CONNECTION="@Microsoft.KeyVault(VaultName=${KEYVAULT_NAME};SecretName=COSMOS-DB-CONNECTION)" \
    COSMOS_DB_NAME="equityreview" \
    AZURE_AD_TENANT_ID=$TENANT_ID \
    AZURE_AD_CLIENT_ID=$APP_ID \
    NODE_ENV="production"
```

---

## Stage 15: Assign Users to Roles

```bash
# Get Service Principal Object ID
export SP_OBJECT_ID=$(az ad sp list \
  --display-name "$APP_NAME" \
  --query "[0].id" \
  --output tsv)

# Assign HR.Admin role to a user (replace with actual user email)
export USER_ID=$(az ad user show \
  --id "admin@yourdomain.com" \
  --query id \
  --output tsv)

# Get the role ID for HR.Admin
export ADMIN_ROLE_ID=$(az ad app show \
  --id $APP_ID \
  --query "appRoles[?value=='HR.Admin'].id" \
  --output tsv)

# Assign role via Graph API (requires admin consent)
az rest --method POST \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/${SP_OBJECT_ID}/appRoleAssignedTo" \
  --body "{
    \"principalId\": \"${USER_ID}\",
    \"resourceId\": \"${SP_OBJECT_ID}\",
    \"appRoleId\": \"${ADMIN_ROLE_ID}\"
  }"
```

---

## Summary: Resources Created

| Resource | Name | Purpose |
|----------|------|---------|
| Resource Group | `rg-equityreview-prod` | Container for all resources |
| Cosmos DB | `equityreviewcosmos` | Document database |
| Storage Account | `equityreviewstorage` | Function App storage |
| Function App | `equityreview-func-prod` | API backend |
| Key Vault | `equityreview-kv-prod` | Secrets management |
| Static Web App | `equityreview-swa-prod` | React frontend hosting |
| App Insights | `equityreview-insights-prod` | Monitoring |
| Log Analytics | `equityreview-logs-prod` | Centralized logging |
| Entra ID App | `EquityReview prod` | Authentication |

---

## Next Steps

1. **Sync to GitHub**: Push your code to a GitHub repository
2. **Import to Azure DevOps**: Import the GitHub repo
3. **Configure CI/CD**: Use the SWA deployment token in your pipeline
4. **Build React frontend**: Configure build output for SWA
5. **Deploy Functions**: Configure Functions deployment

---

## Verification Commands

```bash
# List all resources
az resource list \
  --resource-group $RESOURCE_GROUP \
  --output table

# Test Cosmos DB connection
az cosmosdb sql database list \
  --account-name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP

# Check Function App status
az functionapp show \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --query "state"

# Verify Key Vault secrets
az keyvault secret list \
  --vault-name $KEYVAULT_NAME \
  --output table

# Check SWA status
az staticwebapp show \
  --name $SWA_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "defaultHostname"
```

---

## Cleanup (if needed)

```bash
# Delete all resources
az group delete --name $RESOURCE_GROUP --yes --no-wait

# Delete App Registration
az ad app delete --id $APP_ID
```
