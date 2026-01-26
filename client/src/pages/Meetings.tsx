import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Users, TrendingUp, MessageSquare } from "lucide-react";
import { Meeting } from "@shared/schema";

export default function Meetings() {
  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gets focus
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getEffectivenessColor = (score: number) => {
    if (score >= 8) return "bg-green-100 text-green-800 border-green-200";
    if (score >= 6) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      
      <main className="flex-1 overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Meeting History</h1>
            <p className="text-slate-600 mt-1">Browse and review your analyzed meeting transcripts</p>
          </div>
        </header>
        
        <div className="p-8 h-full overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-4 bg-slate-200 rounded"></div>
                      <div className="h-4 bg-slate-200 rounded w-4/5"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No meetings yet</h3>
              <p className="text-slate-600 mb-6">Start by analyzing your first meeting transcript</p>
              <Link href="/new-meeting">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Analyze Meeting
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {meetings
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((meeting) => (
                <Link key={meeting.id} href={`/meeting/${meeting.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg text-slate-900 mb-2">
                            {meeting.title}
                          </CardTitle>
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <div className="flex items-center gap-1">
                              <CalendarIcon className="w-4 h-4" />
                              {formatDate(meeting.date)}
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {meeting.participants?.length || 0} participants
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge 
                            variant="outline" 
                            className={`${getEffectivenessColor(meeting.effectivenessScore || 0)} flex items-center gap-1`}
                          >
                            <TrendingUp className="w-3 h-3" />
                            {meeting.effectivenessScore || 0}/10
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-sm font-medium text-slate-900 mb-1">Key Takeaways</h4>
                          <div className="text-sm text-slate-600">
                            {meeting.keyTakeaways && meeting.keyTakeaways.length > 0 ? (
                              <ul className="list-disc list-inside space-y-1">
                                {meeting.keyTakeaways.slice(0, 2).map((takeaway, index) => (
                                  <li key={index} className="truncate">{takeaway}</li>
                                ))}
                                {meeting.keyTakeaways.length > 2 && (
                                  <li className="text-blue-600 font-medium">
                                    +{meeting.keyTakeaways.length - 2} more insights...
                                  </li>
                                )}
                              </ul>
                            ) : (
                              <p className="text-slate-400 italic">No key takeaways recorded</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-slate-500">
                            {meeting.participants?.join(", ") || "No participants listed"}
                          </div>
                          <div className="text-blue-600 font-medium">
                            View Full Analysis →
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}