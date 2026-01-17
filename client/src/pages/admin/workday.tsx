import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Save, Info, Lock } from "lucide-react";

interface WorkdayConfig {
  baseUrl: string;
  tenant: string;
  authType: "oauth2" | "basic" | "isu";
  clientId: string;
  hasSecret: boolean;
}

export default function AdminWorkday() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<WorkdayConfig | null>(null);
  const [clientSecret, setClientSecret] = useState("");

  const { data: config, isLoading } = useQuery<WorkdayConfig>({
    queryKey: ["/api/config/workday"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: WorkdayConfig & { clientSecret?: string }) => {
      const res = await apiRequest("PUT", "/api/config/workday", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/workday"] });
      setClientSecret("");
      toast({ title: "Settings saved", description: "Workday settings have been updated." });
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
    <div className="p-6 max-w-3xl" data-testid="page-admin-workday">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Workday Integration</h1>
        <p className="text-muted-foreground">Configure connection to Workday HRIS.</p>
      </div>

      <div className="mb-4 p-4 bg-muted/50 rounded-lg flex items-start gap-3">
        <Info className="h-5 w-5 text-primary mt-0.5" />
        <div>
          <p className="text-sm font-medium">Future Integration</p>
          <p className="text-sm text-muted-foreground">
            Workday integration is a placeholder for future implementation. In production, 
            secrets should be stored in Azure Key Vault rather than application configuration.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workday Connection</CardTitle>
          <CardDescription>Configure Workday API credentials and connection settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Workday Base URL</Label>
              <Input
                id="baseUrl"
                data-testid="input-workday-base-url"
                value={currentConfig?.baseUrl || ""}
                onChange={(e) => setFormData({ ...currentConfig!, baseUrl: e.target.value })}
                placeholder="e.g., https://wd5-impl-services1.workday.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant">Tenant</Label>
              <Input
                id="tenant"
                data-testid="input-workday-tenant"
                value={currentConfig?.tenant || ""}
                onChange={(e) => setFormData({ ...currentConfig!, tenant: e.target.value })}
                placeholder="Your Workday tenant name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="authType">Authentication Type</Label>
            <Select
              value={currentConfig?.authType || "oauth2"}
              onValueChange={(value) => setFormData({ ...currentConfig!, authType: value as WorkdayConfig["authType"] })}
            >
              <SelectTrigger id="authType" data-testid="select-workday-auth-type">
                <SelectValue placeholder="Select auth type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                <SelectItem value="basic">Basic Authentication</SelectItem>
                <SelectItem value="isu">Integration System User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workdayClientId">Client ID</Label>
            <Input
              id="workdayClientId"
              data-testid="input-workday-client-id"
              value={currentConfig?.clientId || ""}
              onChange={(e) => setFormData({ ...currentConfig!, clientId: e.target.value })}
              placeholder="Workday API Client ID"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workdayClientSecret">Client Secret</Label>
            <div className="flex gap-2">
              <Input
                id="workdayClientSecret"
                data-testid="input-workday-client-secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={currentConfig?.hasSecret ? "••••••••••••" : "Enter client secret"}
              />
              {currentConfig?.hasSecret && (
                <Badge variant="secondary" className="whitespace-nowrap flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Set
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Secret is stored server-side and not displayed after saving.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              data-testid="button-save-workday"
              onClick={() => {
                if (currentConfig) {
                  updateMutation.mutate({ ...currentConfig, clientSecret: clientSecret || undefined });
                }
              }}
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
