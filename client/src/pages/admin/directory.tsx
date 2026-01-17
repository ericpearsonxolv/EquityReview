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
import { Loader2, Save, Info } from "lucide-react";

interface DirectoryConfig {
  idpProvider: "entra" | "okta" | "google";
  tenantUrl: string;
  clientId: string;
}

export default function AdminDirectory() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<DirectoryConfig | null>(null);

  const { data: config, isLoading } = useQuery<DirectoryConfig>({
    queryKey: ["/api/config/directory"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: DirectoryConfig) => {
      const res = await apiRequest("PUT", "/api/config/directory", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/directory"] });
      toast({ title: "Settings saved", description: "Directory settings have been updated." });
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
    <div className="p-6 max-w-3xl" data-testid="page-admin-directory">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Directory Integration</h1>
        <p className="text-muted-foreground">Configure identity provider for user authentication.</p>
      </div>

      <div className="mb-4 p-4 bg-muted/50 rounded-lg flex items-start gap-3">
        <Info className="h-5 w-5 text-primary mt-0.5" />
        <div>
          <p className="text-sm font-medium">Configuration Only</p>
          <p className="text-sm text-muted-foreground">
            These settings store IDP configuration. Full authentication is implemented in Azure deployment.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identity Provider</CardTitle>
          <CardDescription>Select and configure your organization's identity provider.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="idpProvider">Provider</Label>
            <Select
              value={currentConfig?.idpProvider || "entra"}
              onValueChange={(value) => setFormData({ ...currentConfig!, idpProvider: value as DirectoryConfig["idpProvider"] })}
            >
              <SelectTrigger id="idpProvider" data-testid="select-idp-provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entra">
                  <div className="flex items-center gap-2">
                    Microsoft Entra ID
                    <Badge variant="secondary" className="text-xs">Recommended</Badge>
                  </div>
                </SelectItem>
                <SelectItem value="okta">
                  <div className="flex items-center gap-2">
                    Okta
                    <Badge variant="outline" className="text-xs">Placeholder</Badge>
                  </div>
                </SelectItem>
                <SelectItem value="google">
                  <div className="flex items-center gap-2">
                    Google Workspace
                    <Badge variant="outline" className="text-xs">Placeholder</Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenantUrl">Tenant / Issuer URL</Label>
            <Input
              id="tenantUrl"
              data-testid="input-tenant-url"
              value={currentConfig?.tenantUrl || ""}
              onChange={(e) => setFormData({ ...currentConfig!, tenantUrl: e.target.value })}
              placeholder="e.g., https://login.microsoftonline.com/your-tenant-id"
            />
            <p className="text-sm text-muted-foreground">
              The OAuth issuer URL for your identity provider.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID</Label>
            <Input
              id="clientId"
              data-testid="input-client-id"
              value={currentConfig?.clientId || ""}
              onChange={(e) => setFormData({ ...currentConfig!, clientId: e.target.value })}
              placeholder="Application (client) ID"
            />
            <p className="text-sm text-muted-foreground">
              The application client ID from your IDP app registration.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              data-testid="button-save-directory"
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
