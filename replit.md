# EquityReview Prototype (Catalight)

## Overview
A web application for Catalight HR teams to analyze performance review data using AI-powered bias detection, values alignment assessment, and rating consistency analysis. Features SharePoint integration for reports history, admin configuration panels, and audit logging.

## Current State
- Production-ready implementation with full upload-analyze-download workflow
- Uses mock LLM provider (no external API keys required, easily swappable for Azure OpenAI)
- PostgreSQL database storage for persistent job history
- SharePoint integration for reports history (optional)
- Admin configuration pages for General, Security, Directory, Workday, SharePoint, and Audit
- Modern indigo/blue/teal UI palette with colorful status badges

## Tech Stack
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Excel Processing**: exceljs for parsing and generating Excel files
- **File Upload**: multer for multipart/form-data handling
- **SharePoint**: Microsoft Graph API with @azure/identity

## Project Structure
```
├── client/                 # React frontend
│   └── src/
│       ├── pages/          # Page components
│       │   ├── analysis-portal.tsx  # Main analysis UI with Recent Runs
│       │   ├── reports.tsx          # Report history with filters
│       │   ├── compliance.tsx       # Escalation flags and policies
│       │   └── admin/               # Admin configuration pages
│       │       ├── general.tsx      # App defaults
│       │       ├── security.tsx     # Access control
│       │       ├── directory.tsx    # IDP configuration
│       │       ├── workday.tsx      # HRIS integration
│       │       ├── sharepoint.tsx   # SharePoint settings
│       │       └── audit.tsx        # Audit log viewer
│       ├── components/     # UI components (shadcn/ui)
│       └── lib/            # Utilities
├── server/                 # Express backend
│   ├── routes.ts           # API endpoints
│   ├── storage.ts          # Database storage
│   ├── db.ts               # Database connection
│   ├── integrations/
│   │   └── sharepoint/     # SharePoint integration
│   │       ├── SharePointClient.ts  # Graph API client
│   │       └── types.ts             # Type definitions
│   ├── services/
│   │   ├── config.ts       # Config persistence (JSON file)
│   │   └── audit.ts        # Audit logging service
│   ├── llm/
│   │   └── provider.ts     # LLM abstraction (mock provider)
│   ├── excel/
│   │   ├── parser.ts       # Excel file parsing
│   │   └── writer.ts       # Results Excel generation
│   ├── .data/              # Local data storage
│   │   ├── config.json     # Application configuration
│   │   └── audit.log.jsonl # Audit event log
│   └── scripts/
│       └── generate-sample-xlsx.ts  # Sample data generator
├── shared/                 # Shared types and schemas
│   └── schema.ts           # Zod schemas, types, escalation rules
└── tmp/                    # Generated result files
```

## API Endpoints

### Analysis
- `POST /api/analyze` - Upload Excel file with reviewBatch name, returns jobId
- `GET /api/jobs` - List all jobs with status and metadata
- `GET /api/jobs/:jobId` - Get job status, progress, and result info
- `GET /api/jobs/:jobId/results` - Get job analysis results data
- `GET /api/jobs/:jobId/download` - Download results Excel file
- `GET /api/stats` - Get aggregate stats (totalAnalyzed, totalRedFlags, completedJobs)

### History (SharePoint)
- `GET /api/history` - Get reports history (from SharePoint if configured, else from local DB)
- `POST /api/history/resolve` - Resolve SharePoint site and list IDs
- `POST /api/history/test` - Test SharePoint connection

### Configuration
- `GET /api/config` - Get all configuration
- `GET/PUT /api/config/general` - General app settings
- `GET/PUT /api/config/security` - Security settings
- `GET/PUT /api/config/directory` - Directory/IDP settings
- `GET/PUT /api/config/workday` - Workday integration settings
- `GET/PUT /api/config/sharepoint` - SharePoint settings

### Audit
- `GET /api/audit` - Get audit events (supports ?top=N and ?eventType=X filters)

## Key Features

### Analysis Features
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

### UI Features
5. **Recent Runs Widget**: Dashboard shows last 5 analysis runs with status
6. **Reports Page**: View all completed analyses with search/filter, download history
7. **Compliance Page**: Review escalation flags, audit policies, and compliance checklist
8. **Real-time Stats**: Sidebar shows live counts of reviews analyzed and RED flags

### Admin Features
9. **General Settings**: Default batch prefix, retention days, max rows
10. **Security Settings**: Login requirements, allowed domains/groups (placeholders)
11. **Directory Settings**: IDP provider configuration (Entra/Okta/Google)
12. **Workday Integration**: HRIS connection settings (placeholder)
13. **SharePoint Integration**: Configure and test SharePoint list connection
14. **Audit Log**: View system events and activity history

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

### Core
- `LLM_PROVIDER`: Set to "mock" (default) or "azure_openai"
- `DATABASE_URL`: PostgreSQL connection string (auto-configured by Replit)

### Azure OpenAI (Future)
- `AZURE_OPENAI_ENDPOINT`: Azure OpenAI endpoint URL
- `AZURE_OPENAI_API_KEY`: Azure OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT_CHAT`: Deployment name for chat model

### SharePoint Integration
- `SHAREPOINT_SITE_URL`: SharePoint site URL (e.g., https://contoso.sharepoint.com/sites/HR)
- `SHAREPOINT_LIST_NAME`: Display name of the SharePoint list
- `USE_MANAGED_IDENTITY`: Set to "true" in Azure to use Managed Identity

### Service Principal (for dev/Replit)
- `SP_TENANT_ID`: Azure AD tenant ID
- `SP_CLIENT_ID`: App registration client ID
- `SP_CLIENT_SECRET`: App registration client secret

## SharePoint List Setup

### Required List Columns
Create a SharePoint list with these columns:
- Title (default, rename to RunId)
- ReviewBatch (Single line of text)
- RunId (Single line of text)
- SubmittedBy (Single line of text)
- SubmittedAt (Date and Time)
- FileName (Single line of text)
- TotalEmployees (Number)
- RedCount (Number)
- GreenCount (Number)
- Status (Choice: Pending, Completed, Failed)
- OutputFileUrl (Single line of text / Hyperlink)
- ErrorMessage (Multiple lines of text)

### Service Principal Permissions
Required Microsoft Graph permissions:
- Sites.ReadWrite.All (Application)
- Sites.Selected (for restricted access)

## Migration to Azure

### Authentication
- Replace service principal with Managed Identity (set USE_MANAGED_IDENTITY=true)
- Use Azure Static Web Apps authentication with Entra ID

### Secrets
- Move secrets to Azure Key Vault
- Reference secrets in App Configuration

### Configuration
- Replace config.json with Azure App Configuration
- Use feature flags for environment-specific behavior

### Database
- Migrate to Azure Database for PostgreSQL
- Use connection strings from Key Vault

## User Preferences
- Professional, enterprise-grade UI with modern indigo/blue/teal palette
- Clean, minimal interface focused on task completion
- Clear status indicators with colorful badges (GREEN/RED/Pending)
- Sidebar with collapsible navigation and quick stats
