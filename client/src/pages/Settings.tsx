import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle, AlertCircle, Settings2, ChevronDown, LogOut, User, RotateCcw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { SystemPrompt } from "@shared/schema";

export default function Settings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [expandedPrompts, setExpandedPrompts] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const { toast } = useToast();

  // Get system prompts
  const { data: systemPrompts = [] } = useQuery<SystemPrompt[]>({
    queryKey: ["/api/system-prompts"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Initialize display name when user data loads
  useEffect(() => {
    if (user && !displayName) {
      setDisplayName(user.displayName || user.firstName || user.email?.split('@')[0] || 'User');
    }
  }, [user]);



  // Initialize default prompts if none exist
  // Update user display name
  const updateDisplayNameMutation = useMutation({
    mutationFn: async (newDisplayName: string) => {
      return apiRequest("PATCH", "/api/auth/user", { displayName: newDisplayName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setIsEditingName(false);
      toast({
        title: "Display name updated",
        description: "Your display name has been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update display name",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const initializePromptsMutation = useMutation({
    mutationFn: async () => {
      const defaultPrompts = [
        {
          name: "meeting_analysis",
          description: "Main prompt for analyzing meeting transcripts and extracting structured information",
          prompt: `You are an AI meeting assistant for Edward (CTO). Parse the raw transcript below and extract structured meeting information.

Focus on:
- Meeting effectiveness based on: clarity of purpose, decisions made, action orientation, Edward's leadership, time efficiency, follow-up readiness, net positive impact
- Clear action items with realistic due dates and priorities
- Project updates and status changes
- What went well vs areas for improvement

CRITICAL: Return ONLY valid JSON without any markdown formatting, code blocks, or additional text. Do not wrap the response in \`\`\`json or any other formatting.

Return a JSON object matching this exact structure:
{
  "meeting": {
    "title": "descriptive meeting title",
    "date": "YYYY-MM-DD", 
    "participants": ["Edward", "other participants"]
  },
  "key_takeaways": ["key point 1", "key point 2"],
  "action_items": {
    "edward": [{"task": "task description", "due": "YYYY-MM-DD or relative date", "priority": "low|medium|high|urgent"}],
    "others": [{"task": "task description", "owner": "person name", "due": "date", "priority": "low|medium|high|urgent"}]
  },
  "follow_ups": ["follow up item 1", "follow up item 2"],
  "projects": [
    {
      "name": "project name",
      "update": "what happened with this project",
      "status": "open|hold|done"
    }
  ],
  "effectiveness": {
    "score": 1-10,
    "went_well": ["positive aspect 1", "positive aspect 2"],
    "improve": ["improvement area 1", "improvement area 2"]
  }
}`,
          isActive: true
        }
      ];

      for (const prompt of defaultPrompts) {
        await apiRequest("POST", "/api/system-prompts", prompt);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-prompts"] });
      toast({
        title: "Prompts Initialized",
        description: "Default system prompts have been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Initialization Failed",
        description: error instanceof Error ? error.message : "Failed to initialize prompts",
        variant: "destructive",
      });
    },
  });



  const togglePromptExpansion = (name: string) => {
    setExpandedPrompts(prev => 
      prev.includes(name) 
        ? prev.filter(p => p !== name)
        : [...prev, name]
    );
  };



  // Clear user data mutation
  const clearDataMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/clear-data", {});
    },
    onSuccess: () => {
      toast({
        title: "Data Cleared",
        description: "All your meeting data, projects, and tasks have been permanently deleted.",
      });
      
      // Invalidate all data queries to refresh empty state
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (error) => {
      toast({
        title: "Clear Failed",
        description: error instanceof Error ? error.message : "Failed to clear user data",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      
      <main className="flex-1 overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
            <p className="text-slate-600 mt-1">Configure your Omny application settings</p>
          </div>
        </header>
        
        <div className="p-8 h-full overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-6">
            
            {/* User Profile Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  User Profile
                </CardTitle>
                <CardDescription>
                  Manage your display name and profile settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <div className="flex items-center gap-2">
                    {isEditingName ? (
                      <>
                        <Input
                          id="displayName"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Enter your display name"
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => updateDisplayNameMutation.mutate(displayName)}
                          disabled={updateDisplayNameMutation.isPending || !displayName.trim()}
                        >
                          <Save className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsEditingName(false);
                            setDisplayName(user?.displayName || user?.firstName || user?.email?.split('@')[0] || 'User');
                          }}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Input
                          value={displayName}
                          readOnly
                          className="flex-1 bg-slate-50"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsEditingName(true)}
                        >
                          Edit
                        </Button>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">
                    This name is used for task assignment and AI personalization. It affects how tasks are filtered in the "My Tasks" section.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={user?.email || ''}
                    readOnly
                    className="bg-slate-50"
                  />
                  <p className="text-sm text-slate-600">
                    Your email address cannot be changed as it's linked to your authentication.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* System Prompts Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5" />
                  System Prompts
                </CardTitle>
                <CardDescription>
                  Customize how the AI analyzes your meeting transcripts and generates insights
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    System prompts control how the AI processes your meetings. Changes affect future analyses. Use "Rerun Analysis" to apply updates to existing meetings.
                  </AlertDescription>
                </Alert>

                {systemPrompts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-600 mb-4">No system prompts found. Initialize default prompts to get started.</p>
                    <Button
                      onClick={() => initializePromptsMutation.mutate()}
                      disabled={initializePromptsMutation.isPending}
                    >
                      {initializePromptsMutation.isPending ? "Initializing..." : "Initialize Default Prompts"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {systemPrompts.map((prompt) => (
                      <Collapsible 
                        key={prompt.name}
                        open={expandedPrompts.includes(prompt.name)}
                        onOpenChange={() => togglePromptExpansion(prompt.name)}
                      >
                        <Card className="border-slate-200">
                          <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors">
                              <div className="flex items-center justify-between">
                                <div>
                                  <CardTitle className="text-base font-medium capitalize">
                                    {prompt.name.replace(/_/g, ' ')}
                                  </CardTitle>
                                  <CardDescription className="text-sm">
                                    {prompt.description}
                                  </CardDescription>
                                </div>
                                <ChevronDown className="w-4 h-4 transition-transform data-[state=open]:rotate-180" />
                              </div>
                            </CardHeader>
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent>
                            <CardContent className="pt-0">
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label>Current Prompt</Label>
                                  <div className="bg-slate-50 border rounded-md p-3">
                                    <pre className="text-xs text-slate-700 whitespace-pre-wrap break-words">
                                      {prompt.prompt}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="mt-4 pt-4 border-t border-slate-200">
                                <div className="text-xs text-slate-500 space-y-1">
                                  <p><strong>Created:</strong> {new Date(prompt.createdAt).toLocaleDateString()}</p>
                                  <p><strong>Last Updated:</strong> {new Date(prompt.updatedAt).toLocaleDateString()}</p>
                                  <p><strong>Status:</strong> {prompt.isActive ? "Active" : "Inactive"}</p>
                                </div>
                              </div>
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LogOut className="w-5 h-5" />
                  Account
                </CardTitle>
                <CardDescription>
                  Manage your account settings and data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
                    <h3 className="text-sm font-medium text-slate-900 mb-2">Clear My Data</h3>
                    <p className="text-sm text-slate-600 mb-3">
                      Permanently delete all your meetings, projects, tasks, and analysis data. Your account information will remain intact. This action cannot be undone.
                    </p>
                    <Button 
                      variant="destructive" 
                      onClick={() => clearDataMutation.mutate()}
                      disabled={clearDataMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {clearDataMutation.isPending ? "Clearing..." : "Clear My Data"}
                    </Button>
                  </div>
                  
                  <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
                    <h3 className="text-sm font-medium text-slate-900 mb-2">Logout</h3>
                    <p className="text-sm text-slate-600 mb-3">
                      Sign out of your Omny account. You'll need to log in again to access your meetings and data.
                    </p>
                    <Button 
                      variant="destructive" 
                      onClick={() => window.location.href = '/api/logout'}
                      className="flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* App Information */}
            <Card>
              <CardHeader>
                <CardTitle>Application Information</CardTitle>
                <CardDescription>
                  Details about your Omny installation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Version:</span>
                  <span className="font-mono">1.0.0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Storage:</span>
                  <span>PostgreSQL Database</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">AI Model:</span>
                  <span>GPT-4o-mini</span>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </main>
    </div>
  );
}