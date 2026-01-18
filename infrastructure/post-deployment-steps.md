# Post-Deployment Configuration Steps

After successfully running the ARM template deployment, complete these manual steps to finalize your Azure infrastructure.

---

## Prerequisites

Ensure you have the `deployment-outputs.json` file created by the deployment script. Load the values:

```powershell
$outputs = Get-Content .\deployment-outputs.json | ConvertFrom-Json
$RESOURCE_GROUP = $outputs.resourceGroup
$SWA_NAME = $outputs.staticWebAppName
$FUNCTION_APP = $outputs.functionAppName
$KEYVAULT_NAME = $outputs.keyVaultName
$TENANT_ID = $outputs.tenantId
$SWA_HOSTNAME = $outputs.staticWebAppHostname
```

---

## Step 1: Create Entra ID App Registration

### 1.1 Create the App

```powershell
# Set app name
$APP_NAME = "EquityReview $($outputs.environment)"

# Create App Registration with redirect URI
az ad app create `
  --display-name "$APP_NAME" `
  --sign-in-audience AzureADMyOrg `
  --web-redirect-uris "https://$SWA_HOSTNAME/.auth/login/aad/callback"

# Get App ID
$APP_ID = az ad app list `
  --display-name "$APP_NAME" `
  --query "[0].appId" `
  --output tsv

Write-Host "App ID: $APP_ID" -ForegroundColor Green
```

### 1.2 Create Client Secret

```powershell
# Create client secret (valid for 2 years)
$CLIENT_SECRET = az ad app credential reset `
  --id $APP_ID `
  --display-name "SWA Auth" `
  --years 2 `
  --query password `
  --output tsv

Write-Host "Client Secret: $CLIENT_SECRET" -ForegroundColor Yellow
Write-Host "⚠️  SAVE THIS SECRET - it will not be shown again!" -ForegroundColor Red
```

### 1.3 Store Secret in Key Vault

```powershell
# Store in Key Vault
az keyvault secret set `
  --vault-name $KEYVAULT_NAME `
  --name "AZURE-AD-CLIENT-SECRET" `
  --value "$CLIENT_SECRET"

Write-Host "✓ Secret stored in Key Vault" -ForegroundColor Green
```

---

## Step 2: Configure App Roles (RBAC)

### 2.1 Define App Roles

```powershell
# Create app roles definition
$appRoles = @'
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
'@

$appRoles | Out-File -FilePath ".\app-roles.json" -Encoding UTF8

# Update app registration with roles
az ad app update `
  --id $APP_ID `
  --app-roles "@app-roles.json"

Remove-Item ".\app-roles.json"

Write-Host "✓ App roles configured" -ForegroundColor Green
```

---

## Step 3: Configure Static Web App Authentication

### 3.1 Set SWA App Settings

```powershell
# Configure SWA authentication
az staticwebapp appsettings set `
  --name $SWA_NAME `
  --resource-group $RESOURCE_GROUP `
  --setting-names `
    AZURE_AD_CLIENT_ID=$APP_ID `
    AZURE_AD_CLIENT_SECRET="@Microsoft.KeyVault(VaultName=$KEYVAULT_NAME;SecretName=AZURE-AD-CLIENT-SECRET)"

Write-Host "✓ SWA authentication configured" -ForegroundColor Green
```

### 3.2 Grant SWA Managed Identity Access to Key Vault (if needed)

If your SWA needs to read from Key Vault directly:

```powershell
# Enable SWA managed identity (if not already enabled)
az staticwebapp identity assign `
  --name $SWA_NAME `
  --resource-group $RESOURCE_GROUP

# Get SWA principal ID
$SWA_PRINCIPAL_ID = az staticwebapp identity show `
  --name $SWA_NAME `
  --resource-group $RESOURCE_GROUP `
  --query principalId `
  --output tsv

# Grant Key Vault access
$KEYVAULT_ID = az keyvault show `
  --name $KEYVAULT_NAME `
  --resource-group $RESOURCE_GROUP `
  --query id `
  --output tsv

az role assignment create `
  --role "Key Vault Secrets User" `
  --assignee $SWA_PRINCIPAL_ID `
  --scope $KEYVAULT_ID

Write-Host "✓ SWA granted Key Vault access" -ForegroundColor Green
```

---

## Step 4: Update Function App Settings

```powershell
# Update Function App with Entra ID settings
az functionapp config appsettings set `
  --name $FUNCTION_APP `
  --resource-group $RESOURCE_GROUP `
  --settings `
    COSMOS_DB_CONNECTION="@Microsoft.KeyVault(VaultName=$KEYVAULT_NAME;SecretName=COSMOS-DB-CONNECTION)" `
    AZURE_AD_TENANT_ID=$TENANT_ID `
    AZURE_AD_CLIENT_ID=$APP_ID

Write-Host "✓ Function App settings updated" -ForegroundColor Green
```

---

## Step 5: Assign Users to Roles

### 5.1 Get Service Principal

```powershell
# Get Service Principal Object ID
$SP_OBJECT_ID = az ad sp list `
  --display-name "$APP_NAME" `
  --query "[0].id" `
  --output tsv

Write-Host "Service Principal ID: $SP_OBJECT_ID" -ForegroundColor Green
```

### 5.2 Assign HR Admin Role

```powershell
# Get user ID (replace with actual admin email)
$ADMIN_EMAIL = $outputs.adminUserEmail
$USER_ID = az ad user show `
  --id "$ADMIN_EMAIL" `
  --query id `
  --output tsv

# Get the HR.Admin role ID
$ADMIN_ROLE_ID = az ad app show `
  --id $APP_ID `
  --query "appRoles[?value=='HR.Admin'].id" `
  --output tsv

# Assign role via Graph API
az rest --method POST `
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$SP_OBJECT_ID/appRoleAssignedTo" `
  --body "{
    \`"principalId\`": \`"$USER_ID\`",
    \`"resourceId\`": \`"$SP_OBJECT_ID\`",
    \`"appRoleId\`": \`"$ADMIN_ROLE_ID\`"
  }"

Write-Host "✓ HR.Admin role assigned to $ADMIN_EMAIL" -ForegroundColor Green
```

### 5.3 Assign Additional Users (Optional)

Repeat the process for other users and roles:

```powershell
# Example: Assign HR.Analyst role
$ANALYST_EMAIL = "analyst@yourdomain.com"
$ANALYST_USER_ID = az ad user show --id "$ANALYST_EMAIL" --query id --output tsv
$ANALYST_ROLE_ID = az ad app show --id $APP_ID --query "appRoles[?value=='HR.Analyst'].id" --output tsv

az rest --method POST `
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$SP_OBJECT_ID/appRoleAssignedTo" `
  --body "{
    \`"principalId\`": \`"$ANALYST_USER_ID\`",
    \`"resourceId\`": \`"$SP_OBJECT_ID\`",
    \`"appRoleId\`": \`"$ANALYST_ROLE_ID\`"
  }"
```

---

## Step 6: Create staticwebapp.config.json

Create this file in your repository root:

```json
{
  "auth": {
    "identityProviders": {
      "azureActiveDirectory": {
        "registration": {
          "openIdIssuer": "https://login.microsoftonline.com/<YOUR_TENANT_ID>/v2.0",
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

**Replace `<YOUR_TENANT_ID>`** with your actual tenant ID from `deployment-outputs.json`.

---

## Step 7: Verify Installation

### 7.1 Check Resource Status

```powershell
# List all resources
az resource list `
  --resource-group $RESOURCE_GROUP `
  --output table

# Verify Function App
az functionapp show `
  --name $FUNCTION_APP `
  --resource-group $RESOURCE_GROUP `
  --query "state"

# Verify Cosmos DB
az cosmosdb sql database list `
  --account-name $outputs.cosmosDbName `
  --resource-group $RESOURCE_GROUP

# Verify Key Vault secrets
az keyvault secret list `
  --vault-name $KEYVAULT_NAME `
  --output table
```

### 7.2 Test SWA URL

```powershell
Write-Host "Static Web App URL: https://$SWA_HOSTNAME" -ForegroundColor Cyan
Start-Process "https://$SWA_HOSTNAME"
```

---

## Step 8: Deploy Your Code

### 8.1 Using Azure DevOps Pipeline

Add the SWA deployment token to your pipeline variables:

- **Variable Name**: `AZURE_STATIC_WEB_APPS_API_TOKEN`
- **Value**: Get from `deployment-outputs.json` → `staticWebAppDeploymentToken`

### 8.2 Manual Deployment (SWA CLI)

```powershell
# Install SWA CLI
npm install -g @azure/static-web-apps-cli

# Deploy
swa deploy `
  --app-location ./src `
  --output-location ./build `
  --deployment-token $outputs.staticWebAppDeploymentToken
```

---

## Summary Checklist

- [ ] Entra ID App Registration created
- [ ] Client secret generated and stored in Key Vault
- [ ] App roles configured (HR.Analyst, HR.Admin, Compliance.Officer)
- [ ] SWA authentication settings configured
- [ ] Function App settings updated with Entra ID details
- [ ] HR.Admin role assigned to admin user
- [ ] `staticwebapp.config.json` created with correct tenant ID
- [ ] All resources verified as running
- [ ] Code deployed to Static Web App

---

## Troubleshooting

### Issue: "401 Unauthorized" errors

**Solution**: Ensure the `staticwebapp.config.json` has the correct tenant ID and that app settings are properly configured.

### Issue: Cannot read Key Vault secrets

**Solution**: Verify managed identity has "Key Vault Secrets User" role assigned.

### Issue: User roles not working

**Solution**: Ensure users are assigned to app roles via Enterprise Applications in Azure Portal, or use the Graph API commands above.

---

## Clean Up (If Needed)

```powershell
# Delete all resources
az group delete --name $RESOURCE_GROUP --yes --no-wait

# Delete App Registration
az ad app delete --id $APP_ID
```
