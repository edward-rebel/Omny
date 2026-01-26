import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, CheckCircle, AlertCircle, BarChart3, Users } from "lucide-react";
import { Sidebar, MobileHeader } from "@/components/Sidebar";
import type { Meeting } from "@shared/schema";

export default function Insights() {
  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
  });

  const { data: metaInsights, isLoading: isLoadingInsights } = useQuery({
    queryKey: ["/api/insights"],
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  if (isLoading || isLoadingInsights) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
        <Sidebar />
        <MobileHeader title="Insights" subtitle="Loading..." />
        <main className="flex-1 overflow-hidden">
          <header className="hidden md:block bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-6">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Meeting Analysis Insights</h1>
              <p className="text-slate-600 mt-1 text-sm md:text-base">Loading your meeting patterns and trends...</p>
            </div>
          </header>
          <div className="p-4 md:p-8 animate-pulse space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 md:h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="h-64 md:h-96 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
        <Sidebar />
        <MobileHeader title="Insights" subtitle="Meeting patterns" />
        <main className="flex-1 overflow-hidden">
          <header className="hidden md:block bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-6">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Meeting Analysis Insights</h1>
              <p className="text-slate-600 mt-1 text-sm md:text-base">Patterns and trends from your meetings</p>
            </div>
          </header>
          <div className="p-4 md:p-8">
            <div className="text-center py-8 md:py-12">
              <BarChart3 className="w-12 h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-2">No Meeting Data</h2>
              <p className="text-gray-600 mb-6 text-sm md:text-base">
                Add some meetings to see analysis insights and patterns.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const totalMeetings = meetings.length;
  const averageScore = meetings.length > 0
    ? Math.round((meetings.reduce((sum, m) => sum + m.effectivenessScore, 0) / meetings.length) * 10) / 10
    : 0;

  const allStrengths: string[] = [];
  const allImprovements: string[] = [];

  meetings.forEach(meeting => {
    allStrengths.push(...meeting.wentWell);
    allImprovements.push(...meeting.areasToImprove);
  });

  const strengthCounts = allStrengths.reduce((counts, item) => {
    const cleaned = item.toLowerCase().trim();
    counts[cleaned] = (counts[cleaned] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  const improvementCounts = allImprovements.reduce((counts, item) => {
    const cleaned = item.toLowerCase().trim();
    counts[cleaned] = (counts[cleaned] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  const topStrengths = Object.entries(strengthCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8);

  const topImprovements = Object.entries(improvementCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8);

  const recentMeetings = meetings.slice(0, Math.min(5, meetings.length));
  const olderMeetings = meetings.slice(Math.min(5, meetings.length));

  const recentAvg = recentMeetings.length > 0
    ? recentMeetings.reduce((sum, m) => sum + m.effectivenessScore, 0) / recentMeetings.length
    : 0;
  const olderAvg = olderMeetings.length > 0
    ? olderMeetings.reduce((sum, m) => sum + m.effectivenessScore, 0) / olderMeetings.length
    : recentAvg;

  const scoreChange = Math.round((recentAvg - olderAvg) * 10) / 10;

  const allParticipants = new Set<string>();
  meetings.forEach(meeting => {
    meeting.participants.forEach(p => allParticipants.add(p.toLowerCase()));
  });

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <Sidebar />
      <MobileHeader title="Insights" subtitle={`${totalMeetings} meetings analyzed`} />

      <main className="flex-1 overflow-hidden">
        <header className="hidden md:block bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-6">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Meeting Analysis Insights</h1>
            <p className="text-slate-600 mt-1 text-sm md:text-base">
              Patterns and trends from your {totalMeetings} meetings
            </p>
          </div>
        </header>

        <div className="p-4 md:p-8 h-full overflow-y-auto space-y-4 md:space-y-6">

          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium">Total Meetings</CardTitle>
                <BarChart3 className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0">
                <div className="text-xl md:text-2xl font-bold">{totalMeetings}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium">Average Score</CardTitle>
                {scoreChange > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-600" />
                ) : scoreChange < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5 md:h-4 md:w-4 text-red-600" />
                ) : (
                  <BarChart3 className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                )}
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0">
                <div className="text-xl md:text-2xl font-bold">{averageScore}/10</div>
                <Progress value={averageScore * 10} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium">Score Trend</CardTitle>
                {scoreChange > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-600" />
                ) : scoreChange < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5 md:h-4 md:w-4 text-red-600" />
                ) : (
                  <BarChart3 className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                )}
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0">
                <div className="text-xl md:text-2xl font-bold">
                  {scoreChange > 0 ? '+' : ''}{scoreChange}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Recent vs older
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium">Participants</CardTitle>
                <Users className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0">
                <div className="text-xl md:text-2xl font-bold">{allParticipants.size}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Unique people
                </p>
              </CardContent>
            </Card>
          </div>

          {/* AI-Generated Narrative Insights */}
          {metaInsights && (metaInsights.narrativeWentWell || metaInsights.narrativeAreasToImprove) ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <Card>
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                    What Tends to Go Well
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    AI-generated insights from your meeting patterns
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0">
                  {metaInsights.narrativeWentWell ? (
                    <div className="bg-green-50 rounded-lg p-3 md:p-4 border border-green-200">
                      <p className="text-slate-700 leading-relaxed text-xs md:text-sm">{metaInsights.narrativeWentWell}</p>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4 text-sm">
                      No narrative insights generated yet
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
                    Areas That Can Be Improved
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    AI-generated improvement recommendations
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0">
                  {metaInsights.narrativeAreasToImprove ? (
                    <div className="bg-orange-50 rounded-lg p-3 md:p-4 border border-orange-200">
                      <p className="text-slate-700 leading-relaxed text-xs md:text-sm">{metaInsights.narrativeAreasToImprove}</p>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4 text-sm">
                      No improvement insights generated yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <Card>
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                    What Went Well
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    Most common strengths across all meetings
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0 space-y-2 md:space-y-3">
                  {topStrengths.length > 0 ? (
                    topStrengths.map(([strength, count]) => (
                      <div key={strength} className="flex items-center justify-between p-2 md:p-3 bg-green-50 rounded-lg border border-green-200">
                        <span className="text-xs md:text-sm font-medium text-green-900 capitalize">
                          {strength}
                        </span>
                        <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                          {count}x
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4 text-sm">
                      No strengths recorded yet
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
                    Areas to Improve
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    Most common improvement opportunities
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0 space-y-2 md:space-y-3">
                  {topImprovements.length > 0 ? (
                    topImprovements.map(([improvement, count]) => (
                      <div key={improvement} className="flex items-center justify-between p-2 md:p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <span className="text-xs md:text-sm font-medium text-orange-900 capitalize">
                          {improvement}
                        </span>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
                          {count}x
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4 text-sm">
                      No improvement areas recorded yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Recent Meetings Preview */}
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-base md:text-lg">Recent Meeting Scores</CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Effectiveness scores from your latest meetings
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="space-y-2 md:space-y-3">
                {meetings.slice(0, 5).map((meeting, index) => (
                  <div key={meeting.id} className="flex items-center justify-between p-2 md:p-3 bg-gray-50 rounded-lg gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs md:text-sm truncate">{meeting.title}</div>
                      <div className="text-xs text-gray-500">{meeting.date}</div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-xs md:text-sm font-semibold">{meeting.effectivenessScore}/10</div>
                        <Progress
                          value={meeting.effectivenessScore * 10}
                          className="w-12 md:w-16 h-1.5 md:h-2"
                        />
                      </div>
                      {index === 0 && (
                        <Badge variant="secondary" className="text-xs hidden sm:inline-flex">Latest</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
