import { Link, useLocation } from "wouter";
import { Brain, Home, Plus, FolderOpen, Settings, MessageSquare, CheckSquare, BarChart3 } from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    { path: "/", label: "Dashboard", icon: Home },
    { path: "/new-meeting", label: "New Meeting", icon: Plus },
    { path: "/meetings", label: "Meetings", icon: MessageSquare },
    { path: "/todos", label: "Todos", icon: CheckSquare },
    { path: "/projects", label: "Projects", icon: FolderOpen },
    { path: "/insights", label: "Insights", icon: BarChart3 },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      <div className="p-6 border-b border-slate-200">
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
                <Link href={item.path} className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive 
                    ? "text-primary bg-primary/10" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}>
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
