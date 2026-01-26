import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Users, BarChart3, FileText, CheckCircle, ArrowRight } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-slate-900 dark:text-slate-100">
              Omny
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              Transform your meeting transcripts into structured insights and action items with AI-powered analysis.
            </p>
          </div>
          
          <div className="flex justify-center">
            <Button size="lg" asChild className="text-lg px-8 py-6">
              <a href="/dashboard" className="flex items-center gap-2">
                Get Started <ArrowRight className="w-5 h-5" />
              </a>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          <Card className="text-center">
            <CardHeader>
              <Brain className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <CardTitle className="text-lg">AI-Powered Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Advanced AI processes your meeting transcripts to extract key insights and action items automatically.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <CardTitle className="text-lg">Action Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Never miss a follow-up. Track action items with owners, priorities, and due dates across all meetings.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Users className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              <CardTitle className="text-lg">Project Management</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Monitor project progress across meetings with automated status updates and timeline tracking.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <BarChart3 className="w-12 h-12 text-orange-600 mx-auto mb-4" />
              <CardTitle className="text-lg">Meeting Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Get detailed analysis and feedback on meeting effectiveness and improvement opportunities.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Benefits Section */}
        <div className="mt-20 text-center space-y-12">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              Why Choose Omny?
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
              Turn every meeting into actionable insights and track your meeting effectiveness over time.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <FileText className="w-16 h-16 text-blue-600 mx-auto" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Structured Data Extraction
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                Convert messy meeting transcripts into organized, searchable data with clear action items and project updates.
              </p>
            </div>

            <div className="space-y-4">
              <BarChart3 className="w-16 h-16 text-green-600 mx-auto" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Meeting Analysis
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                Receive detailed feedback on meeting effectiveness, communication patterns, and improvement areas.
              </p>
            </div>

            <div className="space-y-4">
              <Users className="w-16 h-16 text-purple-600 mx-auto" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Team Alignment
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                Keep everyone accountable with clear task ownership, deadlines, and progress tracking across projects.
              </p>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
}