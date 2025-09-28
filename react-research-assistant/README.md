# Smart Research Assistant - React UI

A modern, React-based web application for the Smart Research Assistant hackathon challenge. This application provides an intuitive interface for users to ask research questions, upload documents, and receive AI-generated reports with citations and live data integration.

## 🚀 Features

### Core Functionality
- **Question Input Interface**: Clean, user-friendly form for research questions
- **File Upload System**: Drag-and-drop file upload with support for PDF, DOC, DOCX, TXT
- **Real-time Progress Tracking**: Visual progress indicators during report generation
- **Interactive Dashboard**: Statistics and live data integration status
- **Report Management**: View, download, and share generated research reports
- **Usage Tracking**: Credit-based billing system with detailed activity logs

### Technical Features
- **React 18**: Modern React with hooks and context API
- **React Router**: Client-side routing for single-page application
- **Responsive Design**: Mobile-first design that works on all devices
- **Modern UI/UX**: Beautiful gradients, animations, and micro-interactions
- **Accessibility**: WCAG-compliant with keyboard navigation and screen reader support
- **State Management**: Context API for global state management
- **Component Architecture**: Modular, reusable components

## 🛠️ Technology Stack

- **Frontend Framework**: React 18 with Vite
- **Routing**: React Router DOM
- **Icons**: Lucide React (modern icon library)
- **Styling**: CSS3 with modern features (Grid, Flexbox, Custom Properties)
- **State Management**: React Context API with useReducer
- **Build Tool**: Vite (fast development and building)
- **Package Manager**: npm

## 📦 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- npm (v7 or higher)

### Quick Start
```bash
# Clone or navigate to the project directory
cd react-research-assistant

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:5173
```

## 🎨 Design System

### Color Palette
- **Primary**: `#667eea` (Vibrant blue)
- **Secondary**: `#764ba2` (Purple)
- **Success**: `#28a745` (Green)
- **Warning**: `#ffc107` (Yellow)
- **Danger**: `#dc3545` (Red)
- **Background**: Linear gradient from `#667eea` to `#764ba2`

## 📱 Responsive Design

The application is fully responsive and optimized for:
- **Desktop**: 1200px+ (Full layout with side-by-side components)
- **Tablet**: 768px - 1199px (Stacked layout with adjusted spacing)
- **Mobile**: Below 768px (Single column layout with touch-friendly elements)

## 🔄 State Management

The application uses React Context API for state management with features like:
- Global state for questions, reports, and usage tracking
- Real-time progress updates during report generation
- File upload management with drag-and-drop support
- Credit-based billing system integration

## 🎯 Key Features

### File Upload System
- Drag & Drop interface with visual feedback
- File validation (size limits and type checking)
- Real-time file management

### Report Generation
- 4-step progressive loading with visual indicators
- Real-time progress tracking
- Formatted reports with citations and sources

### Dashboard Analytics
- Live usage statistics and metrics
- Data source monitoring
- Activity timeline

### Billing Integration
- Credit-based usage tracking
- Detailed pricing information
- Transaction history

## 🚀 Getting Started

1. **Start the development server**: `npm run dev`
2. **Open your browser**: Navigate to `http://localhost:5173`
3. **Explore the features**:
   - Ask research questions on the Home page
   - Upload documents using drag & drop
   - View generated reports with citations
   - Monitor usage and billing in the Usage section
   - Check live statistics on the Dashboard

Built with ❤️ for the Smart Research Assistant hackathon challenge.+ Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
