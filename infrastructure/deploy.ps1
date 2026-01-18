# EquityReview Azure Infrastructure Deployment Script
# This script deploys all Azure resources using ARM templates

param(
    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId,
    
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroupName = "rg-equityreview-prod",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "eastus",
    
    [Parameter(Mandatory=$false)]
    [string]$Environment = "prod",
    
    [Parameter(Mandatory=$false)]
    [string]$Prefix = "equityreview",
    
    [Parameter(Mandatory=$false)]
    [string]$StaticWebAppSku = "Free",
    
    [Parameter(Mandatory=$true)]
    [string]$AdminUserEmail
)

# Script configuration
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "EquityReview Infrastructure Deployment" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify Azure CLI
Write-Host "[1/8] Verifying Azure CLI..." -ForegroundColor Yellow
try {
    $azVersion = az version --query '\"azure-cli\"' -o tsv
    Write-Host "  ✓ Azure CLI version: $azVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Azure CLI not found. Please install from https://aka.ms/installazurecliwindows" -ForegroundColor Red
    exit 1
}

# Step 2: Login and set subscription
Write-Host "[2/8] Setting Azure subscription..." -ForegroundColor Yellow
try {
    az account set --subscription $SubscriptionId
    $currentSub = az account show --query name -o tsv
    Write-Host "  ✓ Using subscription: $currentSub" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Failed to set subscription. Please run 'az login' first" -ForegroundColor Red
    exit 1
}

# Step 3: Create Resource Group
Write-Host "[3/8] Creating resource group..." -ForegroundColor Yellow
$rgExists = az group exists --name $ResourceGroupName
if ($rgExists -eq "true") {
    Write-Host "  ℹ Resource group '$ResourceGroupName' already exists" -ForegroundColor Blue
} else {
    az group create `
        --name $ResourceGroupName `
        --location $Location `
        --tags Environment=$Environment Project=EquityReview | Out-Null
    Write-Host "  ✓ Created resource group: $ResourceGroupName" -ForegroundColor Green
}

# Step 4: Validate ARM template
Write-Host "[4/8] Validating ARM template..." -ForegroundColor Yellow
$templateFile = Join-Path $ScriptDir "azuredeploy.json"
$parametersFile = Join-Path $ScriptDir "azuredeploy.parameters.json"

if (-not (Test-Path $templateFile)) {
    Write-Host "  ✗ Template file not found: $templateFile" -ForegroundColor Red
    exit 1
}

try {
    az deployment group validate `
        --resource-group $ResourceGroupName `
        --template-file $templateFile `
        --parameters $parametersFile `
        --parameters prefix=$Prefix environment=$Environment location=$Location staticWebAppSku=$StaticWebAppSku adminUserEmail=$AdminUserEmail | Out-Null
    Write-Host "  ✓ Template validation successful" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Template validation failed" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Step 5: Deploy ARM template
Write-Host "[5/8] Deploying Azure resources (this may take 5-10 minutes)..." -ForegroundColor Yellow
Write-Host "  Resources being created:" -ForegroundColor White
Write-Host "    - Cosmos DB (Serverless)" -ForegroundColor Gray
Write-Host "    - Function App (Node.js 20)" -ForegroundColor Gray
Write-Host "    - Storage Account" -ForegroundColor Gray
Write-Host "    - Key Vault" -ForegroundColor Gray
Write-Host "    - Static Web App ($StaticWebAppSku)" -ForegroundColor Gray
Write-Host "    - Application Insights" -ForegroundColor Gray
Write-Host "    - Log Analytics Workspace" -ForegroundColor Gray
Write-Host ""

try {
    $deploymentOutput = az deployment group create `
        --name "equityreview-deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss')" `
        --resource-group $ResourceGroupName `
        --template-file $templateFile `
        --parameters $parametersFile `
        --parameters prefix=$Prefix environment=$Environment location=$Location staticWebAppSku=$StaticWebAppSku adminUserEmail=$AdminUserEmail `
        --output json | ConvertFrom-Json
    
    Write-Host "  ✓ Deployment completed successfully" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Deployment failed" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Step 6: Extract outputs
Write-Host "[6/8] Extracting deployment outputs..." -ForegroundColor Yellow
$outputs = $deploymentOutput.properties.outputs

$cosmosDbName = $outputs.cosmosDbAccountName.value
$functionAppName = $outputs.functionAppName.value
$functionPrincipalId = $outputs.functionAppPrincipalId.value
$keyVaultName = $outputs.keyVaultName.value
$swaName = $outputs.staticWebAppName.value
$swaHostname = $outputs.staticWebAppDefaultHostname.value
$swaId = $outputs.staticWebAppId.value
$functionAppId = $outputs.functionAppId.value
$tenantId = $outputs.tenantId.value

Write-Host "  ✓ Deployment outputs captured" -ForegroundColor Green

# Step 7: Link Static Web App to Function App
Write-Host "[7/8] Linking Static Web App to Function App backend..." -ForegroundColor Yellow
try {
    az staticwebapp backends link `
        --name $swaName `
        --resource-group $ResourceGroupName `
        --backend-resource-id $functionAppId `
        --region $Location | Out-Null
    Write-Host "  ✓ Backend linked successfully" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Backend linking may have failed (this is normal if already linked)" -ForegroundColor Yellow
}

# Step 8: Get SWA deployment token
Write-Host "[8/8] Retrieving Static Web App deployment token..." -ForegroundColor Yellow
try {
    $swaToken = az staticwebapp secrets list `
        --name $swaName `
        --resource-group $ResourceGroupName `
        --query "properties.apiKey" `
        --output tsv
    Write-Host "  ✓ Deployment token retrieved" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Could not retrieve deployment token" -ForegroundColor Yellow
    $swaToken = "N/A"
}

# Display summary
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Deployment Summary" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Resource Group:      $ResourceGroupName" -ForegroundColor White
Write-Host "Location:            $Location" -ForegroundColor White
Write-Host "Environment:         $Environment" -ForegroundColor White
Write-Host ""
Write-Host "Resources Created:" -ForegroundColor Yellow
Write-Host "  Cosmos DB:         $cosmosDbName" -ForegroundColor White
Write-Host "  Function App:      $functionAppName" -ForegroundColor White
Write-Host "  Key Vault:         $keyVaultName" -ForegroundColor White
Write-Host "  Static Web App:    $swaName" -ForegroundColor White
Write-Host "  SWA URL:           https://$swaHostname" -ForegroundColor White
Write-Host ""
Write-Host "Identity Information:" -ForegroundColor Yellow
Write-Host "  Tenant ID:         $tenantId" -ForegroundColor White
Write-Host "  Function Principal: $functionPrincipalId" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Create Entra ID App Registration (see post-deployment-steps.md)" -ForegroundColor White
Write-Host "  2. Configure SWA authentication settings" -ForegroundColor White
Write-Host "  3. Update Function App with Entra ID settings" -ForegroundColor White
Write-Host "  4. Assign RBAC roles to users" -ForegroundColor White
Write-Host "  5. Deploy your code to SWA using the deployment token" -ForegroundColor White
Write-Host ""
Write-Host "SWA Deployment Token (save this securely):" -ForegroundColor Yellow
Write-Host "  $swaToken" -ForegroundColor Cyan
Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "Deployment Complete! ✓" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Save outputs to file
$outputFile = Join-Path $ScriptDir "deployment-outputs.json"
$outputData = @{
    resourceGroup = $ResourceGroupName
    location = $Location
    environment = $Environment
    cosmosDbName = $cosmosDbName
    functionAppName = $functionAppName
    functionPrincipalId = $functionPrincipalId
    keyVaultName = $keyVaultName
    staticWebAppName = $swaName
    staticWebAppHostname = $swaHostname
    staticWebAppDeploymentToken = $swaToken
    tenantId = $tenantId
    adminUserEmail = $AdminUserEmail
} | ConvertTo-Json

$outputData | Out-File -FilePath $outputFile -Encoding UTF8
Write-Host "Outputs saved to: $outputFile" -ForegroundColor Gray
