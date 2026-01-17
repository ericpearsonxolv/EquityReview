# EquityReview Prototype (Catalight)

## Overview
A web application for Catalight HR teams to analyze performance review data using AI-powered bias detection, values alignment assessment, and rating consistency analysis.

## Current State
- Production-ready implementation with full upload-analyze-download workflow
- Uses mock LLM provider (no external API keys required, easily swappable for Azure OpenAI)
- PostgreSQL database storage for persistent job history
- All navigation sections fully functional

## Tech Stack
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express + TypeScript
- **Excel Processing**: exceljs for parsing and generating Excel files
- **File Upload**: multer for multipart/form-data handling

## Project Structure
```
├── client/                 # React frontend
│   └── src/
│       ├── pages/          # Page components
│       │   └── analysis-portal.tsx  # Main analysis UI
│       ├── components/     # UI components (shadcn/ui)
│       └── lib/            # Utilities
├── server/                 # Express backend
│   ├── routes.ts           # API endpoints
│   ├── storage.ts          # In-memory job storage
│   ├── llm/
│   │   └── provider.ts     # LLM abstraction (mock provider)
│   ├── excel/
│   │   ├── parser.ts       # Excel file parsing
│   │   └── writer.ts       # Results Excel generation
│   └── scripts/
│       └── generate-sample-xlsx.ts  # Sample data generator
├── shared/                 # Shared types and schemas
│   └── schema.ts           # Zod schemas, types, escalation rules
└── tmp/                    # Generated result files
```

## API Endpoints
- `POST /api/analyze` - Upload Excel file with reviewBatch name, returns jobId
- `GET /api/jobs` - List all jobs with status and metadata
- `GET /api/jobs/:jobId` - Get job status, progress, and result info
- `GET /api/jobs/:jobId/results` - Get job analysis results data
- `GET /api/jobs/:jobId/download` - Download results Excel file
- `GET /api/stats` - Get aggregate stats (totalAnalyzed, totalRedFlags, completedJobs)

## Key Features
1. **Excel Upload**: Upload .xlsx performance review data
2. **AI Analysis**: Mock LLM analyzes each employee for:
   - Bias indicators in manager comments
   - Values alignment between employee and manager ratings
   - Rating consistency across goal/values/overall categories
3. **Escalation Rules**: Automatically flags RED for:
   - Rating mismatch >= 2 levels
   - Insufficient narrative (< 20 chars)
   - Loaded language without evidence
   - Policy-sensitive content (medical, discrimination, etc.)
4. **Results Download**: Generated Excel with AI recommendations
5. **Reports Page**: View all completed analyses with download history
6. **Compliance Page**: Review escalation flags, audit policies, and compliance checklist
7. **Real-time Stats**: Sidebar shows live counts of reviews analyzed and RED flags

## Running the App
```bash
npm run dev
```

## Generate Sample Test Data
```bash
npx tsx server/scripts/generate-sample-xlsx.ts
```
This creates `tmp/sample-performance-reviews.xlsx` with 25 test employees.

## Environment Variables
- `LLM_PROVIDER`: Set to "mock" (default) or "azure_openai"
- Future Azure OpenAI support: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT_CHAT

## User Preferences
- Professional, enterprise-grade UI using Fluent Design principles
- Clean, minimal interface focused on task completion
- Clear status indicators and progress feedback
