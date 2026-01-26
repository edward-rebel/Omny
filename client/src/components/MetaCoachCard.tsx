import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { MetaInsights } from "@shared/schema";

interface MetaCoachCardProps {
  insights: MetaInsights | null;
}

export function MetaCoachCard({ insights }: MetaCoachCardProps) {
  if (!insights) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Meeting Analysis Insights</h2>
            <p className="text-sm text-slate-600">Your meeting effectiveness trends</p>
          </div>
        </div>
        
        <div className="text-center py-8">
          <p className="text-slate-600">No insights available yet.</p>
          <p className="text-sm text-slate-500 mt-1">Analyze a few meetings to see your effectiveness trends.</p>
        </div>
      </div>
    );
  }

  const averageScore = insights.averageScore / 10; // Convert back from integer
  const scoreChange = insights.trends.scoreChange || 0;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Meeting Analysis Insights</h2>
          <p className="text-sm text-slate-600">Your meeting effectiveness trends</p>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Average Meeting Score</span>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-green-600">{averageScore.toFixed(1)}</div>
            {scoreChange !== 0 && (
              <div className={`flex items-center gap-1 text-sm ${scoreChange > 0 ? "text-green-600" : "text-red-600"}`}>
                {scoreChange > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {Math.abs(scoreChange).toFixed(1)}
              </div>
            )}
          </div>
        </div>
        
        {insights.strengths.length > 0 && (
          <div className="bg-white rounded-lg p-4">
            <h4 className="font-medium text-slate-900 mb-2">Recent Strengths</h4>
            <ul className="space-y-1 text-sm text-slate-600">
              {insights.strengths.slice(0, 3).map((strength, index) => (
                <li key={index} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  {strength}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {insights.opportunities.length > 0 && (
          <div className="bg-white rounded-lg p-4">
            <h4 className="font-medium text-slate-900 mb-2">Growth Opportunities</h4>
            <ul className="space-y-1 text-sm text-slate-600">
              {insights.opportunities.slice(0, 2).map((opportunity, index) => (
                <li key={index} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                  {opportunity}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-center pt-2">
          <p className="text-xs text-slate-500">
            Based on {insights.totalMeetings} meeting{insights.totalMeetings !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
