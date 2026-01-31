import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { Sidebar, MobileHeader } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Search, X, Layers, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import type { ProjectWithTasks, ConsolidationPreview, ConsolidationResult } from "@/lib/types";

export default function Projects() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [projectToDelete, setProjectToDelete] = useState<ProjectWithTasks | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Consolidation state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<ConsolidationPreview | null>(null);
  const [consolidationResult, setConsolidationResult] = useState<ConsolidationResult | null>(null);

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

  // Consolidation preview mutation
  const previewMutation = useMutation({
    mutationFn: async (): Promise<ConsolidationPreview> => {
      const response = await fetch("/api/projects/consolidate/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to analyze projects");
      }
      return data;
    },
    onSuccess: (data) => {
      setPreviewData(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze projects for consolidation",
        variant: "destructive",
      });
      setShowPreviewModal(false);
    },
  });

  // Consolidation execute mutation
  const executeMutation = useMutation({
    mutationFn: async (consolidations: ConsolidationPreview["proposedConsolidations"]): Promise<ConsolidationResult> => {
      const response = await fetch("/api/projects/consolidate/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consolidations }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to consolidate projects");
      }
      return data;
    },
    onSuccess: (data) => {
      setConsolidationResult(data);
      setPreviewData(null);
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Consolidation Failed",
        description: error.message || "Failed to consolidate projects",
        variant: "destructive",
      });
      // Keep preview modal open so user doesn't lose state
    },
  });

  const handleConsolidateClick = () => {
    setShowPreviewModal(true);
    setPreviewData(null);
    setConsolidationResult(null);
    previewMutation.mutate();
  };

  const handleConfirmConsolidation = () => {
    if (previewData?.proposedConsolidations) {
      executeMutation.mutate(previewData.proposedConsolidations);
    }
  };

  const handleClosePreviewModal = () => {
    setShowPreviewModal(false);
    setPreviewData(null);
  };

  const handleCloseResultModal = () => {
    setConsolidationResult(null);
  };

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

  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case "open": return "border-l-green-500";
      case "hold": return "border-l-amber-500";
      case "done": return "border-l-slate-400";
      default: return "border-l-blue-500";
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleConsolidateClick}
                        disabled={!projects || projects.length < 2}
                        className="gap-2"
                      >
                        <Layers className="w-4 h-4" />
                        <span className="hidden sm:inline">Consolidate</span>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {(!projects || projects.length < 2) && (
                    <TooltipContent>
                      <p>Need at least 2 projects</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
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
                <div className="space-y-3 md:space-y-4">
                  {filteredProjects.map((project) => (
                    <Link key={project.id} href={`/project/${project.id}`}>
                      <Card
                        className={`hover:shadow-md transition-shadow cursor-pointer border-l-4 ${getStatusBorderColor(project.status)}`}
                      >
                        <CardHeader className="p-4 md:p-6 pb-2 md:pb-3">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base md:text-lg text-slate-900 mb-2 truncate">
                                {project.name}
                              </CardTitle>
                              <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-slate-600">
                                <div>
                                  <span className="text-slate-500">Last update:</span>
                                  <span className="text-slate-900 font-medium ml-1">
                                    {new Date(project.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Updates:</span>
                                  <span className="text-slate-900 font-medium ml-1">{project.updates.length}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Open tasks:</span>
                                  <span className="text-slate-900 font-medium ml-1">{project.openTasksCount}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className={`${getStatusColor(project.status)} text-xs md:text-sm font-medium`}>
                                {getStatusLabel(project.status)}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                onClick={(e) => handleDeleteClick(e, project)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 md:p-6 pt-0">
                          <div className="space-y-3">
                            <div>
                              <h4 className="text-xs md:text-sm font-medium text-slate-900 mb-1">Context</h4>
                              {project.context ? (
                                <p className="text-xs md:text-sm text-slate-600 line-clamp-3 md:line-clamp-4 leading-relaxed">
                                  {project.context}
                                </p>
                              ) : (
                                <p className="text-slate-400 italic text-xs md:text-sm">No context provided</p>
                              )}
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs md:text-sm">
                              <div className="text-slate-500 truncate">
                                {project.openTasks?.slice(0, 3).map((task) => task.title).join(", ") ||
                                  "No tasks linked"}
                              </div>
                              <div className="text-blue-600 font-medium shrink-0">
                                View Project →
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
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
              )
            ) : (
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

      {/* Consolidation Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={handleClosePreviewModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Consolidate Projects
            </DialogTitle>
            <DialogDescription>
              {previewMutation.isPending
                ? "Analyzing projects for duplicates..."
                : previewData?.noChanges
                ? "Review proposed project consolidations"
                : "Review and confirm the proposed consolidations below"}
            </DialogDescription>
          </DialogHeader>

          {previewMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-slate-600">Analyzing projects for duplicates...</p>
            </div>
          )}

          {previewData && previewData.noChanges && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">All projects appear unique</h3>
              <p className="text-slate-600 text-center">No consolidation needed. Your projects are already well organized.</p>
            </div>
          )}

          {previewData && !previewData.noChanges && previewData.proposedConsolidations.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Found {previewData.proposedConsolidations.length} group{previewData.proposedConsolidations.length > 1 ? "s" : ""} of projects to consolidate:
              </p>

              {previewData.proposedConsolidations.map((consolidation, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {consolidation.sourceProjects.map((project, pIndex) => (
                      <span key={project.id} className="flex items-center">
                        <Badge variant="outline" className="text-sm">
                          {project.name}
                          <span className="ml-1 text-xs text-slate-400">
                            ({project.updatesCount} updates, {project.tasksCount} tasks)
                          </span>
                        </Badge>
                        {pIndex < consolidation.sourceProjects.length - 1 && (
                          <span className="mx-1 text-slate-400">+</span>
                        )}
                      </span>
                    ))}
                    <ArrowRight className="w-4 h-4 text-slate-400 mx-2" />
                    <Badge className="bg-primary text-white text-sm">
                      {consolidation.mergedName}
                    </Badge>
                  </div>

                  <div className="bg-slate-50 rounded p-3">
                    <p className="text-xs font-medium text-slate-500 mb-1">AI Reasoning:</p>
                    <p className="text-sm text-slate-700">{consolidation.reason}</p>
                  </div>

                  {consolidation.mergedContext && (
                    <div className="bg-blue-50 rounded p-3">
                      <p className="text-xs font-medium text-blue-600 mb-1">Merged Context Preview:</p>
                      <p className="text-sm text-slate-700 line-clamp-3">{consolidation.mergedContext}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClosePreviewModal}>
              Cancel
            </Button>
            {previewData && !previewData.noChanges && (
              <Button
                onClick={handleConfirmConsolidation}
                disabled={executeMutation.isPending}
              >
                {executeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Consolidating...
                  </>
                ) : (
                  "Confirm Consolidation"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consolidation Result Modal */}
      <Dialog open={!!consolidationResult} onOpenChange={handleCloseResultModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Consolidation Complete
            </DialogTitle>
            <DialogDescription>
              Consolidated {consolidationResult?.originalProjectCount} projects into {consolidationResult?.finalProjectCount}
            </DialogDescription>
          </DialogHeader>

          {consolidationResult && consolidationResult.consolidations.length > 0 && (
            <div className="space-y-4">
              {consolidationResult.consolidations.map((result, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {result.sourceProjects.map((project, pIndex) => (
                      <span key={project.id} className="flex items-center">
                        <span className="text-sm text-slate-500 line-through">{project.name}</span>
                        {pIndex < result.sourceProjects.length - 1 && (
                          <span className="mx-1 text-slate-400">+</span>
                        )}
                      </span>
                    ))}
                    <ArrowRight className="w-4 h-4 text-slate-400 mx-2" />
                    <Badge className="bg-green-100 text-green-800 text-sm">
                      {result.targetProject.name}
                    </Badge>
                  </div>

                  <div className="flex gap-4 text-sm text-slate-600">
                    <span>{result.updatesConsolidated} updates consolidated</span>
                    <span>{result.tasksReassigned} tasks reassigned</span>
                  </div>

                  <p className="text-sm text-slate-500">{result.reason}</p>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button onClick={handleCloseResultModal}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
