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
      model: "gpt-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze this meeting transcript:\n\n${transcript}` }
      ],
      temperature: 0.1,
      max_completion_tokens: 4000,
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

    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to analyze meeting transcript');
  }
}

