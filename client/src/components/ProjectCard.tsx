import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { Link } from "wouter";
import type { ProjectWithTasks } from "@/lib/types";

interface ProjectCardProps {
  projects: ProjectWithTasks[];
}

export function ProjectCard({ projects }: ProjectCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-green-100 text-green-800";
      case "hold": return "bg-amber-100 text-amber-800";
      case "done": return "bg-gray-100 text-gray-800";
      default: return "bg-blue-100 text-blue-800";
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case "open": return "bg-green-500";
      case "hold": return "bg-amber-500";
      case "done": return "bg-gray-500";
      default: return "bg-blue-500";
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Active Projects</h2>
        <Badge className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-medium">
          {projects.length}
        </Badge>
      </div>

      <div className="space-y-4">
        {projects.slice(0, 3).map((project) => (
          <div key={project.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors">
            <div className={`w-3 h-3 rounded-full ${getStatusDot(project.status)}`}></div>
            <div className="flex-1">
              <p className="font-medium text-slate-900">{project.name}</p>
              <p className="text-sm text-slate-600 mt-1">{project.lastUpdate}</p>
              {project.openTasksCount > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  {project.openTasksCount} open task{project.openTasksCount > 1 ? 's' : ''}
                </p>
              )}
            </div>
            <Badge className={`${getStatusColor(project.status)} text-xs font-medium`}>
              {project.status === "open" ? "On Track" : 
               project.status === "hold" ? "Blocked" : 
               project.status === "done" ? "Done" : project.status}
            </Badge>
          </div>
        ))}
      </div>

      <Link href="/projects">
        <Button variant="outline" className="w-full mt-4 flex items-center justify-center gap-2">
          View all projects
          <ChevronRight className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  );
}
