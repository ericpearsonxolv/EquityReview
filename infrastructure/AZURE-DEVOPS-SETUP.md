# Azure DevOps Pipeline Setup Guide

## Overview

This guide will help you connect your Azure DevOps pipeline to the deployed Azure resources.

---

## 📋 Prerequisites

1. Azure DevOps organization and project
2. Repository imported/connected to Azure DevOps
3. Azure subscription access
4. Deployment outputs from `infrastructure/deployment-outputs.json`

---

## 🔧 Step 1: Create Service Connection

1. **Navigate to Project Settings**
   - Go to your Azure DevOps project
   - Click **Project Settings** (bottom left)
   - Select **Service connections**

2. **Create Azure Resource Manager Connection**

   ```
   - Click "New service connection"
   - Select "Azure Resource Manager"
   - Choose "Service principal (automatic)"
   - Subscription: Select your subscription (9e0b9781-b9b0-4363-a7c6-a51496872eaa)
   - Resource group: rg-catalight-er-dev
   - Service connection name: Azure-ServiceConnection
   - Grant access to all pipelines: ✓
   ```

3. **Verify Connection**
   - Test the connection to ensure it works
   - Note: You need Owner or Contributor role on the subscription

---

## 🔑 Step 2: Configure Pipeline Variables

### Required Variables

Navigate to **Pipelines** → **Library** → **Create Variable Group** named `EquityReview-Dev`:

| Variable Name | Value | Secret? |
|---------------|-------|---------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | `45221f777f448f470523c1b9e8e1e280908e3b681e` | ✓ Yes |
| `AZURE_AD_TENANT_ID` | `b0dcd598-b101befeb3-827c-9871271` | No |
| `AZURE_AD_CLIENT_ID` | `<from-app-registration>` | No |
| `APP_INSIGHTS_CONNECTION_STRING` | `<from-azure-portal>` | ✓ Yes |

### How to Get Missing Values

**App Insights Connection String:**

```powershell
az monitor app-insights component show \
  --app catalight-er-insights-dev \
  --resource-group rg-catalight-er-dev \
  --query connectionString \
  --output tsv
```

**Azure AD Client ID:**

- Create App Registration first (see `post-deployment-steps.md`)
- Copy the Application (client) ID

---

## 📝 Step 3: Create Pipeline

### Option A: Using Existing Pipeline File

1. Go to **Pipelines** → **New Pipeline**
2. Select **Azure Repos Git** or **GitHub**
3. Select your repository
4. Choose **Existing Azure Pipelines YAML file**
5. Select `/azure-pipelines.yml`
6. Click **Run**

### Option B: Manual Setup

If the pipeline file doesn't exist, create it:

```yaml
# Copy the content from azure-pipelines.yml
```

---

## 🎯 Step 4: Link Variable Group to Pipeline

1. Edit your pipeline
2. Click **Variables** → **Variable groups**
3. Link the `EquityReview-Dev` variable group
4. Save

---

## 🚀 Step 5: Run Initial Deployment

### First Run Checklist

Before triggering the pipeline:

- [x] Service connection created: `Azure-ServiceConnection`
- [x] Variable group created: `EquityReview-Dev`
- [x] SWA deployment token added (secret)
- [ ] Entra ID App Registration created
- [ ] Azure AD Client ID variable set
- [ ] App Insights connection string set
- [ ] Secrets stored in Key Vault

### Trigger Deployment

**Automatic:**

- Push to `main` or `dev` branch triggers deployment

**Manual:**

```bash
# Commit and push changes
git add .
git commit -m "Configure Azure DevOps pipeline"
git push origin main
```

---

## 📊 Pipeline Stages

The pipeline has 3 stages:

### Stage 1: Build

- Installs Node.js 20
- Installs dependencies
- Builds frontend and backend
- Creates deployment artifacts

### Stage 2: Deploy to Dev

- **Static Web App**: Deploys frontend to `catalight-er-swa-dev`
- **Function App**: Deploys backend to `catalight-er-func-dev`

### Stage 3: Configure Resources

- Updates Function App settings with Key Vault references
- Updates Static Web App settings
- Configures environment variables

---

## 🔐 Key Vault Integration

The pipeline automatically configures Key Vault references:

```bash
# Cosmos DB connection
COSMOS_DB_CONNECTION=@Microsoft.KeyVault(VaultName=catalight-er-kv-dev;SecretName=COSMOS-DB-CONNECTION)

# Azure AD client secret
AZURE_AD_CLIENT_SECRET=@Microsoft.KeyVault(VaultName=catalight-er-kv-dev;SecretName=AZURE-AD-CLIENT-SECRET)
```

**Before first deployment**, store secrets in Key Vault:

```powershell
# Get Cosmos DB connection string
$cosmosConn = az cosmosdb keys list \
  --name catalightercosmosdev \
  --resource-group rg-catalight-er-dev \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv

# Store in Key Vault
az keyvault secret set \
  --vault-name catalight-er-kv-dev \
  --name "COSMOS-DB-CONNECTION" \
  --value "$cosmosConn"

# Store Azure AD client secret (after creating app registration)
az keyvault secret set \
  --vault-name catalight-er-kv-dev \
  --name "AZURE-AD-CLIENT-SECRET" \
  --value "<your-client-secret>"
```

---

## 🔍 Monitoring Pipeline Runs

### View Pipeline Logs

1. Go to **Pipelines** → **Recent runs**
2. Click on a run to see details
3. Click on stages/jobs to view logs

### Common Issues

**Issue**: `Service connection not found`

- **Fix**: Ensure service connection name is exactly `Azure-ServiceConnection`

**Issue**: `AZURE_STATIC_WEB_APPS_API_TOKEN not found`

- **Fix**: Add variable to variable group and mark as secret

**Issue**: `Function App deployment fails`

- **Fix**: Check that Node.js 20 is specified in pipeline

**Issue**: `Key Vault access denied`

- **Fix**: Grant service principal "Key Vault Secrets User" role:

  ```powershell
  az role assignment create \
    --role "Key Vault Secrets User" \
    --assignee <service-principal-id> \
    --scope /subscriptions/9e0b9781-b9b0-4363-a7c6-a51496872eaa/resourceGroups/rg-catalight-er-dev/providers/Microsoft.KeyVault/vaults/catalight-er-kv-dev
  ```

---

## 🎯 Next Steps

1. **Complete Entra ID Setup**
   - Follow `infrastructure/post-deployment-steps.md`
   - Update `AZURE_AD_CLIENT_ID` variable

2. **Store All Secrets**
   - Cosmos DB connection string
   - Azure AD client secret
   - Any API keys

3. **Test Deployment**
   - Push a commit to trigger pipeline
   - Verify all stages complete successfully
   - Test the deployed application

4. **Set Up Continuous Deployment**
   - Enable branch policies for `main`
   - Require successful pipeline run before merge

---

## 📁 Quick Reference

**Service Connection**: `Azure-ServiceConnection`  
**Variable Group**: `EquityReview-Dev`  
**Pipeline File**: `azure-pipelines.yml`  

**Dev Environment Resources:**

- Resource Group: `rg-catalight-er-dev`
- Static Web App: `catalight-er-swa-dev`
- Function App: `catalight-er-func-dev`
- Key Vault: `catalight-er-kv-dev`
- Cosmos DB: `catalightercosmosdev`

---

## ✅ Pipeline Setup Complete

Once configured, every push to `main` or `dev` will:

1. Build your application
2. Deploy to Azure Static Web App
3. Deploy to Azure Function App
4. Configure all environment settings

Your Azure DevOps pipeline is ready to deploy to the Azure resources!
