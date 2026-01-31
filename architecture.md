## Omny Architecture

Omny is an AI-powered meeting analysis app. The system ingests meeting transcripts, runs GPT-powered analysis, stores meetings/projects/tasks, and surfaces insights in a React UI.

This doc is a living overview of the system, its data flow, and key modules. Update it when you change core flows, schemas, or service boundaries.

## System Overview

- **Frontend**: React + TypeScript + Vite + Tailwind + shadcn/ui.
- **Backend**: Express + TypeScript.
- **Database**: PostgreSQL via Drizzle ORM.
- **AI**: OpenAI GPT-5.2 for meeting analysis, project analysis, consolidation, and narratives.

High-level flow:
1. User submits transcript in the UI.
2. Backend analyzes it with OpenAI and stores meeting + tasks + projects.
3. Insights are derived and stored.
4. UI fetches data with React Query and renders dashboards and details.

## Repository Layout

- `client/` React frontend
- `server/` Express backend
- `shared/` Drizzle schema + shared types
- Root config files: `vite.config.ts`, `drizzle.config.ts`, `tsconfig.json`, `tailwind.config.ts`

## Backend Architecture

### Entry Point
- `server/index.ts`
  - Initializes DB schema (`initializeDatabase`)
  - Registers routes (`registerRoutes`)
  - Seeds a local user (`storage.upsertUser`)
  - Sets up Vite dev middleware or static serving
  - Starts server on `PORT`
  - Initializes system prompts on boot

### Routing Layer
- `server/routes.ts`
  - Central API surface for meetings, projects, tasks, insights, settings.
  - Orchestrates AI analysis and storage calls.
  - Uses a local user ID (`local-user`) for all operations.

Key routes (see `server/routes.ts` for full list):
- `POST /api/analyze` — Analyze transcript, store meeting/tasks/projects, generate narratives.
- `POST /api/webhook/meeting` — Zapier webhook ingestion (API key guarded).
- `GET /api/meetings`, `GET /api/meetings/:id`
- `GET /api/projects`, `GET /api/project/:id`
- `POST /api/projects/consolidate/preview`, `POST /api/projects/consolidate/execute`
- `GET /api/tasks`, `PATCH /api/task/:id`
- `GET /api/insights`, `POST /api/sync`
- `POST /api/settings/openai-key`, `POST /api/test-openai`
- `GET /api/system-prompts`, `PATCH /api/system-prompts/:name`
- `POST /api/settings/api-keys`, `GET /api/settings/api-keys`, `DELETE /api/settings/api-keys/:id`
- `POST /api/rerun-analysis`, `DELETE /api/clear-data`

### Storage Layer
- `server/storage.ts`
  - `IStorage` interface abstracts data access.
  - `DatabaseStorage` implements Postgres/Drizzle.
  - `MemStorage` provides in-memory storage (mainly for dev/testing).
  - Key operations: `createMeeting`, `createTask`, `createProject`, `mergeProjects`, `updateMetaInsights`, `getSystemPrompts`, `validateApiKey`.

### Services
- `server/services/openai.ts`
  - `analyzeMeetingTranscript()` calls GPT-5.2 with the `meeting_analysis` prompt and parses structured JSON.
- `server/services/projectAnalysis.ts`
  - `analyzeProjectRelationships()` asks GPT-5.2 to map new projects to existing ones and assign tasks.
  - `processProjectAnalysis()` executes create/merge + task assignments.
- `server/services/analytics.ts`
  - `generateMetaInsights()` aggregates meeting stats.
  - `generateNarrativeInsights()` creates coaching narratives using GPT-5.2.
  - `updateInsightsWithNarrative()` updates insights after each analysis.
- `server/services/projectConsolidation.ts`
  - `analyzeProjectConsolidation()` finds duplicate projects for merging.
  - `executeConsolidation()` performs the merges with batching + retry logic.
- `server/services/systemPrompts.ts`
  - Seeds and serves default prompts.
  - `getUserSpecificPrompt()` substitutes user data into prompts.

### Auth (Optional / Not Wired)
- `server/replitAuth.ts`
  - Replit OIDC + session support with Postgres-backed sessions.
  - Not currently invoked from `server/index.ts`.
  - Frontend `useAuth` expects `/api/auth/user`, which is not defined in `server/routes.ts`.

## Frontend Architecture

### Entry Point
- `client/src/main.tsx` bootstraps React.
- `client/src/App.tsx` sets up routing (Wouter), React Query, and UI providers.

### Pages
- `client/src/pages/`
  - `Dashboard.tsx`, `NewMeeting.tsx`, `Meetings.tsx`, `MeetingDetail.tsx`
  - `Projects.tsx`, `ProjectDetail.tsx`, `Todos.tsx`
  - `Insights.tsx`, `Settings.tsx`

### Components
- `client/src/components/`
  - UI cards for meetings, projects, tasks, insights.
  - `TranscriptInput` handles transcript submission.
  - `Sidebar` provides navigation.
  - `ui/` contains shadcn/ui primitives.

### Data Fetching
- `client/src/lib/queryClient.ts`
  - `apiRequest()` handles POST/PATCH/DELETE with JSON body.
  - `getQueryFn()` wraps GET requests for React Query.
  - Requests include `credentials: "include"`.

## Shared Schema and Types

- `shared/schema.ts`
  - Drizzle table definitions + Zod insert schemas.
  - Types exported for both server and client (aliases via `@shared/schema`).
  - Key tables: `users`, `meetings`, `projects`, `tasks`, `metaInsights`, `systemPrompts`, `apiKeys`, `sessions`.

## Core Data Flows

### Meeting Analysis (Primary Flow)
1. UI submits transcript to `POST /api/analyze`.
2. `analyzeMeetingTranscript()` returns structured analysis JSON.
3. Meeting stored via `storage.createMeeting()`.
4. Tasks created for user and others.
5. Project analysis:
   - `analyzeProjectRelationships()` returns mapping + assignments.
   - `processProjectAnalysis()` creates/merges projects and assigns tasks.
6. Narrative insights generated via `updateInsightsWithNarrative()`.
7. Response includes meeting, tasks, projects, analysis.

### Zapier Webhook Ingestion
1. `POST /api/webhook/meeting` with API key and transcript.
2. Same analysis/storage pipeline as manual.
3. Meeting source stored as `zapier`.

### Project Consolidation
1. `POST /api/projects/consolidate/preview` analyzes all projects.
2. `POST /api/projects/consolidate/execute` merges duplicates, reassigns tasks.

### Insights Sync
1. `POST /api/sync` recomputes meta insights.
2. `GET /api/insights` reads latest values.

## Database & Persistence

- `server/db.ts` initializes the Postgres pool and Drizzle client.
- `server/initDb.ts` creates tables on boot if needed.
- `drizzle.config.ts` configures Drizzle migrations.

## Configuration & Environment

Common env vars:
- `DATABASE_URL` — Postgres connection string (required).
- `OPENAI_API_KEY` / `API_KEY` — OpenAI credentials.
- `PORT` — API server port (defaults to 3000).
- `NODE_ENV` — `development` or `production`.

Auth-specific (if enabled):
- `REPLIT_DOMAINS`, `REPL_ID`, `ISSUER_URL`
- `SESSION_SECRET`

## Dev vs Prod Runtime

- Dev: `server/index.ts` uses `setupVite()` to serve the Vite dev middleware.
- Prod: `serveStatic()` serves `dist/public` and falls back to `index.html`.

## Key Files to Know

- `server/index.ts` — server bootstrap
- `server/routes.ts` — API surface and orchestration
- `server/storage.ts` — data access layer
- `server/services/openai.ts` — meeting analysis
- `server/services/projectAnalysis.ts` — AI project mapping + task assignment
- `server/services/analytics.ts` — insights + narratives
- `server/services/projectConsolidation.ts` — project deduping
- `shared/schema.ts` — schema + shared types
- `client/src/App.tsx` — routing and providers
- `client/src/lib/queryClient.ts` — API client utilities

## Operational Notes

- The app uses a single local user (`local-user`) for data operations.
- Prompt templates live in `server/services/systemPrompts.ts` and are seeded into the DB.
- AI calls expect strict JSON responses and include defensive parsing.

## Suggested Update Checklist

Update this document when you:
- Add or remove API endpoints.
- Change OpenAI prompts or analysis structures.
- Modify the data model in `shared/schema.ts`.
- Change the auth strategy or user model.
