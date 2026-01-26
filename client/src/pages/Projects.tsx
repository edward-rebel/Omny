import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { Sidebar, MobileHeader } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronRight, Trash2, Search, X } from "lucide-react";
import type { ProjectWithTasks } from "@/lib/types";

export default function Projects() {
  const queryClient = useQueryClient();
  const [projectToDelete, setProjectToDelete] = useState<ProjectWithTasks | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: projects, isLoading, error } = useQuery<ProjectWithTasks[]>({
    queryKey: ["/api/projects"],
  });

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter((project) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === "" ||
        project.name.toLowerCase().includes(searchLower) ||
        project.context?.toLowerCase().includes(searchLower);

      // Status filter
      const matchesStatus = statusFilter === "all" || project.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
  };

  const hasActiveFilters = searchQuery !== "" || statusFilter !== "all";

  const deleteMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete project");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setProjectToDelete(null);
    },
  });

  const handleDeleteClick = (e: React.MouseEvent, project: ProjectWithTasks) => {
    e.preventDefault();
    e.stopPropagation();
    setProjectToDelete(project);
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      deleteMutation.mutate(projectToDelete.id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row">
        <Sidebar />
        <MobileHeader title="Projects" />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-slate-600">Loading projects...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row">
        <Sidebar />
        <MobileHeader title="Projects" />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-2">Failed to load projects</p>
            <p className="text-slate-600 text-sm">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-green-100 text-green-800";
      case "hold": return "bg-amber-100 text-amber-800";
      case "done": return "bg-gray-100 text-gray-800";
      default: return "bg-blue-100 text-blue-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open": return "On Track";
      case "hold": return "Blocked";
      case "done": return "Completed";
      default: return status;
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <Sidebar />
      <MobileHeader title="Projects" subtitle="Track your projects" />

      <main className="flex-1 overflow-hidden">
        <header className="hidden md:block bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-6">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Projects</h1>
            <p className="text-slate-600 mt-1 text-sm md:text-base">Track progress and decisions across all your active projects</p>
          </div>
        </header>

        {/* Search and Filter Bar */}
        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-3 md:py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search projects by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">On Track</SelectItem>
                  <SelectItem value="hold">Blocked</SelectItem>
                  <SelectItem value="done">Completed</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500">
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
          {hasActiveFilters && projects && (
            <p className="text-xs text-slate-500 mt-2">
              Showing {filteredProjects.length} of {projects.length} projects
            </p>
          )}
        </div>

        <div className="p-4 md:p-8 h-full overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {projects && projects.length > 0 ? (
              filteredProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                {filteredProjects.map((project) => (
                  <div key={project.id} className="bg-white rounded-xl border border-slate-200 p-4 md:p-6 flex flex-col min-h-[280px] md:h-96">
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <h3 className="text-base md:text-lg font-semibold text-slate-900 line-clamp-2">{project.name}</h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={`${getStatusColor(project.status)} text-xs md:text-sm font-medium`}>
                          {getStatusLabel(project.status)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          onClick={(e) => handleDeleteClick(e, project)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="text-xs md:text-sm mb-3">
                      <span className="text-slate-500">Last Update:</span>
                      <span className="text-slate-900 font-medium ml-1">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-2 mb-3 md:mb-4 border-t border-b border-slate-100">
                      <div className="text-xs md:text-sm">
                        <span className="text-slate-500">Updates:</span>
                        <span className="text-slate-900 font-medium ml-1">{project.updates.length}</span>
                      </div>
                      <div className="text-xs md:text-sm">
                        <span className="text-slate-500">Open Tasks:</span>
                        <span className="text-slate-900 font-medium ml-1">{project.openTasksCount}</span>
                      </div>
                    </div>

                    <div className="flex-grow mb-3 md:mb-4">
                      {project.context && (
                        <p className="text-xs md:text-sm text-slate-600 line-clamp-3 md:line-clamp-4 leading-relaxed">{project.context}</p>
                      )}
                    </div>

                    <div className="mt-auto">
                      <Link href={`/project/${project.id}`}>
                        <Button variant="outline" className="w-full flex items-center justify-center gap-2 text-sm">
                          View Details
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 md:py-12">
                <Search className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-base md:text-lg font-medium text-slate-900 mb-2">No matching projects</h3>
                <p className="text-slate-600 mb-6 text-sm md:text-base">Try adjusting your search or filters</p>
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>
            )) : (
              <div className="text-center py-8 md:py-12">
                <p className="text-slate-600 mb-4 text-sm md:text-base">No projects found.</p>
                <p className="text-xs md:text-sm text-slate-500 mb-6">
                  Analyze some meetings to automatically track project updates.
                </p>
                <Link href="/new-meeting">
                  <Button>Analyze Your First Meeting</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{projectToDelete?.name}"? Tasks associated with this project will be unlinked but not deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
