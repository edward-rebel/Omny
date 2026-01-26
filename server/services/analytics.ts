import { storage } from '../storage';
import type { MetaInsights, Meeting } from '@shared/schema';
import OpenAI from 'openai';
import { getUserSpecificPrompt } from './systemPrompts';

interface AnalyticsData {
  averageScore: number;
  totalMeetings: number;
  strengths: string[];
  opportunities: string[];
  trends: Record<string, number>;
}

export async function generateMetaInsights(userId: string): Promise<AnalyticsData> {
  const meetings = await storage.getAllMeetings(userId);
  
  if (meetings.length === 0) {
    return {
      averageScore: 0,
      totalMeetings: 0,
      strengths: [],
      opportunities: [],
      trends: {},
    };
  }

  // Calculate average effectiveness score
  const totalScore = meetings.reduce((sum, meeting) => sum + meeting.effectivenessScore, 0);
  const averageScore = Math.round((totalScore / meetings.length) * 10) / 10;

  // Aggregate strengths and improvement areas
  const allStrengths: string[] = [];
  const allImprovements: string[] = [];

  meetings.forEach(meeting => {
    allStrengths.push(...meeting.wentWell);
    allImprovements.push(...meeting.areasToImprove);
  });

  // Count frequency and get top items
  const strengthCounts = countFrequency(allStrengths);
  const improvementCounts = countFrequency(allImprovements);

  const topStrengths = Object.entries(strengthCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([strength, count]) => `${strength} (+${count})`);

  const topOpportunities = Object.entries(improvementCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([improvement]) => improvement);

  // Calculate trends (score over time)
  const trends: Record<string, number> = {};
  if (meetings.length >= 2) {
    const recentMeetings = meetings.slice(0, Math.min(5, meetings.length));
    const olderMeetings = meetings.slice(Math.min(5, meetings.length));
    
    const recentAvg = recentMeetings.reduce((sum, m) => sum + m.effectivenessScore, 0) / recentMeetings.length;
    const olderAvg = olderMeetings.length > 0 
      ? olderMeetings.reduce((sum, m) => sum + m.effectivenessScore, 0) / olderMeetings.length 
      : recentAvg;
    
    trends.scoreChange = Math.round((recentAvg - olderAvg) * 10) / 10;
    trends.meetingFrequency = meetings.length; // Could be enhanced with time-based calculation
  }

  return {
    averageScore,
    totalMeetings: meetings.length,
    strengths: topStrengths,
    opportunities: topOpportunities,
    trends,
  };
}

function countFrequency(items: string[]): Record<string, number> {
  return items.reduce((counts, item) => {
    const cleaned = item.toLowerCase().trim();
    counts[cleaned] = (counts[cleaned] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
}

/**
 * Generate narrative insights by consolidating meeting patterns with OpenAI
 */
export async function generateNarrativeInsights(
  userId: string, 
  latestMeeting: Meeting,
  userInfo: { firstName?: string; email?: string }
): Promise<{ narrativeWentWell: string; narrativeAreasToImprove: string }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Get existing meta insights (if any)
  const existingInsights = await storage.getMetaInsights(userId);
  
  // Get all meetings for historical context
  const allMeetings = await storage.getUserMeetings(userId);
  
  // Prepare context for OpenAI
  const context = {
    previousNarratives: existingInsights ? {
      wentWell: existingInsights.narrativeWentWell,
      areasToImprove: existingInsights.narrativeAreasToImprove
    } : null,
    latestMeeting: {
      title: latestMeeting.title,
      effectivenessScore: latestMeeting.effectivenessScore,
      wentWell: latestMeeting.wentWell,
      areasToImprove: latestMeeting.areasToImprove
    },
    historicalPatterns: {
      totalMeetings: allMeetings.length,
      averageScore: allMeetings.reduce((sum, m) => sum + m.effectivenessScore, 0) / allMeetings.length,
      commonStrengths: Array.from(new Set(allMeetings.flatMap(m => m.wentWell))).slice(0, 10),
      commonImprovements: Array.from(new Set(allMeetings.flatMap(m => m.areasToImprove))).slice(0, 10)
    }
  };

  const systemPrompt = await getUserSpecificPrompt('narrative_insights', userInfo);
  if (!systemPrompt) {
    throw new Error('Narrative insights system prompt not found');
  }

  const userPrompt = `Based on the following data, generate comprehensive narrative insights:

PREVIOUS CONSOLIDATED INSIGHTS (if any):
${context.previousNarratives ? `
What Went Well: ${context.previousNarratives.wentWell}
Areas to Improve: ${context.previousNarratives.areasToImprove}
` : 'No previous insights available - this is the first analysis.'}

LATEST MEETING DATA:
Title: ${context.latestMeeting.title}
Effectiveness Score: ${context.latestMeeting.effectivenessScore}/10
What Went Well: ${context.latestMeeting.wentWell.join(', ')}
Areas to Improve: ${context.latestMeeting.areasToImprove.join(', ')}

HISTORICAL CONTEXT:
Total Meetings Analyzed: ${context.historicalPatterns.totalMeetings}
Average Effectiveness Score: ${context.historicalPatterns.averageScore.toFixed(1)}/10
Most Common Strengths Across Meetings: ${context.historicalPatterns.commonStrengths.join(', ')}
Most Common Improvement Areas: ${context.historicalPatterns.commonImprovements.join(', ')}

Generate verbose narrative insights that consolidate this information into actionable leadership guidance.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more consistent insights
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    if (!result.narrativeWentWell || !result.narrativeAreasToImprove) {
      throw new Error('Invalid response format from OpenAI');
    }

    return {
      narrativeWentWell: result.narrativeWentWell,
      narrativeAreasToImprove: result.narrativeAreasToImprove
    };
  } catch (error) {
    console.error('Error generating narrative insights:', error);
    throw new Error('Failed to generate narrative insights');
  }
}

export async function syncInsights(userId: string): Promise<MetaInsights> {
  const analyticsData = await generateMetaInsights(userId);
  
  const insights = await storage.updateMetaInsights(userId, {
    averageScore: Math.round(analyticsData.averageScore * 10), // Store as integer
    totalMeetings: analyticsData.totalMeetings,
    strengths: analyticsData.strengths,
    opportunities: analyticsData.opportunities,
    trends: analyticsData.trends,
  });

  return insights;
}

/**
 * Update meta insights with narrative after meeting analysis
 */
export async function updateInsightsWithNarrative(
  userId: string, 
  latestMeeting: Meeting,
  userInfo: { firstName?: string; email?: string }
): Promise<MetaInsights> {
  console.log(`🔄 Generating narrative insights for user ${userId}, meeting: ${latestMeeting.title}`);
  
  // Generate narrative insights first
  const narrativeInsights = await generateNarrativeInsights(userId, latestMeeting, userInfo);
  console.log(`✅ Narrative insights generated:`, {
    wentWellLength: narrativeInsights.narrativeWentWell.length,
    areasToImproveLength: narrativeInsights.narrativeAreasToImprove.length
  });
  
  // Get current analytics data
  const analyticsData = await generateMetaInsights(userId);
  
  // Update meta insights with both analytics and narrative data
  const insights = await storage.updateMetaInsights(userId, {
    averageScore: Math.round(analyticsData.averageScore * 10), // Store as integer
    totalMeetings: analyticsData.totalMeetings,
    strengths: analyticsData.strengths,
    opportunities: analyticsData.opportunities,
    trends: analyticsData.trends,
    narrativeWentWell: narrativeInsights.narrativeWentWell,
    narrativeAreasToImprove: narrativeInsights.narrativeAreasToImprove,
  });

  console.log(`💾 Meta insights updated in database with narratives`);
  return insights;
}
