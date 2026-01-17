import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Save, RefreshCw, CheckCircle, XCircle, Link } from "lucide-react";

interface SharePointConfig {
  siteUrl: string;
  listName: string;
  resolvedSiteId: string;
  resolvedListId: string;
  isConfigured?: boolean;
}

export default function AdminSharePoint() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<SharePointConfig | null>(null);

  const { data: config, isLoading } = useQuery<SharePointConfig>({
    queryKey: ["/api/config/sharepoint"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<SharePointConfig>) => {
      const res = await apiRequest("PUT", "/api/config/sharepoint", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/sharepoint"] });
      toast({ title: "Settings saved", description: "SharePoint settings have been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/history/resolve", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/sharepoint"] });
      toast({ 
        title: "IDs Resolved", 
        description: `Site ID and List ID have been resolved successfully.` 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Resolution Failed", 
        description: error.message || "Could not resolve SharePoint IDs. Check your configuration.",
        variant: "destructive" 
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/history/test", {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Connection Successful", description: data.message });
      } else {
        toast({ title: "Connection Failed", description: data.message, variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Test Failed", 
        description: error.message || "Could not connect to SharePoint.",
        variant: "destructive" 
      });
    },
  });

  const currentConfig = formData || config;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl" data-testid="page-admin-sharepoint">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">SharePoint Integration</h1>
        <p className="text-muted-foreground">Configure SharePoint list for reports history.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            SharePoint Connection
          </CardTitle>
          <CardDescription>
            Connect to a SharePoint list to store analysis run history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium">Status:</span>
            {config?.isConfigured ? (
              <Badge className="bg-success text-success-foreground">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="h-3 w-3 mr-1" />
                Not Configured
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="siteUrl">SharePoint Site URL</Label>
            <Input
              id="siteUrl"
              data-testid="input-sharepoint-site-url"
              value={currentConfig?.siteUrl || ""}
              onChange={(e) => setFormData({ ...currentConfig!, siteUrl: e.target.value })}
              placeholder="e.g., https://contoso.sharepoint.com/sites/HR"
            />
            <p className="text-sm text-muted-foreground">
              The full URL to your SharePoint site.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="listName">List Name</Label>
            <Input
              id="listName"
              data-testid="input-sharepoint-list-name"
              value={currentConfig?.listName || ""}
              onChange={(e) => setFormData({ ...currentConfig!, listName: e.target.value })}
              placeholder="e.g., Reports History"
            />
            <p className="text-sm text-muted-foreground">
              The display name of the SharePoint list.
            </p>
          </div>

          {(currentConfig?.resolvedSiteId || currentConfig?.resolvedListId) && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm font-medium">Resolved IDs</p>
              <div className="grid gap-2 text-sm">
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Site ID:</span>
                  <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                    {currentConfig?.resolvedSiteId || "Not resolved"}
                  </code>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground">List ID:</span>
                  <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                    {currentConfig?.resolvedListId || "Not resolved"}
                  </code>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 justify-end">
            <Button
              variant="outline"
              data-testid="button-resolve-ids"
              onClick={() => resolveMutation.mutate()}
              disabled={resolveMutation.isPending || !config?.isConfigured}
            >
              {resolveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Resolve IDs
            </Button>

            <Button
              variant="outline"
              data-testid="button-test-connection"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !config?.isConfigured}
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>

            <Button
              data-testid="button-save-sharepoint"
              onClick={() => currentConfig && updateMutation.mutate(currentConfig)}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
