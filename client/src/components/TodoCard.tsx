import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Task } from "@shared/schema";

interface TodoCardProps {
  title: string;
  tasks: Task[];
  isOwner?: boolean;
  badgeColor?: string;
}

export function TodoCard({ title, tasks, isOwner = false, badgeColor = "bg-primary-100 text-primary-700" }: TodoCardProps) {
  const queryClient = useQueryClient();

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: number; completed: boolean }) => {
      const response = await apiRequest("PATCH", `/api/task/${taskId}`, { completed });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

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

  const handleTaskToggle = (taskId: number, completed: boolean) => {
    updateTaskMutation.mutate({ taskId, completed });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOwner ? "bg-primary" : "bg-emerald-600"}`}></div>
          {title}
        </h2>
        <Badge className={`${badgeColor} px-3 py-1 rounded-full text-sm font-medium`}>
          {tasks.length}
        </Badge>
      </div>

      <div className="space-y-4">
        {tasks.slice(0, 4).map((task) => (
          <div 
            key={task.id} 
            className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
              task.completed ? "bg-gray-50" : "bg-slate-50 hover:bg-slate-100"
            }`}
          >
            {isOwner ? (
              <input 
                type="checkbox" 
                checked={task.completed}
                onChange={(e) => handleTaskToggle(task.id, e.target.checked)}
                className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary focus:ring-2"
              />
            ) : (
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-medium">{getInitials(task.owner)}</span>
              </div>
            )}
            
            <div className="flex-1">
              <p className={`text-sm font-medium ${task.completed ? "text-gray-500 line-through" : "text-slate-900"}`}>
                {isOwner ? task.task : `${task.owner}: ${task.task}`}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {task.due && (
                  <p className="text-xs text-slate-500">Due: {task.due}</p>
                )}
                <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                  {task.priority}
                </Badge>
              </div>
            </div>
            
            {!isOwner && (
              <div className={`w-3 h-3 rounded-full ${
                task.priority === "urgent" ? "bg-red-400" : 
                task.priority === "high" ? "bg-amber-400" : 
                task.priority === "medium" ? "bg-green-400" : "bg-blue-400"
              }`}></div>
            )}
          </div>
        ))}
      </div>

      {tasks.length > 0 && (
        <Link href="/todos">
          <Button 
            variant="outline" 
            className="w-full mt-4 flex items-center justify-center gap-2"
          >
            View all {isOwner ? "my" : "delegated"} todos
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}
