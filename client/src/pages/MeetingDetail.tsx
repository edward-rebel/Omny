import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { useState } from "react";
import { Sidebar, MobileHeader } from "@/components/Sidebar";
import { MeetingSummary } from "@/components/MeetingSummary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft, Calendar, Users, TrendingUp, Trash2, Download } from "lucide-react";
import { Meeting, Task, Project } from "@shared/schema";
import { exportMeetingToPDF } from "@/lib/pdfExport";

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const meetingId = parseInt(id || '0');
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
      setLocation("/meetings");
    },
  });

  const confirmDelete = () => {
    deleteMutation.mutate(meetingId);
  };

  const handleExportPDF = () => {
    if (meeting) {
      exportMeetingToPDF({
        meeting,
        tasks: meetingTasks,
        projects: meetingProjects,
      });
    }
  };

  const { data: meeting, isLoading, error } = useQuery<Meeting>({
    queryKey: [`/api/meetings/${meetingId}`],
    enabled: !!meetingId,
  });

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: !!meetingId,
  });

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!meetingId,
  });

  const meetingTasks = allTasks.filter(task => task.meetingId === meetingId);

  const meetingProjects = allProjects.filter(project =>
    project.updates.some(update => update.meetingId === meetingId)
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading || !meeting) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
        <Sidebar />
        <MobileHeader title="Meeting" subtitle="Loading..." />
        <main className="flex-1 overflow-hidden">
          <header className="hidden md:block bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-6">
            <div className="animate-pulse">
              <div className="h-6 md:h-8 bg-slate-200 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            </div>
          </header>
          <div className="p-4 md:p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-48 md:h-64 bg-slate-200 rounded"></div>
              <div className="h-24 md:h-32 bg-slate-200 rounded"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
        <Sidebar />
        <MobileHeader title="Meeting Not Found" />
        <main className="flex-1 overflow-hidden">
          <header className="hidden md:block bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-6">
            <div className="flex items-center gap-4">
              <Link href="/meetings">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Meeting Not Found</h1>
              </div>
            </div>
          </header>
          <div className="p-4 md:p-8 text-center">
            <p className="text-slate-600">The requested meeting could not be found.</p>
            <Link href="/meetings">
              <Button className="mt-4">Back to Meetings</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const analysisResult = {
    meeting: meeting,
    tasks: meetingTasks,
    projects: meetingProjects,
    analysis: {
      meeting: {
        title: meeting.title,
        date: meeting.date,
        participants: meeting.participants || []
      },
      summary: meeting.summary || undefined,
      key_takeaways: meeting.keyTakeaways || [],
      topics_discussed: meeting.topicsDiscussed || [],
      action_items: {
        edward: meetingTasks
          .filter(task => ["edward", "ed", "Edward", "Ed"].includes(task.owner.toLowerCase()))
          .map(task => ({
            task: task.task,
            due: task.due || undefined,
            priority: task.priority as "low" | "medium" | "high" | "urgent"
          })),
        others: meetingTasks
          .filter(task => !["edward", "ed", "Edward", "Ed"].includes(task.owner.toLowerCase()))
          .map(task => ({
            task: task.task,
            owner: task.owner,
            due: task.due || undefined,
            priority: task.priority as "low" | "medium" | "high" | "urgent"
          }))
      },
      follow_ups: meeting.followUps || [],
      projects: meetingProjects.map(project => {
        const meetingUpdate = project.updates.find(update => update.meetingId === meetingId);
        return {
          name: project.name,
          update: meetingUpdate?.update || "",
          status: project.status as "open" | "hold" | "done"
        };
      }),
      effectiveness: {
        score: meeting.effectivenessScore || 0,
        went_well: meeting.wentWell || [],
        improve: meeting.areasToImprove || []
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <Sidebar />
      <MobileHeader title={meeting.title} subtitle={formatDateShort(meeting.date)} />

      <main className="flex-1 overflow-hidden">
        <header className="hidden md:block bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center gap-4">
            <Link href="/meetings">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Meetings
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold text-slate-900 truncate">{meeting.title}</h1>
              <div className="flex flex-wrap items-center gap-3 md:gap-6 mt-2 text-xs md:text-sm text-slate-600">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">{formatDate(meeting.date)}</span>
                  <span className="sm:hidden">{formatDateShort(meeting.date)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  {meeting.participants?.length || 0} participants
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  {meeting.effectivenessScore || 0}/10
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                onClick={handleExportPDF}
              >
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </header>

        {/* Mobile back button */}
        <div className="md:hidden px-4 py-2 bg-slate-50 flex items-center justify-between">
          <Link href="/meetings">
            <Button variant="ghost" size="sm" className="text-slate-600">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Meetings
            </Button>
          </Link>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-600 hover:bg-blue-50"
              onClick={handleExportPDF}
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-4 md:p-8 h-full overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <MeetingSummary result={analysisResult} />

            {meeting.rawTranscript && (
              <Card className="mt-4 md:mt-6">
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="text-base md:text-lg">Original Transcript</CardTitle>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0">
                  <div className="bg-slate-50 p-3 md:p-4 rounded-lg max-h-64 md:max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-xs md:text-sm text-slate-700 font-mono">
                      {meeting.rawTranscript}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{meeting.title}"? This will also delete all associated tasks. This action cannot be undone.
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
