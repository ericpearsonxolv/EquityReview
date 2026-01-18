import * as fs from "fs";
import * as path from "path";

const dataDir = path.join(process.cwd(), "server", ".data");
const auditPath = path.join(dataDir, "audit.log.jsonl");

export type AuditEventType =
  | "FILE_UPLOADED"
  | "ANALYSIS_STARTED"
  | "ANALYSIS_COMPLETED"
  | "ANALYSIS_FAILED"
  | "SHAREPOINT_WRITE_SUCCESS"
  | "SHAREPOINT_WRITE_FAILED"
  | "ADMIN_CONFIG_UPDATED"
  | "USER_LOGIN"
  | "USER_LOGOUT"
  | "ACCESS_DENIED";

export interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  details: Record<string, any>;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
}

interface LogAnalyticsConfig {
  workspaceId: string;
  sharedKey: string;
  logType: string;
}

class AuditService {
  private logAnalyticsConfig: LogAnalyticsConfig | null = null;
  private useLogAnalytics: boolean = false;
  private eventBuffer: AuditEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeLogAnalytics();
  }

  private initializeLogAnalytics() {
    const workspaceId = process.env.LOG_ANALYTICS_WORKSPACE_ID;
    const sharedKey = process.env.LOG_ANALYTICS_SHARED_KEY;

    if (workspaceId && sharedKey) {
      this.logAnalyticsConfig = {
        workspaceId,
        sharedKey,
        logType: process.env.LOG_ANALYTICS_LOG_TYPE || "EquityReviewAudit",
      };
      this.useLogAnalytics = true;
      this.flushInterval = setInterval(() => this.flushToLogAnalytics(), 30000);
      console.log("[Audit] Azure Log Analytics integration enabled");
    } else {
      console.log("[Audit] Using local file storage. Set LOG_ANALYTICS_WORKSPACE_ID and LOG_ANALYTICS_SHARED_KEY for Azure Log Analytics.");
    }
  }

  private ensureDir() {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  private async sendToLogAnalytics(events: AuditEvent[]): Promise<boolean> {
    if (!this.logAnalyticsConfig) return false;

    try {
      const { workspaceId, sharedKey, logType } = this.logAnalyticsConfig;
      const body = JSON.stringify(events);
      const contentLength = Buffer.byteLength(body, "utf8");
      const rfc1123Date = new Date().toUTCString();
      const method = "POST";
      const contentType = "application/json";
      const resource = "/api/logs";

      const stringToSign = `${method}\n${contentLength}\n${contentType}\nx-ms-date:${rfc1123Date}\n${resource}`;
      
      const crypto = await import("crypto");
      const decodedKey = Buffer.from(sharedKey, "base64");
      const signature = crypto.createHmac("sha256", decodedKey)
        .update(stringToSign, "utf8")
        .digest("base64");

      const authorization = `SharedKey ${workspaceId}:${signature}`;
      const url = `https://${workspaceId}.ods.opinsights.azure.com/api/logs?api-version=2016-04-01`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": contentType,
          "Log-Type": logType,
          "x-ms-date": rfc1123Date,
          "Authorization": authorization,
        },
        body,
      });

      if (response.ok) {
        console.log(`[Audit] Sent ${events.length} events to Log Analytics`);
        return true;
      } else {
        console.error(`[Audit] Log Analytics error: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (error) {
      console.error("[Audit] Failed to send to Log Analytics:", error);
      return false;
    }
  }

  private async flushToLogAnalytics() {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    const success = await this.sendToLogAnalytics(events);
    if (!success) {
      events.forEach(event => this.writeToFile(event));
    }
  }

  private writeToFile(event: AuditEvent) {
    try {
      this.ensureDir();
      fs.appendFileSync(auditPath, JSON.stringify(event) + "\n");
    } catch (error) {
      console.error("[Audit] Failed to write to file:", error);
    }
  }

  log(eventType: AuditEventType, details: Record<string, any>, userId?: string, userEmail?: string, ipAddress?: string) {
    const event: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      eventType,
      details,
      userId,
      userEmail,
      ipAddress,
    };

    console.log(`[Audit] ${eventType}:`, details);

    if (this.useLogAnalytics) {
      this.eventBuffer.push(event);
      if (this.eventBuffer.length >= 50) {
        this.flushToLogAnalytics();
      }
    } else {
      this.writeToFile(event);
    }
  }

  getEvents(top: number = 200, eventType?: AuditEventType): AuditEvent[] {
    try {
      this.ensureDir();
      if (!fs.existsSync(auditPath)) {
        return [];
      }

      const content = fs.readFileSync(auditPath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      
      let events: AuditEvent[] = lines
        .map((line) => {
          try {
            return JSON.parse(line) as AuditEvent;
          } catch {
            return null;
          }
        })
        .filter((e): e is AuditEvent => e !== null);

      if (eventType) {
        events = events.filter((e) => e.eventType === eventType);
      }

      return events.slice(-top).reverse();
    } catch (error) {
      console.error("[Audit] Failed to read audit log:", error);
      return [];
    }
  }

  shutdown() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    if (this.useLogAnalytics && this.eventBuffer.length > 0) {
      this.flushToLogAnalytics();
    }
  }

  fileUploaded(fileName: string, size: number, reviewBatch: string, userId?: string) {
    this.log("FILE_UPLOADED", { fileName, size, reviewBatch }, userId);
  }

  analysisStarted(jobId: string, userId?: string) {
    this.log("ANALYSIS_STARTED", { jobId }, userId);
  }

  analysisCompleted(jobId: string, totalEmployees: number, redCount: number, greenCount: number, userId?: string) {
    this.log("ANALYSIS_COMPLETED", { jobId, totalEmployees, redCount, greenCount }, userId);
  }

  analysisFailed(jobId: string, error: string, userId?: string) {
    this.log("ANALYSIS_FAILED", { jobId, error }, userId);
  }

  sharePointWriteSuccess(runId: string, userId?: string) {
    this.log("SHAREPOINT_WRITE_SUCCESS", { runId }, userId);
  }

  sharePointWriteFailed(runId: string, error: string, userId?: string) {
    this.log("SHAREPOINT_WRITE_FAILED", { runId, error }, userId);
  }

  adminConfigUpdated(section: string, userId?: string) {
    this.log("ADMIN_CONFIG_UPDATED", { section }, userId);
  }
}

export const auditService = new AuditService();
