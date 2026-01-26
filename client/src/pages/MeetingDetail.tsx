import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Sidebar } from "@/components/Sidebar";
import { MeetingSummary } from "@/components/MeetingSummary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Users, TrendingUp } from "lucide-react";
import { Meeting, Task, Project } from "@shared/schema";

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const meetingId = parseInt(id || '0');

  const { data: meeting, isLoading, error } = useQuery<Meeting>({
    queryKey: [`/api/meetings/${meetingId}`],
    enabled: !!meetingId,
  });

  // Get tasks for this meeting
  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: !!meetingId,
  });

  // Get all projects
  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!meetingId,
  });

  // Filter tasks for this specific meeting
  const meetingTasks = allTasks.filter(task => task.meetingId === meetingId);
  
  // Filter projects that have updates from this meeting
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

  if (isLoading || !meeting) {
    return (
      <div className="min-h-screen flex bg-slate-50">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <header className="bg-white border-b border-slate-200 px-8 py-6">
            <div className="animate-pulse">
              <div className="h-8 bg-slate-200 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            </div>
          </header>
          <div className="p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-64 bg-slate-200 rounded"></div>
              <div className="h-32 bg-slate-200 rounded"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen flex bg-slate-50">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <header className="bg-white border-b border-slate-200 px-8 py-6">
            <div className="flex items-center gap-4">
              <Link href="/meetings">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Meetings
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">Meeting Not Found</h1>
              </div>
            </div>
          </header>
          <div className="p-8 text-center">
            <p className="text-slate-600">The requested meeting could not be found.</p>
          </div>
        </main>
      </div>
    );
  }

  // Convert meeting data to the format expected by MeetingSummary
  const analysisResult = {
    meeting: meeting, // Pass the full meeting object to match the Meeting type
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
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      
      <main className="flex-1 overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/meetings">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Meetings
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-slate-900">{meeting.title}</h1>
              <div className="flex items-center gap-6 mt-2 text-sm text-slate-600">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(meeting.date)}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {meeting.participants?.length || 0} participants
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  Effectiveness: {meeting.effectivenessScore || 0}/10
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <div className="p-8 h-full overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <MeetingSummary result={analysisResult} />
            
            {meeting.rawTranscript && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Original Transcript</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono">
                      {meeting.rawTranscript}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}