import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronRight, Download, FileSpreadsheet, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface JobRecord {
  id: string;
  reviewBatch: string;
  status: "queued" | "running" | "done" | "error";
  progress: number;
  message?: string;
  createdAt: string;
  totalEmployees?: number;
  resultFileName?: string;
}

function StatusBadge({ status }: { status: JobRecord["status"] }) {
  const variants = {
    queued: { variant: "secondary" as const, icon: Clock, label: "Queued" },
    running: { variant: "default" as const, icon: Loader2, label: "Running" },
    done: { variant: "default" as const, icon: CheckCircle, label: "Complete" },
    error: { variant: "destructive" as const, icon: XCircle, label: "Error" },
  };

  const { variant, icon: Icon, label } = variants[status];
  
  return (
    <Badge variant={variant} className={`gap-1 ${status === "done" ? "bg-green-600 hover:bg-green-700" : ""}`}>
      <Icon className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`} />
      {label}
    </Badge>
  );
}

export default function Reports() {
  const { toast } = useToast();
  
  const { data: jobs, isLoading, error } = useQuery<JobRecord[]>({
    queryKey: ["/api/jobs"],
    refetchInterval: 5000,
  });

  const handleDownload = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/download`);
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analysis-results-${jobId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Started",
        description: "Your results file is downloading.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Unable to download the results file.",
      });
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-reports">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Home</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Reports</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
          Analysis Reports
        </h1>
        <p className="text-muted-foreground mt-1">
          View and download completed analysis reports. Track the history of all performance review analyses.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Report History
          </CardTitle>
          <CardDescription>
            All analysis jobs with their current status and results
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-muted-foreground">
              Failed to load reports. Please try again.
            </div>
          ) : !jobs || jobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-reports">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No analysis reports yet.</p>
              <p className="text-sm">Run your first analysis from the Analysis page to see results here.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Review Batch</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                    <TableCell className="font-medium">{job.reviewBatch}</TableCell>
                    <TableCell>
                      {format(new Date(job.createdAt), "MMM d, yyyy h:mm a")}
                    </TableCell>
                    <TableCell>
                      {job.totalEmployees || "--"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {job.status === "done" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(job.id)}
                          data-testid={`button-download-${job.id}`}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
