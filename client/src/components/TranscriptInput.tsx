import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Brain, Loader2 } from "lucide-react";

interface TranscriptInputProps {
  onAnalyze: (transcript: string) => void;
  isAnalyzing: boolean;
}

export function TranscriptInput({ onAnalyze, isAnalyzing }: TranscriptInputProps) {
  const [transcript, setTranscript] = useState("");
  const maxLength = 100000;

  const handleSubmit = () => {
    if (transcript.trim() && transcript.length <= maxLength) {
      onAnalyze(transcript);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="mb-4">
        <Label htmlFor="transcript" className="text-sm font-medium text-slate-900 mb-2 block">
          Meeting Transcript
        </Label>
        <p className="text-sm text-slate-600 mb-4">
          Paste your raw meeting transcript below (up to 100KB)
        </p>
      </div>
      
      <Textarea
        id="transcript"
        rows={12}
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        className="w-full resize-none"
        placeholder={`Paste your meeting transcript here...

Example:
[9:00 AM] Edward: Good morning everyone, thanks for joining the Q4 budget planning meeting. We have Sarah from Finance, David from Engineering, and Jennifer from Marketing.

[9:01 AM] Sarah: Thanks Edward. I've prepared the budget analysis we discussed. Our Q4 actual spending came in 3% under budget, which gives us some flexibility for Q1 planning.

[9:02 AM] Edward: That's great news. David, what are your team's priorities for Q1?

[9:03 AM] David: We need to focus on the customer portal API. The current architecture won't scale past 10k users, and we're projecting 15k by March...`}
        disabled={isAnalyzing}
      />
      
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-slate-500">
          <span className={transcript.length > maxLength ? "text-red-500" : ""}>
            {transcript.length.toLocaleString()}
          </span> / {maxLength.toLocaleString()} characters
        </div>
        <Button 
          onClick={handleSubmit}
          disabled={!transcript.trim() || transcript.length > maxLength || isAnalyzing}
          className="flex items-center gap-2"
        >
          {isAnalyzing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Brain className="w-4 h-4" />
          )}
          {isAnalyzing ? "Analyzing..." : "Analyze Meeting"}
        </Button>
      </div>
    </div>
  );
}
