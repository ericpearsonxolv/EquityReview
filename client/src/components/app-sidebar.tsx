import { BarChart3, FileSpreadsheet, Shield } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import catalightLogo from "@assets/image_1768679443516.png";

interface Stats {
  totalAnalyzed: number;
  totalRedFlags: number;
  completedJobs: number;
}

const navigationItems = [
  {
    title: "Analysis",
    url: "/",
    icon: BarChart3,
  },
  {
    title: "Reports",
    url: "/reports",
    icon: FileSpreadsheet,
  },
  {
    title: "Compliance",
    url: "/compliance",
    icon: Shield,
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const [location] = useLocation();
  const isCollapsed = state === "collapsed";

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    refetchInterval: 5000,
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-3 overflow-hidden">
          <img 
            src={catalightLogo} 
            alt="Catalight" 
            className={`h-8 object-contain transition-all duration-200 ${isCollapsed ? 'w-8' : 'w-auto max-w-[140px]'}`}
          />
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    tooltip={item.title}
                    data-testid={`nav-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <Separator className="mx-4 group-data-[collapsible=icon]:hidden" />
        
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Quick Stats</SidebarGroupLabel>
          <SidebarGroupContent className="px-2">
            <div className="space-y-2">
              <div className="px-3 py-2 rounded-md bg-sidebar-accent" data-testid="stat-reviews-analyzed">
                <div className="text-xs text-muted-foreground">Reviews Analyzed</div>
                <div className="text-lg font-semibold text-sidebar-foreground">
                  {stats?.totalAnalyzed ?? 0}
                </div>
              </div>
              <div className="px-3 py-2 rounded-md bg-sidebar-accent" data-testid="stat-red-flags">
                <div className="text-xs text-muted-foreground">RED Flags</div>
                <div className="text-lg font-semibold text-sidebar-foreground">
                  {stats?.totalRedFlags ?? 0}
                </div>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="px-4 py-3 group-data-[collapsible=icon]:hidden">
        <div className="text-xs text-muted-foreground">
          v1.0.0 - Mock LLM Mode
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
