import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileUp, Play, CheckCircle, XCircle, Link, Settings } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: string;
  details: Record<string, any>;
  userId?: string;
}

const eventTypeIcons: Record<string, React.ReactNode> = {
  FILE_UPLOADED: <FileUp className="h-4 w-4" />,
  ANALYSIS_STARTED: <Play className="h-4 w-4" />,
  ANALYSIS_COMPLETED: <CheckCircle className="h-4 w-4 text-success" />,
  ANALYSIS_FAILED: <XCircle className="h-4 w-4 text-destructive" />,
  SHAREPOINT_WRITE_SUCCESS: <Link className="h-4 w-4 text-success" />,
  SHAREPOINT_WRITE_FAILED: <Link className="h-4 w-4 text-destructive" />,
  ADMIN_CONFIG_UPDATED: <Settings className="h-4 w-4" />,
};

const eventTypeLabels: Record<string, string> = {
  FILE_UPLOADED: "File Uploaded",
  ANALYSIS_STARTED: "Analysis Started",
  ANALYSIS_COMPLETED: "Analysis Completed",
  ANALYSIS_FAILED: "Analysis Failed",
  SHAREPOINT_WRITE_SUCCESS: "SharePoint Write Success",
  SHAREPOINT_WRITE_FAILED: "SharePoint Write Failed",
  ADMIN_CONFIG_UPDATED: "Config Updated",
};

const eventTypeBadgeVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  FILE_UPLOADED: "secondary",
  ANALYSIS_STARTED: "secondary",
  ANALYSIS_COMPLETED: "default",
  ANALYSIS_FAILED: "destructive",
  SHAREPOINT_WRITE_SUCCESS: "default",
  SHAREPOINT_WRITE_FAILED: "destructive",
  ADMIN_CONFIG_UPDATED: "outline",
};

export default function AdminAudit() {
  const [filterType, setFilterType] = useState<string>("all");

  const { data: events, isLoading } = useQuery<AuditEvent[]>({
    queryKey: ["/api/audit", filterType !== "all" ? `?eventType=${filterType}` : ""],
    refetchInterval: 10000,
  });

  const formatDetails = (details: Record<string, any>): string => {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(details)) {
      if (value !== undefined && value !== null && value !== "") {
        parts.push(`${key}: ${value}`);
      }
    }
    return parts.join(" | ");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="page-admin-audit">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-muted-foreground">View system events and activity history.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>Last 200 audit events</CardDescription>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48" data-testid="select-audit-filter">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="FILE_UPLOADED">File Uploaded</SelectItem>
                <SelectItem value="ANALYSIS_STARTED">Analysis Started</SelectItem>
                <SelectItem value="ANALYSIS_COMPLETED">Analysis Completed</SelectItem>
                <SelectItem value="ANALYSIS_FAILED">Analysis Failed</SelectItem>
                <SelectItem value="SHAREPOINT_WRITE_SUCCESS">SharePoint Success</SelectItem>
                <SelectItem value="SHAREPOINT_WRITE_FAILED">SharePoint Failed</SelectItem>
                <SelectItem value="ADMIN_CONFIG_UPDATED">Config Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!events || events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No audit events recorded yet.</p>
              <p className="text-sm mt-1">Events will appear here as actions are performed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-40">Event Type</TableHead>
                    <TableHead className="w-40">Time</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id} data-testid={`row-audit-${event.id}`}>
                      <TableCell>
                        {eventTypeIcons[event.eventType] || <Settings className="h-4 w-4" />}
                      </TableCell>
                      <TableCell>
                        <Badge variant={eventTypeBadgeVariants[event.eventType] || "secondary"}>
                          {eventTypeLabels[event.eventType] || event.eventType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {formatDetails(event.details)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
