import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

export interface KeyVaultConfig {
  vaultUrl: string;
  useManagedIdentity: boolean;
}

class AzureKeyVaultService {
  private client: SecretClient | null = null;
  private secretCache: Map<string, { value: string; expiry: number }> = new Map();
  private cacheTtlMs: number = 5 * 60 * 1000; // 5 minutes
  private enabled: boolean = false;

  initialize(config?: Partial<KeyVaultConfig>) {
    const vaultUrl = config?.vaultUrl || process.env.AZURE_KEYVAULT_URL;
    const useManagedIdentity = config?.useManagedIdentity || 
      process.env.USE_MANAGED_IDENTITY === "true";

    if (!vaultUrl) {
      console.log("[KeyVault] Not configured - using environment variables directly. Set AZURE_KEYVAULT_URL to enable.");
      this.enabled = false;
      return;
    }

    try {
      const credential = useManagedIdentity 
        ? new ManagedIdentityCredential()
        : new DefaultAzureCredential();

      this.client = new SecretClient(vaultUrl, credential);
      this.enabled = true;
      console.log(`[KeyVault] Initialized with vault: ${vaultUrl}`);
    } catch (error) {
      console.error("[KeyVault] Failed to initialize:", error);
      this.enabled = false;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async getSecret(secretName: string, defaultValue?: string): Promise<string | undefined> {
    if (!this.enabled || !this.client) {
      return process.env[secretName] || defaultValue;
    }

    const cached = this.secretCache.get(secretName);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    try {
      const secret = await this.client.getSecret(secretName);
      const value = secret.value || defaultValue || "";
      
      this.secretCache.set(secretName, {
        value,
        expiry: Date.now() + this.cacheTtlMs,
      });

      return value;
    } catch (error: any) {
      if (error.code === "SecretNotFound") {
        console.warn(`[KeyVault] Secret '${secretName}' not found, using default`);
        return defaultValue;
      }
      console.error(`[KeyVault] Error fetching secret '${secretName}':`, error.message);
      return process.env[secretName] || defaultValue;
    }
  }

  async getSecrets(secretNames: string[]): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    
    await Promise.all(
      secretNames.map(async (name) => {
        const value = await this.getSecret(name);
        if (value) {
          results[name] = value;
        }
      })
    );

    return results;
  }

  async setSecret(secretName: string, value: string): Promise<boolean> {
    if (!this.enabled || !this.client) {
      console.warn("[KeyVault] Not enabled, cannot set secret");
      return false;
    }

    try {
      await this.client.setSecret(secretName, value);
      this.secretCache.set(secretName, {
        value,
        expiry: Date.now() + this.cacheTtlMs,
      });
      console.log(`[KeyVault] Secret '${secretName}' updated`);
      return true;
    } catch (error) {
      console.error(`[KeyVault] Failed to set secret '${secretName}':`, error);
      return false;
    }
  }

  clearCache() {
    this.secretCache.clear();
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    if (!this.enabled) {
      return { healthy: true, message: "Key Vault not configured - using environment variables" };
    }

    try {
      const secrets = this.client!.listPropertiesOfSecrets();
      await secrets.next();
      return { healthy: true, message: "Key Vault connection successful" };
    } catch (error: any) {
      return { healthy: false, message: `Key Vault error: ${error.message}` };
    }
  }
}

export const keyVaultService = new AzureKeyVaultService();
