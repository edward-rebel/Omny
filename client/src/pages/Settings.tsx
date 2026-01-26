import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar, MobileHeader } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle, AlertCircle, Settings2, ChevronDown, LogOut, User, RotateCcw, Key, Copy, Trash2, Plus, Save } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { SystemPrompt } from "@shared/schema";

interface ApiKeyListItem {
  id: number;
  name: string;
  keyPreview: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface NewlyCreatedKey {
  id: number;
  name: string;
  key: string;
  createdAt: string;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [expandedPrompts, setExpandedPrompts] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<NewlyCreatedKey | null>(null);
  const { toast } = useToast();

  const { data: systemPrompts = [] } = useQuery<SystemPrompt[]>({
    queryKey: ["/api/system-prompts"],
    staleTime: 5 * 60 * 1000,
  });

  // Get API keys
  const { data: apiKeys = [] } = useQuery<ApiKeyListItem[]>({
    queryKey: ["/api/settings/api-keys"],
    staleTime: 30 * 1000, // 30 seconds
  });

  // Initialize display name when user data loads
  useEffect(() => {
    if (user && !displayName) {
      setDisplayName(user.displayName || user.firstName || user.email?.split('@')[0] || 'User');
    }
  }, [user]);

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

  // Create API key mutation
  const createApiKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/settings/api-keys", { name });
      return response.json() as Promise<NewlyCreatedKey>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/api-keys"] });
      setNewlyCreatedKey(data);
      setNewKeyName("");
      toast({
        title: "API Key Created",
        description: "Copy your key now - it won't be shown again!",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create API key",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete API key mutation
  const deleteApiKeyMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/settings/api-keys/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/api-keys"] });
      toast({
        title: "API Key Revoked",
        description: "The API key has been revoked and can no longer be used.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to revoke API key",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "API key copied to clipboard.",
      });
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Please copy the key manually.",
        variant: "destructive",
      });
    }
  };

  const togglePromptExpansion = (name: string) => {
    setExpandedPrompts(prev =>
      prev.includes(name)
        ? prev.filter(p => p !== name)
        : [...prev, name]
    );
  };

  const clearDataMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/clear-data", {});
    },
    onSuccess: () => {
      toast({
        title: "Data Cleared",
        description: "All your meeting data, projects, and tasks have been permanently deleted.",
      });

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
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <Sidebar />
      <MobileHeader title="Settings" subtitle="App configuration" />

      <main className="flex-1 overflow-hidden">
        <header className="hidden md:block bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-6">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Settings</h1>
            <p className="text-slate-600 mt-1 text-sm md:text-base">Configure your Omny application settings</p>
          </div>
        </header>

        <div className="p-4 md:p-8 h-full overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-4 md:space-y-6">

            {/* User Profile Section */}
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <User className="w-4 h-4 md:w-5 md:h-5" />
                  User Profile
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Manage your display name and profile settings
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-sm">Display Name</Label>
                  <div className="flex items-center gap-2">
                    {isEditingName ? (
                      <>
                        <Input
                          id="displayName"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Enter your display name"
                          className="flex-1 text-sm"
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
                          className="flex-1 bg-slate-50 text-sm"
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
                  <p className="text-xs md:text-sm text-slate-600">
                    This name is used for task assignment and AI personalization.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Email</Label>
                  <Input
                    value={user?.email || ''}
                    readOnly
                    className="bg-slate-50 text-sm"
                  />
                  <p className="text-xs md:text-sm text-slate-600">
                    Your email address cannot be changed.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* API Keys Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  API Keys
                </CardTitle>
                <CardDescription>
                  Manage API keys for Zapier webhook integration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    API keys allow external services like Zapier to send meeting transcripts to Omny for automatic analysis.
                    Webhook URL: <code className="bg-slate-100 px-1 rounded">{window.location.origin}/api/webhook/meeting</code>
                  </AlertDescription>
                </Alert>

                {/* Newly created key display */}
                {newlyCreatedKey && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <div className="font-medium mb-2">New API Key Created: {newlyCreatedKey.name}</div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-white px-2 py-1 rounded border text-sm font-mono break-all">
                          {newlyCreatedKey.key}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(newlyCreatedKey.key)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs mt-2 text-green-700">
                        Copy this key now - it won't be shown again!
                      </p>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Create new API key */}
                <div className="space-y-2">
                  <Label htmlFor="newKeyName">Create New API Key</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="newKeyName"
                      placeholder="Key name (e.g., 'Zapier Integration')"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => createApiKeyMutation.mutate(newKeyName)}
                      disabled={createApiKeyMutation.isPending || !newKeyName.trim()}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {createApiKeyMutation.isPending ? "Creating..." : "Generate"}
                    </Button>
                  </div>
                </div>

                {/* Existing API keys list */}
                {apiKeys.length > 0 && (
                  <div className="space-y-2">
                    <Label>Active API Keys</Label>
                    <div className="space-y-2">
                      {apiKeys.map((key) => (
                        <div
                          key={key.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-sm">{key.name}</div>
                            <div className="text-xs text-slate-500 font-mono">{key.keyPreview}</div>
                            <div className="text-xs text-slate-400 mt-1">
                              Created: {new Date(key.createdAt).toLocaleDateString()}
                              {key.lastUsedAt && (
                                <span className="ml-2">
                                  • Last used: {new Date(key.lastUsedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => deleteApiKeyMutation.mutate(key.id)}
                            disabled={deleteApiKeyMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {apiKeys.length === 0 && !newlyCreatedKey && (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No API keys yet. Create one to enable Zapier integration.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* System Prompts Section */}
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Settings2 className="w-4 h-4 md:w-5 md:h-5" />
                  System Prompts
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Customize how the AI analyzes your meeting transcripts
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs md:text-sm">
                    System prompts control how the AI processes your meetings.
                  </AlertDescription>
                </Alert>

                {systemPrompts.length === 0 ? (
                  <div className="text-center py-6 md:py-8">
                    <p className="text-slate-600 mb-4 text-sm">No system prompts found.</p>
                    <Button
                      onClick={() => initializePromptsMutation.mutate()}
                      disabled={initializePromptsMutation.isPending}
                      size="sm"
                    >
                      {initializePromptsMutation.isPending ? "Initializing..." : "Initialize Default Prompts"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 md:space-y-4">
                    {systemPrompts.map((prompt) => (
                      <Collapsible
                        key={prompt.name}
                        open={expandedPrompts.includes(prompt.name)}
                        onOpenChange={() => togglePromptExpansion(prompt.name)}
                      >
                        <Card className="border-slate-200">
                          <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors p-3 md:p-4">
                              <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                  <CardTitle className="text-sm md:text-base font-medium capitalize truncate">
                                    {prompt.name.replace(/_/g, ' ')}
                                  </CardTitle>
                                  <CardDescription className="text-xs md:text-sm truncate">
                                    {prompt.description}
                                  </CardDescription>
                                </div>
                                <ChevronDown className="w-4 h-4 transition-transform data-[state=open]:rotate-180 shrink-0 ml-2" />
                              </div>
                            </CardHeader>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            <CardContent className="p-3 md:p-4 pt-0">
                              <div className="space-y-3 md:space-y-4">
                                <div className="space-y-2">
                                  <Label className="text-xs md:text-sm">Current Prompt</Label>
                                  <div className="bg-slate-50 border rounded-md p-2 md:p-3 max-h-48 md:max-h-64 overflow-y-auto">
                                    <pre className="text-xs text-slate-700 whitespace-pre-wrap break-words">
                                      {prompt.prompt}
                                    </pre>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-slate-200">
                                <div className="text-xs text-slate-500 space-y-1">
                                  <p><strong>Created:</strong> {new Date(prompt.createdAt).toLocaleDateString()}</p>
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
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <LogOut className="w-4 h-4 md:w-5 md:h-5" />
                  Account
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Manage your account settings and data
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 space-y-4">
                <div className="space-y-3 md:space-y-4">
                  <div className="p-3 md:p-4 border border-orange-200 bg-orange-50 rounded-lg">
                    <h3 className="text-xs md:text-sm font-medium text-slate-900 mb-2">Clear My Data</h3>
                    <p className="text-xs md:text-sm text-slate-600 mb-3">
                      Permanently delete all your meetings, projects, and tasks.
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => clearDataMutation.mutate()}
                      disabled={clearDataMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {clearDataMutation.isPending ? "Clearing..." : "Clear My Data"}
                    </Button>
                  </div>

                  <div className="p-3 md:p-4 border border-red-200 bg-red-50 rounded-lg">
                    <h3 className="text-xs md:text-sm font-medium text-slate-900 mb-2">Logout</h3>
                    <p className="text-xs md:text-sm text-slate-600 mb-3">
                      Sign out of your Omny account.
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
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
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="text-base md:text-lg">Application Information</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Details about your Omny installation
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 space-y-2">
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-slate-600">Version:</span>
                  <span className="font-mono">1.0.0</span>
                </div>
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-slate-600">Storage:</span>
                  <span>PostgreSQL Database</span>
                </div>
                <div className="flex justify-between text-xs md:text-sm">
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
