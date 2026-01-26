import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Sidebar, MobileHeader } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Users } from "lucide-react";
import { Link } from "wouter";
import type { ProjectDetailData } from "@/lib/types";

export default function ProjectDetail() {
  const [match, params] = useRoute("/project/:id");
  const projectId = params?.id;

  const { data, isLoading, error } = useQuery<ProjectDetailData>({
    queryKey: ["/api/project", projectId],
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row">
        <Sidebar />
        <MobileHeader title="Project" subtitle="Loading..." />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-slate-600">Loading project details...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row">
        <Sidebar />
        <MobileHeader title="Project Not Found" />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <p className="text-red-600 mb-2">Failed to load project</p>
            <p className="text-slate-600 text-sm">
              {error instanceof Error ? error.message : "Project not found"}
            </p>
            <Link href="/projects">
              <Button className="mt-4">Back to Projects</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const { project, tasks, relatedMeetings } = data;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-green-100 text-green-800";
      case "hold": return "bg-amber-100 text-amber-800";
      case "done": return "bg-gray-100 text-gray-800";
      default: return "bg-blue-100 text-blue-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800";
      case "high": return "bg-amber-100 text-amber-800";
      case "medium": return "bg-green-100 text-green-800";
      case "low": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const openTasks = tasks.filter(task => !task.completed);
  const completedTasks = tasks.filter(task => task.completed);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <Sidebar />
      <MobileHeader title={project.name} subtitle="Project details" />

      <main className="flex-1 overflow-hidden">
        <header className="hidden md:block bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/projects">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Projects
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold text-slate-900 truncate">{project.name}</h1>
              <p className="text-slate-600 mt-1 text-sm md:text-base">Project timeline and task overview</p>
            </div>
            <Badge className={`${getStatusColor(project.status)} text-xs md:text-sm font-medium shrink-0`}>
              {project.status}
            </Badge>
          </div>
        </header>

        {/* Mobile back button */}
        <div className="md:hidden px-4 py-2 bg-slate-50 flex items-center justify-between">
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="text-slate-600">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <Badge className={`${getStatusColor(project.status)} text-xs font-medium`}>
            {project.status}
          </Badge>
        </div>

        <div className="p-4 md:p-8 h-full overflow-y-auto">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
            {/* Left Column - Timeline and Summary */}
            <div className="lg:col-span-2 space-y-4 md:space-y-6">
              {/* Project Summary */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
                <h2 className="text-base md:text-lg font-semibold text-slate-900 mb-3 md:mb-4">Project Summary</h2>
                <div className="space-y-3 md:space-y-4">
                  {project.context && (
                    <div>
                      <p className="text-xs md:text-sm text-slate-500 mb-1 md:mb-2">Project Context</p>
                      <p className="text-slate-900 leading-relaxed text-sm md:text-base">{project.context}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs md:text-sm text-slate-500 mb-1">Current Status</p>
                    <p className="text-slate-900 text-sm md:text-base">{project.lastUpdate}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <p className="text-xs md:text-sm text-slate-500 mb-1">Total Updates</p>
                      <p className="text-base md:text-lg font-semibold text-slate-900">{project.updates.length}</p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-slate-500 mb-1">Open Tasks</p>
                      <p className="text-base md:text-lg font-semibold text-slate-900">{openTasks.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
                <h2 className="text-base md:text-lg font-semibold text-slate-900 mb-3 md:mb-4">Project Timeline</h2>
                <div className="space-y-3 md:space-y-4">
                  {project.updates.map((update, index) => (
                    <div key={index} className="flex gap-3 md:gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-primary rounded-full"></div>
                        {index < project.updates.length - 1 && (
                          <div className="w-px h-6 md:h-8 bg-slate-200 mt-2"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-3 md:pb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />
                          <span className="text-xs md:text-sm text-slate-500">{update.date}</span>
                        </div>
                        <p className="text-xs md:text-sm text-slate-900">{update.update}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Related Meetings */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
                <h2 className="text-base md:text-lg font-semibold text-slate-900 mb-3 md:mb-4">Related Meetings</h2>
                <div className="space-y-2 md:space-y-3">
                  {relatedMeetings.map((meeting) => (
                    <div key={meeting.id} className="border border-slate-200 rounded-lg p-3 md:p-4">
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <h3 className="font-medium text-slate-900 text-sm md:text-base">{meeting.title}</h3>
                        <Badge className="bg-green-100 text-green-800 text-xs shrink-0">
                          {meeting.effectivenessScore}/10
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          {meeting.date}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          {meeting.participants.length} participants
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Tasks */}
            <div className="space-y-4 md:space-y-6">
              {/* Open Tasks */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
                <h2 className="text-base md:text-lg font-semibold text-slate-900 mb-3 md:mb-4">Open Tasks</h2>
                <div className="space-y-2 md:space-y-3">
                  {openTasks.length > 0 ? (
                    openTasks.map((task) => (
                      <div key={task.id} className="border border-slate-200 rounded-lg p-2.5 md:p-3">
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <p className="text-xs md:text-sm font-medium text-slate-900 flex-1">{task.task}</p>
                          <Badge className={`${getPriorityColor(task.priority)} text-xs shrink-0`}>
                            {task.priority}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500">
                          <span>Owner: {task.owner}</span>
                          {task.due && <span className="ml-2 md:ml-3">Due: {task.due}</span>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 text-xs md:text-sm">No open tasks</p>
                  )}
                </div>
              </div>

              {/* Completed Tasks */}
              {completedTasks.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
                  <h2 className="text-base md:text-lg font-semibold text-slate-900 mb-3 md:mb-4">Completed Tasks</h2>
                  <div className="space-y-2 md:space-y-3">
                    {completedTasks.map((task) => (
                      <div key={task.id} className="border border-slate-200 rounded-lg p-2.5 md:p-3 opacity-75">
                        <p className="text-xs md:text-sm text-slate-600 line-through">{task.task}</p>
                        <div className="text-xs text-slate-400 mt-1">
                          Completed by {task.owner}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
