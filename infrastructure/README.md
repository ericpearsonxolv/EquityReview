# EquityReview Azure Infrastructure

Automated deployment templates and scripts for the EquityReview application on Azure.

---

## 📁 Files Overview

| File | Description |
|------|-------------|
| `azuredeploy.json` | ARM template defining all Azure resources |
| `azuredeploy.parameters.dev.json` | Dev environment configuration |
| `azuredeploy.parameters.uat.json` | UAT environment configuration |
| `azuredeploy.parameters.json` | Default parameters (Dev) |
| `deploy.ps1` | PowerShell deployment orchestration script |
| `post-deployment-steps.md` | Manual configuration steps after deployment |
| `MULTI-ENVIRONMENT-DEPLOYMENT.md` | Guide for deploying Dev and UAT environments |
| `deployment-outputs.json` | Generated deployment outputs (created after deployment) |

---

## 🚀 Quick Start

### Prerequisites

1. **Azure CLI** installed ([Download](https://aka.ms/installazurecliwindows))
2. **Azure subscription** with Owner or Contributor permissions
3. **PowerShell 7+** (recommended)

### Deployment Steps

1. **Login to Azure**

```powershell
az login
```

1. **Customize Parameters**

Edit `azuredeploy.parameters.json` with your values:

```json
{
  "prefix": "equityreview",           // Resource name prefix
  "environment": "prod",              // Environment (dev/qa/staging/prod)
  "location": "eastus",               // Azure region
  "staticWebAppSku": "Free",          // Free or Standard
  "adminUserEmail": "admin@domain.com" // Your admin email
}
```

1. **Run Deployment**

```powershell
.\deploy.ps1 `
  -SubscriptionId "9e0b9781-b9b0-4363-a7c6-a51496872eaa" `
  -AdminUserEmail "your-email@domain.com"
```

Or with custom parameters:

```powershell
.\deploy.ps1 `
  -SubscriptionId "9e0b9781-b9b0-4363-a7c6-a51496872eaa" `
  -ResourceGroupName "rg-equityreview-dev" `
  -Location "westus2" `
  -Environment "dev" `
  -Prefix "mycompany-er" `
  -StaticWebAppSku "Standard" `
  -AdminUserEmail "admin@company.com"
```

1. **Complete Post-Deployment Steps**

Follow the instructions in `post-deployment-steps.md` to:

- Create Entra ID App Registration
- Configure authentication
- Assign user roles
- Deploy your code

---

## 📦 Resources Created

The ARM template creates:

| Resource | Type | Purpose |
|----------|------|---------|
| **Cosmos DB** | Serverless NoSQL | Database for jobs, employees, audit logs |
| **Function App** | Node.js 20, Consumption Plan | Backend API |
| **Storage Account** | Standard LRS | Function App storage |
| **Key Vault** | RBAC-enabled | Secure secrets management |
| **Static Web App** | Free/Standard | React frontend hosting |
| **Application Insights** | Web | Application monitoring |
| **Log Analytics** | Standard | Centralized logging |

**Estimated Monthly Cost** (Free tier): ~$0-5 USD  
**Estimated Monthly Cost** (Standard SWA, light usage): ~$10-30 USD

---

## 🔐 Security Features

- **Managed Identities**: Function App uses system-assigned identity
- **RBAC**: Key Vault and Cosmos DB use role-based access
- **Secrets Management**: All secrets stored in Key Vault
- **TLS**: All services enforce HTTPS/TLS 1.2+
- **Entra ID Auth**: Application uses Azure AD authentication
- **Role-Based Access**: Three roles (HR.Analyst, HR.Admin, Compliance.Officer)

---

## 🎯 Deployment Outputs

After deployment, `deployment-outputs.json` contains:

```json
{
  "resourceGroup": "rg-equityreview-prod",
  "cosmosDbName": "equityreviewcosmos",
  "functionAppName": "equityreview-func-prod",
  "keyVaultName": "equityreview-kv-prod",
  "staticWebAppName": "equityreview-swa-prod",
  "staticWebAppHostname": "xxx.azurestaticapps.net",
  "staticWebAppDeploymentToken": "xxx",
  "tenantId": "xxx",
  "functionPrincipalId": "xxx"
}
```

**⚠️ Important**: Save the `staticWebAppDeploymentToken` securely for CI/CD!

---

## 🔧 Customization

### Change Resource Names

Edit variables in `azuredeploy.json`:

```json
"variables": {
  "cosmosAccountName": "[concat(parameters('prefix'), 'cosmos', parameters('environment'))]",
  ...
}
```

### Add New Cosmos Containers

Add to the `resources` array in `azuredeploy.json`:

```json
{
  "type": "Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers",
  "name": "[concat(variables('cosmosAccountName'), '/equityreview/newcontainer')]",
  "properties": {
    "resource": {
      "id": "newcontainer",
      "partitionKey": {
        "paths": ["/yourPartitionKey"],
        "kind": "Hash"
      }
    }
  }
}
```

### Change Function App Runtime

Modify in `azuredeploy.json`:

```json
"siteConfig": {
  "linuxFxVersion": "NODE|20",  // Change to NODE|18, PYTHON|3.11, etc.
  ...
}
```

---

## 🧪 Verification Commands

```powershell
# Load outputs
$outputs = Get-Content .\deployment-outputs.json | ConvertFrom-Json

# List all resources
az resource list --resource-group $outputs.resourceGroup --output table

# Check Function App
az functionapp show --name $outputs.functionAppName --resource-group $outputs.resourceGroup

# List Cosmos DB databases
az cosmosdb sql database list --account-name $outputs.cosmosDbName --resource-group $outputs.resourceGroup

# List Key Vault secrets
az keyvault secret list --vault-name $outputs.keyVaultName --output table

# Get SWA URL
Write-Host "SWA URL: https://$($outputs.staticWebAppHostname)"
```

---

## 🔄 Updating Infrastructure

### Update Existing Deployment

After modifying the ARM template:

```powershell
az deployment group create `
  --name "equityreview-update-$(Get-Date -Format 'yyyyMMdd-HHmmss')" `
  --resource-group $outputs.resourceGroup `
  --template-file .\azuredeploy.json `
  --parameters @azuredeploy.parameters.json `
  --mode Incremental
```

### Complete vs. Incremental Mode

- **Incremental** (default): Only adds/updates resources
- **Complete**: Deletes resources not in template ⚠️ Use with caution!

---

## 🐛 Troubleshooting

### Deployment Fails with "Storage account name not available"

**Solution**: Storage account names must be globally unique. Change the `prefix` parameter.

### "Role assignment already exists" error

**Solution**: This is normal on re-deployment. The script continues successfully.

### Cannot access Key Vault secrets

**Solution**: Ensure managed identity is enabled and has "Key Vault Secrets User" role.

### Function App not starting

**Solution**: Check Application Insights logs:

```powershell
az monitor app-insights query `
  --app $outputs.appInsightsName `
  --resource-group $outputs.resourceGroup `
  --analytics-query "traces | take 50"
```

---

## 🗑️ Clean Up

### Delete Everything

```powershell
# Delete resource group (removes all resources)
az group delete --name $outputs.resourceGroup --yes

# Delete Entra ID App Registration
az ad app delete --id <APP_ID>
```

### Delete Specific Resources

```powershell
# Delete only Static Web App
az staticwebapp delete --name $outputs.staticWebAppName --resource-group $outputs.resourceGroup
```

---

## 📚 Additional Resources

- [Azure Static Web Apps Documentation](https://docs.microsoft.com/azure/static-web-apps/)
- [Azure Functions Documentation](https://docs.microsoft.com/azure/azure-functions/)
- [Cosmos DB Serverless](https://docs.microsoft.com/azure/cosmos-db/serverless)
- [Azure Key Vault Best Practices](https://docs.microsoft.com/azure/key-vault/general/best-practices)
- [ARM Template Reference](https://docs.microsoft.com/azure/templates/)

---

## 🤝 Support

For issues or questions:

1. Check `post-deployment-steps.md` for configuration help
2. Review Azure Portal logs in Application Insights
3. Consult the original setup guide: `AZURE-SWA-SETUP.md`

---

## 📝 License

Internal use only - EquityReview Project
