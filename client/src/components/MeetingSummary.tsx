import type { AnalysisResult } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle } from "lucide-react";

interface MeetingSummaryProps {
  result: AnalysisResult;
}

export function MeetingSummary({ result }: MeetingSummaryProps) {
  const { meeting, analysis } = result;

  const getScoreColor = (score: number) => {
    if (score >= 8) return "bg-green-100 text-green-800";
    if (score >= 6) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800";
      case "high": return "bg-amber-100 text-amber-800";
      case "medium": return "bg-green-100 text-green-800";
      case "low": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Meeting Summary Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900">Meeting Summary</h2>
          <Badge className={`${getScoreColor(analysis.effectiveness.score)} flex items-center gap-2`}>
            <div className="w-2 h-2 bg-current rounded-full"></div>
            {analysis.effectiveness.score}/10
          </Badge>
        </div>
        
        <div className="space-y-6 mb-6">
          {/* Meeting Details */}
          <div>
            <h3 className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wide">
              Meeting Details
            </h3>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-slate-900">{meeting.title}</p>
              <p className="text-sm text-slate-600">{meeting.date}</p>
              <div className="flex flex-wrap gap-2">
                {meeting.participants.map((participant, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {participant === "Edward" ? `${participant} (You)` : participant}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Meeting Summary */}
          {(meeting.summary || analysis.summary) && (
            <div>
              <h3 className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wide">
                Meeting Summary
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                {meeting.summary || analysis.summary}
              </p>
            </div>
          )}

          {/* Topics Discussed */}
          {(meeting.topicsDiscussed || analysis.topics_discussed) && (
            <div>
              <h3 className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wide">
                Topics Discussed
              </h3>
              <ul className="space-y-1 text-sm text-slate-600">
                {(meeting.topicsDiscussed || analysis.topics_discussed || []).map((topic, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Key Takeaways */}
          <div>
            <h3 className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wide">
              Key Takeaways
            </h3>
            <ul className="space-y-2 text-sm text-slate-600">
              {(meeting.keyTakeaways || analysis.key_takeaways || []).map((takeaway, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="leading-relaxed">{takeaway}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="border-t border-slate-200 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-900 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                What went well
              </h4>
              <ul className="space-y-1 text-sm text-green-800">
                {meeting.wentWell.map((item, index) => (
                  <li key={index}>• {item}</li>
                ))}
              </ul>
            </div>
            
            <div className="bg-amber-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-amber-900 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Areas to improve
              </h4>
              <ul className="space-y-1 text-sm text-amber-800">
                {meeting.areasToImprove.map((item, index) => (
                  <li key={index}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Action Items */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            My Action Items
          </h3>
          <div className="space-y-3">
            {(analysis.action_items?.user || []).map((item, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <input type="checkbox" className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary focus:ring-2" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{item.task}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {item.due && (
                      <p className="text-xs text-slate-500">Due: {item.due}</p>
                    )}
                    {item.priority && (
                      <Badge className={`${getPriorityColor(item.priority)} text-xs`}>
                        {item.priority}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Others' Action Items */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
            Others' Action Items
          </h3>
          <div className="space-y-3">
            {(analysis.action_items?.others || []).map((item, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-medium">{getInitials(item.owner)}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{item.owner}: {item.task}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {item.due && (
                      <p className="text-xs text-slate-500">Due: {item.due}</p>
                    )}
                    {item.priority && (
                      <Badge className={`${getPriorityColor(item.priority)} text-xs`}>
                        {item.priority}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Project Updates */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Project Updates</h3>
        <div className="space-y-4">
          {analysis.projects.map((project, index) => (
            <div key={index} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-slate-900">{project.name}</h4>
                <Badge variant={project.status === "open" ? "default" : project.status === "hold" ? "secondary" : "outline"}>
                  {project.status}
                </Badge>
              </div>
              <p className="text-sm text-slate-600">{project.update}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Follow-ups */}
      {analysis.follow_ups.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Follow-ups</h3>
          <ul className="space-y-2">
            {analysis.follow_ups.map((followUp, index) => (
              <li key={index} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-sm text-slate-600">{followUp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
