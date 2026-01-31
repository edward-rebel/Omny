import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useMemo, useState } from "react";
import { Sidebar, MobileHeader } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Layers, Loader2, Search, Sparkles, X } from "lucide-react";
import type { ThemeWithProjects } from "@/lib/types";

export default function Themes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredThemes = useMemo(() => {
    if (!themes) return [];
    const searchLower = searchQuery.toLowerCase();
    return themes.filter((theme) => {
      if (searchQuery === "") return true;
      return (
        theme.name.toLowerCase().includes(searchLower) ||
        theme.description?.toLowerCase().includes(searchLower) ||
        theme.projects.some((project) => project.name.toLowerCase().includes(searchLower))
      );
    });
  }, [themes, searchQuery]);

  const clearFilters = () => {
    setSearchQuery("");
  };

  const hasActiveFilters = searchQuery !== "";

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

        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-3 md:py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search themes by name, description, or projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500">
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
          {hasActiveFilters && themes && (
            <p className="text-xs text-slate-500 mt-2">
              Showing {filteredThemes.length} of {themes.length} themes
            </p>
          )}
        </div>

        <div className="p-4 md:p-8 h-full overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            {themes && themes.length > 0 ? (
              filteredThemes.length > 0 ? (
                <div className="space-y-3 md:space-y-4">
                  {filteredThemes.map((theme) => (
                    <Link key={theme.id} href={`/themes/${theme.id}`}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-indigo-500">
                        <CardHeader className="p-4 md:p-6 pb-2 md:pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <CardTitle className="text-base md:text-lg text-slate-900 truncate">
                                {theme.name}
                              </CardTitle>
                              <p className="text-xs md:text-sm text-slate-600 mt-1 line-clamp-2">
                                {theme.description}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs md:text-sm shrink-0">
                              {theme.projectCount} project{theme.projectCount === 1 ? "" : "s"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 md:p-6 pt-0">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-xs md:text-sm text-slate-500">
                              <Layers className="w-4 h-4" />
                              <span className="truncate">
                                {theme.projects.slice(0, 3).map((project) => project.name).join(", ")}
                                {theme.projects.length > 3 ? "..." : ""}
                              </span>
                            </div>
                            <div className="text-blue-600 font-medium text-xs md:text-sm">
                              View Theme →
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
                  <h3 className="text-base md:text-lg font-medium text-slate-900 mb-2">No matching themes</h3>
                  <p className="text-slate-600 mb-6 text-sm md:text-base">Try adjusting your search</p>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </div>
              )
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
