import type { Meeting, Project, Task, MetaInsights } from "@shared/schema";

export interface DashboardData {
  myTasks: Task[];
  othersTasks: Task[];
  latestMeeting: Meeting | null;
  projects: Project[];
  metaInsights: MetaInsights | null;
  stats: {
    totalMeetings: number;
    totalProjects: number;
    totalTasks: number;
  };
}

export interface ProjectWithTasks extends Project {
  openTasksCount: number;
  openTasks: Task[];
}

export interface ProjectDetailData {
  project: Project;
  tasks: Task[];
  relatedMeetings: Meeting[];
}

export interface AnalysisResult {
  meeting: Meeting;
  tasks: Task[];
  projects: Project[];
  analysis: {
    meeting: {
      title: string;
      date: string;
      participants: string[];
    };
    summary?: string; // New: Concise meeting summary
    key_takeaways: string[];
    topics_discussed?: string[]; // New: Topics discussed
    action_items: {
      user: Array<{ task: string; due?: string; priority?: string }>;
      others: Array<{ task: string; owner: string; due?: string; priority?: string }>;
    };
    follow_ups: string[];
    projects: Array<{
      name: string;
      update: string;
      status: "open" | "hold" | "done";
    }>;
    effectiveness: {
      score: number;
      went_well: string[];
      improve: string[];
    };
  };
}
