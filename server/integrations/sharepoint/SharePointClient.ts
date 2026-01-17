import { ClientSecretCredential, DefaultAzureCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import type { ISharePointHistoryStore, RunHistoryItem, SharePointResolvedIds } from "./types";

let cachedIds: SharePointResolvedIds | null = null;

export class SharePointClient implements ISharePointHistoryStore {
  private graphClient: Client | null = null;
  private configured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const siteUrl = process.env.SHAREPOINT_SITE_URL;
    const listName = process.env.SHAREPOINT_LIST_NAME;
    const useManagedIdentity = process.env.USE_MANAGED_IDENTITY === "true";

    if (!siteUrl || !listName) {
      console.log("[SharePoint] Not configured - missing SHAREPOINT_SITE_URL or SHAREPOINT_LIST_NAME");
      return;
    }

    try {
      let credential;

      if (useManagedIdentity) {
        credential = new DefaultAzureCredential();
        console.log("[SharePoint] Using Managed Identity");
      } else {
        const tenantId = process.env.SP_TENANT_ID;
        const clientId = process.env.SP_CLIENT_ID;
        const clientSecret = process.env.SP_CLIENT_SECRET;

        if (!tenantId || !clientId || !clientSecret) {
          console.log("[SharePoint] Dev mode requires SP_TENANT_ID, SP_CLIENT_ID, SP_CLIENT_SECRET");
          return;
        }

        credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
        console.log("[SharePoint] Using Service Principal");
      }

      const authProvider = new TokenCredentialAuthenticationProvider(credential, {
        scopes: ["https://graph.microsoft.com/.default"],
      });

      this.graphClient = Client.initWithMiddleware({ authProvider });
      this.configured = true;
      console.log("[SharePoint] Client initialized successfully");
    } catch (error) {
      console.error("[SharePoint] Failed to initialize:", error);
    }
  }

  isConfigured(): boolean {
    return this.configured && this.graphClient !== null;
  }

  async resolveIds(): Promise<SharePointResolvedIds | null> {
    if (cachedIds) {
      return cachedIds;
    }

    if (!this.graphClient) {
      return null;
    }

    const siteUrl = process.env.SHAREPOINT_SITE_URL;
    const listName = process.env.SHAREPOINT_LIST_NAME;

    if (!siteUrl || !listName) {
      return null;
    }

    try {
      const urlObj = new URL(siteUrl);
      const hostName = urlObj.hostname;
      const sitePath = urlObj.pathname;

      const site = await this.graphClient
        .api(`/sites/${hostName}:${sitePath}`)
        .get();

      const siteId = site.id;

      const lists = await this.graphClient
        .api(`/sites/${siteId}/lists`)
        .filter(`displayName eq '${listName}'`)
        .get();

      if (!lists.value || lists.value.length === 0) {
        console.error(`[SharePoint] List "${listName}" not found`);
        return null;
      }

      const listId = lists.value[0].id;

      cachedIds = { siteId, listId };
      console.log(`[SharePoint] Resolved IDs - Site: ${siteId}, List: ${listId}`);
      return cachedIds;
    } catch (error) {
      console.error("[SharePoint] Failed to resolve IDs:", error);
      return null;
    }
  }

  async createRunHistory(item: Omit<RunHistoryItem, "id">): Promise<void> {
    if (!this.graphClient) {
      throw new Error("SharePoint client not configured");
    }

    const ids = await this.resolveIds();
    if (!ids) {
      throw new Error("Failed to resolve SharePoint site/list IDs");
    }

    const listItem = {
      fields: {
        Title: item.runId,
        ReviewBatch: item.reviewBatch,
        RunId: item.runId,
        SubmittedBy: item.submittedBy,
        SubmittedAt: item.submittedAt,
        FileName: item.fileName,
        TotalEmployees: item.totalEmployees,
        RedCount: item.redCount,
        GreenCount: item.greenCount,
        Status: item.status,
        OutputFileUrl: item.outputFileUrl,
        ErrorMessage: item.errorMessage || "",
      },
    };

    await this.graphClient
      .api(`/sites/${ids.siteId}/lists/${ids.listId}/items`)
      .post(listItem);

    console.log(`[SharePoint] Created run history for ${item.runId}`);
  }

  async listRunHistory(top: number = 50): Promise<RunHistoryItem[]> {
    if (!this.graphClient) {
      return [];
    }

    const ids = await this.resolveIds();
    if (!ids) {
      return [];
    }

    try {
      const response = await this.graphClient
        .api(`/sites/${ids.siteId}/lists/${ids.listId}/items`)
        .expand("fields")
        .top(top)
        .orderby("createdDateTime desc")
        .get();

      return (response.value || []).map((item: any) => ({
        id: item.id,
        reviewBatch: item.fields?.ReviewBatch || "",
        runId: item.fields?.RunId || item.fields?.Title || "",
        submittedBy: item.fields?.SubmittedBy || "",
        submittedAt: item.fields?.SubmittedAt || item.createdDateTime,
        fileName: item.fields?.FileName || "",
        totalEmployees: item.fields?.TotalEmployees || 0,
        redCount: item.fields?.RedCount || 0,
        greenCount: item.fields?.GreenCount || 0,
        status: item.fields?.Status || "Pending",
        outputFileUrl: item.fields?.OutputFileUrl || "",
        errorMessage: item.fields?.ErrorMessage,
      }));
    } catch (error) {
      console.error("[SharePoint] Failed to list history:", error);
      return [];
    }
  }

  async getRunHistoryByRunId(runId: string): Promise<RunHistoryItem | null> {
    if (!this.graphClient) {
      return null;
    }

    const ids = await this.resolveIds();
    if (!ids) {
      return null;
    }

    try {
      const response = await this.graphClient
        .api(`/sites/${ids.siteId}/lists/${ids.listId}/items`)
        .expand("fields")
        .filter(`fields/RunId eq '${runId}'`)
        .get();

      if (!response.value || response.value.length === 0) {
        return null;
      }

      const item = response.value[0];
      return {
        id: item.id,
        reviewBatch: item.fields?.ReviewBatch || "",
        runId: item.fields?.RunId || item.fields?.Title || "",
        submittedBy: item.fields?.SubmittedBy || "",
        submittedAt: item.fields?.SubmittedAt || item.createdDateTime,
        fileName: item.fields?.FileName || "",
        totalEmployees: item.fields?.TotalEmployees || 0,
        redCount: item.fields?.RedCount || 0,
        greenCount: item.fields?.GreenCount || 0,
        status: item.fields?.Status || "Pending",
        outputFileUrl: item.fields?.OutputFileUrl || "",
        errorMessage: item.fields?.ErrorMessage,
      };
    } catch (error) {
      console.error("[SharePoint] Failed to get history by runId:", error);
      return null;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.graphClient) {
      return { success: false, message: "SharePoint client not configured" };
    }

    try {
      const ids = await this.resolveIds();
      if (!ids) {
        return { success: false, message: "Failed to resolve site/list IDs" };
      }

      const testItem = {
        fields: {
          Title: `test-${Date.now()}`,
          ReviewBatch: "Test",
          RunId: `test-${Date.now()}`,
          SubmittedBy: "System",
          SubmittedAt: new Date().toISOString(),
          FileName: "test.xlsx",
          TotalEmployees: 0,
          RedCount: 0,
          GreenCount: 0,
          Status: "Pending",
          OutputFileUrl: "/test",
          ErrorMessage: "This is a test item - can be deleted",
        },
      };

      const created = await this.graphClient
        .api(`/sites/${ids.siteId}/lists/${ids.listId}/items`)
        .post(testItem);

      try {
        await this.graphClient
          .api(`/sites/${ids.siteId}/lists/${ids.listId}/items/${created.id}`)
          .delete();
      } catch {
        console.log("[SharePoint] Test item created but not deleted");
      }

      return { success: true, message: "Connection successful" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, message };
    }
  }
}

let sharePointInstance: SharePointClient | null = null;

export function getSharePointClient(): SharePointClient {
  if (!sharePointInstance) {
    sharePointInstance = new SharePointClient();
  }
  return sharePointInstance;
}
