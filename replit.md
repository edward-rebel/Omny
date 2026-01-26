# Omny - AI Meeting Memory & Analysis

## Overview

Omny is a web application that transforms raw meeting transcripts into structured insights, action items, and meeting analysis. The system uses AI to analyze meetings and provide effectiveness tracking through a comprehensive dashboard interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **UI Components**: Shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: TanStack React Query for server state
- **Build Tool**: Vite with custom configuration

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints with JSON responses
- **Development**: Hot reloading via Vite middleware integration

### Database & ORM
- **Database**: PostgreSQL (configured for Neon Database)
- **ORM**: Drizzle ORM with type-safe queries
- **Schema**: Structured tables for meetings, projects, tasks, and meta insights
- **Migrations**: Drizzle Kit for schema management

### AI Integration
- **Provider**: OpenAI API for transcript analysis
- **Processing**: Structured JSON extraction from meeting transcripts
- **Analysis**: Meeting effectiveness scoring and action item extraction

## Key Components

### Core Data Models
- **Meetings**: Store transcript data, participants, and analysis results
- **Projects**: Track project updates and status across meetings
- **Tasks**: Action items with ownership, priority, and completion status
- **Meta Insights**: Aggregated leadership effectiveness metrics

### Frontend Pages
- **Dashboard**: Central hub showing tasks, projects, and insights
- **New Meeting**: Transcript input and analysis interface
- **Projects**: Project management and detail views
- **Project Detail**: Individual project timeline and tasks

### Backend Services
- **OpenAI Service**: Transcript processing and structured analysis
- **Analytics Service**: Meta insights generation and trend analysis
- **Storage Service**: Data persistence with in-memory fallback

## Data Flow

1. **Meeting Analysis**: User pastes transcript → OpenAI processes → Structured data extracted
2. **Data Storage**: Analysis results stored across meetings, tasks, and projects tables
3. **Dashboard Updates**: Real-time updates via React Query invalidation
4. **Insights Generation**: Periodic aggregation of meeting data for leadership trends
5. **Project Tracking**: Cross-meeting project status and decision logging

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection
- **openai**: AI transcript processing
- **drizzle-orm**: Type-safe database operations
- **@tanstack/react-query**: Server state management
- **express**: Web server framework

### UI Dependencies
- **@radix-ui/***: Accessible UI component primitives
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library
- **wouter**: Lightweight routing

### Development Tools
- **vite**: Build tool and dev server
- **tsx**: TypeScript execution
- **drizzle-kit**: Database migration tool

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds React app to `dist/public`
- **Backend**: esbuild bundles server to `dist/index.js`
- **Assets**: Static files served from build directory

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string (required)
- **OPENAI_API_KEY**: OpenAI API access (required)
- **NODE_ENV**: Environment mode (development/production)

### Production Setup
- Single Node.js process serving both API and static files
- PostgreSQL database with Drizzle schema
- Environment variables for external service configuration

### Development Workflow
- **Local**: `npm run dev` for hot reloading development server
- **Database**: `npm run db:push` for schema updates
- **Type Safety**: `npm run check` for TypeScript validation

## Recent Changes
- **January 26, 2025**: Simplified Settings System Prompts Interface
  - Removed edit and rerun analysis buttons from system prompts section per user request
  - System prompts now display as read-only content in collapsible sections
  - Cleaned up unused functions and imports related to prompt editing functionality
  - Fixed missing RotateCcw icon import for clear data button
  - Streamlined user interface for better focus on essential settings features
- **January 26, 2025**: Critical Database Persistence Fix
  - Fixed critical data persistence issue by switching from MemStorage to DatabaseStorage
  - All user data (meetings, projects, tasks, system prompts, meta insights) now persists across sessions
  - Resolved TypeScript errors in database storage operations for proper JSON array handling
  - Enhanced React Query cache invalidation for consistent data synchronization
  - Users no longer lose data on login/logout or server restarts
  - All 2 meetings, 4 projects, and 6 tasks are now permanently stored in PostgreSQL database
- **January 26, 2025**: Enhanced project context extraction and intelligent merging
  - Added comprehensive project context field to capture detailed project summaries (3-5 sentences)
  - Enhanced meeting analysis to extract project goals, current state, and background context
  - Implemented context-based project analysis with intelligent merging capabilities
  - AI now analyzes project relationships using both names and contextual information
  - Project merging includes context augmentation combining information from both projects
  - Added project renaming when merging with new comprehensive merged contexts
  - Updated UI to display project context in both project cards and detail pages
  - Enhanced system prompts management with configurable AI behavior across all operations
- **January 26, 2025**: Enhanced meeting summary and project analysis systems
  - Enhanced meeting summaries with three new sections: Meeting Summary (concise overview), comprehensive Key Takeaways, and Topics Discussed
  - Implemented AI-powered project analysis service for intelligent project management
  - Added smart project merging and task attribution using OpenAI analysis
  - Projects now automatically detect relationships and merge similar initiatives
  - Tasks are intelligently assigned to correct projects based on content analysis
  - Enhanced system prompts for more thorough and structured meeting analysis
  - Updated database schema to support new summary fields and project relationships
- **Multi-user Authentication**: Comprehensive Replit Auth integration with OpenID Connect
- **Database Migration**: User-scoped data with PostgreSQL storage and session management
- **Rebranding**: Changed application name to "Omny"

The application architecture emphasizes type safety, real-time updates, and clean separation between AI processing, data persistence, and user interface components.