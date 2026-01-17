import { type Job, type InsertJob, type AnalysisResult, jobs } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface JobStats {
  totalAnalyzed: number;
  totalRedFlags: number;
  completedJobs: number;
}

export interface IStorage {
  createJob(job: InsertJob): Promise<Job>;
  getJob(id: string): Promise<Job | undefined>;
  updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<boolean>;
  getAllJobs(): Promise<Job[]>;
  getStats(): Promise<JobStats>;
  storeJobResults(jobId: string, results: AnalysisResult[]): Promise<void>;
  getJobResults(jobId: string): Promise<AnalysisResult[] | undefined>;
}

function dbJobToJob(dbJob: typeof jobs.$inferSelect): Job {
  return {
    id: dbJob.id,
    reviewBatch: dbJob.reviewBatch,
    status: dbJob.status as Job["status"],
    progress: dbJob.progress,
    message: dbJob.message ?? undefined,
    resultFileName: dbJob.resultFileName ?? undefined,
    createdAt: dbJob.createdAt,
    totalEmployees: dbJob.totalEmployees ?? undefined,
    processedEmployees: dbJob.processedEmployees ?? undefined,
  };
}

export class DatabaseStorage implements IStorage {
  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    const [dbJob] = await db.insert(jobs).values({
      id,
      reviewBatch: insertJob.reviewBatch,
      status: "queued",
      progress: 0,
    }).returning();
    
    return dbJobToJob(dbJob);
  }

  async getJob(id: string): Promise<Job | undefined> {
    const [dbJob] = await db.select().from(jobs).where(eq(jobs.id, id));
    return dbJob ? dbJobToJob(dbJob) : undefined;
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const updateData: Partial<typeof jobs.$inferInsert> = {};
    
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.progress !== undefined) updateData.progress = updates.progress;
    if (updates.message !== undefined) updateData.message = updates.message;
    if (updates.resultFileName !== undefined) updateData.resultFileName = updates.resultFileName;
    if (updates.totalEmployees !== undefined) updateData.totalEmployees = updates.totalEmployees;
    if (updates.processedEmployees !== undefined) updateData.processedEmployees = updates.processedEmployees;

    const [dbJob] = await db.update(jobs)
      .set(updateData)
      .where(eq(jobs.id, id))
      .returning();
    
    return dbJob ? dbJobToJob(dbJob) : undefined;
  }

  async deleteJob(id: string): Promise<boolean> {
    const result = await db.delete(jobs).where(eq(jobs.id, id)).returning();
    return result.length > 0;
  }

  async getAllJobs(): Promise<Job[]> {
    const dbJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt));
    return dbJobs.map(dbJobToJob);
  }

  async getStats(): Promise<JobStats> {
    const completedJobs = await db.select().from(jobs).where(eq(jobs.status, "done"));
    
    let totalAnalyzed = 0;
    let totalRedFlags = 0;

    for (const job of completedJobs) {
      const results = job.results as AnalysisResult[] | null;
      if (results) {
        totalAnalyzed += results.length;
        totalRedFlags += results.filter(r => r.aiRecommendation === "RED").length;
      }
    }

    return { 
      totalAnalyzed, 
      totalRedFlags, 
      completedJobs: completedJobs.length 
    };
  }

  async storeJobResults(jobId: string, results: AnalysisResult[]): Promise<void> {
    await db.update(jobs)
      .set({ results })
      .where(eq(jobs.id, jobId));
  }

  async getJobResults(jobId: string): Promise<AnalysisResult[] | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    return job?.results as AnalysisResult[] | undefined;
  }
}

export const storage = new DatabaseStorage();
