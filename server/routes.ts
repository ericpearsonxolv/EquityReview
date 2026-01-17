import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as fs from "fs";
import * as path from "path";
import { storage } from "./storage";
import { parseExcelFile } from "./excel/parser";
import { generateResultsExcel } from "./excel/writer";
import { createLLMProvider } from "./llm/provider";
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

async function processJob(jobId: string, buffer: Buffer, reviewBatch: string) {
  try {
    await storage.updateJob(jobId, { status: "running", progress: 5, message: "Parsing Excel file..." });

    const parseResult = await parseExcelFile(buffer);
    
    if (!parseResult.success || !parseResult.employees) {
      await storage.updateJob(jobId, { 
        status: "error", 
        progress: 0, 
        message: parseResult.error || "Failed to parse Excel file" 
      });
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
      await storage.updateJob(jobId, { 
        status: "error", 
        progress: 0, 
        message: writeResult.error || "Failed to generate results file" 
      });
      return;
    }

    await storage.storeJobResults(jobId, results);

    await storage.updateJob(jobId, { 
      status: "done", 
      progress: 100, 
      message: "Analysis complete",
      resultFileName: writeResult.fileName,
    });

  } catch (error) {
    await storage.updateJob(jobId, { 
      status: "error", 
      progress: 0, 
      message: error instanceof Error ? error.message : "An unexpected error occurred" 
    });
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

      const job = await storage.createJob({ reviewBatch: validation.data.reviewBatch });
      
      processJob(job.id, req.file.buffer, validation.data.reviewBatch);

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

  return httpServer;
}
