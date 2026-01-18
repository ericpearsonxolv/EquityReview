# Multi-Environment Deployment Guide

This guide shows how to deploy to multiple environments (Dev, UAT, Prod).

---

## 📁 Parameter Files

| File | Environment | Purpose |
|------|-------------|---------|
| `azuredeploy.parameters.dev.json` | **Development** | For active development and testing |
| `azuredeploy.parameters.uat.json` | **UAT** | For user acceptance testing |
| `azuredeploy.parameters.json` | **Default (Dev)** | Default parameters file |

---

## 🚀 Deployment Commands

### Deploy Development Environment

```powershell
cd c:\Users\EricPearson\Projects\Equity-Review\EquityReview\infrastructure

.\deploy.ps1 `
  -SubscriptionId "9e0b9781-b9b0-4363-a7c6-a51496872eaa" `
  -ResourceGroupName "rg-catalight-equityreview-dev" `
  -Environment "dev" `
  -Prefix "catalight-equityreview" `
  -Location "westus2" `
  -StaticWebAppSku "Standard" `
  -AdminUserEmail "eric.pearson@xolv.org"
```

**Or using the parameter file:**

```powershell
az deployment group create `
  --name "equityreview-dev-$(Get-Date -Format 'yyyyMMdd-HHmmss')" `
  --resource-group "rg-catalight-equityreview-dev" `
  --template-file .\azuredeploy.json `
  --parameters @azuredeploy.parameters.dev.json
```

### Deploy UAT Environment

```powershell
.\deploy.ps1 `
  -SubscriptionId "9e0b9781-b9b0-4363-a7c6-a51496872eaa" `
  -ResourceGroupName "rg-catalight-equityreview-uat" `
  -Environment "uat" `
  -Prefix "catalight-equityreview" `
  -Location "westus2" `
  -StaticWebAppSku "Standard" `
  -AdminUserEmail "eric.pearson@xolv.org"
```

**Or using the parameter file:**

```powershell
az deployment group create `
  --name "equityreview-uat-$(Get-Date -Format 'yyyyMMdd-HHmmss')" `
  --resource-group "rg-catalight-equityreview-uat" `
  --template-file .\azuredeploy.json `
  --parameters @azuredeploy.parameters.uat.json
```

---

## 🏷️ Resource Names

### Development Environment

| Resource | Name |
|----------|------|
| Resource Group | `rg-catalight-equityreview-dev` |
| Cosmos DB | `catalight-equityreviewcosmosdev` |
| Function App | `catalight-equityreview-func-dev` |
| Storage Account | `catalightequitystoragedev` |
| Key Vault | `catalight-equityreview-kv-dev` |
| Static Web App | `catalight-equityreview-swa-dev` |
| App Insights | `catalight-equityreview-insights-dev` |

### UAT Environment

| Resource | Name |
|----------|------|
| Resource Group | `rg-catalight-equityreview-uat` |
| Cosmos DB | `catalight-equityreviewcosmosuat` |
| Function App | `catalight-equityreview-func-uat` |
| Storage Account | `catalightequitystorageuat` |
| Key Vault | `catalight-equityreview-kv-uat` |
| Static Web App | `catalight-equityreview-swa-uat` |
| App Insights | `catalight-equityreview-insights-uat` |

---

## 💰 Cost Estimate

**Per Environment** (with Standard SWA):

- Static Web App Standard: ~$9/month
- Cosmos DB Serverless: ~$0-5/month (minimal usage)
- Function App Consumption: ~$0-5/month (minimal usage)
- Storage: ~$1/month
- App Insights: Free tier (first 5GB/month)

**Total per environment**: ~$10-20/month  
**Two environments (Dev + UAT)**: ~$20-40/month

---

## 📋 Deployment Order

### Recommended Approach

1. **Deploy Dev first** to validate the template and configuration
2. **Test Dev thoroughly** to ensure everything works
3. **Deploy UAT** once Dev is stable
4. **Configure Entra ID** for each environment separately (different app registrations)

---

## 🔐 Entra ID Configuration

Each environment needs its own Entra ID App Registration:

### Dev Environment App

- **Name**: `EquityReview dev`
- **Redirect URI**: `https://catalight-equityreview-swa-dev.azurestaticapps.net/.auth/login/aad/callback`

### UAT Environment App

- **Name**: `EquityReview uat`
- **Redirect URI**: `https://catalight-equityreview-swa-uat.azurestaticapps.net/.auth/login/aad/callback`

**Note**: Follow `post-deployment-steps.md` for each environment separately.

---

## 🔄 Updating Environments

To update an existing environment after code changes:

```powershell
# Update Dev
az deployment group create `
  --name "equityreview-dev-update-$(Get-Date -Format 'yyyyMMdd-HHmmss')" `
  --resource-group "rg-catalight-equityreview-dev" `
  --template-file .\azuredeploy.json `
  --parameters @azuredeploy.parameters.dev.json `
  --mode Incremental
```

---

## 🧹 Environment Isolation

Each environment is completely isolated:

- ✅ Separate resource groups
- ✅ Separate databases
- ✅ Separate authentication
- ✅ Separate monitoring
- ✅ No shared resources

This ensures Dev changes never affect UAT.

---

## 📊 Quick Status Check

```powershell
# Check Dev environment
az resource list --resource-group "rg-catalight-equityreview-dev" --output table

# Check UAT environment
az resource list --resource-group "rg-catalight-equityreview-uat" --output table
```

---

## 🎯 Next Steps

1. **Deploy Dev** using the command above
2. Wait for deployment to complete (~5-10 minutes)
3. Follow post-deployment steps for Dev
4. Test Dev environment
5. **Deploy UAT** once Dev is validated
6. Follow post-deployment steps for UAT
