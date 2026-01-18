import { entraIdAuth } from "./azure-auth";
import { keyVaultService } from "./azure-keyvault";
import { telemetryService } from "./azure-telemetry";
import { auditService } from "./audit";

interface InitializationResult {
  keyVault: { enabled: boolean; error?: string };
  entraId: { enabled: boolean; error?: string };
  telemetry: { enabled: boolean; error?: string };
}

export async function initializeAzureServices(): Promise<InitializationResult> {
  console.log("[Azure] Initializing Azure services...");

  const result: InitializationResult = {
    keyVault: { enabled: false },
    entraId: { enabled: false },
    telemetry: { enabled: false },
  };

  try {
    keyVaultService.initialize();
    result.keyVault.enabled = keyVaultService.isEnabled();
    
    if (keyVaultService.isEnabled()) {
      console.log("[Azure] Key Vault enabled - loading secrets...");
      
      try {
        const tenantId = await keyVaultService.getSecret("AZURE-AD-TENANT-ID");
        const clientId = await keyVaultService.getSecret("AZURE-AD-CLIENT-ID");
        const clientSecret = await keyVaultService.getSecret("AZURE-AD-CLIENT-SECRET");

        if (tenantId && clientId && clientSecret) {
          process.env.AZURE_AD_TENANT_ID = tenantId;
          process.env.AZURE_AD_CLIENT_ID = clientId;
          process.env.AZURE_AD_CLIENT_SECRET = clientSecret;
        }

        const dbUrl = await keyVaultService.getSecret("DATABASE-URL");
        if (dbUrl && !process.env.DATABASE_URL) {
          process.env.DATABASE_URL = dbUrl;
        }

        const sessionSecret = await keyVaultService.getSecret("SESSION-SECRET");
        if (sessionSecret && !process.env.SESSION_SECRET) {
          process.env.SESSION_SECRET = sessionSecret;
        }

        const appInsightsConn = await keyVaultService.getSecret("APPLICATIONINSIGHTS-CONNECTION-STRING");
        if (appInsightsConn) {
          process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = appInsightsConn;
        }

        const logWorkspaceId = await keyVaultService.getSecret("LOG-ANALYTICS-WORKSPACE-ID");
        const logSharedKey = await keyVaultService.getSecret("LOG-ANALYTICS-SHARED-KEY");
        if (logWorkspaceId && logSharedKey) {
          process.env.LOG_ANALYTICS_WORKSPACE_ID = logWorkspaceId;
          process.env.LOG_ANALYTICS_SHARED_KEY = logSharedKey;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error loading secrets";
        console.error("[Azure] Failed to load secrets from Key Vault:", errorMsg);
        result.keyVault.error = errorMsg;
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Azure] Key Vault initialization failed:", errorMsg);
    result.keyVault.error = errorMsg;
  }

  try {
    entraIdAuth.initialize();
    result.entraId.enabled = entraIdAuth.isEnabled();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Azure] Entra ID initialization failed:", errorMsg);
    result.entraId.error = errorMsg;
  }

  try {
    telemetryService.initialize();
    result.telemetry.enabled = telemetryService.isEnabled();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Azure] Application Insights initialization failed:", errorMsg);
    result.telemetry.error = errorMsg;
  }

  console.log("[Azure] Azure services initialization complete");
  console.log(`  - Key Vault: ${result.keyVault.enabled ? "enabled" : "disabled"}${result.keyVault.error ? ` (error: ${result.keyVault.error})` : ""}`);
  console.log(`  - Entra ID Auth: ${result.entraId.enabled ? "enabled" : "disabled"}${result.entraId.error ? ` (error: ${result.entraId.error})` : ""}`);
  console.log(`  - Application Insights: ${result.telemetry.enabled ? "enabled" : "disabled"}${result.telemetry.error ? ` (error: ${result.telemetry.error})` : ""}`);

  return result;
}

export async function shutdownAzureServices(): Promise<void> {
  console.log("[Azure] Shutting down Azure services...");
  
  try {
    telemetryService.shutdown();
  } catch (error) {
    console.error("[Azure] Telemetry shutdown error:", error);
  }
  
  try {
    auditService.shutdown();
  } catch (error) {
    console.error("[Azure] Audit service shutdown error:", error);
  }
  
  entraIdAuth.shutdown();
  
  console.log("[Azure] Azure services shutdown complete");
}

export { entraIdAuth, keyVaultService, telemetryService };
