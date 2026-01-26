import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeMeetingTranscript } from "./services/openai";
import { analyzeProjectRelationships, processProjectAnalysis } from "./services/projectAnalysis";
import { updateInsightsWithNarrative } from "./services/analytics";
import { getUserSpecificPrompt } from "./services/systemPrompts";
import { insertMeetingSchema, insertTaskSchema, insertProjectSchema, insertSystemPromptSchema, type Project, tasks, projects, meetings, metaInsights } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import OpenAI from 'openai';

// Store for runtime API key updates
let runtimeApiKey: string | null = null;

const LOCAL_USER_ID = "local-user";
const LOCAL_USER_INFO = {
  displayName: "Local User",
  firstName: "Local",
  email: "local@localhost",
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Analyze meeting transcript
  app.post("/api/analyze", async (req: any, res) => {
    try {
      const { raw_transcript } = req.body;
      
      if (!raw_transcript || typeof raw_transcript !== 'string') {
        return res.status(400).json({ message: "raw_transcript is required and must be a string" });
      }

      // Get current user info for analysis
      const currentUser = await storage.getUser(LOCAL_USER_ID);
      const userInfo = {
        displayName: currentUser?.displayName || LOCAL_USER_INFO.displayName,
        firstName: LOCAL_USER_INFO.firstName,
        email: LOCAL_USER_INFO.email,
      };
      
      // Analyze with OpenAI using user-specific prompt
      const analysis = await analyzeMeetingTranscript(raw_transcript, userInfo);
      
      // Store meeting
      const userId = LOCAL_USER_ID;
      const meeting = await storage.createMeeting({
        userId,
        title: analysis.meeting.title,
        date: analysis.meeting.date,
        participants: analysis.meeting.participants,
        rawTranscript: raw_transcript,
        summary: analysis.summary,
        keyTakeaways: analysis.key_takeaways,
        topicsDiscussed: analysis.topics_discussed || [],
        followUps: analysis.follow_ups,
        effectivenessScore: analysis.effectiveness.score,
        wentWell: analysis.effectiveness.went_well,
        areasToImprove: analysis.effectiveness.improve,
      });

      // Store action items as tasks
      const tasks = [];
      
      // User's tasks - use display name first
      const currentUserData = await storage.getUser(userId);
      const userName = currentUserData?.displayName || LOCAL_USER_INFO.displayName;
      for (const item of analysis.action_items.user) {
        const task = await storage.createTask({
          userId,
          meetingId: meeting.id,
          projectId: null,
          task: item.task,
          owner: userName,
          due: item.due || null,
          priority: item.priority || "medium",
          completed: false,
        });
        tasks.push(task);
      }

      // Others' tasks
      for (const item of analysis.action_items.others) {
        const task = await storage.createTask({
          userId,
          meetingId: meeting.id,
          projectId: null,
          task: item.task,
          owner: item.owner,
          due: item.due || null,
          priority: item.priority || "medium",
          completed: false,
        });
        tasks.push(task);
      }

      // Enhanced project handling with AI analysis
      let projects: Project[] = [];
      if (analysis.projects && analysis.projects.length > 0) {
        try {
          // Analyze project relationships using AI
          const projectAnalysis = await analyzeProjectRelationships({
            newProjects: analysis.projects,
            meetingId: meeting.id,
            meetingTitle: analysis.meeting.title,
            meetingDate: analysis.meeting.date,
            userId,
          });

          // Process the analysis results
          projects = await processProjectAnalysis(
            projectAnalysis,
            analysis.projects,
            meeting.id,
            analysis.meeting.date,
            userId
          );

          console.log(`AI Project Analysis completed: ${projectAnalysis.projectMappings.length} mappings, ${projectAnalysis.taskAssignments.length} task assignments`);

        } catch (error) {
          console.error('Project analysis failed, falling back to simple creation:', error);
          
          // Fallback to original logic if AI analysis fails
          for (const projectData of analysis.projects) {
            let project = await storage.getProjectByName(projectData.name, userId);
            
            if (!project) {
              project = await storage.createProject({
                userId,
                name: projectData.name,
                status: projectData.status,
                lastUpdate: projectData.update,
                context: projectData.context,
                updates: [{
                  meetingId: meeting.id,
                  update: projectData.update,
                  date: analysis.meeting.date,
                }],
              });
            } else {
              const newUpdates = [...project.updates, {
                meetingId: meeting.id,
                update: projectData.update,
                date: analysis.meeting.date,
              }];
              
              project = await storage.updateProject(project.id, {
                status: projectData.status,
                lastUpdate: projectData.update,
                context: projectData.context || project.context,
                updates: newUpdates,
              });
            }
            
            if (project) {
              projects.push(project);
              
              // Simple task assignment fallback
              const projectTasks = tasks.filter(task => 
                task.task.toLowerCase().includes(projectData.name.toLowerCase())
              );
              
              for (const task of projectTasks) {
                await storage.updateTask(task.id, { projectId: project.id });
              }
            }
          }
        }
      }

      // Generate narrative insights after meeting analysis
      try {
        await updateInsightsWithNarrative(userId, meeting, userInfo);
        console.log('✓ Narrative insights generated and updated');
      } catch (error) {
        console.error('Failed to generate narrative insights:', error);
        // Don't fail the entire request if narrative generation fails
      }

      res.json({
        meeting,
        tasks,
        projects: projects as Project[],
        analysis,
      });

    } catch (error) {
      console.error("Analysis error:", error);
      const message = error instanceof Error ? error.message : "Failed to analyze meeting";
      res.status(500).json({ message });
    }
  });

  // Get dashboard data
  app.get("/api/dashboard", async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const userName = LOCAL_USER_INFO.displayName;
      const meetings = await storage.getAllMeetings(userId);
      const projects = await storage.getAllProjects(userId);
      const allTasks = await storage.getAllTasks(userId);
      const metaInsights = await storage.getMetaInsights(userId);

      const myTasks = allTasks.filter(task => {
        const owner = task.owner.toLowerCase();
        const userNameLower = userName.toLowerCase();
        return (owner === userNameLower || owner === "user") && !task.completed;
      });
      const othersTasks = allTasks.filter(task => {
        const owner = task.owner.toLowerCase();
        const userNameLower = userName.toLowerCase();
        return (owner !== userNameLower && owner !== "user") && !task.completed;
      });
      const latestMeeting = meetings[0] || null;
      const activeProjects = projects.filter(p => p.status === "open");

      res.json({
        myTasks: myTasks.slice(0, 10), // Top 10
        othersTasks: othersTasks.slice(0, 10),
        latestMeeting,
        projects: activeProjects,
        metaInsights,
        stats: {
          totalMeetings: meetings.length,
          totalProjects: projects.length,
          totalTasks: allTasks.length,
        }
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // Sync insights
  app.post("/api/sync", async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const insights = await syncInsights(userId);
      res.json(insights);
    } catch (error) {
      console.error("Sync error:", error);
      res.status(500).json({ message: "Failed to sync insights" });
    }
  });

  // Get project details
  app.get("/api/project/:id", async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const userId = LOCAL_USER_ID;
      const project = await storage.getProject(id, userId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const tasks = await storage.getTasksByProjectAndUser(id, userId);
      const meetings = await storage.getAllMeetings(userId);
      
      // Get meetings related to this project
      const relatedMeetings = meetings.filter(meeting =>
        project.updates.some(update => update.meetingId === meeting.id)
      );

      res.json({
        project,
        tasks,
        relatedMeetings,
      });
    } catch (error) {
      console.error("Project detail error:", error);
      res.status(500).json({ message: "Failed to fetch project details" });
    }
  });

  // Get all tasks
  app.get("/api/tasks", async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const tasks = await storage.getAllTasks(userId);
      res.json(tasks);
    } catch (error) {
      console.error("Error getting tasks:", error);
      res.status(500).json({ message: "Failed to get tasks" });
    }
  });

  // Update task completion
  app.patch("/api/task/:id", async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      const { completed, priority, task: taskText, owner } = req.body;
      const updates: any = {};
      
      if (typeof completed === 'boolean') {
        updates.completed = completed;
      }
      if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
        updates.priority = priority;
      }
      if (typeof taskText === 'string' && taskText.trim()) {
        updates.task = taskText.trim();
      }
      if (typeof owner === 'string' && owner.trim()) {
        updates.owner = owner.trim();
      }

      const task = await storage.updateTask(id, updates);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      res.json(task);
    } catch (error) {
      console.error("Task update error:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  // Delete task
  app.delete("/api/task/:id", async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      const success = await storage.deleteTask(id);
      if (!success) {
        return res.status(404).json({ message: "Task not found" });
      }

      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error("Task delete error:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Get all projects
  app.get("/api/projects", async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const projects = await storage.getAllProjects(userId);
      const projectsWithTasks = await Promise.all(
        projects.map(async (project) => {
          const tasks = await storage.getTasksByProjectAndUser(project.id, userId);
          const openTasks = tasks.filter(task => !task.completed);
          return {
            ...project,
            openTasksCount: openTasks.length,
            openTasks: openTasks.slice(0, 3), // First 3 open tasks for preview
          };
        })
      );

      res.json(projectsWithTasks);
    } catch (error) {
      console.error("Projects error:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Update OpenAI API key
  app.post("/api/settings/openai-key", async (req, res) => {
    try {
      const { apiKey } = req.body;
      
      if (!apiKey || typeof apiKey !== 'string') {
        return res.status(400).json({ message: "API key is required" });
      }

      if (!apiKey.startsWith('sk-')) {
        return res.status(400).json({ message: "Invalid API key format" });
      }

      // Store the API key for runtime use
      runtimeApiKey = apiKey;
      
      // Update the environment variable for the current process
      process.env.OPENAI_API_KEY = apiKey;

      res.json({ message: "API key updated successfully" });
    } catch (error) {
      console.error("API key update error:", error);
      res.status(500).json({ message: "Failed to update API key" });
    }
  });

  // Test OpenAI connection
  app.post("/api/test-openai", async (req, res) => {
    try {
      const apiKey = runtimeApiKey || process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        return res.status(400).json({ message: "No API key configured" });
      }

      const openai = new OpenAI({ apiKey });
      
      // Test with a simple completion
      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [{ role: "user", content: "Say 'API key is working'" }],
        max_tokens: 10,
      });

      if (response.choices[0]?.message?.content) {
        res.json({ 
          message: "API key is valid and working",
          model: "gpt-5.2",
          status: "connected"
        });
      } else {
        res.status(500).json({ message: "Unexpected response from OpenAI" });
      }
    } catch (error) {
      console.error("OpenAI test error:", error);
      if (error instanceof Error) {
        res.status(500).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to test API key" });
      }
    }
  });

  // Get system prompts
  app.get("/api/system-prompts", async (req, res) => {
    try {
      const prompts = await storage.getSystemPrompts();
      res.json(prompts);
    } catch (error) {
      console.error("Get system prompts error:", error);
      res.status(500).json({ message: "Failed to get system prompts" });
    }
  });

  // Update system prompt
  app.patch("/api/system-prompts/:name", async (req, res) => {
    try {
      const { name } = req.params;
      const updates = req.body;
      
      const updatedPrompt = await storage.updateSystemPrompt(name, updates);
      if (!updatedPrompt) {
        return res.status(404).json({ message: "System prompt not found" });
      }

      res.json(updatedPrompt);
    } catch (error) {
      console.error("Update system prompt error:", error);
      res.status(500).json({ message: "Failed to update system prompt" });
    }
  });

  // Create system prompt
  app.post("/api/system-prompts", async (req, res) => {
    try {
      const promptData = insertSystemPromptSchema.parse(req.body);
      const prompt = await storage.createSystemPrompt(promptData);
      res.json(prompt);
    } catch (error) {
      console.error("Create system prompt error:", error);
      res.status(500).json({ message: "Failed to create system prompt" });
    }
  });

  // Get narrative insights
  app.get("/api/insights", async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const metaInsights = await storage.getMetaInsights(userId);
      console.log(`📊 Returning insights to client:`, {
        hasNarrativeWentWell: !!metaInsights?.narrativeWentWell,
        hasNarrativeAreasToImprove: !!metaInsights?.narrativeAreasToImprove,
        totalMeetings: metaInsights?.totalMeetings || 0
      });
      res.json(metaInsights);
    } catch (error) {
      console.error("Error fetching insights:", error);
      res.status(500).json({ message: "Failed to fetch insights" });
    }
  });

  // Get all meetings
  app.get("/api/meetings", async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const meetings = await storage.getAllMeetings(userId);
      res.json(meetings);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      res.status(500).json({ message: "Failed to fetch meetings" });
    }
  });

  // Rerun analysis on all meetings
  app.post("/api/rerun-analysis", async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const userName = LOCAL_USER_INFO.displayName;
      const userInfo = {
        displayName: LOCAL_USER_INFO.displayName,
        firstName: LOCAL_USER_INFO.firstName,
        email: LOCAL_USER_INFO.email,
      };
      const meetings = await storage.getAllMeetings(userId);
      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      console.log(`Starting re-analysis of ${meetings.length} meetings...`);

      for (const meeting of meetings) {
        if (!meeting.rawTranscript || meeting.rawTranscript.trim() === '') {
          console.log(`Skipping meeting ${meeting.id} - no transcript available`);
          skippedCount++;
          continue;
        }

        try {
          console.log(`Re-analyzing meeting ${meeting.id}: ${meeting.title}`);
          
          // Clear existing data for this meeting first
          const existingTasks = await storage.getTasksByMeeting(meeting.id);
          for (const task of existingTasks) {
            await storage.deleteTask(task.id);
          }

          // Clear project updates for this meeting
          const allProjects = await storage.getAllProjects(userId);
          for (const project of allProjects) {
            const filteredUpdates = project.updates.filter(u => u.meetingId !== meeting.id);
            if (filteredUpdates.length !== project.updates.length) {
              await storage.updateProject(project.id, {
                updates: filteredUpdates
              });
            }
          }

          // Reset meeting data to just the transcript and basic info
          await storage.updateMeeting(meeting.id, {
            title: meeting.title, // Keep original title for now, will be updated by analysis
            participants: [],
            summary: null,
            keyTakeaways: [],
            topicsDiscussed: [],
            followUps: [],
            effectivenessScore: 0,
            wentWell: [],
            areasToImprove: [],
          });

          // Run fresh analysis
          const analysisResult = await analyzeMeetingTranscript(meeting.rawTranscript);
          
          if (!analysisResult) {
            throw new Error(`Analysis returned invalid result for meeting ${meeting.id}`);
          }

          // Update meeting with new analysis data
          await storage.updateMeeting(meeting.id, {
            title: analysisResult.meeting?.title || meeting.title,
            participants: analysisResult.meeting?.participants || [],
            summary: analysisResult.summary || null,
            keyTakeaways: analysisResult.key_takeaways || [],
            topicsDiscussed: analysisResult.topics_discussed || [],
            followUps: analysisResult.follow_ups || [],
            effectivenessScore: analysisResult.effectiveness?.score || 0,
            wentWell: analysisResult.effectiveness?.went_well || [],
            areasToImprove: analysisResult.effectiveness?.improve || [],
          });

          // Create new tasks from analysis
          if (analysisResult.action_items) {
            const edwardTasks = analysisResult.action_items.edward || [];
            const otherTasks = analysisResult.action_items.others || [];

            for (const item of edwardTasks) {
              await storage.createTask({
                userId,
                meetingId: meeting.id,
                task: item.task,
                owner: userName,
                due: item.due || null,
                priority: item.priority || "medium",
                completed: false,
                projectId: null,
              });
            }

            for (const item of otherTasks) {
              await storage.createTask({
                userId,
                meetingId: meeting.id,
                task: item.task,
                owner: item.owner || "Unknown",
                due: item.due || null,
                priority: item.priority || "medium",
                completed: false,
                projectId: null,
              });
            }
          }

          // Enhanced project handling with AI analysis for rerun
          if (analysisResult.projects && analysisResult.projects.length > 0) {
            try {
              // Analyze project relationships using AI
              const projectAnalysis = await analyzeProjectRelationships({
                newProjects: analysisResult.projects,
                meetingId: meeting.id,
                meetingTitle: analysisResult.meeting?.title || meeting.title,
                meetingDate: analysisResult.meeting?.date || meeting.date,
                userId,
              }, userInfo);

              // Process the analysis results
              await processProjectAnalysis(
                projectAnalysis,
                analysisResult.projects,
                meeting.id,
                analysisResult.meeting?.date || meeting.date,
                userId
              );

            } catch (error) {
              console.error('Project analysis failed during rerun, using fallback:', error);
              
              // Fallback to simple project creation/update
              for (const projectUpdate of analysisResult.projects) {
                let project = await storage.getProjectByName(projectUpdate.name, userId);
                
                if (!project) {
                  project = await storage.createProject({
                    userId,
                    name: projectUpdate.name,
                    status: projectUpdate.status || "open",
                    updates: [{
                      meetingId: meeting.id,
                      update: projectUpdate.update || "",
                      date: meeting.date
                    }],
                    lastUpdate: meeting.date,
                  });
                } else {
                  // Add update for this meeting
                  const updatedUpdates = [
                    ...project.updates,
                    {
                      meetingId: meeting.id,
                      update: projectUpdate.update || "",
                      date: meeting.date
                    }
                  ];
                  
                  await storage.updateProject(project.id, {
                    status: projectUpdate.status || project.status,
                    updates: updatedUpdates,
                    lastUpdate: meeting.date,
                  });
                }
              }
            }
          }

          successCount++;
          console.log(`✓ Successfully re-analyzed meeting ${meeting.id}: ${meeting.title}`);
        } catch (error) {
          errorCount++;
          console.error(`✗ Failed to re-analyze meeting ${meeting.id}:`, error instanceof Error ? error.message : error);
        }
      }

      // Sync insights after reprocessing
      try {
        await syncInsights();
      } catch (error) {
        console.error("Failed to sync insights:", error);
      }

      console.log(`Re-analysis complete: ${successCount} successful, ${errorCount} errors, ${skippedCount} skipped`);

      res.json({ 
        message: "Analysis completed",
        count: successCount,
        errors: errorCount,
        skipped: skippedCount,
        total: meetings.length
      });
    } catch (error) {
      console.error("Rerun analysis error:", error);
      res.status(500).json({ message: "Failed to rerun analysis" });
    }
  });

  // Get all meetings (legacy route - should be removed once frontend is updated)
  // Get specific meeting
  app.get("/api/meetings/:id", async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid meeting ID" });
      }

      const userId = LOCAL_USER_ID;
      const meeting = await storage.getMeeting(id, userId);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      res.json(meeting);
    } catch (error) {
      console.error("Meeting fetch error:", error);
      res.status(500).json({ message: "Failed to fetch meeting" });
    }
  });

  // Clear user data endpoint
  app.delete("/api/clear-data", async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      
      // Delete user data in correct order due to foreign key constraints
      await db.delete(tasks).where(eq(tasks.userId, userId));
      await db.delete(projects).where(eq(projects.userId, userId));
      await db.delete(meetings).where(eq(meetings.userId, userId));
      await db.delete(metaInsights).where(eq(metaInsights.userId, userId));
      
      res.json({ message: "All user data cleared successfully" });
    } catch (error) {
      console.error("Clear data error:", error);
      res.status(500).json({ message: "Failed to clear user data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
