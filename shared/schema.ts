import { sql } from 'drizzle-orm';
import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  displayName: varchar("display_name"), // Custom display name for the user
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  participants: jsonb("participants").$type<string[]>().notNull(),
  rawTranscript: text("raw_transcript").notNull(),
  summary: text("summary"), // New: Concise meeting summary
  keyTakeaways: jsonb("key_takeaways").$type<string[]>().notNull(),
  topicsDiscussed: jsonb("topics_discussed").$type<string[]>(), // New: Topics discussed
  followUps: jsonb("follow_ups").$type<string[]>().notNull(),
  effectivenessScore: integer("effectiveness_score").notNull(),
  wentWell: jsonb("went_well").$type<string[]>().notNull(),
  areasToImprove: jsonb("areas_to_improve").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(), // "open" | "hold" | "done"
  lastUpdate: text("last_update").notNull(),
  context: text("context"), // Comprehensive project summary from meeting discussions
  updates: jsonb("updates").$type<Array<{
    meetingId: number;
    update: string;
    date: string;
  }>>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  meetingId: integer("meeting_id").references(() => meetings.id).notNull(),
  projectId: integer("project_id").references(() => projects.id),
  task: text("task").notNull(),
  owner: text("owner").notNull(), // user's name for their tasks, or other person's name
  due: text("due"), // optional date string
  priority: text("priority").notNull().default("medium"), // "low" | "medium" | "high" | "urgent"
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const metaInsights = pgTable("meta_insights", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  averageScore: integer("average_score").notNull(),
  totalMeetings: integer("total_meetings").notNull(),
  strengths: jsonb("strengths").$type<string[]>().notNull(),
  opportunities: jsonb("opportunities").$type<string[]>().notNull(),
  trends: jsonb("trends").$type<Record<string, number>>().notNull(),
  narrativeWentWell: text("narrative_went_well"), // AI-generated narrative about consistent strengths
  narrativeAreasToImprove: text("narrative_areas_to_improve"), // AI-generated narrative about improvement areas
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const systemPrompts = pgTable("system_prompts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  prompt: text("prompt").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMeetingSchema = createInsertSchema(meetings).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
});

export const insertMetaInsightsSchema = createInsertSchema(metaInsights).omit({
  id: true,
  lastUpdated: true,
});

export const insertSystemPromptSchema = createInsertSchema(systemPrompts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type MetaInsights = typeof metaInsights.$inferSelect;
export type InsertMetaInsights = z.infer<typeof insertMetaInsightsSchema>;
export type SystemPrompt = typeof systemPrompts.$inferSelect;
export type InsertSystemPrompt = z.infer<typeof insertSystemPromptSchema>;
