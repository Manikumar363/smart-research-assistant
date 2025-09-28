import { createContext, useContext, useReducer, useEffect } from 'react'

const AuthContext = createContext()

// API base URL - change this for production
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://smart-research-assistant-pt0p.onrender.com' 
  : 'http://localhost:5001/api'

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  accessToken: null
}

const authReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        isAuthenticated: true,
        isLoading: false,
        error: null
      }
    
    case 'LOGIN_ERROR':
      return {
        ...state,
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload
      }
    
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      }
    
    case 'SIGNUP_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        isAuthenticated: true,
        isLoading: false,
        error: null
      }
    
    case 'SIGNUP_ERROR':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload
      }
    
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    
    default:
      return state
  }
}

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Check for existing user session on app load
  useEffect(() => {
    const checkAuthStatus = () => {
      try {
        const userData = localStorage.getItem('research_assistant_user')
        const accessToken = localStorage.getItem('research_assistant_token')
        const refreshToken = localStorage.getItem('research_assistant_refresh_token')
        
        if (userData && accessToken) {
          const user = JSON.parse(userData)
          dispatch({ 
            type: 'LOGIN_SUCCESS', 
            payload: { user, accessToken, refreshToken }
          })
        } else {
          dispatch({ type: 'SET_LOADING', payload: false })
        }
      } catch (error) {
        console.error('Error checking auth status:', error)
        localStorage.removeItem('research_assistant_user')
        localStorage.removeItem('research_assistant_token')
        localStorage.removeItem('research_assistant_refresh_token')
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }

    checkAuthStatus()
  }, [])

  const login = async (email, password) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Login failed')
      }

      if (data.success) {
        // Store tokens and user data
        localStorage.setItem('research_assistant_user', JSON.stringify(data.data.user))
        localStorage.setItem('research_assistant_token', data.data.accessToken)
        localStorage.setItem('research_assistant_refresh_token', data.data.refreshToken)
        
        dispatch({ 
          type: 'LOGIN_SUCCESS', 
          payload: {
            user: data.data.user,
            accessToken: data.data.accessToken,
            refreshToken: data.data.refreshToken
          }
        })
        
        return data.data.user
      } else {
        throw new Error(data.message || 'Login failed')
      }
    } catch (error) {
      const errorMessage = error.message || 'Network error. Please check your connection.'
      dispatch({ type: 'LOGIN_ERROR', payload: errorMessage })
      throw new Error(errorMessage)
    }
  }

  const signup = async (name, email, password) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name, 
          email, 
          password,
          username: email.split('@')[0] // Use email prefix as username
        }),
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Signup failed')
      }

      if (data.success) {
        // Store tokens and user data
        localStorage.setItem('research_assistant_user', JSON.stringify(data.data.user))
        localStorage.setItem('research_assistant_token', data.data.accessToken)
        localStorage.setItem('research_assistant_refresh_token', data.data.refreshToken)
        
        dispatch({ 
          type: 'SIGNUP_SUCCESS', 
          payload: {
            user: data.data.user,
            accessToken: data.data.accessToken,
            refreshToken: data.data.refreshToken
          }
        })
        
        return data.data.user
      } else {
        throw new Error(data.message || 'Signup failed')
      }
    } catch (error) {
      const errorMessage = error.message || 'Network error. Please check your connection.'
      dispatch({ type: 'SIGNUP_ERROR', payload: errorMessage })
      throw new Error(errorMessage)
    }
  }

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('research_assistant_refresh_token')
      
      // Call logout endpoint to invalidate refresh token
      if (refreshToken) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.accessToken}`
          },
          body: JSON.stringify({ refreshToken }),
          credentials: 'include'
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear local storage regardless of API call success
      localStorage.removeItem('research_assistant_user')
      localStorage.removeItem('research_assistant_token')
      localStorage.removeItem('research_assistant_refresh_token')
      dispatch({ type: 'LOGOUT' })
    }
  }

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' })
  }

  const socialLogin = async (provider) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    
    try {
      // For now, simulate social login as this requires OAuth setup
      // In production, this would redirect to OAuth provider
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock social login for demo purposes
      const mockUser = {
        email: `demo@${provider}.com`,
        name: `Demo ${provider} User`,
        username: `${provider}_user`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${provider}`,
        plan: 'free',
        credits: 100,
        provider
      }
      
      // Store mock data
      localStorage.setItem('research_assistant_user', JSON.stringify(mockUser))
      localStorage.setItem('research_assistant_token', 'mock_social_token')
      localStorage.setItem('research_assistant_refresh_token', 'mock_social_refresh_token')
      
      dispatch({ 
        type: 'LOGIN_SUCCESS', 
        payload: {
          user: mockUser,
          accessToken: 'mock_social_token',
          refreshToken: 'mock_social_refresh_token'
        }
      })
      
      return mockUser
    } catch (error) {
      const errorMessage = error.message || 'Social login failed'
      dispatch({ type: 'LOGIN_ERROR', payload: errorMessage })
      throw new Error(errorMessage)
    }
  }

  const value = {
    ...state,
    login,
    signup,
    logout,
    clearError,
    socialLogin
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}