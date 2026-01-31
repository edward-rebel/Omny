import OpenAI from 'openai';
import { storage } from '../storage';
import { getActivePrompt } from './systemPrompts';
import type { Project, Task } from '@shared/schema';

// Create OpenAI client with dynamic API key support
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY || process.env.API_KEY || '';
  return new OpenAI({ apiKey });
}

// Types for consolidation analysis
export interface ConsolidationGroup {
  sourceProjectIds: number[];
  keepProjectId: number;
  mergedName: string;
  mergedContext: string;
  reasoning: string;
}

interface OpenAIConsolidationResponse {
  consolidationGroups: ConsolidationGroup[];
}

export interface ProjectForAnalysis {
  id: number;
  name: string;
  context: string | null;
  updatesCount: number;
  tasksCount: number;
}

export interface ConsolidationPreview {
  success: boolean;
  originalProjectCount: number;
  proposedConsolidations: Array<{
    sourceProjects: Array<{ id: number; name: string; updatesCount: number; tasksCount: number }>;
    targetProject: { id: number; name: string };
    mergedName: string;
    mergedContext: string;
    reason: string;
  }>;
  noChanges: boolean;
  error?: string;
}

export interface ConsolidationResult {
  success: boolean;
  originalProjectCount: number;
  finalProjectCount: number;
  consolidations: Array<{
    sourceProjects: Array<{ id: number; name: string }>;
    targetProject: { id: number; name: string; mergedContext: string };
    updatesConsolidated: number;
    tasksReassigned: number;
    reason: string;
  }>;
  error?: string;
}

// Token estimation: ~0.4 tokens per character (conservative estimate for GPT)
const TOKENS_PER_CHAR = 0.4;
const MAX_TOKENS_PER_REQUEST = 80000;
const MAX_CONTEXT_LENGTH = 2000;
const MAX_PROJECTS_PER_BATCH = 30;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Helper to truncate text with ellipsis
 */
function truncateText(text: string | null, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Estimate token count for a set of projects
 */
function estimateTokens(projects: ProjectForAnalysis[]): number {
  let totalChars = 0;
  for (const project of projects) {
    totalChars += project.name.length;
    totalChars += (project.context || '').length;
  }
  return Math.ceil(totalChars * TOKENS_PER_CHAR);
}

/**
 * Call OpenAI with retry logic for rate limiting and server errors
 */
async function callOpenAIWithRetry(
  openai: OpenAI,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_completion_tokens: 4000,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('No response from OpenAI');
      }
      return responseContent;
    } catch (error: any) {
      lastError = error;

      // Check if it's a retryable error (rate limit or server error)
      const statusCode = error?.status || error?.response?.status;
      const isRetryable = statusCode === 429 || (statusCode >= 500 && statusCode < 600);

      if (isRetryable && attempt < MAX_RETRIES - 1) {
        const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.log(`OpenAI request failed with status ${statusCode}, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      // Not retryable or max retries reached
      throw error;
    }
  }

  throw lastError || new Error('OpenAI request failed after retries');
}

/**
 * Format projects for OpenAI analysis
 */
function formatProjectsForAnalysis(projects: ProjectForAnalysis[]): string {
  return projects.map(p => {
    const truncatedContext = truncateText(p.context, MAX_CONTEXT_LENGTH);
    return `Project ID: ${p.id}
Name: ${p.name}
Context: ${truncatedContext || 'No context available'}
Updates Count: ${p.updatesCount}
Tasks Count: ${p.tasksCount}`;
  }).join('\n\n---\n\n');
}

/**
 * Parse and validate OpenAI response
 */
function parseConsolidationResponse(
  responseContent: string,
  validProjectIds: Set<number>
): OpenAIConsolidationResponse {
  // Clean the response content - remove markdown code blocks if present
  let cleanedContent = responseContent.trim();
  if (cleanedContent.startsWith('```json')) {
    cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanedContent.startsWith('```')) {
    cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleanedContent) as OpenAIConsolidationResponse;

  // Validate structure
  if (!parsed.consolidationGroups || !Array.isArray(parsed.consolidationGroups)) {
    throw new Error('Invalid response structure: missing consolidationGroups array');
  }

  // Validate all project IDs exist
  for (const group of parsed.consolidationGroups) {
    if (!group.sourceProjectIds || !Array.isArray(group.sourceProjectIds)) {
      throw new Error('Invalid consolidation group: missing sourceProjectIds');
    }
    if (typeof group.keepProjectId !== 'number') {
      throw new Error('Invalid consolidation group: missing keepProjectId');
    }

    for (const id of group.sourceProjectIds) {
      if (!validProjectIds.has(id)) {
        throw new Error(`Invalid project ID in response: ${id}`);
      }
    }

    if (!validProjectIds.has(group.keepProjectId)) {
      throw new Error(`Invalid keepProjectId in response: ${group.keepProjectId}`);
    }

    if (!group.sourceProjectIds.includes(group.keepProjectId)) {
      throw new Error(`keepProjectId ${group.keepProjectId} must be in sourceProjectIds`);
    }
  }

  return parsed;
}

/**
 * Analyze projects for potential consolidation
 */
export async function analyzeProjectConsolidation(
  projects: Project[],
  tasks: Task[],
  userId: string
): Promise<ConsolidationPreview> {
  if (projects.length < 2) {
    return {
      success: true,
      originalProjectCount: projects.length,
      proposedConsolidations: [],
      noChanges: true,
    };
  }

  // Get the system prompt
  const systemPrompt = await getActivePrompt('project_consolidation');
  if (!systemPrompt) {
    return {
      success: false,
      originalProjectCount: projects.length,
      proposedConsolidations: [],
      noChanges: true,
      error: 'Project consolidation system prompt not found',
    };
  }

  // Prepare projects for analysis with task counts
  const projectsForAnalysis: ProjectForAnalysis[] = projects.map(p => ({
    id: p.id,
    name: p.name,
    context: p.context,
    updatesCount: p.updates.length,
    tasksCount: tasks.filter(t => t.projectId === p.id).length,
  }));

  const validProjectIds = new Set(projects.map(p => p.id));

  // Check if we need batching
  const estimatedTokens = estimateTokens(projectsForAnalysis);
  console.log(`Estimated tokens for ${projects.length} projects: ${estimatedTokens}`);

  try {
    const openai = getOpenAIClient();
    let allGroups: ConsolidationGroup[] = [];

    if (estimatedTokens > MAX_TOKENS_PER_REQUEST || projects.length > MAX_PROJECTS_PER_BATCH) {
      // Process in batches
      console.log(`Processing projects in batches due to size...`);

      for (let i = 0; i < projectsForAnalysis.length; i += MAX_PROJECTS_PER_BATCH) {
        const batch = projectsForAnalysis.slice(i, i + MAX_PROJECTS_PER_BATCH);
        const userPrompt = `Analyze these projects for potential consolidation:\n\n${formatProjectsForAnalysis(batch)}`;

        const responseContent = await callOpenAIWithRetry(openai, systemPrompt, userPrompt);
        const batchResult = parseConsolidationResponse(responseContent, validProjectIds);
        allGroups.push(...batchResult.consolidationGroups);
      }
    } else {
      // Process all at once
      const userPrompt = `Analyze these projects for potential consolidation:\n\n${formatProjectsForAnalysis(projectsForAnalysis)}`;
      const responseContent = await callOpenAIWithRetry(openai, systemPrompt, userPrompt);
      const result = parseConsolidationResponse(responseContent, validProjectIds);
      allGroups = result.consolidationGroups;
    }

    // Convert to preview format
    const proposedConsolidations = allGroups.map(group => {
      const sourceProjects = group.sourceProjectIds.map(id => {
        const p = projectsForAnalysis.find(proj => proj.id === id)!;
        return {
          id: p.id,
          name: p.name,
          updatesCount: p.updatesCount,
          tasksCount: p.tasksCount,
        };
      });

      const targetProject = projectsForAnalysis.find(p => p.id === group.keepProjectId)!;

      return {
        sourceProjects,
        targetProject: {
          id: targetProject.id,
          name: targetProject.name,
        },
        mergedName: group.mergedName,
        mergedContext: group.mergedContext,
        reason: group.reasoning,
      };
    });

    return {
      success: true,
      originalProjectCount: projects.length,
      proposedConsolidations,
      noChanges: proposedConsolidations.length === 0,
    };

  } catch (error: any) {
    console.error('Project consolidation analysis failed:', error);

    // Provide specific error messages
    let errorMessage = 'Failed to analyze projects';
    if (error?.status === 429) {
      errorMessage = 'OpenAI rate limit exceeded. Please try again later.';
    } else if (error?.status >= 500) {
      errorMessage = 'OpenAI service temporarily unavailable. Please try again later.';
    } else if (error?.message?.includes('API key')) {
      errorMessage = 'OpenAI API key not configured or invalid.';
    } else if (error instanceof SyntaxError) {
      errorMessage = 'Invalid response from AI. Please try again.';
    } else if (error?.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      originalProjectCount: projects.length,
      proposedConsolidations: [],
      noChanges: true,
      error: errorMessage,
    };
  }
}

/**
 * Execute the consolidation based on approved preview
 */
export async function executeConsolidation(
  consolidations: ConsolidationPreview['proposedConsolidations'],
  userId: string
): Promise<ConsolidationResult> {
  const projects = await storage.getAllProjects(userId);
  const originalCount = projects.length;
  const projectMap = new Map(projects.map(p => [p.id, p]));

  const results: ConsolidationResult['consolidations'] = [];
  const errors: string[] = [];

  // Track deleted projects to avoid double-deletion
  const deletedProjectIds = new Set<number>();

  for (const consolidation of consolidations) {
    try {
      // Validate all project IDs still exist
      const keepProjectId = consolidation.targetProject.id;
      const keepProject = projectMap.get(keepProjectId);

      if (!keepProject || deletedProjectIds.has(keepProjectId)) {
        errors.push(`Target project ${keepProjectId} no longer exists`);
        continue;
      }

      const sourceProjectIds = consolidation.sourceProjects
        .map(sp => sp.id)
        .filter(id => id !== keepProjectId);

      // Check all source projects exist
      const missingProjects = sourceProjectIds.filter(
        id => !projectMap.has(id) || deletedProjectIds.has(id)
      );
      if (missingProjects.length > 0) {
        errors.push(`Source projects ${missingProjects.join(', ')} no longer exist`);
        // Continue with available projects
        const availableSourceIds = sourceProjectIds.filter(
          id => projectMap.has(id) && !deletedProjectIds.has(id)
        );
        if (availableSourceIds.length === 0) {
          continue;
        }
      }

      // Merge the projects
      const mergeResult = await storage.mergeProjects(
        keepProjectId,
        sourceProjectIds.filter(id => !deletedProjectIds.has(id)),
        consolidation.mergedName,
        consolidation.mergedContext,
        userId
      );

      // Mark source projects as deleted
      sourceProjectIds.forEach(id => deletedProjectIds.add(id));

      results.push({
        sourceProjects: consolidation.sourceProjects
          .filter(sp => sp.id !== keepProjectId)
          .map(sp => ({ id: sp.id, name: sp.name })),
        targetProject: {
          id: keepProjectId,
          name: consolidation.mergedName,
          mergedContext: consolidation.mergedContext,
        },
        updatesConsolidated: mergeResult.updatesConsolidated,
        tasksReassigned: mergeResult.tasksReassigned,
        reason: consolidation.reason,
      });

    } catch (error: any) {
      console.error(`Failed to consolidate group:`, error);
      errors.push(error?.message || 'Unknown error during consolidation');
    }
  }

  // Calculate final project count
  const finalCount = originalCount - deletedProjectIds.size;

  return {
    success: errors.length === 0,
    originalProjectCount: originalCount,
    finalProjectCount: finalCount,
    consolidations: results,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}
