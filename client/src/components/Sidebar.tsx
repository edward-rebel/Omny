import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Brain, Home, Plus, FolderOpen, Settings, MessageSquare, CheckSquare, BarChart3, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/new-meeting", label: "New Meeting", icon: Plus },
  { path: "/meetings", label: "Meetings", icon: MessageSquare },
  { path: "/todos", label: "Todos", icon: CheckSquare },
  { path: "/projects", label: "Projects", icon: FolderOpen },
  { path: "/insights", label: "Insights", icon: BarChart3 },
  { path: "/settings", label: "Settings", icon: Settings },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();

  return (
    <>
      <div className="p-4 md:p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Brain className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Omny</h1>
            <p className="text-sm text-slate-600">AI Meeting Assistant</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;

            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                  onClick={onNavigate}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  // Mobile: render hamburger menu with Sheet
  if (isMobile) {
    return null; // Mobile sidebar is rendered via MobileHeader
  }

  // Desktop: render regular sidebar
  return (
    <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col">
      <SidebarContent />
    </aside>
  );
}

export function MobileHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  if (!isMobile) {
    return null;
  }

  return (
    <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0">
            <Menu className="w-5 h-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-slate-900 truncate">{title}</h1>
        {subtitle && (
          <p className="text-sm text-slate-600 truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
