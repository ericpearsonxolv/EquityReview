# Azure Deployment Guide for EquityReview

This comprehensive guide provides step-by-step instructions for deploying EquityReview to Microsoft Azure with enterprise-grade security, authentication, monitoring, and disaster recovery.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Core Infrastructure](#core-infrastructure)
4. [Microsoft Entra ID Authentication](#microsoft-entra-id-authentication)
5. [Network Security](#network-security)
6. [Azure Key Vault Integration](#azure-key-vault-integration)
7. [SharePoint Integration](#sharepoint-integration)
8. [Monitoring & Observability](#monitoring--observability)
9. [Disaster Recovery & Backup](#disaster-recovery--backup)
10. [Azure DevOps CI/CD](#azure-devops-cicd)
11. [Environment Variables Reference](#environment-variables-reference)
12. [Troubleshooting](#troubleshooting)
13. [Security Checklist](#security-checklist)

---

## Prerequisites

- Azure CLI installed and configured (`az login`)
- Azure subscription with Owner or Contributor permissions
- Azure DevOps organization (for CI/CD pipelines)
- SharePoint site with admin access (for history integration)
- PowerShell with Microsoft Graph module (for Entra ID setup)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Azure Resource Group                                │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                           Virtual Network (VNet)                         │    │
│  │                                                                          │    │
│  │   ┌──────────────────┐         ┌──────────────────┐                     │    │
│  │   │  App Service     │  ◄───►  │  PostgreSQL      │                     │    │
│  │   │  (Private Endpt) │         │  (Private Endpt) │                     │    │
│  │   │                  │         │  + Backups       │                     │    │
│  │   └────────┬─────────┘         └──────────────────┘                     │    │
│  │            │                                                             │    │
│  │            │ Managed Identity                                            │    │
│  │            ▼                                                             │    │
│  │   ┌──────────────────┐         ┌──────────────────┐                     │    │
│  │   │  Azure Key Vault │         │  Log Analytics   │                     │    │
│  │   │  (Private Endpt) │         │  Workspace       │                     │    │
│  │   │  - Secrets       │         │  - Audit Logs    │                     │    │
│  │   │  - Certificates  │         │  - App Logs      │                     │    │
│  │   └──────────────────┘         └──────────────────┘                     │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐          │
│  │  Container       │    │  Application     │    │  Microsoft       │          │
│  │  Registry (ACR)  │    │  Insights        │    │  Entra ID        │          │
│  └──────────────────┘    └──────────────────┘    │  (Authentication)│          │
│                                                   └──────────────────┘          │
│                                                                                  │
│  External Services:                                                              │
│  ┌──────────────────┐    ┌──────────────────┐                                   │
│  │  Microsoft Graph │    │  SharePoint      │                                   │
│  │  API             │    │  Online          │                                   │
│  └──────────────────┘    └──────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Infrastructure

### Step 1: Set Environment Variables

```bash
# Core settings
export RESOURCE_GROUP="rg-equityreview-prod"
export LOCATION="eastus"
export ENVIRONMENT="prod"

# Resource names (must be globally unique)
export DB_SERVER_NAME="equityreview-db-${ENVIRONMENT}"
export KEYVAULT_NAME="kv-equityreview-${ENVIRONMENT}"
export ACR_NAME="acrequityreview${ENVIRONMENT}"
export APP_SERVICE_PLAN="asp-equityreview-${ENVIRONMENT}"
export APP_NAME="equityreview-${ENVIRONMENT}"
export VNET_NAME="vnet-equityreview-${ENVIRONMENT}"
export LOG_ANALYTICS_NAME="log-equityreview-${ENVIRONMENT}"
export APP_INSIGHTS_NAME="ai-equityreview-${ENVIRONMENT}"
```

### Step 2: Create Resource Group

```bash
az group create --name $RESOURCE_GROUP --location $LOCATION --tags Environment=$ENVIRONMENT Application=EquityReview
```

### Step 3: Create Virtual Network

```bash
# Create VNet with subnets
az network vnet create \
  --resource-group $RESOURCE_GROUP \
  --name $VNET_NAME \
  --address-prefix 10.0.0.0/16

# App Service subnet
az network vnet subnet create \
  --resource-group $RESOURCE_GROUP \
  --vnet-name $VNET_NAME \
  --name snet-appservice \
  --address-prefix 10.0.1.0/24 \
  --delegations Microsoft.Web/serverFarms

# Database subnet
az network vnet subnet create \
  --resource-group $RESOURCE_GROUP \
  --vnet-name $VNET_NAME \
  --name snet-database \
  --address-prefix 10.0.2.0/24 \
  --delegations Microsoft.DBforPostgreSQL/flexibleServers

# Private endpoints subnet
az network vnet subnet create \
  --resource-group $RESOURCE_GROUP \
  --vnet-name $VNET_NAME \
  --name snet-privateendpoints \
  --address-prefix 10.0.3.0/24 \
  --disable-private-endpoint-network-policies true
```

### Step 4: Create Azure Database for PostgreSQL

```bash
# Generate secure password
DB_ADMIN_USER="adminuser"
DB_ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
echo "DB Password: $DB_ADMIN_PASSWORD"  # Save this securely!

# Create PostgreSQL Flexible Server with VNet integration
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --location $LOCATION \
  --admin-user $DB_ADMIN_USER \
  --admin-password $DB_ADMIN_PASSWORD \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 15 \
  --storage-size 32 \
  --vnet $VNET_NAME \
  --subnet snet-database \
  --yes

# Create database
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $DB_SERVER_NAME \
  --database-name equityreview

# Enable connection encryption
az postgres flexible-server parameter set \
  --resource-group $RESOURCE_GROUP \
  --server-name $DB_SERVER_NAME \
  --name require_secure_transport \
  --value on
```

### Step 5: Create Azure Key Vault

```bash
# Create Key Vault
az keyvault create \
  --resource-group $RESOURCE_GROUP \
  --name $KEYVAULT_NAME \
  --location $LOCATION \
  --enable-rbac-authorization true \
  --enable-soft-delete true \
  --retention-days 90

# Store secrets
az keyvault secret set --vault-name $KEYVAULT_NAME \
  --name "DATABASE-URL" \
  --value "postgresql://${DB_ADMIN_USER}:${DB_ADMIN_PASSWORD}@${DB_SERVER_NAME}.postgres.database.azure.com:5432/equityreview?sslmode=require"

az keyvault secret set --vault-name $KEYVAULT_NAME \
  --name "SESSION-SECRET" \
  --value "$(openssl rand -base64 32)"
```

### Step 6: Create Container Registry

```bash
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Standard \
  --admin-enabled false
```

### Step 7: Create App Service

```bash
# Create App Service Plan
az appservice plan create \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_PLAN \
  --sku P1v3 \
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

# Get Managed Identity Principal ID
PRINCIPAL_ID=$(az webapp identity show \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --query principalId -o tsv)

# Enable VNet Integration
az webapp vnet-integration add \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --vnet $VNET_NAME \
  --subnet snet-appservice

# Enable HTTPS Only
az webapp update \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --https-only true

# Set minimum TLS version
az webapp config set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --min-tls-version 1.2
```

---

## Microsoft Entra ID Authentication

### Step 1: Create App Registration

```bash
# Create App Registration
APP_REG_NAME="EquityReview-${ENVIRONMENT}"
APP_REG=$(az ad app create \
  --display-name $APP_REG_NAME \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris "https://${APP_NAME}.azurewebsites.net/auth/callback" \
  --query appId -o tsv)

echo "Client ID: $APP_REG"

# Create Client Secret
APP_SECRET=$(az ad app credential reset \
  --id $APP_REG \
  --display-name "EquityReview-Secret" \
  --years 2 \
  --query password -o tsv)

echo "Client Secret: $APP_SECRET"  # Save this securely!

# Get Tenant ID
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "Tenant ID: $TENANT_ID"

# Store in Key Vault
az keyvault secret set --vault-name $KEYVAULT_NAME \
  --name "AZURE-AD-CLIENT-ID" \
  --value "$APP_REG"

az keyvault secret set --vault-name $KEYVAULT_NAME \
  --name "AZURE-AD-CLIENT-SECRET" \
  --value "$APP_SECRET"

az keyvault secret set --vault-name $KEYVAULT_NAME \
  --name "AZURE-AD-TENANT-ID" \
  --value "$TENANT_ID"
```

### Step 2: Configure API Permissions

```bash
# Add Microsoft Graph permissions
# User.Read - Sign in and read user profile
az ad app permission add \
  --id $APP_REG \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope

# Grant admin consent (requires Global Admin)
az ad app permission admin-consent --id $APP_REG
```

### Step 3: Configure App Roles (Optional - for RBAC)

```bash
# Define app roles in manifest
az ad app update --id $APP_REG --app-roles '[
  {
    "allowedMemberTypes": ["User"],
    "description": "HR Analysts can upload and analyze reviews",
    "displayName": "HR Analyst",
    "id": "00000000-0000-0000-0000-000000000001",
    "isEnabled": true,
    "value": "HRAnalyst"
  },
  {
    "allowedMemberTypes": ["User"],
    "description": "Administrators have full access",
    "displayName": "Administrator",
    "id": "00000000-0000-0000-0000-000000000002",
    "isEnabled": true,
    "value": "Administrator"
  }
]'
```

### Step 4: Configure App Service Authentication Settings

```bash
# Configure authentication environment variables
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings \
    AZURE_AD_TENANT_ID="@Microsoft.KeyVault(VaultName=${KEYVAULT_NAME};SecretName=AZURE-AD-TENANT-ID)" \
    AZURE_AD_CLIENT_ID="@Microsoft.KeyVault(VaultName=${KEYVAULT_NAME};SecretName=AZURE-AD-CLIENT-ID)" \
    AZURE_AD_CLIENT_SECRET="@Microsoft.KeyVault(VaultName=${KEYVAULT_NAME};SecretName=AZURE-AD-CLIENT-SECRET)" \
    AZURE_AD_REDIRECT_URI="https://${APP_NAME}.azurewebsites.net/auth/callback"
```

---

## Network Security

### Private Endpoints for Key Vault

```bash
# Create private endpoint for Key Vault
az network private-endpoint create \
  --resource-group $RESOURCE_GROUP \
  --name pe-keyvault \
  --vnet-name $VNET_NAME \
  --subnet snet-privateendpoints \
  --private-connection-resource-id $(az keyvault show --name $KEYVAULT_NAME --query id -o tsv) \
  --group-id vault \
  --connection-name kv-connection

# Create Private DNS Zone for Key Vault
az network private-dns zone create \
  --resource-group $RESOURCE_GROUP \
  --name privatelink.vaultcore.azure.net

# Link DNS Zone to VNet
az network private-dns link vnet create \
  --resource-group $RESOURCE_GROUP \
  --zone-name privatelink.vaultcore.azure.net \
  --name kv-dns-link \
  --virtual-network $VNET_NAME \
  --registration-enabled false

# Create DNS Zone Group
az network private-endpoint dns-zone-group create \
  --resource-group $RESOURCE_GROUP \
  --endpoint-name pe-keyvault \
  --name kv-dns-group \
  --private-dns-zone privatelink.vaultcore.azure.net \
  --zone-name keyvault
```

### Network Security Group (NSG)

```bash
# Create NSG for App Service subnet
az network nsg create \
  --resource-group $RESOURCE_GROUP \
  --name nsg-appservice

# Allow only HTTPS inbound
az network nsg rule create \
  --resource-group $RESOURCE_GROUP \
  --nsg-name nsg-appservice \
  --name AllowHTTPS \
  --priority 100 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --destination-port-ranges 443

# Deny all other inbound
az network nsg rule create \
  --resource-group $RESOURCE_GROUP \
  --nsg-name nsg-appservice \
  --name DenyAllInbound \
  --priority 4096 \
  --direction Inbound \
  --access Deny \
  --protocol '*' \
  --destination-port-ranges '*'
```

### Web Application Firewall (Optional)

```bash
# Create Application Gateway with WAF
az network application-gateway waf-policy create \
  --resource-group $RESOURCE_GROUP \
  --name waf-equityreview \
  --mode Prevention

# Enable OWASP 3.2 rule set
az network application-gateway waf-policy rule set update \
  --resource-group $RESOURCE_GROUP \
  --policy-name waf-equityreview \
  --rule-set-type OWASP \
  --rule-set-version 3.2
```

---

## Azure Key Vault Integration

### Grant App Service Access to Key Vault

```bash
# Get Key Vault resource ID
KEYVAULT_ID=$(az keyvault show --name $KEYVAULT_NAME --query id -o tsv)

# Assign Key Vault Secrets User role to App Service managed identity
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee $PRINCIPAL_ID \
  --scope $KEYVAULT_ID

# Grant ACR pull access
ACR_ID=$(az acr show --name $ACR_NAME --query id -o tsv)
az role assignment create \
  --role "AcrPull" \
  --assignee $PRINCIPAL_ID \
  --scope $ACR_ID
```

### Store All Secrets in Key Vault

```bash
# Store additional secrets as needed
az keyvault secret set --vault-name $KEYVAULT_NAME \
  --name "SP-TENANT-ID" \
  --value "$TENANT_ID"

# For SharePoint service principal (if not using managed identity)
# az keyvault secret set --vault-name $KEYVAULT_NAME \
#   --name "SP-CLIENT-ID" --value "<your-sp-client-id>"
# az keyvault secret set --vault-name $KEYVAULT_NAME \
#   --name "SP-CLIENT-SECRET" --value "<your-sp-client-secret>"
```

---

## SharePoint Integration

### Step 1: Grant Managed Identity Graph Permissions

Run in Azure Cloud Shell (PowerShell):

```powershell
# Install Microsoft Graph module if needed
Install-Module Microsoft.Graph -Scope CurrentUser

# Connect to Microsoft Graph
Connect-MgGraph -Scopes "Application.Read.All","AppRoleAssignment.ReadWrite.All"

# Your App Service Managed Identity Object ID
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

### Step 2: Create SharePoint List

Create a list named `EquityReviewHistory` with these columns:

| Column Name | Type | Required |
|-------------|------|----------|
| Title | Single line of text | Yes |
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

### Step 3: Configure SharePoint Settings

```bash
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings \
    SHAREPOINT_SITE_URL="https://yourtenant.sharepoint.com/sites/HR" \
    SHAREPOINT_LIST_NAME="EquityReviewHistory" \
    USE_MANAGED_IDENTITY="true"
```

---

## Monitoring & Observability

### Create Log Analytics Workspace

```bash
# Create Log Analytics Workspace
az monitor log-analytics workspace create \
  --resource-group $RESOURCE_GROUP \
  --workspace-name $LOG_ANALYTICS_NAME \
  --location $LOCATION \
  --retention-time 90

# Get workspace ID and key
LOG_ANALYTICS_WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --resource-group $RESOURCE_GROUP \
  --workspace-name $LOG_ANALYTICS_NAME \
  --query customerId -o tsv)

LOG_ANALYTICS_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group $RESOURCE_GROUP \
  --workspace-name $LOG_ANALYTICS_NAME \
  --query primarySharedKey -o tsv)

# Store in Key Vault
az keyvault secret set --vault-name $KEYVAULT_NAME \
  --name "LOG-ANALYTICS-WORKSPACE-ID" \
  --value "$LOG_ANALYTICS_WORKSPACE_ID"

az keyvault secret set --vault-name $KEYVAULT_NAME \
  --name "LOG-ANALYTICS-SHARED-KEY" \
  --value "$LOG_ANALYTICS_KEY"
```

### Create Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
  --resource-group $RESOURCE_GROUP \
  --app $APP_INSIGHTS_NAME \
  --location $LOCATION \
  --kind web \
  --application-type web \
  --workspace $LOG_ANALYTICS_NAME

# Get connection string
APP_INSIGHTS_CONNECTION=$(az monitor app-insights component show \
  --resource-group $RESOURCE_GROUP \
  --app $APP_INSIGHTS_NAME \
  --query connectionString -o tsv)

# Store in Key Vault
az keyvault secret set --vault-name $KEYVAULT_NAME \
  --name "APPLICATIONINSIGHTS-CONNECTION-STRING" \
  --value "$APP_INSIGHTS_CONNECTION"

# Configure App Service
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings \
    APPLICATIONINSIGHTS_CONNECTION_STRING="@Microsoft.KeyVault(VaultName=${KEYVAULT_NAME};SecretName=APPLICATIONINSIGHTS-CONNECTION-STRING)" \
    LOG_ANALYTICS_WORKSPACE_ID="@Microsoft.KeyVault(VaultName=${KEYVAULT_NAME};SecretName=LOG-ANALYTICS-WORKSPACE-ID)" \
    LOG_ANALYTICS_SHARED_KEY="@Microsoft.KeyVault(VaultName=${KEYVAULT_NAME};SecretName=LOG-ANALYTICS-SHARED-KEY)"
```

### Enable Diagnostic Settings

```bash
# Enable App Service diagnostics to Log Analytics
az monitor diagnostic-settings create \
  --resource $(az webapp show --resource-group $RESOURCE_GROUP --name $APP_NAME --query id -o tsv) \
  --name "AppServiceDiagnostics" \
  --workspace $LOG_ANALYTICS_NAME \
  --logs '[
    {"category": "AppServiceHTTPLogs", "enabled": true},
    {"category": "AppServiceConsoleLogs", "enabled": true},
    {"category": "AppServiceAppLogs", "enabled": true},
    {"category": "AppServiceAuditLogs", "enabled": true}
  ]' \
  --metrics '[{"category": "AllMetrics", "enabled": true}]'

# Enable PostgreSQL diagnostics
az monitor diagnostic-settings create \
  --resource $(az postgres flexible-server show --resource-group $RESOURCE_GROUP --name $DB_SERVER_NAME --query id -o tsv) \
  --name "PostgreSQLDiagnostics" \
  --workspace $LOG_ANALYTICS_NAME \
  --logs '[
    {"category": "PostgreSQLLogs", "enabled": true}
  ]' \
  --metrics '[{"category": "AllMetrics", "enabled": true}]'
```

### Create Alerts

```bash
# Create action group for alerts
az monitor action-group create \
  --resource-group $RESOURCE_GROUP \
  --name "ag-equityreview-alerts" \
  --short-name "ERAlerts" \
  --email-receiver name="Admin" email="admin@yourdomain.com"

# Alert for high error rate
az monitor metrics alert create \
  --resource-group $RESOURCE_GROUP \
  --name "High-Error-Rate" \
  --scopes $(az webapp show --resource-group $RESOURCE_GROUP --name $APP_NAME --query id -o tsv) \
  --condition "avg Http5xx > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action "ag-equityreview-alerts"

# Alert for database connection issues
az monitor metrics alert create \
  --resource-group $RESOURCE_GROUP \
  --name "DB-Connection-Failed" \
  --scopes $(az postgres flexible-server show --resource-group $RESOURCE_GROUP --name $DB_SERVER_NAME --query id -o tsv) \
  --condition "avg connections_failed > 5" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action "ag-equityreview-alerts"
```

---

## Disaster Recovery & Backup

### PostgreSQL Backup Configuration

```bash
# Enable geo-redundant backup (already default for Flexible Server)
# Verify backup settings
az postgres flexible-server show \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --query "backup"

# Configure backup retention (7-35 days)
az postgres flexible-server update \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --backup-retention 35
```

### Point-in-Time Restore

```bash
# Restore to a specific point in time (example)
# az postgres flexible-server restore \
#   --resource-group $RESOURCE_GROUP \
#   --name ${DB_SERVER_NAME}-restored \
#   --source-server $DB_SERVER_NAME \
#   --restore-time "2024-01-15T12:00:00Z"
```

### Geo-Replication (Production)

```bash
# Create read replica in different region for DR
# az postgres flexible-server replica create \
#   --resource-group $RESOURCE_GROUP \
#   --name ${DB_SERVER_NAME}-replica \
#   --source-server $DB_SERVER_NAME \
#   --location westus2
```

### Key Vault Backup

```bash
# Enable soft delete and purge protection (already set)
# Backup secrets periodically
az keyvault secret backup \
  --vault-name $KEYVAULT_NAME \
  --name DATABASE-URL \
  --file database-url-backup.blob
```

### App Service Deployment Slots

```bash
# Create staging slot for zero-downtime deployments
az webapp deployment slot create \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --slot staging

# Configure slot settings
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --slot staging \
  --settings NODE_ENV=staging
```

---

## Azure DevOps CI/CD

### Step 1: Create Service Connections

1. Go to **Azure DevOps > Project Settings > Service connections**
2. Create **Azure Resource Manager** connection named `Azure-Service-Connection`
3. Create **Docker Registry** connection for ACR named `AzureContainerRegistry`

### Step 2: Configure Pipeline Variables

Update `azure-pipelines.yml`:

```yaml
variables:
  AZURE_CONTAINER_REGISTRY: 'acrequityreviewprod.azurecr.io'
  IMAGE_NAME: 'equityreview'
  AZURE_RESOURCE_GROUP: 'rg-equityreview-prod'
  AZURE_APP_NAME_DEV: 'equityreview-dev'
  AZURE_APP_NAME_PROD: 'equityreview-prod'
```

### Step 3: Create Environments with Approvals

1. Go to **Pipelines > Environments**
2. Create `development` environment
3. Create `production` environment with approval gates

### Step 4: Run Initial Pipeline

```bash
# Trigger pipeline by pushing to develop branch
git push origin develop
```

---

## Environment Variables Reference

### Core Application Settings

| Variable | Source | Description |
|----------|--------|-------------|
| `NODE_ENV` | App Settings | `production` |
| `PORT` | App Settings | `5000` |
| `WEBSITES_PORT` | App Settings | `5000` |
| `DATABASE_URL` | Key Vault | PostgreSQL connection string |
| `SESSION_SECRET` | Key Vault | Session encryption key |
| `LLM_PROVIDER` | App Settings | `mock` or `azure_openai` |

### Authentication (Microsoft Entra ID)

| Variable | Source | Description |
|----------|--------|-------------|
| `AZURE_AD_TENANT_ID` | Key Vault | Azure AD tenant ID |
| `AZURE_AD_CLIENT_ID` | Key Vault | App registration client ID |
| `AZURE_AD_CLIENT_SECRET` | Key Vault | App registration secret |
| `AZURE_AD_REDIRECT_URI` | App Settings | OAuth callback URL |

### Azure Services

| Variable | Source | Description |
|----------|--------|-------------|
| `USE_MANAGED_IDENTITY` | App Settings | `true` for Azure |
| `AZURE_KEYVAULT_URL` | App Settings | Key Vault URL |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Key Vault | App Insights connection |
| `LOG_ANALYTICS_WORKSPACE_ID` | Key Vault | Log Analytics workspace ID |
| `LOG_ANALYTICS_SHARED_KEY` | Key Vault | Log Analytics shared key |

### SharePoint Integration

| Variable | Source | Description |
|----------|--------|-------------|
| `SHAREPOINT_SITE_URL` | App Settings | SharePoint site URL |
| `SHAREPOINT_LIST_NAME` | App Settings | History list name |

### Configure All Settings

```bash
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings \
    NODE_ENV=production \
    PORT=5000 \
    WEBSITES_PORT=5000 \
    LLM_PROVIDER=mock \
    USE_MANAGED_IDENTITY=true \
    AZURE_KEYVAULT_URL="https://${KEYVAULT_NAME}.vault.azure.net/" \
    SHAREPOINT_SITE_URL="https://yourtenant.sharepoint.com/sites/HR" \
    SHAREPOINT_LIST_NAME="EquityReviewHistory" \
    DATABASE_URL="@Microsoft.KeyVault(VaultName=${KEYVAULT_NAME};SecretName=DATABASE-URL)" \
    SESSION_SECRET="@Microsoft.KeyVault(VaultName=${KEYVAULT_NAME};SecretName=SESSION-SECRET)" \
    AZURE_AD_TENANT_ID="@Microsoft.KeyVault(VaultName=${KEYVAULT_NAME};SecretName=AZURE-AD-TENANT-ID)" \
    AZURE_AD_CLIENT_ID="@Microsoft.KeyVault(VaultName=${KEYVAULT_NAME};SecretName=AZURE-AD-CLIENT-ID)" \
    AZURE_AD_CLIENT_SECRET="@Microsoft.KeyVault(VaultName=${KEYVAULT_NAME};SecretName=AZURE-AD-CLIENT-SECRET)" \
    AZURE_AD_REDIRECT_URI="https://${APP_NAME}.azurewebsites.net/auth/callback" \
    APPLICATIONINSIGHTS_CONNECTION_STRING="@Microsoft.KeyVault(VaultName=${KEYVAULT_NAME};SecretName=APPLICATIONINSIGHTS-CONNECTION-STRING)" \
    LOG_ANALYTICS_WORKSPACE_ID="@Microsoft.KeyVault(VaultName=${KEYVAULT_NAME};SecretName=LOG-ANALYTICS-WORKSPACE-ID)" \
    LOG_ANALYTICS_SHARED_KEY="@Microsoft.KeyVault(VaultName=${KEYVAULT_NAME};SecretName=LOG-ANALYTICS-SHARED-KEY)"
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Check connection from App Service
az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP

# Verify VNet integration
az webapp vnet-integration list --name $APP_NAME --resource-group $RESOURCE_GROUP

# Test database connectivity
az postgres flexible-server connect \
  --name $DB_SERVER_NAME \
  --admin-user $DB_ADMIN_USER \
  --admin-password $DB_ADMIN_PASSWORD
```

### Key Vault Access Issues

```bash
# Verify managed identity role assignment
az role assignment list \
  --assignee $PRINCIPAL_ID \
  --scope $(az keyvault show --name $KEYVAULT_NAME --query id -o tsv)

# Check Key Vault firewall rules
az keyvault network-rule list --name $KEYVAULT_NAME
```

### Authentication Issues

```bash
# Verify app registration
az ad app show --id $APP_REG

# Check redirect URIs
az ad app show --id $APP_REG --query "web.redirectUris"

# Verify API permissions
az ad app permission list --id $APP_REG
```

### Container Startup Failures

```bash
# View container logs
az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP

# Check container settings
az webapp config container show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP

# Verify ACR access
az acr login --name $ACR_NAME
az acr repository list --name $ACR_NAME
```

### SharePoint Integration Errors

```bash
# Verify Graph API permissions for managed identity
# Run in PowerShell:
# Get-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $ManagedIdentityObjectId

# Test SharePoint connection via application
curl -X POST https://${APP_NAME}.azurewebsites.net/api/history/test
```

---

## Security Checklist

### Identity & Access

- [ ] Microsoft Entra ID authentication configured
- [ ] App roles defined for RBAC
- [ ] Managed Identity used (no service principal secrets in code)
- [ ] Key Vault access via RBAC (not access policies)
- [ ] Admin consent granted for Graph API permissions

### Network Security

- [ ] VNet integration enabled for App Service
- [ ] Private endpoints configured for Key Vault
- [ ] PostgreSQL accessible only via VNet
- [ ] NSG rules restrict inbound traffic
- [ ] HTTPS-only enforced on App Service
- [ ] Minimum TLS 1.2 configured
- [ ] WAF enabled (optional but recommended)

### Data Protection

- [ ] All secrets stored in Key Vault
- [ ] Database connection uses SSL (`sslmode=require`)
- [ ] Session encryption configured
- [ ] Soft delete enabled on Key Vault
- [ ] Purge protection enabled on Key Vault

### Monitoring & Compliance

- [ ] Application Insights configured
- [ ] Log Analytics workspace created
- [ ] Diagnostic settings enabled for all resources
- [ ] Alerts configured for critical metrics
- [ ] Audit logging enabled to Log Analytics

### Disaster Recovery

- [ ] PostgreSQL backup retention configured (35 days)
- [ ] Geo-redundant backup enabled
- [ ] Point-in-time restore tested
- [ ] Deployment slots configured
- [ ] Recovery procedures documented

### CI/CD Security

- [ ] Service connections use limited scope
- [ ] Production environment requires approval
- [ ] Secrets not logged in pipeline output
- [ ] Container images scanned for vulnerabilities

---

## Production Hardening Recommendations

The following enhancements should be implemented before production deployment:

### Authentication Hardening

The current Entra ID implementation provides a foundation that should be enhanced with:

1. **Server-Side Session Store**: Replace in-memory session storage with Redis or Azure Cache for Redis
2. **ID Token Validation**: Add full JWT signature and audience validation using `jsonwebtoken` or `jose`
3. **Token Refresh Flow**: Implement automatic token refresh with refresh tokens stored server-side
4. **Session Security**: Enable secure cookies, SameSite settings, and CSRF protection

```bash
# Add Redis for session storage
npm install connect-redis redis

# Add JWT validation
npm install jose
```

### Application Insights Enhancement

Replace the current telemetry shim with the official Azure Application Insights SDK:

```bash
npm install applicationinsights
```

Update `server/services/azure-telemetry.ts` to use the official SDK for full APM capabilities including:
- Automatic dependency tracking
- Exception monitoring
- Performance metrics
- Custom events and metrics

### Audit Logging Reliability

Enhance the audit service for production:

1. **Await Flush on Shutdown**: Ensure all audit events are sent before process exit
2. **Retry Logic**: Add exponential backoff for Log Analytics API failures
3. **Dead Letter Queue**: Store failed events locally for later retry

### Additional RBAC Assignments

```bash
# Grant App Insights access to managed identity (for metrics queries)
az role assignment create \
  --role "Monitoring Reader" \
  --assignee $PRINCIPAL_ID \
  --scope $(az monitor app-insights component show --resource-group $RESOURCE_GROUP --app $APP_INSIGHTS_NAME --query id -o tsv)

# Grant Log Analytics access
az role assignment create \
  --role "Log Analytics Reader" \
  --assignee $PRINCIPAL_ID \
  --scope $(az monitor log-analytics workspace show --resource-group $RESOURCE_GROUP --workspace-name $LOG_ANALYTICS_NAME --query id -o tsv)
```

### Security Headers

Add security headers middleware to Express:

```typescript
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});
```

### Rate Limiting

Implement rate limiting for API endpoints:

```bash
npm install express-rate-limit
```

### Container Security Scanning

Add container scanning to the CI/CD pipeline:

```yaml
# Add to azure-pipelines.yml
- task: ContainerScanning@0
  inputs:
    image: '$(AZURE_CONTAINER_REGISTRY)/$(IMAGE_NAME):$(Build.BuildId)'
```
