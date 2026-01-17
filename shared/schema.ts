import { z } from "zod";
import { pgTable, text, integer, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const ValuesAlignmentEnum = z.enum(["Aligned", "Partially aligned", "Misaligned"]);
export const RatingConsistencyEnum = z.enum(["Consistent", "Inconsistent"]);
export const AIRecommendationEnum = z.enum(["GREEN", "RED"]);
export const JobStatusEnum = z.enum(["queued", "running", "done", "error"]);

export const analysisResultSchema = z.object({
  employeeId: z.string(),
  biasAssessment: z.string(),
  valuesAlignment: ValuesAlignmentEnum,
  ratingConsistency: RatingConsistencyEnum,
  ratingConsistencyRationale: z.string(),
  aiRecommendation: AIRecommendationEnum,
  flagsTriggered: z.array(z.string()),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  reviewBatch: text("review_batch").notNull(),
  status: text("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  message: text("message"),
  resultFileName: text("result_file_name"),
  totalEmployees: integer("total_employees"),
  processedEmployees: integer("processed_employees"),
  results: json("results"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertJobDbSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export type InsertJobDb = z.infer<typeof insertJobDbSchema>;
export type JobDb = typeof jobs.$inferSelect;

export const jobSchema = z.object({
  id: z.string(),
  reviewBatch: z.string(),
  status: JobStatusEnum,
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
  resultFileName: z.string().optional(),
  createdAt: z.date(),
  totalEmployees: z.number().optional(),
  processedEmployees: z.number().optional(),
});

export type Job = z.infer<typeof jobSchema>;
export type JobStatus = z.infer<typeof JobStatusEnum>;

export const insertJobSchema = z.object({
  reviewBatch: z.string().min(1, "Review batch name is required"),
});

export type InsertJob = z.infer<typeof insertJobSchema>;

export const jobStatusResponseSchema = z.object({
  status: JobStatusEnum,
  progress: z.number(),
  message: z.string().optional(),
  resultFileName: z.string().optional(),
});

export type JobStatusResponse = z.infer<typeof jobStatusResponseSchema>;

export const analyzeResponseSchema = z.object({
  jobId: z.string(),
});

export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;

export const employeeDataSchema = z.object({
  employeeId: z.string(),
  goalEmployeeRating: z.string().optional(),
  goalManagerRating: z.string().optional(),
  valuesEmployeeRating: z.string().optional(),
  valuesManagerRating: z.string().optional(),
  overallRatingEmployee: z.string().optional(),
  overallRatingManager: z.string().optional(),
  managerComments: z.string().optional(),
});

export type EmployeeData = z.infer<typeof employeeDataSchema>;

export const ratingMap: Record<string, number> = {
  "does not meet expectations": 1,
  "does not meet": 1,
  "below expectations": 1,
  "below": 1,
  "needs improvement": 1,
  "meets expectations": 2,
  "meets": 2,
  "meeting expectations": 2,
  "meeting": 2,
  "satisfactory": 2,
  "exceeds expectations": 3,
  "exceeds": 3,
  "exceeding expectations": 3,
  "exceeding": 3,
  "outstanding": 3,
  "exceptional": 3,
};

export const escalationFlags = {
  RATING_MISMATCH_OVERALL: "RatingMismatch_Overall_2+Levels",
  RATING_MISMATCH_GOALS: "RatingMismatch_Goals_2+Levels",
  RATING_MISMATCH_VALUES: "RatingMismatch_Values_2+Levels",
  NARRATIVE_INSUFFICIENT: "NarrativeInsufficient",
  LOADED_LANGUAGE: "LoadedLanguage_NoEvidence",
  POLICY_SENSITIVE: "PolicySensitive_EscalateHR",
  UNKNOWN_RATING_LABEL: "UnknownRatingLabel",
} as const;

export const loadedLanguageTerms = [
  "abrasive",
  "emotional",
  "not a culture fit",
  "too aggressive",
  "lacks executive presence",
  "difficult",
  "temperamental",
  "unprofessional demeanor",
];

export const policySensitiveTerms = [
  "medical",
  "disability",
  "pregnant",
  "pregnancy",
  "religion",
  "religious",
  "race",
  "racial",
  "age",
  "gender",
  "gender identity",
  "harassment",
  "discrimination",
  "retaliation",
  "ada",
  "fmla",
  "eeoc",
];

export const columnAliases: Record<string, string[]> = {
  employeeId: ["employeeid", "employee_id", "emp_id", "empid", "id", "employee id", "employee"],
  goalEmployeeRating: ["goal employee rating", "goals employee rating", "goal_employee_rating", "goals_employee_rating", "employee goal rating"],
  goalManagerRating: ["goal manager rating", "goals manager rating", "goal_manager_rating", "goals_manager_rating", "manager goal rating"],
  valuesEmployeeRating: ["values employee rating", "value employee rating", "values_employee_rating", "employee values rating"],
  valuesManagerRating: ["values manager rating", "value manager rating", "values_manager_rating", "manager values rating"],
  overallRatingEmployee: ["overall rating - employee", "overall rating employee", "overall_rating_employee", "employee overall rating", "overall employee rating"],
  overallRatingManager: ["overall rating - manager", "overall rating manager", "overall_rating_manager", "manager overall rating", "overall manager rating"],
  managerComments: ["manager comments", "manager_comments", "comments", "manager feedback", "feedback", "manager notes", "notes"],
};

export { z };
