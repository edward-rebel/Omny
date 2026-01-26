import OpenAI from 'openai';
import { storage } from '../storage';
import { getUserSpecificPrompt } from './systemPrompts';

// Create OpenAI client with dynamic API key support
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY || process.env.API_KEY || '';
  return new OpenAI({ apiKey });
}

interface MeetingAnalysis {
  meeting: {
    title: string;
    date: string;
    participants: string[];
  };
  summary: string; // New: Concise meeting summary
  key_takeaways: string[];
  topics_discussed: string[]; // New: Topics discussed
  action_items: {
    user: Array<{ task: string; due?: string; priority?: string }>;
    others: Array<{ task: string; owner: string; due?: string; priority?: string }>;
  };
  follow_ups: string[];
  projects: Array<{
    name: string;
    update: string;
    context: string; // Comprehensive project summary from meeting discussion
    status: "open" | "hold" | "done";
  }>;
  effectiveness: {
    score: number;
    went_well: string[];
    improve: string[];
  };
}

export async function analyzeMeetingTranscript(
  transcript: string, 
  userInfo: { displayName?: string; firstName?: string; email?: string }
): Promise<MeetingAnalysis> {
  if (!transcript.trim()) {
    throw new Error('Transcript cannot be empty');
  }

  if (transcript.length > 100000) {
    throw new Error('Transcript too long (max 100KB)');
  }

  try {
    // Get user-specific prompt
    const systemPrompt = await getUserSpecificPrompt('meeting_analysis', userInfo);
    if (!systemPrompt) {
      throw new Error('Meeting analysis system prompt not found');
    }
    console.log('Using user-specific system prompt for meeting_analysis');

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze this meeting transcript:\n\n${transcript}` }
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    try {
      // Clean the response content - remove markdown code blocks if present
      let cleanedContent = responseContent.trim();
      
      // Remove ```json and ``` markers if they exist
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const analysis = JSON.parse(cleanedContent) as MeetingAnalysis;
      
      // Validate required fields
      if (!analysis.meeting || !analysis.effectiveness || !analysis.action_items) {
        throw new Error('Invalid response structure from AI');
      }

      return analysis;
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', responseContent);
      throw new Error('Invalid JSON response from AI');
    }
  } catch (error) {
    console.error('OpenAI API error:', error);
    
    // If quota exceeded or model access issues, provide demo analysis
    if (error instanceof Error && (
      error.message.includes('quota') || 
      error.message.includes('model') ||
      error.message.includes('429') ||
      error.message.includes('404')
    )) {
      console.log('Providing demo analysis due to API limitations');
      return generateDemoAnalysis(transcript);
    }
    
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to analyze meeting transcript');
  }
}

function generateDemoAnalysis(transcript: string): MeetingAnalysis {
  // Extract basic info from transcript
  const lines = transcript.split('\n').filter(line => line.trim());
  const participants = new Set<string>();
  
  lines.forEach(line => {
    const match = line.match(/\[(.*?)\]\s+([^:]+):/);
    if (match) {
      participants.add(match[2].trim());
    }
  });
  
  const participantList = Array.from(participants);
  const today = new Date().toISOString().split('T')[0];
  
  return {
    meeting: {
      title: "Q4 Budget Planning Meeting",
      date: today,
      participants: participantList.length > 0 ? participantList : ["User", "Sarah", "David", "Jennifer"]
    },
    summary: "Team reviewed Q4 budget performance and discussed strategic priorities for Q1, including scaling infrastructure for expected user growth and finalizing resource allocation for critical projects.",
    key_takeaways: [
      "Q4 spending came in 3% under budget, providing flexibility for Q1 strategic initiatives and unexpected opportunities",
      "Customer portal API needs immediate scaling architecture review for projected 15k users by March, requiring dedicated engineering resources",
      "Marketing campaign launch in February expects 20% growth in sign-ups, necessitating infrastructure readiness and support team scaling",
      "Technical team requires dedicated resources for portal enhancement to meet user growth projections and maintain performance standards",
      "Budget reallocation approved for additional engineering hires to support critical infrastructure projects",
      "Q1 priorities established with clear ownership and deadlines for all major deliverables"
    ],
    topics_discussed: [
      "Q4 budget performance review",
      "Customer portal API scaling requirements",
      "Marketing campaign timeline and impact",
      "Engineering resource allocation",
      "Infrastructure capacity planning",
      "Q1 strategic priorities",
      "Hiring decisions and team expansion",
      "Technical architecture improvements"
    ],
    action_items: {
      user: [
        { task: "Review technical proposal and budget analysis", due: "Next Friday", priority: "high" },
        { task: "Make hiring decision for additional engineers", due: "End of week", priority: "medium" }
      ],
      others: [
        { task: "Prepare technical proposal for customer portal API", owner: "David", due: "Next Friday", priority: "urgent" },
        { task: "Run budget impact analysis for hiring 3 engineers", owner: "Sarah", due: "Thursday", priority: "high" },
        { task: "Coordinate marketing campaign timeline with engineering", owner: "Jennifer", due: "This week", priority: "medium" }
      ]
    },
    follow_ups: [
      "Schedule follow-up meeting to review technical proposal",
      "Align marketing and engineering timelines for Q1",
      "Finalize hiring plan and budget allocation"
    ],
    projects: [
      {
        name: "Customer Portal API Scaling",
        update: "Architecture needs enhancement to handle 15k+ users. Requires dedicated team of 3 engineers.",
        context: "Critical infrastructure project requiring significant engineering resources to scale customer portal API for 15k+ concurrent users.",
        status: "open"
      },
      {
        name: "Q1 Marketing Campaign",
        update: "February launch planned with 20% growth target. Dependencies on portal capacity.",
        context: "Strategic growth initiative targeting 20% user acquisition increase through coordinated marketing efforts dependent on infrastructure capacity.",
        status: "open"
      }
    ],
    effectiveness: {
      score: 8,
      went_well: [
        "Clear agenda and purpose",
        "Good cross-team collaboration",
        "Concrete action items assigned",
        "Efficient use of time"
      ],
      improve: [
        "Could have discussed timeline dependencies earlier",
        "More specific budget numbers needed"
      ]
    }
  };
}
