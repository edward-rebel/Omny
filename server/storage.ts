import { 
  meetings, 
  projects, 
  tasks, 
  metaInsights,
  systemPrompts,
  users,
  type Meeting, 
  type InsertMeeting,
  type Project,
  type InsertProject,
  type Task,
  type InsertTask,
  type MetaInsights,
  type InsertMetaInsights,
  type SystemPrompt,
  type InsertSystemPrompt,
  type User,
  type UpsertUser
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserDisplayName(userId: string, displayName: string): Promise<User>;
  
  // Meeting operations
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  getMeeting(id: number, userId: string): Promise<Meeting | undefined>;
  getAllMeetings(userId: string): Promise<Meeting[]>;
  getUserMeetings(userId: string): Promise<Meeting[]>;
  updateMeeting(id: number, updates: Partial<InsertMeeting>): Promise<Meeting | undefined>;
  
  // Project operations
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, updates: Partial<InsertProject>): Promise<Project | undefined>;
  getProject(id: number, userId: string): Promise<Project | undefined>;
  getAllProjects(userId: string): Promise<Project[]>;
  getProjectByName(name: string, userId: string): Promise<Project | undefined>;
  
  // Task operations
  createTask(task: InsertTask): Promise<Task>;
  getTasksByMeeting(meetingId: number): Promise<Task[]>;
  getTasksByProject(projectId: number): Promise<Task[]>;
  getTasksByProjectAndUser(projectId: number, userId: string): Promise<Task[]>;
  getTasksByOwner(owner: string, userId: string): Promise<Task[]>;
  updateTask(id: number, updates: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;
  getAllTasks(userId: string): Promise<Task[]>;
  
  // Meta insights operations
  getMetaInsights(userId: string): Promise<MetaInsights | undefined>;
  updateMetaInsights(userId: string, insights: Omit<InsertMetaInsights, 'userId'>): Promise<MetaInsights>;
  
  // System prompts operations
  getSystemPrompts(): Promise<SystemPrompt[]>;
  getSystemPrompt(name: string): Promise<SystemPrompt | undefined>;
  updateSystemPrompt(name: string, updates: Partial<InsertSystemPrompt>): Promise<SystemPrompt | undefined>;
  createSystemPrompt(prompt: InsertSystemPrompt): Promise<SystemPrompt>;
}

export class MemStorage implements IStorage {
  private meetings: Map<number, Meeting>;
  private projects: Map<number, Project>;
  private tasks: Map<number, Task>;
  private users: Map<string, User>;
  private systemPrompts: Map<string, SystemPrompt>;
  private metaInsights: MetaInsights | undefined;
  private currentMeetingId: number;
  private currentProjectId: number;
  private currentTaskId: number;
  private currentSystemPromptId: number;

  constructor() {
    this.meetings = new Map();
    this.projects = new Map();
    this.tasks = new Map();
    this.users = new Map();
    this.systemPrompts = new Map();
    this.metaInsights = undefined;
    this.currentMeetingId = 1;
    this.currentProjectId = 1;
    this.currentTaskId = 1;
    this.currentSystemPromptId = 1;
  }

  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = this.users.get(userData.id);
    const user: User = {
      id: userData.id || '',
      email: userData.email || '',
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      displayName: userData.displayName || null,
      profileImageUrl: userData.profileImageUrl || null,
      createdAt: existingUser?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.users.set(userData.id, user);
    return user;
  }

  async updateUserDisplayName(userId: string, displayName: string): Promise<User> {
    const existingUser = this.users.get(userId);
    if (!existingUser) {
      throw new Error("User not found");
    }
    
    const updatedUser: User = {
      ...existingUser,
      displayName,
      updatedAt: new Date(),
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const id = this.currentMeetingId++;
    const meeting: Meeting = {
      id,
      userId: insertMeeting.userId,
      title: insertMeeting.title,
      date: insertMeeting.date,
      participants: insertMeeting.participants || [],
      rawTranscript: insertMeeting.rawTranscript,
      summary: insertMeeting.summary || null,
      keyTakeaways: insertMeeting.keyTakeaways || [],
      topicsDiscussed: insertMeeting.topicsDiscussed || null,
      followUps: insertMeeting.followUps || [],
      effectivenessScore: insertMeeting.effectivenessScore || 0,
      wentWell: insertMeeting.wentWell || [],
      areasToImprove: insertMeeting.areasToImprove || [],
      createdAt: new Date(),
    };
    this.meetings.set(id, meeting);
    return meeting;
  }

  async getMeeting(id: number, userId: string): Promise<Meeting | undefined> {
    const meeting = this.meetings.get(id);
    return meeting?.userId === userId ? meeting : undefined;
  }

  async getAllMeetings(userId: string): Promise<Meeting[]> {
    return Array.from(this.meetings.values())
      .filter(meeting => meeting.userId === userId)
      .sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  async getUserMeetings(userId: string): Promise<Meeting[]> {
    return this.getAllMeetings(userId);
  }

  async updateMeeting(id: number, updates: Partial<InsertMeeting>): Promise<Meeting | undefined> {
    const meeting = this.meetings.get(id);
    if (!meeting) return undefined;
    
    const updatedMeeting = { 
      ...meeting, 
      ...updates,
      // Properly handle null/undefined for new optional fields
      summary: updates.summary !== undefined ? updates.summary : meeting.summary,
      topicsDiscussed: updates.topicsDiscussed !== undefined ? updates.topicsDiscussed : meeting.topicsDiscussed,
    };
    this.meetings.set(id, updatedMeeting);
    return updatedMeeting;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = this.currentProjectId++;
    const project: Project = {
      id,
      userId: insertProject.userId,
      name: insertProject.name,
      status: insertProject.status,
      lastUpdate: insertProject.lastUpdate,
      context: insertProject.context || null,
      updates: insertProject.updates || [],
      createdAt: new Date(),
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: number, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;

    const updatedProject = { ...project, ...updates };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async getProject(id: number, userId: string): Promise<Project | undefined> {
    const project = this.projects.get(id);
    return project?.userId === userId ? project : undefined;
  }

  async getAllProjects(userId: string): Promise<Project[]> {
    return Array.from(this.projects.values())
      .filter(project => project.userId === userId)
      .sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  async getProjectByName(name: string, userId: string): Promise<Project | undefined> {
    return Array.from(this.projects.values()).find(p => p.name === name && p.userId === userId);
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = this.currentTaskId++;
    const task: Task = {
      id,
      userId: insertTask.userId,
      meetingId: insertTask.meetingId,
      projectId: insertTask.projectId || null,
      task: insertTask.task,
      owner: insertTask.owner,
      due: insertTask.due || null,
      priority: insertTask.priority || "medium",
      completed: insertTask.completed || false,
      createdAt: new Date(),
    };
    this.tasks.set(id, task);
    return task;
  }

  async getTasksByMeeting(meetingId: number): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(t => t.meetingId === meetingId);
  }

  async getTasksByProject(projectId: number): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(t => t.projectId === projectId);
  }

  async getTasksByProjectAndUser(projectId: number, userId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(t => t.projectId === projectId && t.userId === userId);
  }

  async getTasksByOwner(owner: string, userId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(t => t.owner === owner && t.userId === userId);
  }

  async updateTask(id: number, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;

    const updatedTask = { ...task, ...updates };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  async deleteTask(id: number): Promise<boolean> {
    return this.tasks.delete(id);
  }

  async getAllTasks(userId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(task => task.userId === userId);
  }

  async getMetaInsights(userId: string): Promise<MetaInsights | undefined> {
    return this.metaInsights?.userId === userId ? this.metaInsights : undefined;
  }

  async updateMetaInsights(userId: string, insightsData: Omit<InsertMetaInsights, 'userId'>): Promise<MetaInsights> {
    const insights = { ...insightsData, userId };
    const metaInsights: MetaInsights = {
      id: 1,
      userId: insights.userId,
      averageScore: insights.averageScore,
      totalMeetings: insights.totalMeetings,
      strengths: insights.strengths,
      opportunities: insights.opportunities,
      trends: insights.trends,
      narrativeWentWell: insights.narrativeWentWell || null,
      narrativeAreasToImprove: insights.narrativeAreasToImprove || null,
      lastUpdated: new Date(),
    };
    this.metaInsights = metaInsights;
    return metaInsights;
  }

  async getSystemPrompts(): Promise<SystemPrompt[]> {
    return Array.from(this.systemPrompts.values());
  }

  async getSystemPrompt(name: string): Promise<SystemPrompt | undefined> {
    return this.systemPrompts.get(name);
  }

  async updateSystemPrompt(name: string, updates: Partial<InsertSystemPrompt>): Promise<SystemPrompt | undefined> {
    const existing = this.systemPrompts.get(name);
    if (!existing) return undefined;
    
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.systemPrompts.set(name, updated);
    return updated;
  }

  async createSystemPrompt(prompt: InsertSystemPrompt): Promise<SystemPrompt> {
    const systemPrompt: SystemPrompt = {
      id: this.currentSystemPromptId++,
      name: prompt.name,
      description: prompt.description,
      prompt: prompt.prompt,
      isActive: prompt.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.systemPrompts.set(prompt.name, systemPrompt);
    return systemPrompt;
  }
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserDisplayName(userId: string, displayName: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        displayName,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async createMeeting(meeting: InsertMeeting): Promise<Meeting> {
    const [created] = await db.insert(meetings).values({
      ...meeting,
      participants: meeting.participants as string[],
      keyTakeaways: meeting.keyTakeaways as string[],
      topicsDiscussed: meeting.topicsDiscussed as string[] | null,
      followUps: meeting.followUps as string[],
      wentWell: meeting.wentWell as string[],
      areasToImprove: meeting.areasToImprove as string[]
    }).returning();
    return created;
  }

  async getMeeting(id: number, userId: string): Promise<Meeting | undefined> {
    const [meeting] = await db.select().from(meetings)
      .where(and(eq(meetings.id, id), eq(meetings.userId, userId)));
    return meeting || undefined;
  }

  async getAllMeetings(userId: string): Promise<Meeting[]> {
    const allMeetings = await db.select().from(meetings)
      .where(eq(meetings.userId, userId))
      .orderBy(desc(meetings.createdAt));
    return allMeetings;
  }

  async getUserMeetings(userId: string): Promise<Meeting[]> {
    return this.getAllMeetings(userId);
  }

  async updateMeeting(id: number, updates: Partial<InsertMeeting>): Promise<Meeting | undefined> {
    const [updated] = await db.update(meetings)
      .set({
        ...updates,
        participants: updates.participants as string[] | undefined,
        keyTakeaways: updates.keyTakeaways as string[] | undefined,
        topicsDiscussed: updates.topicsDiscussed as string[] | null | undefined,
        followUps: updates.followUps as string[] | undefined,
        wentWell: updates.wentWell as string[] | undefined,
        areasToImprove: updates.areasToImprove as string[] | undefined
      })
      .where(eq(meetings.id, id))
      .returning();
    return updated || undefined;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [created] = await db.insert(projects).values({
      ...project,
      updates: project.updates as { meetingId: number; update: string; date: string; }[]
    }).returning();
    return created;
  }

  async updateProject(id: number, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db.update(projects)
      .set({
        ...updates,
        updates: updates.updates as { meetingId: number; update: string; date: string; }[] | undefined
      })
      .where(eq(projects.id, id))
      .returning();
    return updated || undefined;
  }

  async getProject(id: number, userId: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)));
    return project || undefined;
  }

  async getAllProjects(userId: string): Promise<Project[]> {
    const allProjects = await db.select().from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.lastUpdate));
    return allProjects;
  }

  async getProjectByName(name: string, userId: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects)
      .where(and(eq(projects.name, name), eq(projects.userId, userId)));
    return project || undefined;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [created] = await db.insert(tasks).values(task).returning();
    return created;
  }

  async getTasksByMeeting(meetingId: number): Promise<Task[]> {
    const meetingTasks = await db.select().from(tasks).where(eq(tasks.meetingId, meetingId));
    return meetingTasks;
  }

  async getTasksByProject(projectId: number): Promise<Task[]> {
    const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId));
    return projectTasks;
  }

  async getTasksByProjectAndUser(projectId: number, userId: string): Promise<Task[]> {
    const projectTasks = await db.select().from(tasks)
      .where(and(eq(tasks.projectId, projectId), eq(tasks.userId, userId)));
    return projectTasks;
  }

  async getTasksByOwner(owner: string, userId: string): Promise<Task[]> {
    const ownerTasks = await db.select().from(tasks)
      .where(and(eq(tasks.owner, owner), eq(tasks.userId, userId)));
    return ownerTasks;
  }

  async updateTask(id: number, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const [updated] = await db.update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTask(id: number): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getAllTasks(userId: string): Promise<Task[]> {
    const allTasks = await db.select().from(tasks)
      .where(eq(tasks.userId, userId));
    return allTasks;
  }

  async getMetaInsights(userId: string): Promise<MetaInsights | undefined> {
    const [insights] = await db.select().from(metaInsights)
      .where(eq(metaInsights.userId, userId));
    return insights || undefined;
  }

  async updateMetaInsights(userId: string, insightsData: Omit<InsertMetaInsights, 'userId'>): Promise<MetaInsights> {
    console.log(`🔍 updateMetaInsights called with userId: ${userId}`, {
      insightsData: Object.keys(insightsData)
    });
    
    const existing = await this.getMetaInsights(userId);
    
    if (existing) {
      console.log(`📝 Updating existing meta insights for user ${userId}`);
      const [updated] = await db.update(metaInsights)
        .set({
          userId, // Explicitly set userId
          averageScore: insightsData.averageScore,
          totalMeetings: insightsData.totalMeetings,
          strengths: insightsData.strengths as string[],
          opportunities: insightsData.opportunities as string[],
          trends: insightsData.trends,
          narrativeWentWell: insightsData.narrativeWentWell || null,
          narrativeAreasToImprove: insightsData.narrativeAreasToImprove || null,
          lastUpdated: new Date()
        })
        .where(eq(metaInsights.userId, userId))
        .returning();
      return updated;
    } else {
      console.log(`🆕 Creating new meta insights for user ${userId}`);
      const [created] = await db.insert(metaInsights).values({
        userId, // Explicitly set userId
        averageScore: insightsData.averageScore,
        totalMeetings: insightsData.totalMeetings,
        strengths: insightsData.strengths as string[],
        opportunities: insightsData.opportunities as string[],
        trends: insightsData.trends,
        narrativeWentWell: insightsData.narrativeWentWell || null,
        narrativeAreasToImprove: insightsData.narrativeAreasToImprove || null
      }).returning();
      return created;
    }
  }

  async getSystemPrompts(): Promise<SystemPrompt[]> {
    const prompts = await db.select().from(systemPrompts);
    return prompts;
  }

  async getSystemPrompt(name: string): Promise<SystemPrompt | undefined> {
    const [prompt] = await db.select().from(systemPrompts).where(eq(systemPrompts.name, name));
    return prompt || undefined;
  }

  async updateSystemPrompt(name: string, updates: Partial<InsertSystemPrompt>): Promise<SystemPrompt | undefined> {
    const [updated] = await db.update(systemPrompts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(systemPrompts.name, name))
      .returning();
    return updated || undefined;
  }

  async createSystemPrompt(prompt: InsertSystemPrompt): Promise<SystemPrompt> {
    const [created] = await db.insert(systemPrompts).values(prompt).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
