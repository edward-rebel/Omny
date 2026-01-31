import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Sidebar, MobileHeader } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Layers, Loader2, Sparkles } from "lucide-react";
import type { ThemeWithProjects } from "@/lib/types";

export default function Themes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: themes, isLoading, error } = useQuery<ThemeWithProjects[]>({
    queryKey: ["/api/themes"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/themes/generate", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Failed to generate themes");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/themes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Themes updated",
        description: "AI-generated themes have been refreshed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Theme generation failed",
        description: error.message || "Unable to generate themes.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row">
        <Sidebar />
        <MobileHeader title="Themes" />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-slate-600">Loading themes...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row">
        <Sidebar />
        <MobileHeader title="Themes" />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-2">Failed to load themes</p>
            <p className="text-slate-600 text-sm">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <Sidebar />
      <MobileHeader title="Themes" subtitle="AI-generated project focus areas" />

      <main className="flex-1 overflow-hidden">
        <header className="hidden md:flex bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-6 items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Themes</h1>
            <p className="text-slate-600 mt-1 text-sm md:text-base">
              High-level goals that unify your active projects
            </p>
          </div>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="gap-2"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Themes
              </>
            )}
          </Button>
        </header>

        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3">
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="w-full gap-2"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Themes
              </>
            )}
          </Button>
        </div>

        <div className="p-4 md:p-8 h-full overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            {themes && themes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                {themes.map((theme) => (
                  <Link
                    key={theme.id}
                    href={`/themes/${theme.id}`}
                    className="bg-white rounded-xl border border-slate-200 p-4 md:p-6 flex flex-col gap-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base md:text-lg font-semibold text-slate-900">
                          {theme.name}
                        </h3>
                        <p className="text-xs md:text-sm text-slate-600 mt-1">
                          {theme.description}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs md:text-sm">
                        {theme.projectCount} project{theme.projectCount === 1 ? "" : "s"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs md:text-sm text-slate-500">
                      <Layers className="w-4 h-4" />
                      <span>
                        {theme.projects.slice(0, 3).map((project) => project.name).join(", ")}
                        {theme.projects.length > 3 ? "..." : ""}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 md:py-12">
                <Layers className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-base md:text-lg font-medium text-slate-900 mb-2">No themes yet</h3>
                <p className="text-slate-600 mb-6 text-sm md:text-base">
                  Generate AI themes to group your active projects by shared goals.
                </p>
                <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                  Generate Themes
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
