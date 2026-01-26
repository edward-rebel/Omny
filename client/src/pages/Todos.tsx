import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, User, CheckCircle2, Clock, Edit3, Check, X, Trash2, UserCheck } from "lucide-react";
import { Task } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

export default function Todos() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editingTask, setEditingTask] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [reassigningTask, setReassigningTask] = useState<number | null>(null);
  
  const { data: allTasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    staleTime: 0,
    refetchOnMount: true,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: number; updates: { completed?: boolean; task?: string } }) => {
      return apiRequest("PATCH", `/api/task/${taskId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setEditingTask(null);
      setEditText("");
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return apiRequest("DELETE", `/api/task/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const myTasks = allTasks.filter(task => {
    if (!user) return false;
    // Use display name first, then fall back to firstName or email-based name
    const currentUserName = (user.displayName || user.firstName || user.email?.split('@')[0] || 'user').toLowerCase();
    const owner = task.owner.toLowerCase();
    return owner === currentUserName || owner === currentUserName.split(' ')[0];
  });
  const otherTasks = allTasks.filter(task => {
    if (!user) return true;
    const currentUserName = (user.displayName || user.firstName || user.email?.split('@')[0] || 'user').toLowerCase();
    const owner = task.owner.toLowerCase();
    return owner !== currentUserName && owner !== currentUserName.split(' ')[0];
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800 border-red-200";
      case "high": return "bg-amber-100 text-amber-800 border-amber-200";
      case "medium": return "bg-green-100 text-green-800 border-green-200";
      case "low": return "bg-blue-100 text-blue-800 border-blue-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const handleTaskToggle = (taskId: number, currentCompleted: boolean) => {
    updateTaskMutation.mutate({ taskId, updates: { completed: !currentCompleted } });
  };

  const startEditing = (taskId: number, currentText: string) => {
    setEditingTask(taskId);
    setEditText(currentText);
  };

  const cancelEditing = () => {
    setEditingTask(null);
    setEditText("");
  };

  const saveEdit = (taskId: number) => {
    if (editText.trim() && editText.trim() !== "") {
      updateTaskMutation.mutate({ taskId, updates: { task: editText.trim() } });
    } else {
      cancelEditing();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, taskId: number) => {
    if (e.key === "Enter") {
      saveEdit(taskId);
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  const handleDelete = (taskId: number) => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      deleteTaskMutation.mutate(taskId);
    }
  };

  const reassignTaskMutation = useMutation({
    mutationFn: async ({ taskId, owner }: { taskId: number; owner: string }) => {
      return apiRequest("PATCH", `/api/task/${taskId}`, { owner });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setReassigningTask(null);
    },
  });

  const handleReassign = (taskId: number, newOwner: string) => {
    reassignTaskMutation.mutate({ taskId, owner: newOwner });
  };

  // Get unique owners from all tasks for the reassignment dropdown
  const allOwners = Array.from(new Set(allTasks.map(task => task.owner))).sort();
  const currentUserName = user ? (user.displayName || user.firstName || user.email?.split('@')[0] || 'User') : 'User';
  const reassignmentOptions = [
    currentUserName,
    ...allOwners.filter(owner => owner !== currentUserName)
  ];

  const TaskCard = ({ task, showOwner = false }: { task: Task; showOwner?: boolean }) => (
    <Card key={task.id} className={`group/card transition-all ${task.completed ? 'opacity-60 bg-slate-50' : 'bg-white'}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={task.completed}
            onCheckedChange={() => handleTaskToggle(task.id, task.completed)}
            className="mt-1"
            disabled={updateTaskMutation.isPending || deleteTaskMutation.isPending}
          />
          <div className="flex-1 min-w-0">
            {editingTask === task.id ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => handleKeyPress(e, task.id)}
                  className="text-sm font-medium"
                  autoFocus
                  disabled={updateTaskMutation.isPending}
                />
                <button
                  onClick={() => saveEdit(task.id)}
                  className="text-green-600 hover:text-green-700 p-1"
                  disabled={updateTaskMutation.isPending}
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={cancelEditing}
                  className="text-red-600 hover:text-red-700 p-1"
                  disabled={updateTaskMutation.isPending}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <div 
                  className="group flex items-start gap-2 cursor-pointer flex-1"
                  onClick={() => !task.completed && startEditing(task.id, task.task)}
                >
                  <p className={`text-sm font-medium flex-1 ${task.completed ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                    {task.task}
                  </p>
                  {!task.completed && (
                    <Edit3 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <Popover open={reassigningTask === task.id} onOpenChange={(open) => setReassigningTask(open ? task.id : null)}>
                    <PopoverTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-400 hover:text-blue-600 p-1"
                        disabled={updateTaskMutation.isPending}
                        title="Reassign task"
                      >
                        <UserCheck className="w-3 h-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2" align="end">
                      <div className="space-y-2">
                        <p className="text-xs text-slate-600 font-medium">Reassign to:</p>
                        <div className="space-y-1">
                          {reassignmentOptions.map((owner) => (
                            <Button
                              key={owner}
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-xs h-7"
                              onClick={() => handleReassign(task.id, owner)}
                              disabled={updateTaskMutation.isPending}
                            >
                              {owner === currentUserName ? `${owner} (Me)` : owner}
                            </Button>
                          ))}
                          <div className="border-t pt-1">
                            <Input
                              placeholder="New person..."
                              className="text-xs h-7"
                              onKeyPress={(e) => {
                                if (e.key === "Enter" && e.currentTarget.value.trim()) {
                                  handleReassign(task.id, e.currentTarget.value.trim());
                                  e.currentTarget.value = "";
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(task.id);
                    }}
                    className="text-red-400 hover:text-red-600 p-1"
                    disabled={deleteTaskMutation.isPending}
                    title="Delete task"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 mt-2">
              {showOwner && (
                <div className="flex items-center gap-1 text-xs text-slate-600">
                  <User className="w-3 h-3" />
                  {task.owner}
                </div>
              )}
              {task.due && (
                <div className="flex items-center gap-1 text-xs text-slate-600">
                  <CalendarIcon className="w-3 h-3" />
                  Due {formatDate(task.due)}
                </div>
              )}
              <Badge variant="outline" className={getPriorityColor(task.priority)}>
                {task.priority}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      
      <main className="flex-1 overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Todo Lists</h1>
            <p className="text-slate-600 mt-1">Track and manage all your action items from meetings</p>
          </div>
        </header>
        
        <div className="p-8 h-full overflow-y-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {[1, 2].map((section) => (
                <div key={section} className="space-y-4">
                  <div className="h-8 bg-slate-200 rounded w-1/3 animate-pulse"></div>
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-4 h-4 bg-slate-200 rounded mt-1"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* My Tasks */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-slate-900">My Tasks</h2>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {myTasks.filter(t => !t.completed).length} active
                  </Badge>
                </div>
                
                {myTasks.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-600">No tasks assigned to you yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {myTasks
                      .sort((a, b) => {
                        // Show incomplete tasks first, then completed
                        if (a.completed !== b.completed) {
                          return a.completed ? 1 : -1;
                        }
                        // Within each group, sort by priority
                        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
                        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4;
                        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4;
                        return aPriority - bPriority;
                      })
                      .map((task) => (
                        <TaskCard key={task.id} task={task} />
                      ))}
                  </div>
                )}
              </div>

              {/* Others' Tasks */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-slate-900">Others' Tasks</h2>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                    {otherTasks.filter(t => !t.completed).length} active
                  </Badge>
                </div>
                
                {otherTasks.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-600">No tasks assigned to others yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {otherTasks
                      .sort((a, b) => {
                        // Show incomplete tasks first, then completed
                        if (a.completed !== b.completed) {
                          return a.completed ? 1 : -1;
                        }
                        // Within each group, sort by priority
                        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
                        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4;
                        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4;
                        return aPriority - bPriority;
                      })
                      .map((task) => (
                        <TaskCard key={task.id} task={task} showOwner />
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}