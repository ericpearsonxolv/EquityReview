import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Save, Info } from "lucide-react";

interface SecurityConfig {
  requireLogin: boolean;
  allowedDomains: string;
  allowedGroups: string;
}

export default function AdminSecurity() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<SecurityConfig | null>(null);

  const { data: config, isLoading } = useQuery<SecurityConfig>({
    queryKey: ["/api/config/security"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SecurityConfig) => {
      const res = await apiRequest("PUT", "/api/config/security", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/security"] });
      toast({ title: "Settings saved", description: "Security settings have been updated." });
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
    <div className="p-6 max-w-3xl" data-testid="page-admin-security">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Security Settings</h1>
        <p className="text-muted-foreground">Configure authentication and access control.</p>
      </div>

      <div className="mb-4 p-4 bg-muted/50 rounded-lg flex items-start gap-3">
        <Info className="h-5 w-5 text-primary mt-0.5" />
        <div>
          <p className="text-sm font-medium">Azure Deployment Note</p>
          <p className="text-sm text-muted-foreground">
            These settings are placeholders for the prototype. In production on Azure, authentication 
            is enforced via Entra ID and Azure AD groups through Static Web Apps authentication.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Access Control</CardTitle>
          <CardDescription>Control who can access the application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="requireLogin">Require Login</Label>
              <p className="text-sm text-muted-foreground">
                Users must authenticate before accessing the application.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="requireLogin"
                data-testid="switch-require-login"
                checked={currentConfig?.requireLogin || false}
                onCheckedChange={(checked) => setFormData({ ...currentConfig!, requireLogin: checked })}
              />
              <Badge variant="outline" className="text-xs">Placeholder</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="allowedDomains">Allowed Email Domains</Label>
            <Input
              id="allowedDomains"
              data-testid="input-allowed-domains"
              value={currentConfig?.allowedDomains || ""}
              onChange={(e) => setFormData({ ...currentConfig!, allowedDomains: e.target.value })}
              placeholder="e.g., catalight.org, example.com"
            />
            <p className="text-sm text-muted-foreground">
              Comma-separated list of allowed email domains.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="allowedGroups">Allowed Azure AD Groups</Label>
            <Input
              id="allowedGroups"
              data-testid="input-allowed-groups"
              value={currentConfig?.allowedGroups || ""}
              onChange={(e) => setFormData({ ...currentConfig!, allowedGroups: e.target.value })}
              placeholder="e.g., HR-Reviewers, HR-Admins"
            />
            <p className="text-sm text-muted-foreground">
              Comma-separated list of Azure AD groups that can access this application.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              data-testid="button-save-security"
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
