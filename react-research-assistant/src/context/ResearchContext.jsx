import { createContext, useContext, useReducer, useEffect } from 'react'
import { useAuth } from './AuthContext'

const ResearchContext = createContext()

// API base URL
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://smart-research-assistant-pt0p.onrender.com' 
  : 'http://localhost:5001/api'

const initialState = {
  stats: {
    questionsCount: 0,
    reportsCount: 0,
    creditsUsed: 0,
    sourcesCount: 0
  },
  creditBalance: 100,
  userStats: null,
  sessionStats: null,
  reports: [],
  sessions: [],
  activities: [],
  isGenerating: false,
  generationProgress: 0,
  uploadedFiles: [],
  lastUpdateTime: new Date().toISOString(),
  isLoading: false,
  error: null
}

const researchReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false }
    
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    
    case 'SET_USER_STATS':
      return {
        ...state,
        userStats: action.payload.userStats,
        sessionStats: action.payload.sessionStats,
        creditBalance: action.payload.accountInfo.credits,
        stats: {
          questionsCount: action.payload.userStats.totalQuestions,
          reportsCount: action.payload.userStats.totalReports,
          creditsUsed: action.payload.userStats.creditsUsed,
          sourcesCount: action.payload.sessionStats.totalSessions
        },
        lastUpdateTime: new Date().toISOString(),
        isLoading: false
      }
    
    case 'SET_SESSIONS':
      return { ...state, sessions: action.payload, isLoading: false }
    
    case 'ADD_SESSION':
      return {
        ...state,
        sessions: [action.payload, ...state.sessions]
      }
    
    case 'UPDATE_SESSION':
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session._id === action.payload._id ? action.payload : session
        )
      }
    
    case 'SET_GENERATING':
      return { ...state, isGenerating: action.payload }
    
    case 'SET_PROGRESS':
      return { ...state, generationProgress: action.payload }
    
    case 'ADD_UPLOADED_FILE':
      return {
        ...state,
        uploadedFiles: [...state.uploadedFiles, action.payload]
      }
    
    case 'REMOVE_UPLOADED_FILE':
      return {
        ...state,
        uploadedFiles: state.uploadedFiles.filter(file => file.id !== action.payload)
      }
    
    case 'ADD_ACTIVITY':
      return {
        ...state,
        activities: [action.payload, ...state.activities]
      }
    
    case 'REMOVE_SESSION':
      return {
        ...state,
        sessions: state.sessions.filter(session => session._id !== action.payload)
      }
    
    case 'ADD_REPORT_LOCAL':
      return {
        ...state,
        reports: [action.payload, ...state.reports]
      }
    
    case 'UPDATE_LAST_UPDATE_TIME':
      return {
        ...state,
        lastUpdateTime: new Date().toISOString()
      }
    
    default:
      return state
  }
}

export const ResearchProvider = ({ children }) => {
  const [state, dispatch] = useReducer(researchReducer, initialState)
  const { user, accessToken } = useAuth()

  // Function to fetch user statistics
  const fetchUserStats = async () => {
    if (!user || !accessToken) return
    
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      
      const response = await fetch(`${API_BASE_URL}/user/stats`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch user statistics')
      }
      
      const data = await response.json()
      dispatch({ type: 'SET_USER_STATS', payload: data.data })
    } catch (error) {
      console.error('Error fetching user stats:', error)
      dispatch({ type: 'SET_ERROR', payload: error.message })
    }
  }

  // Fetch user statistics when user is available
  useEffect(() => {
    fetchUserStats()
  }, [user, accessToken])

  // Fetch user research sessions
  useEffect(() => {
    const fetchSessions = async () => {
      if (!user || !accessToken) {
        console.log('🔍 Sessions fetch skipped - missing user or token:', { user: !!user, accessToken: !!accessToken })
        return
      }
      
      console.log('🔍 Fetching sessions for user:', user.email)
      
      try {
        const response = await fetch(`${API_BASE_URL}/user/sessions`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        })
        
        console.log('🔍 Sessions fetch response:', response.status, response.ok)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch sessions: ${response.status}`)
        }
        
        const data = await response.json()
        console.log('🔍 Sessions data received:', data)
        console.log('🔍 Sessions array:', data.data?.sessions)
        console.log('🔍 Sessions count:', data.data?.sessions?.length || 0)
        
        dispatch({ type: 'SET_SESSIONS', payload: data.data.sessions || [] })
      } catch (error) {
        console.error('❌ Error fetching sessions:', error)
        dispatch({ type: 'SET_ERROR', payload: error.message })
      }
    }

    fetchSessions()
  }, [user, accessToken])

  const addUploadedFile = (file) => {
    const fileData = {
      id: Date.now(),
      name: file.name,
      size: file.size,
      type: file.type
    }
    dispatch({ type: 'ADD_UPLOADED_FILE', payload: fileData })
  }

  const removeUploadedFile = (fileId) => {
    dispatch({ type: 'REMOVE_UPLOADED_FILE', payload: fileId })
  }

  const createResearchSession = async (question, files = []) => {
    if (!user || !accessToken) return
    
    try {
      const response = await fetch(`${API_BASE_URL}/user/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: question,
          files: files.map(f => ({ name: f.name, size: f.size, type: f.type })),
          metadata: {
            category: 'general',
            creditsUsed: 1
          }
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to create research session')
      }
      
      const data = await response.json()
      dispatch({ type: 'ADD_SESSION', payload: data.data.session })
      
      // Refresh user statistics to get updated question count
      await fetchUserStats()
      
      return data.data.session
    } catch (error) {
      console.error('Error creating session:', error)
      dispatch({ type: 'SET_ERROR', payload: error.message })
      throw error
    }
  }

  // Function to refresh sessions
  const refreshSessions = async () => {
    if (!user || !accessToken) return
    
    try {
      const response = await fetch(`${API_BASE_URL}/user/sessions`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch sessions')
      }
      
      const data = await response.json()
      dispatch({ type: 'SET_SESSIONS', payload: data.data.sessions })
    } catch (error) {
      console.error('Error fetching sessions:', error)
      dispatch({ type: 'SET_ERROR', payload: error.message })
    }
  }

  const generateReport = async (question) => {
    dispatch({ type: 'SET_GENERATING', payload: true })
    
    try {
      // Create research session (this will increment the question count in backend)
      const session = await createResearchSession(question, state.uploadedFiles)
      
      // Simulate report generation with progress
      const steps = [25, 50, 75, 100]
      for (let i = 0; i < steps.length; i++) {
        setTimeout(() => {
          dispatch({ type: 'SET_PROGRESS', payload: steps[i] })
        }, (i + 1) * 1000)
      }

      // Simulate completion after 4 seconds
      setTimeout(async () => {
        const newReport = {
          id: Date.now(),
          title: question.substring(0, 50) + "...",
          timestamp: new Date().toISOString(),
          takeaways: [
            "Key insight from your research question",
            "Important finding from uploaded documents",
            "Relevant information from live data sources"
          ],
          sources: [
            ...state.uploadedFiles.map(file => ({ type: "file", name: file.name })),
            { type: "web", name: "Live data source - Latest updates" }
          ]
        }
        
        dispatch({ type: 'ADD_ACTIVITY', payload: {
          id: Date.now(),
          type: "report",
          description: `Generated report: "${newReport.title}"`,
          timestamp: "Just now",
          cost: 2
        }})
        
        // Add report to local state for UI
        dispatch({ type: 'SET_GENERATING', payload: false })
        dispatch({ type: 'SET_PROGRESS', payload: 0 })
        dispatch({ type: 'UPDATE_LAST_UPDATE_TIME' })
        
        // Add the report to local reports array
                dispatch({ type: 'ADD_REPORT_LOCAL', payload: newReport })
        
        // Update session with report generated and refresh stats
        if (session && accessToken) {
          try {
            const updateResponse = await fetch(`${API_BASE_URL}/user/sessions/${session._id}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                generateReport: true,
                status: 'completed',
                result: {
                  title: newReport.title,
                  takeaways: newReport.takeaways,
                  sources: newReport.sources
                }
              })
            })
            
            if (updateResponse.ok) {
              // Refresh user statistics to get updated report count
              await fetchUserStats()
            }
          } catch (error) {
            console.error('Error updating session:', error)
          }
        }
      }, 4000)
    } catch (error) {
      dispatch({ type: 'SET_GENERATING', payload: false })
      dispatch({ type: 'SET_PROGRESS', payload: 0 })
    }
  }

  const value = {
    ...state,
    addUploadedFile,
    removeUploadedFile,
    generateReport,
    createResearchSession,
    fetchUserStats,
    refreshSessions
  }

  return (
    <ResearchContext.Provider value={value}>
      {children}
    </ResearchContext.Provider>
  )
}

export const useResearch = () => {
  const context = useContext(ResearchContext)
  if (!context) {
    throw new Error('useResearch must be used within a ResearchProvider')
  }
  return context
}