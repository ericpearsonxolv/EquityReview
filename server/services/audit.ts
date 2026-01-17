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
  | "ADMIN_CONFIG_UPDATED";

export interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  details: Record<string, any>;
  userId?: string;
}

class AuditService {
  private ensureDir() {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  log(eventType: AuditEventType, details: Record<string, any>, userId?: string) {
    const event: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      eventType,
      details,
      userId,
    };

    try {
      this.ensureDir();
      fs.appendFileSync(auditPath, JSON.stringify(event) + "\n");
      console.log(`[Audit] ${eventType}:`, details);
    } catch (error) {
      console.error("[Audit] Failed to write audit log:", error);
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
