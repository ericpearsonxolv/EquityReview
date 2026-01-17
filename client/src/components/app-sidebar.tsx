import { BarChart3, FileSpreadsheet, Shield, Building2 } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const navigationItems = [
  {
    title: "Analysis",
    url: "/",
    icon: BarChart3,
    isActive: true,
  },
  {
    title: "Reports",
    url: "#",
    icon: FileSpreadsheet,
    isActive: false,
  },
  {
    title: "Compliance",
    url: "#",
    icon: Shield,
    isActive: false,
  },
];

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <span className="text-sm font-semibold text-sidebar-foreground">EquityReview</span>
            <p className="text-xs text-muted-foreground">Enterprise Edition</p>
          </div>
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
                    isActive={item.isActive}
                    data-testid={`nav-${item.title.toLowerCase()}`}
                  >
                    <a href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <Separator className="mx-4" />
        
        <SidebarGroup>
          <SidebarGroupLabel>Quick Stats</SidebarGroupLabel>
          <SidebarGroupContent className="px-2">
            <div className="space-y-2">
              <div className="px-3 py-2 rounded-md bg-sidebar-accent">
                <div className="text-xs text-muted-foreground">Reviews Analyzed</div>
                <div className="text-lg font-semibold text-sidebar-foreground">--</div>
              </div>
              <div className="px-3 py-2 rounded-md bg-sidebar-accent">
                <div className="text-xs text-muted-foreground">RED Flags</div>
                <div className="text-lg font-semibold text-sidebar-foreground">--</div>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="px-4 py-3">
        <div className="text-xs text-muted-foreground">
          v1.0.0 - Mock LLM Mode
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
