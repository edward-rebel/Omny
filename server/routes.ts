import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeMeetingTranscript } from "./services/openai";
import { analyzeProjectRelationships, processProjectAnalysis } from "./services/projectAnalysis";
import { updateInsightsWithNarrative } from "./services/analytics";
import { getUserSpecificPrompt } from "./services/systemPrompts";
import { analyzeProjectConsolidation, executeConsolidation, type ConsolidationPreview } from "./services/projectConsolidation";
import { analyzeProjectThemes } from "./services/themeAnalysis";
import { insertMeetingSchema, insertTaskSchema, insertProjectSchema, insertSystemPromptSchema, type Project, tasks, projects, meetings, metaInsights } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import OpenAI from 'openai';
import { z } from "zod";

// Schema for webhook request validation
const webhookMeetingSchema = z.object({
  title: z.string().min(1, "Title is required"),
  created_time: z.string().min(1, "Created time is required"),
  transcript: z.string().min(1, "Transcript is required"),
});

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

  // Webhook endpoint for Zapier integration
  app.post("/api/webhook/meeting", async (req: any, res) => {
    try {
      // Validate API key
      const apiKeyHeader = req.headers["x-api-key"];
      if (!apiKeyHeader || typeof apiKeyHeader !== "string") {
        return res.status(401).json({ message: "Missing X-API-Key header" });
      }

      const apiKey = await storage.validateApiKey(apiKeyHeader);
      if (!apiKey) {
        return res.status(401).json({ message: "Invalid API key" });
      }

      // Update last used timestamp
      await storage.updateApiKeyLastUsed(apiKey.id);

      // Validate request body
      const parseResult = webhookMeetingSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          message: "Invalid request body",
          errors: parseResult.error.errors,
        });
      }

      const { title, created_time, transcript } = parseResult.data;

      // Get current user info for analysis
      const userId = LOCAL_USER_ID;
      const currentUser = await storage.getUser(userId);
      const userInfo = {
        displayName: currentUser?.displayName || LOCAL_USER_INFO.displayName,
        firstName: LOCAL_USER_INFO.firstName,
        email: LOCAL_USER_INFO.email,
      };

      // Analyze with OpenAI using user-specific prompt
      const analysis = await analyzeMeetingTranscript(transcript, userInfo);

      // Parse the created_time to get a date
      const meetingDate = new Date(created_time).toISOString().split("T")[0];

      // Store meeting with source: "zapier"
      const meeting = await storage.createMeeting({
        userId,
        title: title || analysis.meeting.title,
        date: meetingDate || analysis.meeting.date,
        participants: analysis.meeting.participants,
        rawTranscript: transcript,
        summary: analysis.summary,
        keyTakeaways: analysis.key_takeaways,
        topicsDiscussed: analysis.topics_discussed || [],
        followUps: analysis.follow_ups,
        effectivenessScore: analysis.effectiveness.score,
        wentWell: analysis.effectiveness.went_well,
        areasToImprove: analysis.effectiveness.improve,
        source: "zapier",
      });

      // Store action items as tasks
      const createdTasks = [];
      const currentUserData = await storage.getUser(userId);
      const userName = currentUserData?.displayName || LOCAL_USER_INFO.displayName;

      // User's tasks
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
        createdTasks.push(task);
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
        createdTasks.push(task);
      }

      // Process projects
      let createdProjects: Project[] = [];
      if (analysis.projects && analysis.projects.length > 0) {
        try {
          const projectAnalysis = await analyzeProjectRelationships({
            newProjects: analysis.projects,
            meetingId: meeting.id,
            meetingTitle: title || analysis.meeting.title,
            meetingDate: meetingDate || analysis.meeting.date,
            userId,
          });

          createdProjects = await processProjectAnalysis(
            projectAnalysis,
            analysis.projects,
            meeting.id,
            meetingDate || analysis.meeting.date,
            userId
          );
        } catch (error) {
          console.error("Project analysis failed in webhook:", error);
          // Fallback to simple creation
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
                  date: meetingDate || analysis.meeting.date,
                }],
              });
            }
            if (project) {
              createdProjects.push(project);
            }
          }
        }
      }

      // Generate narrative insights
      try {
        await updateInsightsWithNarrative(userId, meeting, userInfo);
      } catch (error) {
        console.error("Failed to generate narrative insights in webhook:", error);
      }

      console.log(`✓ Webhook: Created meeting ${meeting.id} with ${createdTasks.length} tasks and ${createdProjects.length} projects`);

      res.json({
        success: true,
        meeting_id: meeting.id,
        title: meeting.title,
        tasks_created: createdTasks.length,
        projects_created: createdProjects.length,
      });
    } catch (error) {
      console.error("Webhook error:", error);
      const message = error instanceof Error ? error.message : "Failed to process webhook";
      res.status(500).json({ success: false, message });
    }
  });

  // API Key management endpoints
  app.post("/api/settings/api-keys", async (req: any, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "Name is required" });
      }

      const { apiKey, plainKey } = await storage.createApiKey(name.trim());

      res.json({
        id: apiKey.id,
        name: apiKey.name,
        key: plainKey, // Only returned once on creation
        createdAt: apiKey.createdAt,
      });
    } catch (error) {
      console.error("Create API key error:", error);
      res.status(500).json({ message: "Failed to create API key" });
    }
  });

  app.get("/api/settings/api-keys", async (req: any, res) => {
    try {
      const keys = await storage.getApiKeys();

      // Mask the keys for security - only show first 8 characters
      const maskedKeys = keys.map((key) => ({
        id: key.id,
        name: key.name,
        keyPreview: key.key.substring(0, 12) + "..." + key.key.substring(key.key.length - 4),
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt,
      }));

      res.json(maskedKeys);
    } catch (error) {
      console.error("Get API keys error:", error);
      res.status(500).json({ message: "Failed to get API keys" });
    }
  });

  app.delete("/api/settings/api-keys/:id", async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid API key ID" });
      }

      const success = await storage.deleteApiKey(id);
      if (!success) {
        return res.status(404).json({ message: "API key not found" });
      }

      res.json({ message: "API key revoked successfully" });
    } catch (error) {
      console.error("Delete API key error:", error);
      res.status(500).json({ message: "Failed to revoke API key" });
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

  // Get all themes
  app.get("/api/themes", async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const themes = await storage.getThemes(userId);
      const allProjects = await storage.getAllProjects(userId);

      const themesWithProjects = themes.map((theme) => {
        const themeProjects = allProjects.filter((project) => project.themeId === theme.id);
        return {
          ...theme,
          projectCount: themeProjects.length,
          projects: themeProjects,
        };
      });

      res.json(themesWithProjects);
    } catch (error) {
      console.error("Themes error:", error);
      res.status(500).json({ message: "Failed to fetch themes" });
    }
  });

  // Get theme details
  app.get("/api/themes/:id", async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid theme ID" });
      }

      const userId = LOCAL_USER_ID;
      const theme = await storage.getTheme(id, userId);
      if (!theme) {
        return res.status(404).json({ message: "Theme not found" });
      }

      const allProjects = await storage.getAllProjects(userId);
      const themeProjects = allProjects.filter((project) => project.themeId === theme.id);

      res.json({
        theme,
        projects: themeProjects,
      });
    } catch (error) {
      console.error("Theme detail error:", error);
      res.status(500).json({ message: "Failed to fetch theme" });
    }
  });

  // Generate themes from active projects
  app.post("/api/themes/generate", async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const allProjects = await storage.getAllProjects(userId);
      const activeProjects = allProjects.filter((project) => project.status !== "done");
      const projectsForThemes = activeProjects.length > 0 ? activeProjects : allProjects;

      if (projectsForThemes.length === 0) {
        return res.json({ success: true, themes: [] });
      }

      const analysis = await analyzeProjectThemes(projectsForThemes, userId);
      const validProjectIds = new Set(projectsForThemes.map((project) => project.id));

      await storage.clearProjectThemes(userId);
      await storage.deleteThemesForUser(userId);

      const assignedProjectIds = new Set<number>();
      const createdThemes = [];

      for (const themeData of analysis.themes) {
        const filteredProjectIds = Array.from(new Set(themeData.projectIds)).filter(
          (id) => validProjectIds.has(id) && !assignedProjectIds.has(id)
        );
        if (filteredProjectIds.length === 0) {
          continue;
        }

        filteredProjectIds.forEach((id) => assignedProjectIds.add(id));

        const createdTheme = await storage.createTheme({
          userId,
          name: themeData.name,
          description: themeData.description,
          reasoning: themeData.reasoning || null,
        });

        for (const projectId of filteredProjectIds) {
          await storage.updateProjectTheme(projectId, createdTheme.id);
        }

        createdThemes.push(createdTheme);
      }

      const unassignedProjects = projectsForThemes.filter(
        (project) => !assignedProjectIds.has(project.id)
      );
      if (unassignedProjects.length > 0) {
        const fallbackTheme = await storage.createTheme({
          userId,
          name: "General Focus",
          description: "Projects that do not fit cleanly into other themes.",
          reasoning: "Assigned as a fallback for ungrouped projects.",
        });

        for (const project of unassignedProjects) {
          await storage.updateProjectTheme(project.id, fallbackTheme.id);
        }

        createdThemes.push(fallbackTheme);
      }

      res.json({ success: true, themes: createdThemes });
    } catch (error) {
      console.error("Theme generation error:", error);
      const message = error instanceof Error ? error.message : "Failed to generate themes";
      res.status(500).json({ success: false, message });
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
      max_completion_tokens: 10,
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

  // Delete meeting
  app.delete("/api/meetings/:id", async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid meeting ID" });
      }

      const userId = LOCAL_USER_ID;
      const success = await storage.deleteMeeting(id, userId);
      if (!success) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      res.json({ message: "Meeting deleted successfully" });
    } catch (error) {
      console.error("Meeting delete error:", error);
      res.status(500).json({ message: "Failed to delete meeting" });
    }
  });

  // Delete project
  app.delete("/api/projects/:id", async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const userId = LOCAL_USER_ID;
      const success = await storage.deleteProject(id, userId);
      if (!success) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      console.error("Project delete error:", error);
      res.status(500).json({ message: "Failed to delete project" });
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

  // Project consolidation preview endpoint
  app.post("/api/projects/consolidate/preview", async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const allProjects = await storage.getAllProjects(userId);
      const allTasks = await storage.getAllTasks(userId);

      console.log(`Analyzing ${allProjects.length} projects for consolidation...`);

      const preview = await analyzeProjectConsolidation(allProjects, allTasks, userId);

      if (!preview.success) {
        return res.status(500).json(preview);
      }

      console.log(`Consolidation preview: ${preview.proposedConsolidations.length} groups found`);
      res.json(preview);
    } catch (error) {
      console.error("Consolidation preview error:", error);
      const message = error instanceof Error ? error.message : "Failed to analyze projects";
      res.status(500).json({
        success: false,
        originalProjectCount: 0,
        proposedConsolidations: [],
        noChanges: true,
        error: message,
      });
    }
  });

  // Project consolidation execute endpoint
  app.post("/api/projects/consolidate/execute", async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const { consolidations } = req.body as { consolidations: ConsolidationPreview['proposedConsolidations'] };

      if (!consolidations || !Array.isArray(consolidations) || consolidations.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No consolidations provided",
        });
      }

      console.log(`Executing ${consolidations.length} project consolidations...`);

      const result = await executeConsolidation(consolidations, userId);

      console.log(`Consolidation complete: ${result.originalProjectCount} -> ${result.finalProjectCount} projects`);
      res.json(result);
    } catch (error) {
      console.error("Consolidation execute error:", error);
      const message = error instanceof Error ? error.message : "Failed to consolidate projects";
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
