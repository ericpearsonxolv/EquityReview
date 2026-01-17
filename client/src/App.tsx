import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import AnalysisPortal from "@/pages/analysis-portal";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={AnalysisPortal} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm px-4 flex items-center justify-between gap-4 sticky top-0 z-50">
                <div className="flex items-center gap-3">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <span className="text-sm font-medium text-muted-foreground">Analysis Portal</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground border-border">
                    v1.0.0
                  </Badge>
                  <div 
                    className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"
                    data-testid="button-user-menu"
                  >
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </header>
              <main className="flex-1 overflow-auto">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
