import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as fs from "fs";
import * as path from "path";
import { storage } from "./storage";
import { parseExcelFile } from "./excel/parser";
import { generateResultsExcel } from "./excel/writer";
import { createLLMProvider } from "./llm/provider";
import { getSharePointClient } from "./integrations/sharepoint/SharePointClient";
import { configService } from "./services/config";
import { auditService } from "./services/audit";
import { insertJobSchema, type AnalysisResult } from "@shared/schema";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.originalname.endsWith(".xlsx")) {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx files are allowed"));
    }
  },
});

const llmProvider = createLLMProvider();
const sharePointClient = getSharePointClient();

async function recordSharePointHistory(
  jobId: string,
  reviewBatch: string,
  fileName: string,
  totalEmployees: number,
  redCount: number,
  greenCount: number,
  status: "Completed" | "Failed",
  errorMessage?: string
) {
  if (!sharePointClient.isConfigured()) {
    console.log("[SharePoint] Not configured, skipping history record");
    return;
  }

  try {
    await sharePointClient.createRunHistory({
      reviewBatch,
      runId: jobId,
      submittedBy: "System",
      submittedAt: new Date().toISOString(),
      fileName,
      totalEmployees,
      redCount,
      greenCount,
      status,
      outputFileUrl: `/api/jobs/${jobId}/download`,
      errorMessage,
    });
    auditService.sharePointWriteSuccess(jobId);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[SharePoint] Failed to record history:", errorMsg);
    auditService.sharePointWriteFailed(jobId, errorMsg);
  }
}

async function processJob(jobId: string, buffer: Buffer, reviewBatch: string, fileName: string) {
  try {
    auditService.analysisStarted(jobId);
    await storage.updateJob(jobId, { status: "running", progress: 5, message: "Parsing Excel file..." });

    const parseResult = await parseExcelFile(buffer);
    
    if (!parseResult.success || !parseResult.employees) {
      const errorMsg = parseResult.error || "Failed to parse Excel file";
      await storage.updateJob(jobId, { 
        status: "error", 
        progress: 0, 
        message: errorMsg
      });
      auditService.analysisFailed(jobId, errorMsg);
      await recordSharePointHistory(jobId, reviewBatch, fileName, 0, 0, 0, "Failed", errorMsg);
      return;
    }

    const employees = parseResult.employees;
    const totalEmployees = employees.length;
    
    await storage.updateJob(jobId, { 
      status: "running", 
      progress: 10, 
      message: `Found ${totalEmployees} employees. Starting analysis...`,
      totalEmployees,
      processedEmployees: 0,
    });

    const results: AnalysisResult[] = [];
    
    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i];
      
      try {
        const result = await llmProvider.analyze(employee);
        results.push(result);
      } catch (error) {
        results.push({
          employeeId: employee.employeeId,
          biasAssessment: "Analysis failed",
          valuesAlignment: "Misaligned",
          ratingConsistency: "Inconsistent",
          ratingConsistencyRationale: "Unable to complete analysis",
          aiRecommendation: "RED",
          flagsTriggered: ["AnalysisError"],
        });
      }

      const progress = Math.round(10 + ((i + 1) / totalEmployees) * 70);
      await storage.updateJob(jobId, { 
        progress, 
        message: `Analyzed ${i + 1} of ${totalEmployees} employees...`,
        processedEmployees: i + 1,
      });
    }

    await storage.updateJob(jobId, { 
      progress: 85, 
      message: "Generating results Excel file..." 
    });

    const writeResult = await generateResultsExcel(reviewBatch, results, jobId);
    
    if (!writeResult.success) {
      const errorMsg = writeResult.error || "Failed to generate results file";
      await storage.updateJob(jobId, { 
        status: "error", 
        progress: 0, 
        message: errorMsg
      });
      auditService.analysisFailed(jobId, errorMsg);
      await recordSharePointHistory(jobId, reviewBatch, fileName, totalEmployees, 0, 0, "Failed", errorMsg);
      return;
    }

    await storage.storeJobResults(jobId, results);

    const redCount = results.filter(r => r.aiRecommendation === "RED").length;
    const greenCount = results.filter(r => r.aiRecommendation === "GREEN").length;

    await storage.updateJob(jobId, { 
      status: "done", 
      progress: 100, 
      message: "Analysis complete",
      resultFileName: writeResult.fileName,
    });

    auditService.analysisCompleted(jobId, totalEmployees, redCount, greenCount);
    await recordSharePointHistory(jobId, reviewBatch, fileName, totalEmployees, redCount, greenCount, "Completed");

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "An unexpected error occurred";
    await storage.updateJob(jobId, { 
      status: "error", 
      progress: 0, 
      message: errorMsg
    });
    auditService.analysisFailed(jobId, errorMsg);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post("/api/analyze", upload.single("file"), async (req: Request, res: Response) => {
    try {
      const { reviewBatch } = req.body;
      
      const validation = insertJobSchema.safeParse({ reviewBatch });
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Review batch name is required",
          errors: validation.error.errors 
        });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Excel file is required" });
      }

      const fileName = req.file.originalname || "upload.xlsx";
      auditService.fileUploaded(fileName, req.file.size, validation.data.reviewBatch);

      const job = await storage.createJob({ reviewBatch: validation.data.reviewBatch });
      
      processJob(job.id, req.file.buffer, validation.data.reviewBatch, fileName);

      return res.json({ jobId: job.id });
    } catch (error) {
      console.error("Error in /api/analyze:", error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  app.get("/api/jobs/:jobId", async (req: Request, res: Response) => {
    try {
      const jobId = req.params.jobId as string;
      
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      return res.json({
        status: job.status,
        progress: job.progress,
        message: job.message,
        resultFileName: job.resultFileName,
      });
    } catch (error) {
      console.error("Error in /api/jobs/:jobId:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/jobs", async (req: Request, res: Response) => {
    try {
      const jobs = await storage.getAllJobs();
      return res.json(jobs.map(job => ({
        id: job.id,
        reviewBatch: job.reviewBatch,
        status: job.status,
        progress: job.progress,
        message: job.message,
        createdAt: job.createdAt,
        totalEmployees: job.totalEmployees,
        resultFileName: job.resultFileName,
      })));
    } catch (error) {
      console.error("Error in /api/jobs:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/stats", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getStats();
      return res.json(stats);
    } catch (error) {
      console.error("Error in /api/stats:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/jobs/:jobId/results", async (req: Request, res: Response) => {
    try {
      const jobId = req.params.jobId as string;
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const results = storage.getJobResults(jobId);
      if (!results) {
        return res.status(404).json({ message: "Results not found" });
      }

      return res.json({
        job: {
          id: job.id,
          reviewBatch: job.reviewBatch,
          createdAt: job.createdAt,
          totalEmployees: job.totalEmployees,
        },
        results,
      });
    } catch (error) {
      console.error("Error in /api/jobs/:jobId/results:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/jobs/:jobId/download", async (req: Request, res: Response) => {
    try {
      const jobId = req.params.jobId as string;
      
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (job.status !== "done") {
        return res.status(400).json({ message: "Job is not complete yet" });
      }

      if (!job.resultFileName) {
        return res.status(404).json({ message: "Result file not found" });
      }

      const filePath = path.join(process.cwd(), "tmp", job.resultFileName);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Result file not found on disk" });
      }

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${job.resultFileName}"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error in /api/jobs/:jobId/download:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/history", async (req: Request, res: Response) => {
    try {
      const top = parseInt(req.query.top as string) || 50;
      
      if (sharePointClient.isConfigured()) {
        const history = await sharePointClient.listRunHistory(top);
        return res.json(history);
      }
      
      const allJobs = await storage.getAllJobs();
      const history = await Promise.all(
        allJobs.slice(0, top).map(async (job) => {
          const results = await storage.getJobResults(job.id) || [];
          const redCount = results.filter((r) => r.aiRecommendation === "RED").length;
          const greenCount = results.filter((r) => r.aiRecommendation === "GREEN").length;
          
          return {
            id: job.id,
            reviewBatch: job.reviewBatch,
            runId: job.id,
            submittedBy: "System",
            submittedAt: job.createdAt?.toISOString() || new Date().toISOString(),
            fileName: job.resultFileName || "",
            totalEmployees: job.totalEmployees || 0,
            redCount,
            greenCount,
            status: job.status === "done" ? "Completed" : job.status === "error" ? "Failed" : "Pending",
            outputFileUrl: `/api/jobs/${job.id}/download`,
          };
        })
      );
      
      return res.json(history);
    } catch (error) {
      console.error("Error in /api/history:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/history/resolve", async (req: Request, res: Response) => {
    try {
      if (!sharePointClient.isConfigured()) {
        return res.status(400).json({ 
          message: "SharePoint not configured",
          configured: false 
        });
      }

      const ids = await sharePointClient.resolveIds();
      
      if (!ids) {
        return res.status(400).json({ 
          message: "Failed to resolve SharePoint IDs" 
        });
      }

      configService.updateSharePoint({
        resolvedSiteId: ids.siteId,
        resolvedListId: ids.listId,
      });

      return res.json({ 
        success: true, 
        siteId: ids.siteId, 
        listId: ids.listId 
      });
    } catch (error) {
      console.error("Error in /api/history/resolve:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/history/test", async (req: Request, res: Response) => {
    try {
      if (!sharePointClient.isConfigured()) {
        return res.status(400).json({ 
          success: false,
          message: "SharePoint not configured" 
        });
      }

      const result = await sharePointClient.testConnection();
      return res.json(result);
    } catch (error) {
      console.error("Error in /api/history/test:", error);
      return res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  app.get("/api/audit", async (req: Request, res: Response) => {
    try {
      const top = parseInt(req.query.top as string) || 200;
      const eventType = req.query.eventType as string | undefined;
      
      const events = auditService.getEvents(
        top, 
        eventType as any
      );
      
      return res.json(events);
    } catch (error) {
      console.error("Error in /api/audit:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/config", async (req: Request, res: Response) => {
    try {
      return res.json(configService.getAll());
    } catch (error) {
      console.error("Error in /api/config:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/config/general", async (req: Request, res: Response) => {
    try {
      return res.json(configService.getGeneral());
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/config/general", async (req: Request, res: Response) => {
    try {
      const updated = configService.updateGeneral(req.body);
      auditService.adminConfigUpdated("general");
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/config/security", async (req: Request, res: Response) => {
    try {
      return res.json(configService.getSecurity());
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/config/security", async (req: Request, res: Response) => {
    try {
      const updated = configService.updateSecurity(req.body);
      auditService.adminConfigUpdated("security");
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/config/directory", async (req: Request, res: Response) => {
    try {
      return res.json(configService.getDirectory());
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/config/directory", async (req: Request, res: Response) => {
    try {
      const updated = configService.updateDirectory(req.body);
      auditService.adminConfigUpdated("directory");
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/config/workday", async (req: Request, res: Response) => {
    try {
      return res.json(configService.getWorkday());
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/config/workday", async (req: Request, res: Response) => {
    try {
      const updated = configService.updateWorkday(req.body);
      auditService.adminConfigUpdated("workday");
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/config/sharepoint", async (req: Request, res: Response) => {
    try {
      const config = configService.getSharePoint();
      return res.json({
        ...config,
        isConfigured: sharePointClient.isConfigured(),
      });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/config/sharepoint", async (req: Request, res: Response) => {
    try {
      const updated = configService.updateSharePoint(req.body);
      auditService.adminConfigUpdated("sharepoint");
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
