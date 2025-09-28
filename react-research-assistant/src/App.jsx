import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Home from './components/Home'
import Dashboard from './components/Dashboard'
import Sessions from './components/Sessions'
import Reports from './components/Reports'
import Usage from './components/Usage'
import ModernLiveSources from './components/ModernLiveSources'
import Login from './components/Login'
import Signup from './components/Signup'
import ProtectedRoute from './components/ProtectedRoute'
import ProgressModal from './components/ProgressModal'
import { ResearchProvider } from './context/ResearchContext'
import { AuthProvider } from './context/AuthContext'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <ResearchProvider>
        <Router>
          <div className="app">
            <Header />
            <main className="main-content">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/" element={
                  <ProtectedRoute>
                    <Sessions />
                  </ProtectedRoute>
                } />
                <Route path="/sessions" element={
                  <ProtectedRoute>
                    <Sessions />
                  </ProtectedRoute>
                } />
                <Route path="/home" element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                } />
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/reports" element={
                  <ProtectedRoute>
                    <Reports />
                  </ProtectedRoute>
                } />
                <Route path="/usage" element={
                  <ProtectedRoute>
                    <Usage />
                  </ProtectedRoute>
                } />
                <Route path="/live-sources" element={
                  <ProtectedRoute>
                    <ModernLiveSources />
                  </ProtectedRoute>
                } />
              </Routes>
            </main>
            <ProgressModal />
          </div>
        </Router>
      </ResearchProvider>
    </AuthProvider>
  )
}

export default App
