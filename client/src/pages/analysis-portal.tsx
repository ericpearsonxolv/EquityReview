import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Info } from "lucide-react";

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
        description: `Job ${data.jobId} has been queued for processing.`,
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
      queued: { label: "Queued", variant: "secondary" as const, icon: Loader2 },
      running: { label: "Running", variant: "default" as const, icon: Loader2 },
      done: { label: "Complete", variant: "default" as const, icon: CheckCircle },
      error: { label: "Error", variant: "destructive" as const, icon: AlertCircle },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge 
        variant={config.variant} 
        className={`gap-1 ${status === "done" ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
      >
        <Icon className={`h-3 w-3 ${status === "running" || status === "queued" ? "animate-spin" : ""}`} />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">EquityReview Analysis Portal</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>Auth placeholder</span>
        </div>
      </header>

      <main className="px-6 py-12">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">Performance Review Analysis</h2>
            <p className="text-muted-foreground">
              Upload performance review data to run AI-powered bias detection, values alignment, and rating consistency analysis.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload Review Data</CardTitle>
              <CardDescription>
                Enter a batch name and upload an Excel file containing employee performance review data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="reviewBatch">
                    Review Batch Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="reviewBatch"
                    data-testid="input-review-batch"
                    type="text"
                    placeholder="e.g., Q4-2024-Engineering"
                    value={reviewBatch}
                    onChange={(e) => setReviewBatch(e.target.value)}
                    disabled={isSubmitting || (job?.status === "running" || job?.status === "queued")}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Performance Review Excel File (.xlsx) <span className="text-destructive">*</span>
                  </Label>
                  <div className="space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx"
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="input-file"
                      disabled={isSubmitting || (job?.status === "running" || job?.status === "queued")}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleFileButtonClick}
                      disabled={isSubmitting || (job?.status === "running" || job?.status === "queued")}
                      className="gap-2"
                      data-testid="button-select-file"
                    >
                      <Upload className="h-4 w-4" />
                      Select File
                    </Button>
                    {selectedFile && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                        <FileSpreadsheet className="h-4 w-4 text-primary" />
                        <span className="truncate">{selectedFile.name}</span>
                        <span className="text-xs">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={!selectedFile || !reviewBatch.trim() || isSubmitting || (job?.status === "running" || job?.status === "queued")}
                    className="min-w-32"
                    data-testid="button-submit"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Run Analysis"
                    )}
                  </Button>
                  {job && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleReset}
                      disabled={job?.status === "running" || job?.status === "queued"}
                      data-testid="button-reset"
                    >
                      Start New Analysis
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {job && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between gap-4">
                  <span>Analysis Status</span>
                  {getStatusBadge(job.status)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Job ID:</span>
                    <code className="font-mono text-xs bg-muted px-2 py-1 rounded" data-testid="text-job-id">
                      {job.id}
                    </code>
                  </div>
                </div>

                {(job.status === "running" || job.status === "queued") && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium" data-testid="text-progress">{job.progress}%</span>
                    </div>
                    <Progress value={job.progress} className="h-2" data-testid="progress-bar" />
                    {job.message && (
                      <p className="text-sm text-muted-foreground mt-2" data-testid="text-status-message">
                        {job.message}
                      </p>
                    )}
                  </div>
                )}

                {job.status === "done" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Analysis completed successfully</span>
                    </div>
                    <Button
                      onClick={handleDownload}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      data-testid="button-download"
                    >
                      <Download className="h-4 w-4" />
                      Download Results
                    </Button>
                    {job.resultFileName && (
                      <p className="text-sm text-muted-foreground">
                        File: <span className="font-mono">{job.resultFileName}</span>
                      </p>
                    )}
                  </div>
                )}

                {job.status === "error" && (
                  <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive">Analysis Failed</p>
                      <p className="text-sm text-muted-foreground mt-1" data-testid="text-error-message">
                        {job.message || "An unexpected error occurred during analysis."}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground space-y-2">
                  <p className="font-medium text-foreground">Expected Excel Format</p>
                  <p>
                    Your Excel file should contain columns for: Employee ID, Goal/Values/Overall Ratings (Employee and Manager), and Manager Comments.
                  </p>
                  <p>
                    The analysis will detect bias, assess values alignment, check rating consistency, and flag items requiring HR escalation.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
