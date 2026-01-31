import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { Sidebar, MobileHeader } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Layers } from "lucide-react";
import type { ThemeDetailData } from "@/lib/types";

export default function ThemeDetail() {
  const [, params] = useRoute("/themes/:id");
  const themeId = params?.id ? parseInt(params.id, 10) : NaN;

  const { data, isLoading, error } = useQuery<ThemeDetailData>({
    queryKey: ["/api/themes", themeId],
    queryFn: async () => {
      const response = await fetch(`/api/themes/${themeId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch theme");
      }
      return response.json();
    },
    enabled: !isNaN(themeId),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row">
        <Sidebar />
        <MobileHeader title="Theme" />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-slate-600">Loading theme...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row">
        <Sidebar />
        <MobileHeader title="Theme" />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-2">Failed to load theme</p>
            <p className="text-slate-600 text-sm">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const { theme, projects } = data;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <Sidebar />
      <MobileHeader title={theme.name} subtitle="Theme overview" />

      <main className="flex-1 overflow-hidden">
        <header className="hidden md:block bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-slate-900">{theme.name}</h1>
              <p className="text-slate-600 mt-1 text-sm md:text-base">{theme.description}</p>
            </div>
            <Badge variant="outline" className="text-sm">
              {projects.length} project{projects.length === 1 ? "" : "s"}
            </Badge>
          </div>
          {theme.reasoning && (
            <div className="mt-4 bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
              <span className="font-medium text-slate-700">AI reasoning: </span>
              {theme.reasoning}
            </div>
          )}
        </header>

        <div className="p-4 md:p-8 h-full overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                {projects.map((project) => (
                  <div key={project.id} className="bg-white rounded-xl border border-slate-200 p-4 md:p-6 flex flex-col min-h-[240px] md:h-80">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="text-base md:text-lg font-semibold text-slate-900 line-clamp-2">
                        {project.name}
                      </h3>
                      <Badge variant="outline" className="text-xs md:text-sm">
                        {project.status === "open" ? "On Track" : project.status === "hold" ? "Blocked" : "Completed"}
                      </Badge>
                    </div>

                    <div className="text-xs md:text-sm mb-3 text-slate-600">
                      Last update: {new Date(project.createdAt).toLocaleDateString()}
                    </div>

                    {project.context && (
                      <p className="text-xs md:text-sm text-slate-600 line-clamp-4 leading-relaxed mb-4">
                        {project.context}
                      </p>
                    )}

                    <div className="mt-auto">
                      <Link href={`/project/${project.id}`}>
                        <Button variant="outline" className="w-full flex items-center justify-center gap-2 text-sm">
                          View Project
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 md:py-12">
                <Layers className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-base md:text-lg font-medium text-slate-900 mb-2">No projects assigned</h3>
                <p className="text-slate-600 mb-6 text-sm md:text-base">
                  Generate themes again to refresh assignments.
                </p>
                <Link href="/themes">
                  <Button variant="outline">Back to Themes</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
