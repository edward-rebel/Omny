import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { TodoCard } from "@/components/TodoCard";
import { ProjectCard } from "@/components/ProjectCard";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import type { DashboardData } from "@/lib/types";

export default function Dashboard() {
  const { data: dashboardData, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-slate-600">Loading dashboard...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-2">Failed to load dashboard</p>
            <p className="text-slate-600 text-sm">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const data = dashboardData!;

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      
      <main className="flex-1 overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
              <p className="text-slate-600 mt-1">Your meeting insights and action items</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">
                Last updated: just now
              </span>
            </div>
          </div>
        </header>
        
        <div className="p-8 h-full overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-6">
              <TodoCard 
                title="My Top Todos"
                tasks={data.myTasks}
                isOwner={true}
                badgeColor="bg-primary-100 text-primary-700"
              />
              
              <TodoCard 
                title="Others' Todos"
                tasks={data.othersTasks}
                isOwner={false}
                badgeColor="bg-emerald-100 text-emerald-700"
              />
            </div>
            
            {/* Right Column */}
            <div className="space-y-6">
              {/* Latest Meeting Card */}
              {data.latestMeeting ? (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-slate-900">Latest Meeting</h2>
                    <Badge className="bg-green-100 text-green-800 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      {data.latestMeeting.effectivenessScore}/10
                    </Badge>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">{data.latestMeeting.title}</h3>
                      <p className="text-sm text-slate-600 mt-1">{data.latestMeeting.date}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {data.latestMeeting.participants.map((participant, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {participant === "Edward" ? `${participant} (You)` : participant}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-slate-900 mb-2">Key Takeaways</h4>
                      <ul className="space-y-1 text-sm text-slate-600">
                        {data.latestMeeting.keyTakeaways.slice(0, 3).map((takeaway, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                            {takeaway}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="bg-slate-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-slate-900 mb-2 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        What went well
                      </h4>
                      <p className="text-sm text-slate-600">
                        {data.latestMeeting.wentWell.join(", ")}
                      </p>
                    </div>
                  </div>
                  
                  <Link href={`/meeting/${data.latestMeeting.id}`}>
                    <Button variant="outline" className="w-full mt-4 flex items-center justify-center gap-2">
                      View full meeting details
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Latest Meeting</h2>
                  <div className="text-center py-8">
                    <p className="text-slate-600">No meetings analyzed yet.</p>
                    <Link href="/new-meeting">
                      <Button className="mt-4">Analyze Your First Meeting</Button>
                    </Link>
                  </div>
                </div>
              )}
              
              <ProjectCard projects={data.projects} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
