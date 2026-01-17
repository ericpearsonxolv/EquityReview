import * as fs from "fs";
import * as path from "path";
import { z } from "zod";

const configDir = path.join(process.cwd(), "server", ".data");
const configPath = path.join(configDir, "config.json");

const GeneralConfigSchema = z.object({
  defaultReviewBatchPrefix: z.string().default("FY25-Q1"),
  outputRetentionDays: z.number().default(90),
  maxRowsPerUpload: z.number().default(1000),
});

const SecurityConfigSchema = z.object({
  requireLogin: z.boolean().default(false),
  allowedDomains: z.string().default(""),
  allowedGroups: z.string().default(""),
});

const DirectoryConfigSchema = z.object({
  idpProvider: z.enum(["entra", "okta", "google"]).default("entra"),
  tenantUrl: z.string().default(""),
  clientId: z.string().default(""),
});

const WorkdayConfigSchema = z.object({
  baseUrl: z.string().default(""),
  tenant: z.string().default(""),
  authType: z.enum(["oauth2", "basic", "isu"]).default("oauth2"),
  clientId: z.string().default(""),
  hasSecret: z.boolean().default(false),
});

const SharePointConfigSchema = z.object({
  siteUrl: z.string().default(""),
  listName: z.string().default(""),
  resolvedSiteId: z.string().default(""),
  resolvedListId: z.string().default(""),
});

const AppConfigSchema = z.object({
  general: GeneralConfigSchema.default({}),
  security: SecurityConfigSchema.default({}),
  directory: DirectoryConfigSchema.default({}),
  workday: WorkdayConfigSchema.default({}),
  sharepoint: SharePointConfigSchema.default({}),
});

export type GeneralConfig = z.infer<typeof GeneralConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type DirectoryConfig = z.infer<typeof DirectoryConfigSchema>;
export type WorkdayConfig = z.infer<typeof WorkdayConfigSchema>;
export type SharePointConfig = z.infer<typeof SharePointConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

class ConfigService {
  private config: AppConfig;

  constructor() {
    this.config = this.load();
  }

  private ensureDir() {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  private load(): AppConfig {
    try {
      this.ensureDir();
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(raw);
        return AppConfigSchema.parse(parsed);
      }
    } catch (error) {
      console.error("[Config] Failed to load config:", error);
    }
    return AppConfigSchema.parse({});
  }

  private save() {
    try {
      this.ensureDir();
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error("[Config] Failed to save config:", error);
    }
  }

  getAll(): AppConfig {
    return { ...this.config };
  }

  getGeneral(): GeneralConfig {
    return { ...this.config.general };
  }

  getSecurity(): SecurityConfig {
    return { ...this.config.security };
  }

  getDirectory(): DirectoryConfig {
    return { ...this.config.directory };
  }

  getWorkday(): Omit<WorkdayConfig, "hasSecret"> & { hasSecret: boolean } {
    return { ...this.config.workday };
  }

  getSharePoint(): SharePointConfig {
    return { ...this.config.sharepoint };
  }

  updateGeneral(update: Partial<GeneralConfig>) {
    this.config.general = { ...this.config.general, ...update };
    this.save();
    return this.config.general;
  }

  updateSecurity(update: Partial<SecurityConfig>) {
    this.config.security = { ...this.config.security, ...update };
    this.save();
    return this.config.security;
  }

  updateDirectory(update: Partial<DirectoryConfig>) {
    this.config.directory = { ...this.config.directory, ...update };
    this.save();
    return this.config.directory;
  }

  updateWorkday(update: Partial<WorkdayConfig & { clientSecret?: string }>) {
    const { clientSecret, ...rest } = update;
    if (clientSecret && clientSecret.trim() !== "") {
      this.config.workday.hasSecret = true;
    }
    this.config.workday = { ...this.config.workday, ...rest };
    this.save();
    return { ...this.config.workday };
  }

  updateSharePoint(update: Partial<SharePointConfig>) {
    this.config.sharepoint = { ...this.config.sharepoint, ...update };
    this.save();
    return this.config.sharepoint;
  }
}

export const configService = new ConfigService();
