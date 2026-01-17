import { z } from "zod";

export const RunHistoryItemSchema = z.object({
  id: z.string().optional(),
  reviewBatch: z.string(),
  runId: z.string(),
  submittedBy: z.string(),
  submittedAt: z.string(),
  fileName: z.string(),
  totalEmployees: z.number(),
  redCount: z.number(),
  greenCount: z.number(),
  status: z.enum(["Pending", "Completed", "Failed"]),
  outputFileUrl: z.string(),
  errorMessage: z.string().optional(),
});

export type RunHistoryItem = z.infer<typeof RunHistoryItemSchema>;

export interface ISharePointHistoryStore {
  isConfigured(): boolean;
  createRunHistory(item: Omit<RunHistoryItem, "id">): Promise<void>;
  listRunHistory(top?: number): Promise<RunHistoryItem[]>;
  getRunHistoryByRunId(runId: string): Promise<RunHistoryItem | null>;
}

export interface SharePointResolvedIds {
  siteId: string;
  listId: string;
}
