import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { Sidebar, MobileHeader } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { CalendarIcon, Users, TrendingUp, MessageSquare, Trash2, Search, X, Zap } from "lucide-react";
import { Meeting } from "@shared/schema";

export default function Meetings() {
  const queryClient = useQueryClient();
  const [meetingToDelete, setMeetingToDelete] = useState<Meeting | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [effectivenessFilter, setEffectivenessFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const deleteMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete meeting");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setMeetingToDelete(null);
    },
  });

  const handleDeleteClick = (e: React.MouseEvent, meeting: Meeting) => {
    e.preventDefault();
    e.stopPropagation();
    setMeetingToDelete(meeting);
  };

  const confirmDelete = () => {
    if (meetingToDelete) {
      deleteMutation.mutate(meetingToDelete.id);
    }
  };

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

  const filteredMeetings = useMemo(() => {
    return meetings.filter((meeting) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === "" ||
        meeting.title.toLowerCase().includes(searchLower) ||
        meeting.summary?.toLowerCase().includes(searchLower) ||
        meeting.participants?.some(p => p.toLowerCase().includes(searchLower)) ||
        meeting.keyTakeaways?.some(k => k.toLowerCase().includes(searchLower));

      // Effectiveness filter
      let matchesEffectiveness = true;
      const score = meeting.effectivenessScore || 0;
      if (effectivenessFilter === "high") {
        matchesEffectiveness = score >= 8;
      } else if (effectivenessFilter === "medium") {
        matchesEffectiveness = score >= 6 && score < 8;
      } else if (effectivenessFilter === "low") {
        matchesEffectiveness = score < 6;
      }

      // Date filter
      let matchesDate = true;
      const meetingDate = new Date(meeting.date);
      const now = new Date();
      if (dateFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesDate = meetingDate >= weekAgo;
      } else if (dateFilter === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchesDate = meetingDate >= monthAgo;
      } else if (dateFilter === "quarter") {
        const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        matchesDate = meetingDate >= quarterAgo;
      }

      return matchesSearch && matchesEffectiveness && matchesDate;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [meetings, searchQuery, effectivenessFilter, dateFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setEffectivenessFilter("all");
    setDateFilter("all");
  };

  const hasActiveFilters = searchQuery !== "" || effectivenessFilter !== "all" || dateFilter !== "all";

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <Sidebar />
      <MobileHeader title="Meeting History" subtitle="Browse your meetings" />

      <main className="flex-1 overflow-hidden">
        <header className="hidden md:block bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-6">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Meeting History</h1>
            <p className="text-slate-600 mt-1 text-sm md:text-base">Browse and review your analyzed meeting transcripts</p>
          </div>
        </header>

        {/* Search and Filter Bar */}
        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-3 md:py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search meetings by title, summary, participants..."
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
              <Select value={effectivenessFilter} onValueChange={setEffectivenessFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Effectiveness" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Scores</SelectItem>
                  <SelectItem value="high">High (8-10)</SelectItem>
                  <SelectItem value="medium">Medium (6-7)</SelectItem>
                  <SelectItem value="low">Low (1-5)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="week">Past Week</SelectItem>
                  <SelectItem value="month">Past Month</SelectItem>
                  <SelectItem value="quarter">Past 3 Months</SelectItem>
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
          {hasActiveFilters && (
            <p className="text-xs text-slate-500 mt-2">
              Showing {filteredMeetings.length} of {meetings.length} meetings
            </p>
          )}
        </div>

        <div className="p-4 md:p-8 h-full overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3 md:space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="p-4 md:p-6">
                    <div className="h-5 md:h-6 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2 mt-2"></div>
                  </CardHeader>
                  <CardContent className="p-4 md:p-6 pt-0">
                    <div className="space-y-2">
                      <div className="h-4 bg-slate-200 rounded"></div>
                      <div className="h-4 bg-slate-200 rounded w-4/5"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-8 md:py-12">
              <MessageSquare className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-base md:text-lg font-medium text-slate-900 mb-2">No meetings yet</h3>
              <p className="text-slate-600 mb-6 text-sm md:text-base">Start by analyzing your first meeting transcript</p>
              <Link href="/new-meeting">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm md:text-base">
                  Analyze Meeting
                </button>
              </Link>
            </div>
          ) : filteredMeetings.length === 0 ? (
            <div className="text-center py-8 md:py-12">
              <Search className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-base md:text-lg font-medium text-slate-900 mb-2">No matching meetings</h3>
              <p className="text-slate-600 mb-6 text-sm md:text-base">Try adjusting your search or filters</p>
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {filteredMeetings.map((meeting) => (
                <Link key={meeting.id} href={`/meeting/${meeting.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
                    <CardHeader className="p-4 md:p-6 pb-2 md:pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base md:text-lg text-slate-900 mb-2 truncate">
                            {meeting.title}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-slate-600">
                            <div className="flex items-center gap-1">
                              <CalendarIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              {formatDate(meeting.date)}
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              {meeting.participants?.length || 0} participants
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(meeting as any).source === 'zapier' && (
                            <Badge className="bg-purple-100 text-purple-700 border-purple-200 flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              Auto
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={`${getEffectivenessColor(meeting.effectivenessScore || 0)} flex items-center gap-1`}
                          >
                            <TrendingUp className="w-3 h-3" />
                            {meeting.effectivenessScore || 0}/10
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={(e) => handleDeleteClick(e, meeting)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6 pt-0">
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-xs md:text-sm font-medium text-slate-900 mb-1">Key Takeaways</h4>
                          <div className="text-xs md:text-sm text-slate-600">
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

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs md:text-sm">
                          <div className="text-slate-500 truncate">
                            {meeting.participants?.join(", ") || "No participants listed"}
                          </div>
                          <div className="text-blue-600 font-medium shrink-0">
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

      <AlertDialog open={!!meetingToDelete} onOpenChange={(open) => !open && setMeetingToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{meetingToDelete?.title}"? This will also delete all associated tasks. This action cannot be undone.
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
