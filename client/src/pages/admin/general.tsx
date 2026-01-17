import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Save } from "lucide-react";

interface GeneralConfig {
  defaultReviewBatchPrefix: string;
  outputRetentionDays: number;
  maxRowsPerUpload: number;
}

export default function AdminGeneral() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<GeneralConfig | null>(null);

  const { data: config, isLoading } = useQuery<GeneralConfig>({
    queryKey: ["/api/config/general"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: GeneralConfig) => {
      const res = await apiRequest("PUT", "/api/config/general", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/general"] });
      toast({ title: "Settings saved", description: "General settings have been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
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
    <div className="p-6 max-w-3xl" data-testid="page-admin-general">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">General Settings</h1>
        <p className="text-muted-foreground">Configure default application behavior and limits.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application Defaults</CardTitle>
          <CardDescription>Set default values for common operations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="batchPrefix">Default Review Batch Prefix</Label>
            <Input
              id="batchPrefix"
              data-testid="input-batch-prefix"
              value={currentConfig?.defaultReviewBatchPrefix || ""}
              onChange={(e) => setFormData({ ...currentConfig!, defaultReviewBatchPrefix: e.target.value })}
              placeholder="e.g., FY25-Q1"
            />
            <p className="text-sm text-muted-foreground">
              This prefix will be suggested when creating new analysis runs.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="retentionDays">Output Retention Days</Label>
            <Input
              id="retentionDays"
              data-testid="input-retention-days"
              type="number"
              value={currentConfig?.outputRetentionDays || 90}
              onChange={(e) => setFormData({ ...currentConfig!, outputRetentionDays: parseInt(e.target.value) || 90 })}
              min={1}
              max={365}
            />
            <p className="text-sm text-muted-foreground">
              Number of days to retain analysis output files.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxRows">Maximum Rows Per Upload</Label>
            <Input
              id="maxRows"
              data-testid="input-max-rows"
              type="number"
              value={currentConfig?.maxRowsPerUpload || 1000}
              onChange={(e) => setFormData({ ...currentConfig!, maxRowsPerUpload: parseInt(e.target.value) || 1000 })}
              min={10}
              max={10000}
            />
            <p className="text-sm text-muted-foreground">
              Maximum number of employee records allowed per upload.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              data-testid="button-save-general"
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
