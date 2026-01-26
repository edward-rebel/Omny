# Claude Code Guidelines for Omny

## Git Workflow

**Always pull latest changes before starting new features:**

```bash
git fetch origin
git pull origin main
```

This ensures you're working with the latest codebase and avoids merge conflicts and rebase issues when pushing your changes.

## Project Overview

Omny is a meeting analysis application that uses AI to extract insights from meeting transcripts.

### Tech Stack
- **Frontend:** React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **AI:** OpenAI GPT-5.2

### Key Directories
- `/client/src/` - React frontend
- `/server/` - Express backend
- `/shared/` - Shared types and schemas (Drizzle + Zod)

### Common Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
