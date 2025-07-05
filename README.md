# Financial Advisor AI Agent - Backend

A comprehensive AI agent for financial advisors that integrates with Gmail, Google Calendar, and HubSpot CRM.

## Features

- **Google OAuth Integration** - Secure authentication with Gmail and Calendar access
- **HubSpot CRM Integration** - Contact management and note tracking
- **RAG (Retrieval-Augmented Generation)** - Vector search through emails and contacts
- **AI-Powered Chat Interface** - ChatGPT-like interface with tool calling
- **Task Management** - Long-running task handling and memory
- **Proactive Agent** - Automated responses based on ongoing instructions

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+ with pgvector extension
- Google Cloud Console project
- HubSpot developer account
- OpenAI API key

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Jtest-Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL with pgvector**
   ```bash
   # Install pgvector extension
   CREATE EXTENSION IF NOT EXISTS vector;
   
   # Run the database schema
   psql -d your_database -f dbschema.txt
   ```

4. **Environment Configuration**
   Create a `.env` file with the following variables:
   ```env
   # Server Configuration
   NODE_ENV=development
   PORT=3001
   FRONTEND_URL=http://localhost:3000

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=financial_advisor_agent
   DB_USER=postgres
   DB_PASSWORD=your_password

   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

   # OpenAI Configuration
   OPENAI_API_KEY=your-openai-api-key

   # Google OAuth Configuration
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

   # HubSpot Configuration
   HUBSPOT_CLIENT_ID=your-hubspot-client-id
   HUBSPOT_CLIENT_SECRET=your-hubspot-client-secret
   HUBSPOT_REDIRECT_URI=http://localhost:3001/api/auth/hubspot/callback

   # Email Configuration
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Gmail API and Google Calendar API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3001/api/auth/google/callback`
6. Add test users (including `webshookeng@gmail.com`)

## HubSpot Setup

1. Go to [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Create a new app
3. Configure OAuth settings
4. Add redirect URI: `http://localhost:3001/api/auth/hubspot/callback`
5. Get Client ID and Client Secret

## Running the Application

1. **Development mode**
   ```bash
   npm run dev
   ```

2. **Production mode**
   ```bash
   npm run build
   npm start
   ```

## API Endpoints

### Authentication
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/hubspot` - Initiate HubSpot OAuth
- `GET /api/auth/hubspot/callback` - HubSpot OAuth callback
- `GET /api/auth/status` - Check authentication status
- `POST /api/auth/logout` - Logout user

### Chat
- `POST /api/chat/message` - Send message to AI agent
- `GET /api/chat/conversations` - Get recent conversations
- `GET /api/chat/conversations/:sessionId` - Get conversation history
- `GET /api/chat/conversations/search` - Search conversations
- `DELETE /api/chat/conversations/:sessionId` - Delete conversation

### Tasks
- `GET /api/chat/tasks` - Get user tasks
- `GET /api/chat/tasks/:id` - Get specific task
- `PUT /api/chat/tasks/:id` - Update task

## Database Schema

The application uses the following main tables:
- `users` - User accounts and profiles
- `user_credentials` - OAuth tokens for integrations
- `email_embeddings` - Vector embeddings for email content
- `hubspot_embeddings` - Vector embeddings for HubSpot contacts
- `tasks` - Long-running tasks and their status
- `ongoing_instructions` - Persistent instructions for the AI agent
- `conversations` - Chat conversation history
- `calendar_events` - Calendar event tracking

## Architecture

- **Express.js** - Web framework
- **PostgreSQL + pgvector** - Database with vector search
- **OpenAI GPT-4** - AI language model
- **JWT** - Authentication
- **OAuth 2.0** - Third-party integrations

## Development

### Project Structure
```
src/
├── config/          # Database and configuration
├── controllers/     # API route handlers
├── middleware/      # Authentication and validation
├── modules/         # Database models
├── routes/          # API route definitions
├── services/        # Business logic and integrations
├── types/           # TypeScript type definitions
└── utils/           # Helper functions
```

### Adding New Features

1. **New API Endpoints**: Add to appropriate controller and route files
2. **New Integrations**: Create service in `services/` directory
3. **Database Changes**: Update schema and create migration
4. **AI Tools**: Add to `ai.service.ts` tools array

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Deployment

1. Set up production environment variables
2. Configure production database
3. Set up reverse proxy (nginx)
4. Use PM2 or similar for process management
5. Configure SSL certificates

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

## License

MIT License 