import OpenAI from 'openai';
import { storage } from '../storage';
import { Project, Task } from '@shared/schema';
import { getUserSpecificPrompt } from './systemPrompts';

// Create OpenAI client
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY || process.env.API_KEY || '';
  return new OpenAI({ apiKey });
}

interface ProjectAnalysisInput {
  newProjects: Array<{
    name: string;
    update: string;
    context: string;
    status: "open" | "hold" | "done";
  }>;
  meetingId: number;
  meetingTitle: string;
  meetingDate: string;
  userId: string;
}

interface ProjectAnalysisResult {
  projectMappings: Array<{
    newProjectName: string;
    action: "create" | "merge";
    targetProjectId?: number;
    targetProjectName?: string;
    mergedName?: string;
    mergedContext?: string;
    reasoning: string;
  }>;
  taskAssignments: Array<{
    taskId: number;
    projectId: number;
    projectName: string;
    reasoning: string;
  }>;
}



export async function analyzeProjectRelationships(
  input: ProjectAnalysisInput,
  userInfo: { firstName?: string; email?: string }
): Promise<ProjectAnalysisResult> {
  try {
    // Get existing projects for this user
    const existingProjects = await storage.getAllProjects(input.userId);
    
    // Get all unassigned tasks from this meeting
    const allTasks = await storage.getAllTasks(input.userId);
    const meetingTasks = allTasks.filter(task => 
      task.meetingId === input.meetingId && !task.projectId
    );

    console.log(`Found ${meetingTasks.length} unassigned tasks from meeting ${input.meetingId} for project analysis`);

    // If no new projects or existing context, return empty result
    if (input.newProjects.length === 0) {
      return {
        projectMappings: [],
        taskAssignments: []
      };
    }

    const analysisPrompt = `
Meeting: "${input.meetingTitle}" (${input.meetingDate})

NEW PROJECTS MENTIONED:
${input.newProjects.map(p => `- ${p.name}: ${p.update} (Status: ${p.status})
  Context: ${p.context}`).join('\n\n')}

EXISTING PROJECTS:
${existingProjects.map(p => `- ID ${p.id}: ${p.name} - ${p.lastUpdate} (Status: ${p.status})
  Context: ${p.context || 'No context available'}`).join('\n\n') || 'No existing projects'}

UNASSIGNED TASKS FROM THIS MEETING:
${meetingTasks.map(t => `- ID ${t.id}: ${t.task} (Owner: ${t.owner}, Priority: ${t.priority})`).join('\n') || 'No unassigned tasks'}

Analyze the relationships based on both project names AND context. If merging projects, create an augmented context that combines information from both projects.`;

    // Get user info for project analysis
    const user = await storage.getUser(input.userId);
    const fullUserInfo = {
      displayName: user?.displayName || undefined,
      firstName: user?.firstName || undefined,
      email: user?.email || undefined
    };

    // Get user-specific system prompt
    const systemPrompt = await getUserSpecificPrompt('project_analysis', fullUserInfo);
    if (!systemPrompt) {
      throw new Error('Project analysis system prompt not found');
    }
    console.log('Using user-specific system prompt for project_analysis');

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: analysisPrompt }
      ],
      temperature: 0.1,
      max_completion_tokens: 2000,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    // Clean and parse the response
    let cleanedContent = responseContent.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const analysis = JSON.parse(cleanedContent) as ProjectAnalysisResult;
    
    // Validate the response structure
    if (!analysis.projectMappings || !analysis.taskAssignments) {
      throw new Error('Invalid response structure from AI');
    }

    return analysis;

  } catch (error) {
    console.error('Project analysis error:', error);
    
    // Fallback: create all new projects and don't assign tasks
    return {
      projectMappings: input.newProjects.map(p => ({
        newProjectName: p.name,
        action: "create" as const,
        reasoning: "Fallback due to analysis error"
      })),
      taskAssignments: []
    };
  }
}

export async function processProjectAnalysis(
  analysis: ProjectAnalysisResult,
  newProjectsData: Array<{
    name: string;
    update: string;
    context: string;
    status: "open" | "hold" | "done";
  }>,
  meetingId: number,
  meetingDate: string,
  userId: string
): Promise<Project[]> {
  const processedProjects: Project[] = [];

  for (const mapping of analysis.projectMappings) {
    const newProjectData = newProjectsData.find(p => p.name === mapping.newProjectName);
    if (!newProjectData) continue;

    if (mapping.action === "create") {
      // Create new project
      const project = await storage.createProject({
        userId,
        name: mapping.mergedName || newProjectData.name,
        status: newProjectData.status,
        lastUpdate: newProjectData.update,
        context: newProjectData.context,
        updates: [{
          meetingId,
          update: newProjectData.update,
          date: meetingDate,
        }],
      });
      processedProjects.push(project);

    } else if (mapping.action === "merge" && mapping.targetProjectId) {
      // Update existing project
      const existingProject = await storage.getProject(mapping.targetProjectId, userId);
      if (existingProject) {
        const updatedProject = await storage.updateProject(mapping.targetProjectId, {
          name: mapping.mergedName || existingProject.name,
          status: newProjectData.status,
          lastUpdate: newProjectData.update,
          context: mapping.mergedContext || newProjectData.context || existingProject.context,
          updates: [
            ...existingProject.updates,
            {
              meetingId,
              update: newProjectData.update,
              date: meetingDate,
            }
          ],
        });
        if (updatedProject) {
          processedProjects.push(updatedProject);
        }
      }
    }
  }

  // Process task assignments
  for (const assignment of analysis.taskAssignments) {
    // Find the project either in processed projects or fetch it
    let targetProject = processedProjects.find(p => p.id === assignment.projectId);
    if (!targetProject) {
      targetProject = await storage.getProject(assignment.projectId, userId);
    }
    
    if (targetProject) {
      console.log(`Assigning task ${assignment.taskId} to project ${assignment.projectId} (${targetProject.name}): ${assignment.reasoning}`);
      const result = await storage.updateTask(assignment.taskId, {
        projectId: assignment.projectId
      });
      if (result) {
        console.log(`✓ Successfully assigned task ${assignment.taskId} to project ${assignment.projectId}`);
      } else {
        console.log(`✗ Failed to assign task ${assignment.taskId} to project ${assignment.projectId}`);
      }
    } else {
      console.log(`✗ Project ${assignment.projectId} not found for task assignment ${assignment.taskId}`);
    }
  }

  return processedProjects;
}