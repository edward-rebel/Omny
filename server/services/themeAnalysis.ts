import OpenAI from "openai";
import { storage } from "../storage";
import { getUserSpecificPrompt } from "./systemPrompts";
import type { Project } from "@shared/schema";

interface ThemeAnalysisResult {
  themes: Array<{
    name: string;
    description: string;
    reasoning?: string;
    projectIds: number[];
  }>;
}

// Create OpenAI client with dynamic API key support
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY || process.env.API_KEY || "";
  return new OpenAI({ apiKey });
}

function formatProjectsForPrompt(projects: Project[]): string {
  return projects.map((project) => (
    `Project ID: ${project.id}
Name: ${project.name}
Status: ${project.status}
Last Update: ${project.lastUpdate}
Context: ${project.context || "No context available"}`
  )).join("\n\n---\n\n");
}

function parseThemeResponse(responseContent: string): ThemeAnalysisResult {
  let cleanedContent = responseContent.trim();
  if (cleanedContent.startsWith("```json")) {
    cleanedContent = cleanedContent.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleanedContent.startsWith("```")) {
    cleanedContent = cleanedContent.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  const parsed = JSON.parse(cleanedContent) as ThemeAnalysisResult;
  if (!parsed.themes || !Array.isArray(parsed.themes)) {
    throw new Error("Invalid response structure from AI");
  }
  return parsed;
}

export async function analyzeProjectThemes(
  projects: Project[],
  userId: string
): Promise<ThemeAnalysisResult> {
  if (projects.length === 0) {
    return { themes: [] };
  }

  try {
    const user = await storage.getUser(userId);
    const userInfo = {
      displayName: user?.displayName || undefined,
      firstName: user?.firstName || undefined,
      email: user?.email || undefined,
    };

    const systemPrompt = await getUserSpecificPrompt("theme_generation", userInfo);
    if (!systemPrompt) {
      throw new Error("Theme generation system prompt not found");
    }

    const openai = getOpenAIClient();
    const prompt = `Generate project themes from the following project list:\n\n${formatProjectsForPrompt(projects)}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_completion_tokens: 2000,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response from OpenAI");
    }

    return parseThemeResponse(responseContent);
  } catch (error) {
    console.error("Theme analysis error:", error);
    return {
      themes: [
        {
          name: "General Focus",
          description: "A broad theme covering the current active projects.",
          reasoning: "Fallback theme due to analysis error.",
          projectIds: projects.map((project) => project.id),
        },
      ],
    };
  }
}
