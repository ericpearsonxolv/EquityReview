# Azure Deployment Guide for EquityReview

This guide provides step-by-step instructions for deploying EquityReview to Microsoft Azure.

## Prerequisites

- Azure CLI installed and configured
- Azure subscription with appropriate permissions
- Azure DevOps organization (for CI/CD pipelines)
- SharePoint site with admin access (for history integration)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Azure Resource Group                      │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   App        │    │   Azure      │    │   Azure      │       │
│  │   Service    │◄──►│   Database   │    │   Key Vault  │       │
│  │   (Node.js)  │    │   PostgreSQL │    │   (Secrets)  │       │
│  └──────┬───────┘    └──────────────┘    └──────────────┘       │
│         │                                        ▲               │
│         │ Managed Identity                       │               │
│         ▼                                        │               │
│  ┌──────────────┐                               │               │
│  │   Microsoft  │◄──────────────────────────────┘               │
│  │   Graph API  │                                               │
│  │   (SharePt)  │                                               │
│  └──────────────┘                                               │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐                           │
│  │   Container  │    │   App        │                           │
│  │   Registry   │    │   Insights   │                           │
│  │   (ACR)      │    │   (Optional) │                           │
│  └──────────────┘    └──────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

## Step 1: Create Resource Group

```bash
# Set variables
RESOURCE_GROUP="rg-equityreview-prod"
LOCATION="eastus"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION
```

## Step 2: Create Azure Database for PostgreSQL

```bash
DB_SERVER_NAME="equityreview-db"
DB_ADMIN_USER="adminuser"
DB_ADMIN_PASSWORD="<generate-secure-password>"

# Create PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --location $LOCATION \
  --admin-user $DB_ADMIN_USER \
  --admin-password $DB_ADMIN_PASSWORD \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 15 \
  --storage-size 32

# Create database
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $DB_SERVER_NAME \
  --database-name equityreview

# Allow Azure services to connect
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

## Step 3: Create Azure Key Vault

```bash
KEYVAULT_NAME="kv-equityreview"

# Create Key Vault
az keyvault create \
  --resource-group $RESOURCE_GROUP \
  --name $KEYVAULT_NAME \
  --location $LOCATION \
  --enable-rbac-authorization false

# Add secrets
az keyvault secret set --vault-name $KEYVAULT_NAME \
  --name "DATABASE-URL" \
  --value "postgresql://${DB_ADMIN_USER}:${DB_ADMIN_PASSWORD}@${DB_SERVER_NAME}.postgres.database.azure.com:5432/equityreview?sslmode=require"

az keyvault secret set --vault-name $KEYVAULT_NAME \
  --name "SESSION-SECRET" \
  --value "$(openssl rand -base64 32)"
```

## Step 4: Create Azure Container Registry

```bash
ACR_NAME="acrequityreview"

# Create Container Registry
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true
```

## Step 5: Create App Service

```bash
APP_SERVICE_PLAN="asp-equityreview"
APP_NAME="equityreview-prod"

# Create App Service Plan
az appservice plan create \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_PLAN \
  --sku B1 \
  --is-linux

# Create Web App for Containers
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --name $APP_NAME \
  --deployment-container-image-name mcr.microsoft.com/appsvc/staticsite:latest

# Enable System-Assigned Managed Identity
az webapp identity assign \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME
```

## Step 6: Configure Managed Identity Permissions

```bash
# Get Managed Identity Principal ID
PRINCIPAL_ID=$(az webapp identity show \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --query principalId -o tsv)

# Grant Key Vault access
az keyvault set-policy \
  --name $KEYVAULT_NAME \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list

# Grant ACR pull access
ACR_ID=$(az acr show --name $ACR_NAME --query id -o tsv)
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role AcrPull \
  --scope $ACR_ID
```

## Step 7: Configure App Settings

```bash
# Configure environment variables
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings \
    NODE_ENV=production \
    PORT=5000 \
    LLM_PROVIDER=mock \
    USE_MANAGED_IDENTITY=true \
    WEBSITES_PORT=5000

# Reference Key Vault secrets
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings \
    DATABASE_URL="@Microsoft.KeyVault(VaultName=${KEYVAULT_NAME};SecretName=DATABASE-URL)" \
    SESSION_SECRET="@Microsoft.KeyVault(VaultName=${KEYVAULT_NAME};SecretName=SESSION-SECRET)"
```

## Step 8: SharePoint Integration Setup

### 8.1 Create App Registration

1. Go to **Azure Portal > Microsoft Entra ID > App registrations**
2. Click **New registration**
   - Name: `EquityReview-SharePoint`
   - Supported account types: Single tenant
3. Note the **Application (client) ID** and **Directory (tenant) ID**

### 8.2 Configure API Permissions

1. Go to **API permissions > Add permission**
2. Select **Microsoft Graph > Application permissions**
3. Add the following permissions:
   - `Sites.ReadWrite.All`
4. Click **Grant admin consent**

### 8.3 Grant Managed Identity Graph Permissions

Run this PowerShell script in Azure Cloud Shell:

```powershell
# Connect to Microsoft Graph
Connect-MgGraph -Scopes "Application.Read.All","AppRoleAssignment.ReadWrite.All"

# Variables
$ManagedIdentityObjectId = "<your-managed-identity-object-id>"

# Get Microsoft Graph Service Principal
$GraphAppId = "00000003-0000-0000-c000-000000000000"
$GraphSP = Get-MgServicePrincipal -Filter "appId eq '$GraphAppId'"

# Get Sites.ReadWrite.All permission
$AppRole = $GraphSP.AppRoles | Where-Object { $_.Value -eq "Sites.ReadWrite.All" }

# Assign permission to Managed Identity
New-MgServicePrincipalAppRoleAssignment `
  -ServicePrincipalId $ManagedIdentityObjectId `
  -PrincipalId $ManagedIdentityObjectId `
  -ResourceId $GraphSP.Id `
  -AppRoleId $AppRole.Id
```

### 8.4 Create SharePoint List

Create a list named `EquityReviewHistory` in your SharePoint site with these columns:

| Column Name | Type | Required |
|-------------|------|----------|
| Title | Single line of text (default) | Yes |
| ReviewBatch | Single line of text | Yes |
| RunId | Single line of text | Yes |
| SubmittedBy | Single line of text | Yes |
| SubmittedAt | Date and Time | Yes |
| FileName | Single line of text | Yes |
| TotalEmployees | Number | Yes |
| RedCount | Number | Yes |
| GreenCount | Number | Yes |
| Status | Choice (Pending/Completed/Failed) | Yes |
| OutputFileUrl | Single line of text | No |
| ErrorMessage | Multiple lines of text | No |

### 8.5 Configure SharePoint Settings

```bash
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings \
    SHAREPOINT_SITE_URL="https://yourtenant.sharepoint.com/sites/HR" \
    SHAREPOINT_LIST_NAME="EquityReviewHistory"
```

## Step 9: Azure DevOps Setup

### 9.1 Create Service Connection

1. Go to **Azure DevOps > Project Settings > Service connections**
2. Create **Azure Resource Manager** connection
3. Select **Service principal (automatic)**
4. Name it: `Azure-Service-Connection`

### 9.2 Create Container Registry Connection

1. Go to **Project Settings > Service connections**
2. Create **Docker Registry** connection
3. Select **Azure Container Registry**
4. Name it: `AzureContainerRegistry`

### 9.3 Import Pipeline

1. Go to **Pipelines > New Pipeline**
2. Select **Azure Repos Git** or **GitHub**
3. Select your repository
4. Choose **Existing Azure Pipelines YAML file**
5. Select `azure-pipelines.yml`

### 9.4 Update Pipeline Variables

Update these variables in `azure-pipelines.yml`:

```yaml
variables:
  AZURE_CONTAINER_REGISTRY: 'acrequityreview.azurecr.io'
  IMAGE_NAME: 'equityreview'
```

### 9.5 Create Environments

1. Go to **Pipelines > Environments**
2. Create `development` environment
3. Create `production` environment with approval gates

## Step 10: Initial Deployment

### 10.1 Build and Push Container

```bash
# Login to ACR
az acr login --name $ACR_NAME

# Build and push
docker build -t ${ACR_NAME}.azurecr.io/equityreview:latest .
docker push ${ACR_NAME}.azurecr.io/equityreview:latest
```

### 10.2 Configure App Service Container

```bash
az webapp config container set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --docker-custom-image-name ${ACR_NAME}.azurecr.io/equityreview:latest \
  --docker-registry-server-url https://${ACR_NAME}.azurecr.io
```

### 10.3 Run Database Migrations

```bash
# Connect to the database and run migrations
# Option 1: Use Azure Cloud Shell
npm run db:push

# Option 2: Configure GitHub Actions to run migrations
```

## Step 11: Verification

1. Navigate to `https://${APP_NAME}.azurewebsites.net`
2. Verify the application loads correctly
3. Test file upload and analysis
4. Check SharePoint list for history entries
5. Review Application Insights for any errors

## Optional: Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
  --resource-group $RESOURCE_GROUP \
  --app ai-equityreview \
  --location $LOCATION \
  --kind web

# Get connection string
AI_CONNECTION=$(az monitor app-insights component show \
  --resource-group $RESOURCE_GROUP \
  --app ai-equityreview \
  --query connectionString -o tsv)

# Configure App Service
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings APPLICATIONINSIGHTS_CONNECTION_STRING="$AI_CONNECTION"
```

## Environment Variables Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `DATABASE_URL` | Key Vault | PostgreSQL connection string |
| `SESSION_SECRET` | Key Vault | Session encryption key |
| `NODE_ENV` | App Settings | `production` |
| `PORT` | App Settings | `5000` |
| `LLM_PROVIDER` | App Settings | `mock` or `azure_openai` |
| `USE_MANAGED_IDENTITY` | App Settings | `true` |
| `SHAREPOINT_SITE_URL` | App Settings | SharePoint site URL |
| `SHAREPOINT_LIST_NAME` | App Settings | History list name |

## Troubleshooting

### Database Connection Issues
- Verify firewall rules allow Azure services
- Check DATABASE_URL format includes `?sslmode=require`
- Ensure managed identity has Key Vault access

### SharePoint Integration Errors
- Verify managed identity has Graph API permissions
- Check admin consent was granted
- Validate site URL and list name in admin settings

### Container Startup Failures
- Check application logs: `az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP`
- Verify WEBSITES_PORT matches the application port
- Ensure all required environment variables are set

## Security Checklist

- [ ] Database passwords stored in Key Vault
- [ ] Managed Identity used instead of service principal
- [ ] HTTPS enforced on App Service
- [ ] Network isolation with VNet (optional)
- [ ] Regular security audits enabled
- [ ] Backup configured for PostgreSQL
- [ ] Application Insights monitoring enabled
