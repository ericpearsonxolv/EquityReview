import { type Job, type InsertJob } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  createJob(job: InsertJob): Promise<Job>;
  getJob(id: string): Promise<Job | undefined>;
  updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private jobs: Map<string, Job>;

  constructor() {
    this.jobs = new Map();
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    const job: Job = {
      id,
      reviewBatch: insertJob.reviewBatch,
      status: "queued",
      progress: 0,
      createdAt: new Date(),
    };
    this.jobs.set(id, job);
    return job;
  }

  async getJob(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    
    const updatedJob = { ...job, ...updates };
    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  async deleteJob(id: string): Promise<boolean> {
    return this.jobs.delete(id);
  }
}

export const storage = new MemStorage();
