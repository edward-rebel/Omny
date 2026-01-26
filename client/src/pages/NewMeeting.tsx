import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Sidebar, MobileHeader } from "@/components/Sidebar";
import { TranscriptInput } from "@/components/TranscriptInput";
import { MeetingSummary } from "@/components/MeetingSummary";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AnalysisResult } from "@/lib/types";

export default function NewMeeting() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const analyzeMutation = useMutation({
    mutationFn: async (transcript: string): Promise<AnalysisResult> => {
      const response = await apiRequest("POST", "/api/analyze", { raw_transcript: transcript });
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/insights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/project"] });
      toast({
        title: "Meeting Analyzed Successfully",
        description: "Your meeting has been processed and insights generated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze meeting",
        variant: "destructive",
      });
    },
  });

  const handleAnalyze = (transcript: string) => {
    analyzeMutation.mutate(transcript);
  };

  const handleReset = () => {
    setResult(null);
  };

  const handleViewDashboard = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <Sidebar />
      <MobileHeader title="New Meeting" subtitle="Analyze a transcript" />

      <main className="flex-1 overflow-hidden">
        <header className="hidden md:block bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-6">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">New Meeting Analysis</h1>
            <p className="text-slate-600 mt-1 text-sm md:text-base">Paste your meeting transcript to extract insights and action items</p>
          </div>
        </header>

        <div className="p-4 md:p-8 h-full overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-4 md:space-y-8">
            {!result && (
              <TranscriptInput
                onAnalyze={handleAnalyze}
                isAnalyzing={analyzeMutation.isPending}
              />
            )}

            {analyzeMutation.isPending && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 md:p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-slate-600 text-sm md:text-base">Analyzing your meeting transcript...</p>
                <p className="text-xs md:text-sm text-slate-500 mt-1">This usually takes 3-8 seconds</p>
              </div>
            )}

            {result && (
              <>
                <MeetingSummary result={result} />

                <div className="flex flex-col sm:flex-row justify-center gap-3 md:gap-4">
                  <Button onClick={handleReset} variant="outline" className="w-full sm:w-auto">
                    Analyze Another Meeting
                  </Button>
                  <Button onClick={handleViewDashboard} className="w-full sm:w-auto">
                    View Dashboard
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
