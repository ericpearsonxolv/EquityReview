import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Info,
  BarChart3,
  Clock,
  ChevronRight,
  ArrowRight
} from "lucide-react";

interface HistoryItem {
  id: string;
  reviewBatch: string;
  runId: string;
  submittedAt: string;
  totalEmployees: number;
  redCount: number;
  greenCount: number;
  status: "Pending" | "Completed" | "Failed";
}

type JobStatus = "queued" | "running" | "done" | "error";

interface JobState {
  id: string;
  status: JobStatus;
  progress: number;
  message?: string;
  resultFileName?: string;
}

export default function AnalysisPortal() {
  const [reviewBatch, setReviewBatch] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [job, setJob] = useState<JobState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".xlsx")) {
        toast({
          title: "Invalid file type",
          description: "Please select an Excel file (.xlsx)",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  }, [toast]);

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`);
      if (!response.ok) throw new Error("Failed to fetch job status");
      
      const data = await response.json();
      setJob({
        id: jobId,
        status: data.status,
        progress: data.progress,
        message: data.message,
        resultFileName: data.resultFileName,
      });

      if (data.status === "done" || data.status === "error") {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        if (data.status === "done") {
          toast({
            title: "Analysis Complete",
            description: "Your results are ready for download.",
          });
        } else {
          toast({
            title: "Analysis Failed",
            description: data.message || "An error occurred during analysis.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error polling job status:", error);
    }
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile || !reviewBatch.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a review batch name and select an Excel file.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setJob(null);

    try {
      const formData = new FormData();
      formData.append("reviewBatch", reviewBatch.trim());
      formData.append("file", selectedFile);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to submit analysis");
      }

      const data = await response.json();
      
      setJob({
        id: data.jobId,
        status: "queued",
        progress: 0,
      });

      pollingRef.current = setInterval(() => {
        pollJobStatus(data.jobId);
      }, 1000);

      toast({
        title: "Analysis Started",
        description: `Job ${data.jobId.substring(0, 8)}... has been queued for processing.`,
      });
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!job?.id) return;
    
    try {
      const response = await fetch(`/api/jobs/${job.id}/download`);
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = job.resultFileName || `analysis-results-${job.id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Started",
        description: "Your results file is being downloaded.",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Unable to download the results file.",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setReviewBatch("");
    setSelectedFile(null);
    setJob(null);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const getStatusBadge = (status: JobStatus) => {
    const statusConfig = {
      queued: { label: "Queued", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800", icon: Clock },
      running: { label: "Processing", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800", icon: Loader2 },
      done: { label: "Complete", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800", icon: CheckCircle },
      error: { label: "Failed", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800", icon: AlertCircle },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge 
        variant="outline"
        className={`gap-1.5 px-3 py-1 font-medium border ${config.className}`}
        data-testid="badge-status"
      >
        <Icon className={`h-3.5 w-3.5 ${status === "running" || status === "queued" ? "animate-spin" : ""}`} />
        {config.label}
      </Badge>
    );
  };

  const isProcessing = job?.status === "running" || job?.status === "queued";

  const { data: recentRuns } = useQuery<HistoryItem[]>({
    queryKey: ["/api/history?top=5"],
    refetchInterval: 10000,
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Home</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">Performance Review Analysis</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight" data-testid="text-page-title">
            Performance Review Analysis
          </h1>
          <p className="text-muted-foreground">
            Upload performance review data to run AI-powered bias detection, values alignment, and rating consistency analysis.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Upload className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Upload Review Data</CardTitle>
                  <CardDescription className="text-xs">Excel file with employee performance reviews</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="reviewBatch" className="text-sm font-medium">
                    Review Batch Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="reviewBatch"
                    data-testid="input-review-batch"
                    type="text"
                    placeholder="e.g., Q4-2024-Engineering"
                    value={reviewBatch}
                    onChange={(e) => setReviewBatch(e.target.value)}
                    disabled={isSubmitting || isProcessing}
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground">A unique identifier for this batch of reviews</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Performance Review File <span className="text-destructive">*</span>
                  </Label>
                  <div className="space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx"
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="input-file"
                      disabled={isSubmitting || isProcessing}
                    />
                    <button
                      type="button"
                      onClick={handleFileButtonClick}
                      disabled={isSubmitting || isProcessing}
                      data-testid="button-upload-zone"
                      className={`w-full border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                        selectedFile 
                          ? "border-primary/50 bg-primary/5" 
                          : "border-border hover:border-primary/30 hover:bg-muted/50"
                      } ${(isSubmitting || isProcessing) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      {selectedFile ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileSpreadsheet className="h-5 w-5 text-primary" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-foreground truncate max-w-[200px]" data-testid="text-selected-file">
                              {selectedFile.name}
                            </p>
                            <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center mx-auto">
                            <Upload className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Click to upload</p>
                            <p className="text-xs text-muted-foreground">Excel file (.xlsx) only</p>
                          </div>
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                <Separator />

                <div className="flex gap-3 flex-wrap">
                  <Button
                    type="submit"
                    disabled={!selectedFile || !reviewBatch.trim() || isSubmitting || isProcessing}
                    className="min-w-36"
                    data-testid="button-submit"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Run Analysis
                      </>
                    )}
                  </Button>
                  {job && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleReset}
                      disabled={isProcessing}
                      data-testid="button-reset"
                    >
                      New Analysis
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                File Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-muted-foreground">
              <div>
                <p className="font-medium text-foreground mb-1">Required Columns:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Employee ID</li>
                  <li>Goal Ratings (Employee/Manager)</li>
                  <li>Values Ratings (Employee/Manager)</li>
                  <li>Overall Ratings (Employee/Manager)</li>
                  <li>Manager Comments</li>
                </ul>
              </div>
              <Separator />
              <div>
                <p className="font-medium text-foreground mb-1">Analysis Includes:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Bias detection in narratives</li>
                  <li>Values alignment check</li>
                  <li>Rating consistency review</li>
                  <li>Policy-sensitive flags</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {job && (
          <Card className={`border-l-4 ${
            job.status === "done" ? "border-l-emerald-500" :
            job.status === "error" ? "border-l-red-500" :
            "border-l-blue-500"
          }`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="text-base font-medium">Analysis Progress</CardTitle>
                {getStatusBadge(job.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Job ID</span>
                  <p className="font-mono text-xs mt-0.5 bg-muted px-2 py-1 rounded inline-block" data-testid="text-job-id">
                    {job.id}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="font-medium mt-0.5 capitalize" data-testid="text-status">{job.status}</p>
                </div>
              </div>

              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold tabular-nums" data-testid="text-progress">{job.progress}%</span>
                  </div>
                  <Progress value={job.progress} className="h-2" data-testid="progress-bar" />
                  {job.message && (
                    <p className="text-sm text-muted-foreground" data-testid="text-status-message">
                      {job.message}
                    </p>
                  )}
                </div>
              )}

              {job.status === "done" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-emerald-800 dark:text-emerald-300 text-sm" data-testid="text-success-message">
                        Analysis completed successfully
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400/80 mt-0.5">Results are ready for download</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button
                      onClick={handleDownload}
                      className="gap-2"
                      data-testid="button-download"
                    >
                      <Download className="h-4 w-4" />
                      Download Results
                    </Button>
                    {job.resultFileName && (
                      <span className="text-sm text-muted-foreground font-mono" data-testid="text-filename">
                        {job.resultFileName}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {job.status === "error" && (
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800 dark:text-red-300 text-sm">Analysis Failed</p>
                    <p className="text-xs text-red-600 dark:text-red-400/80 mt-0.5" data-testid="text-error-message">
                      {job.message || "An unexpected error occurred during analysis."}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {recentRuns && recentRuns.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-accent/20 flex items-center justify-center">
                    <Clock className="h-4.5 w-4.5 text-accent-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Recent Runs</CardTitle>
                    <CardDescription className="text-xs">Latest analysis history</CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild className="gap-1">
                  <Link href="/reports">
                    View All
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentRuns.slice(0, 5).map((run) => (
                  <div 
                    key={run.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    data-testid={`recent-run-${run.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        run.status === "Completed" ? "bg-success/20" :
                        run.status === "Failed" ? "bg-destructive/20" :
                        "bg-warning/20"
                      }`}>
                        {run.status === "Completed" ? (
                          <CheckCircle className="h-4 w-4 text-success" />
                        ) : run.status === "Failed" ? (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <Loader2 className="h-4 w-4 text-warning animate-spin" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{run.reviewBatch}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(run.submittedAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
                            {run.greenCount} GREEN
                          </Badge>
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                            {run.redCount} RED
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1">{run.totalEmployees} employees</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
