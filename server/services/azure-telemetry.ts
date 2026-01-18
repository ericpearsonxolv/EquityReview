import { Request, Response, NextFunction } from "express";

export interface TelemetryConfig {
  connectionString: string;
  cloudRole?: string;
  cloudRoleInstance?: string;
}

interface TelemetryEvent {
  name: string;
  properties?: Record<string, string>;
  measurements?: Record<string, number>;
}

interface TelemetryMetric {
  name: string;
  value: number;
  properties?: Record<string, string>;
}

interface TelemetryException {
  exception: Error;
  properties?: Record<string, string>;
  measurements?: Record<string, number>;
}

class ApplicationInsightsService {
  private enabled: boolean = false;
  private connectionString: string | null = null;
  private cloudRole: string = "equityreview-api";
  private cloudRoleInstance: string = "";
  private eventBuffer: TelemetryEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  initialize(config?: Partial<TelemetryConfig>) {
    const connectionString = config?.connectionString || process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

    if (!connectionString) {
      console.log("[AppInsights] Not configured - telemetry disabled. Set APPLICATIONINSIGHTS_CONNECTION_STRING to enable.");
      this.enabled = false;
      return;
    }

    this.connectionString = connectionString;
    this.cloudRole = config?.cloudRole || "equityreview-api";
    this.cloudRoleInstance = config?.cloudRoleInstance || process.env.HOSTNAME || "";
    this.enabled = true;

    this.flushInterval = setInterval(() => this.flush(), 60000);

    console.log("[AppInsights] Telemetry initialized");
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  trackEvent(event: TelemetryEvent) {
    if (!this.enabled) return;

    const enrichedEvent = {
      ...event,
      properties: {
        ...event.properties,
        cloudRole: this.cloudRole,
        cloudRoleInstance: this.cloudRoleInstance,
        timestamp: new Date().toISOString(),
      },
    };

    this.eventBuffer.push(enrichedEvent);
    console.log(`[AppInsights] Event: ${event.name}`, event.properties);

    if (this.eventBuffer.length >= 100) {
      this.flush();
    }
  }

  trackMetric(metric: TelemetryMetric) {
    if (!this.enabled) return;

    console.log(`[AppInsights] Metric: ${metric.name} = ${metric.value}`, metric.properties);
  }

  trackException(telemetry: TelemetryException) {
    if (!this.enabled) return;

    console.error(`[AppInsights] Exception: ${telemetry.exception.message}`, {
      stack: telemetry.exception.stack,
      properties: telemetry.properties,
    });
  }

  trackDependency(
    name: string,
    dependencyType: string,
    target: string,
    duration: number,
    success: boolean,
    resultCode?: string
  ) {
    if (!this.enabled) return;

    console.log(`[AppInsights] Dependency: ${name} (${dependencyType}) -> ${target}`, {
      duration,
      success,
      resultCode,
    });
  }

  trackRequest(
    name: string,
    url: string,
    duration: number,
    resultCode: string,
    success: boolean
  ) {
    if (!this.enabled) return;

    console.log(`[AppInsights] Request: ${name} ${url}`, {
      duration,
      resultCode,
      success,
    });
  }

  trackAnalysisJob(jobId: string, properties: {
    reviewBatch: string;
    totalEmployees: number;
    redCount: number;
    greenCount: number;
    durationMs: number;
    status: "success" | "failed";
  }) {
    this.trackEvent({
      name: "AnalysisJobCompleted",
      properties: {
        jobId,
        reviewBatch: properties.reviewBatch,
        status: properties.status,
      },
      measurements: {
        totalEmployees: properties.totalEmployees,
        redCount: properties.redCount,
        greenCount: properties.greenCount,
        durationMs: properties.durationMs,
      },
    });

    this.trackMetric({
      name: "AnalysisJobDuration",
      value: properties.durationMs,
      properties: { reviewBatch: properties.reviewBatch },
    });

    this.trackMetric({
      name: "EmployeesAnalyzed",
      value: properties.totalEmployees,
    });

    this.trackMetric({
      name: "RedFlagsGenerated",
      value: properties.redCount,
    });
  }

  trackFileUpload(fileName: string, sizeBytes: number, success: boolean) {
    this.trackEvent({
      name: "FileUploaded",
      properties: {
        fileName,
        success: success.toString(),
      },
      measurements: {
        sizeBytes,
      },
    });
  }

  trackSharePointOperation(operation: string, success: boolean, durationMs: number) {
    this.trackDependency(
      `SharePoint_${operation}`,
      "HTTP",
      "graph.microsoft.com",
      durationMs,
      success
    );
  }

  requestMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.enabled) return next();

      const startTime = Date.now();

      res.on("finish", () => {
        const duration = Date.now() - startTime;
        const success = res.statusCode < 400;

        this.trackRequest(
          `${req.method} ${req.path}`,
          req.originalUrl,
          duration,
          res.statusCode.toString(),
          success
        );
      });

      next();
    };
  }

  errorMiddleware() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      this.trackException({
        exception: error,
        properties: {
          url: req.originalUrl,
          method: req.method,
        },
      });

      next(error);
    };
  }

  private async flush() {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    console.log(`[AppInsights] Flushing ${events.length} events`);
  }

  shutdown() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

export const telemetryService = new ApplicationInsightsService();
