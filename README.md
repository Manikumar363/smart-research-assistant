# 🔬 Smart Research Assistant

A comprehensive AI-powered research platform that combines document analysis, live data integration, and advanced query refinement to provide intelligent research insights with proper citations and source attribution.

## 🚀 Features

### Core Capabilities
- **📄 Document Processing**: Upload and analyze PDFs, Word documents, and text files
- **🤖 AI-Powered Analysis**: Azure OpenAI GPT-4.1 integration for intelligent responses
- **🔍 Semantic Search**: Pinecone vector database for advanced document retrieval
- **📊 Live Data Integration**: Real-time data ingestion via Python Pathway service
- **🧵 Thread Management**: Persistent conversation threads with context preservation
- **📈 Usage Analytics**: Credit-based system with detailed billing and usage tracking
- **🔐 Authentication**: Secure JWT-based user authentication and session management

### Advanced Features
- **Iterative Query Refinement**: Multi-step query processing for enhanced accuracy
- **Session Isolation**: User-specific namespaces for document and conversation management
- **Fallback Systems**: Robust error handling with offline thread support
- **Real-time Progress**: Live updates during document processing and report generation
- **Citation Management**: Proper source attribution and citation formatting

## 🛠️ Technology Stack

### Backend
- **Node.js** with Express.js framework
- **Azure OpenAI** (GPT-4.1) for chat completions and text-embedding-ada-002 for embeddings
- **Pinecone** vector database for semantic search
- **MongoDB Atlas** for data persistence
- **JWT** for authentication
- **Multer** for file upload handling

### Frontend
- **React 18** with modern hooks and context API
- **React Router** for client-side navigation
- **Vite** for fast development and building
- **Lucide React** for modern icons
- **Responsive CSS** with mobile-first design

### Python Services
- **Pathway** for real-time data processing
- **Python-dotenv** for environment management
- **Asyncio** for asynchronous operations

## 📦 Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- Python (v3.8 or higher)
- MongoDB Atlas account
- Azure OpenAI Service account
- Pinecone account

### 1. Clone the Repository
```bash
git clone https://github.com/Ftdgufvfi/Hack_Rag.git
cd Hack_2025_RAG
```

### 2. Backend Setup
```bash
cd backend
npm install
```

Create `.env` file in the backend directory:
```env
# Environment Configuration
NODE_ENV=development
PORT=5001

# Database Configuration - MongoDB Atlas
DB_USER=your_mongodb_username
DB_PASSWORD=your_mongodb_password
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/research-assistant?retryWrites=true&w=majority&appName=Cluster0

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-too
JWT_EXPIRES_IN=15m

# Frontend Configuration
CLIENT_URL_DEV=http://localhost:5174
CLIENT_URL_PROD=https://your-frontend-production-url.com

# Azure OpenAI API (Azure AI Foundry)
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
AZURE_OPENAI_BASE_URL=https://your-resource-name.cognitiveservices.azure.com/openai/
AZURE_OPENAI_API_VERSION=2024-12-01-preview
AZURE_OPENAI_EMBEDDING_API_VERSION=2023-05-15
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4.1
AZURE_OPENAI_COMPLETIONS_DEPLOYMENT=gpt-4.1

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=research-assistant
PINECONE_ENVIRONMENT=your_pinecone_environment
PINECONE_INDEX_HOST=research-assistant-xxxxxx.svc.your-environment.pinecone.io

AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME=text-embedding-ada-002

# CORS Origins (comma-separated)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5174,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:5174,https://localhost:3000,https://localhost:3001,https://localhost:5174,https://your-frontend-production-url.com

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=5242880
```

### 3. Frontend Setup
```bash
cd react-research-assistant
npm install
```

### 4. Python Pathway Service Setup
```bash
cd pathway-service
python -m venv pathway-env
# On Windows:
pathway-env\Scripts\activate
# On macOS/Linux:
source pathway-env/bin/activate

pip install -r requirements.txt
```

Create `.env` file in the pathway-service directory:
```env
# Environment Configuration for Pathway Service

# Weather API Configuration
WEATHER_API_KEY=your_openweather_api_key_here
WEATHER_BASE_URL=https://api.openweathermap.org/data/2.5

# Node.js Backend Configuration
NODE_BACKEND_URL=http://localhost:5001
NODE_BACKEND_ENDPOINT=/api/pathway/ingest

# Pathway Service Configuration
PATHWAY_PORT=8000
PATHWAY_HOST=localhost

# Data Processing Configuration
INGESTION_INTERVAL=30  # 30 seconds for demo/testing
BATCH_SIZE=10
MAX_RETRIES=3

# Logging Configuration
LOG_LEVEL=INFO
```

## 🚀 Running the Application

### Start All Services

1. **Backend Server** (Terminal 1):
```bash
cd backend
npm start
```

2. **Frontend Development Server** (Terminal 2):
```bash
cd react-research-assistant
npm run dev
```

3. **Python Pathway Service** (Terminal 3):
```bash
cd pathway-service
pathway-env\Scripts\activate  # Windows
# or source pathway-env/bin/activate  # macOS/Linux
python simple_pathway_service.py
```

### Access the Application
- **Frontend**: http://localhost:5174
- **Backend API**: http://localhost:5001
- **Pathway Service**: http://localhost:8000

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │   Node.js API   │    │ Python Pathway  │
│   (Frontend)    │───▶│   (Backend)     │───▶│   (Live Data)   │
│                 │    │                 │    │                 │
│ • UI/UX         │    │ • Authentication│    │ • Data Ingestion│
│ • File Upload   │    │ • File Processing│    │ • Real-time Proc│
│ • Chat Interface│    │ • Vector Storage│    │ • API Integration│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │   MongoDB Atlas │              │
         │              │   (Database)    │              │
         │              │                 │              │
         │              │ • User Data     │              │
         │              │ • Sessions      │              │
         │              │ • Conversations │              │
         │              └─────────────────┘              │
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         └─────────────▶│   Azure OpenAI  │◀─────────────┘
                        │   (AI Service)  │
                        │                 │
                        │ • GPT-4.1       │
                        │ • Embeddings    │
                        │ • Chat Complete │
                        └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    Pinecone     │
                        │ (Vector Store)  │
                        │                 │
                        │ • Semantic Search│
                        │ • Document Index│
                        │ • Vector Retriev│
                        └─────────────────┘
```

### Key Features Flow

1. **Document Upload**: Files are processed, chunked, and embedded using Azure OpenAI
2. **Vector Storage**: Embeddings are stored in Pinecone with session-based namespacing
3. **Query Processing**: User questions are refined and processed through multiple steps
4. **Semantic Search**: Relevant document chunks are retrieved using vector similarity
5. **AI Response**: Azure OpenAI generates responses with proper citations
6. **Live Data**: Pathway service provides real-time data integration

## 🧪 Testing

### Backend Tests
```bash
cd backend
# Test Azure OpenAI connection
node test-azure-openai.js

# Test Pinecone integration
node test-pinecone.js

# Test query refinement
node test-query-refiner.js

# Test thread persistence
node test-thread-persistence.js
```

### Create Pinecone Index
```bash
cd backend
node create-pinecone-index.js
```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - User logout

### File Management
- `POST /api/files/upload` - Upload and process documents
- `GET /api/files/documents` - List user documents
- `DELETE /api/files/:id` - Delete document
- `GET /api/files/pinecone-status` - Check Pinecone connection

### Research Endpoints
- `POST /api/files/ask` - Submit research question
- `GET /api/user/sessions` - Get user sessions
- `GET /api/user/usage` - Get usage statistics

### Live Sources
- `POST /api/live-sources/register` - Register live data source
- `GET /api/live-sources/sources` - List registered sources
- `POST /api/pathway/ingest` - Ingest live data

## 🔧 Configuration

### Environment Variables

#### Required Azure OpenAI Variables
- `AZURE_OPENAI_API_KEY`: Your Azure OpenAI API key
- `AZURE_OPENAI_BASE_URL`: Azure OpenAI endpoint URL
- `AZURE_OPENAI_DEPLOYMENT_NAME`: Chat completion deployment name
- `AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME`: Embedding deployment name

#### Required Pinecone Variables
- `PINECONE_API_KEY`: Pinecone API key
- `PINECONE_INDEX_NAME`: Index name for vector storage
- `PINECONE_ENVIRONMENT`: Pinecone environment

#### Required MongoDB Variables
- `MONGODB_URI`: MongoDB Atlas connection string

## 🚀 Deployment

### Production Deployment Checklist

1. **Environment Configuration**:
   - Set `NODE_ENV=production`
   - Configure production database URLs
   - Set secure JWT secrets
   - Configure CORS origins

2. **Security**:
   - Enable HTTPS
   - Set secure cookie options
   - Configure rate limiting
   - Enable API key rotation

3. **Monitoring**:
   - Set up logging
   - Configure error tracking
   - Monitor API usage
   - Set up health checks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **GitHub Repository**: https://github.com/Ftdgufvfi/Hack_Rag
- **Azure OpenAI Documentation**: https://docs.microsoft.com/en-us/azure/cognitive-services/openai/
- **Pinecone Documentation**: https://docs.pinecone.io/
- **MongoDB Atlas**: https://www.mongodb.com/cloud/atlas

## 🆘 Support

For support and questions:
1. Check the [Issues](https://github.com/Ftdgufvfi/Hack_Rag/issues) page
2. Review the troubleshooting guides in `/backend/` directory
3. Check the API documentation above

---

Built with ❤️ for the Smart Research Assistant hackathon challenge.
