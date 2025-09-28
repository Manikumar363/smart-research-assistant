import { useState, useEffect } from 'react'
import { Search, FileText, Calendar, Trash2, Eye, Plus, Filter, ChevronRight } from 'lucide-react'
import { useResearch } from '../context/ResearchContext'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import './Sessions.css'

const Sessions = () => {
  const { 
    sessions, 
    isLoading, 
    error, 
    fetchUserStats,
    refreshSessions 
  } = useResearch()
  
  const { user, accessToken } = useAuth()
  const navigate = useNavigate()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedSessions, setSelectedSessions] = useState([])
  const [isDeleting, setIsDeleting] = useState(false)

  // Debug logging
  useEffect(() => {
    console.log('🔍 Sessions Debug Info:')
    console.log('- User:', user ? `${user.name} (${user.email})` : 'No user')
    console.log('- AccessToken:', accessToken ? `${accessToken.substring(0, 10)}...` : 'No token')
    console.log('- Sessions:', sessions)
    console.log('- Sessions length:', sessions?.length || 0)
    console.log('- Is loading:', isLoading)
    console.log('- Error:', error)
  }, [sessions, user, accessToken, isLoading, error])

  // API base URL
  const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://your-backend-production-url.com/api' 
    : 'http://localhost:5001/api'

  // Filter sessions based on search term and status
  const filteredSessions = sessions?.filter(session => {
    const matchesSearch = session.query?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         session.title?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'completed' && session.reportGenerated) ||
                         (filterStatus === 'pending' && !session.reportGenerated)
    return matchesSearch && matchesFilter
  }) || []

  const handleNewSession = () => {
    navigate('/home')
  }

  const handleOpenSession = (session) => {
    // Navigate to home with session data
    navigate('/home', { 
      state: { 
        sessionId: session._id,
        question: session.query,
        existingSession: session 
      } 
    })
  }

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to delete this session?')) {
      return
    }

    try {
      setIsDeleting(true)
      
      const response = await fetch(`${API_BASE_URL}/user/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete session')
      }

      // Refresh sessions list immediately
      await refreshSessions()
      
      // Also refresh user stats to update counts
      await fetchUserStats()
      
    } catch (error) {
      console.error('Error deleting session:', error)
      alert('Failed to delete session. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedSessions.length === 0) return
    
    if (!window.confirm(`Are you sure you want to delete ${selectedSessions.length} session(s)?`)) {
      return
    }

    try {
      setIsDeleting(true)
      
      const deletePromises = selectedSessions.map(sessionId =>
        fetch(`${API_BASE_URL}/user/sessions/${sessionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        })
      )

      await Promise.all(deletePromises)
      
      // Clear selection and refresh
      setSelectedSessions([])
      await refreshSessions()
      await fetchUserStats()
      
    } catch (error) {
      console.error('Error deleting sessions:', error)
      alert('Failed to delete some sessions. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleSessionSelection = (sessionId) => {
    setSelectedSessions(prev => 
      prev.includes(sessionId) 
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    )
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (session) => {
    if (session.reportGenerated) {
      return <span className="status-badge completed">Completed</span>
    }
    return <span className="status-badge pending">Pending</span>
  }

  if (isLoading) {
    return (
      <div className="sessions-page">
        <div className="sessions-container">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <h2>Loading your research sessions...</h2>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="sessions-page">
        <div className="sessions-container">
          <div className="error-state">
            <h2>Error loading sessions</h2>
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>Try Again</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sessions-page">
      <div className="sessions-container">
        <div className="sessions-header">
          <div className="header-content">
            <h1>My Research Sessions</h1>
            <p>Manage and continue your research sessions</p>
          </div>
          <button className="new-session-btn" onClick={handleNewSession}>
            <Plus size={20} />
            New Session
          </button>
        </div>

        <div className="sessions-controls">
          <div className="search-bar">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="filter-controls">
            <div className="filter-group">
              <Filter size={16} />
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Sessions</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          {selectedSessions.length > 0 && (
            <div className="bulk-actions">
              <span>{selectedSessions.length} selected</span>
              <button 
                className="bulk-delete-btn"
                onClick={handleBulkDelete}
                disabled={isDeleting}
              >
                <Trash2 size={16} />
                Delete Selected
              </button>
            </div>
          )}
        </div>

        <div className="sessions-stats">
          <div className="stat-item">
            <span className="stat-number">{sessions?.length || 0}</span>
            <span className="stat-label">Total Sessions</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">
              {sessions?.filter(s => s.reportGenerated).length || 0}
            </span>
            <span className="stat-label">Completed</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">
              {sessions?.filter(s => !s.reportGenerated).length || 0}
            </span>
            <span className="stat-label">Pending</span>
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="empty-state">
            <FileText size={64} />
            <h3>
              {sessions?.length === 0 
                ? "No research sessions yet" 
                : "No sessions match your search"
              }
            </h3>
            <p>
              {sessions?.length === 0 
                ? "Start your first research session to see it here" 
                : "Try adjusting your search terms or filters"
              }
            </p>
            {sessions?.length === 0 && (
              <button className="start-session-btn" onClick={handleNewSession}>
                Start Your First Session
              </button>
            )}
          </div>
        ) : (
          <div className="sessions-grid">
            {console.log('📋 Rendering sessions grid with', filteredSessions.length, 'sessions')}
            {filteredSessions.map((session) => (
              <div key={session._id} className="session-card">
                {console.log('🎯 Rendering session card:', session._id, session.title || session.query)}
                <div className="session-header">
                  <input
                    type="checkbox"
                    checked={selectedSessions.includes(session._id)}
                    onChange={() => toggleSessionSelection(session._id)}
                    className="session-checkbox"
                  />
                  {getStatusBadge(session)}
                </div>
                
                <div className="session-content">
                  <h3 className="session-title">{session.title || session.query}</h3>
                  <p className="session-query">{session.query}</p>
                  
                  <div className="session-meta">
                    <div className="meta-item">
                      <Calendar size={16} />
                      <span>{formatDate(session.createdAt)}</span>
                    </div>
                    
                    {session.metadata?.creditsUsed && (
                      <div className="meta-item">
                        <span className="credits-used">
                          {session.metadata.creditsUsed} credits used
                        </span>
                      </div>
                    )}

                    {session.chatHistory && session.chatHistory.length > 0 && (
                      <div className="meta-item">
                        <span className="message-count">
                          {session.chatHistory.length} messages
                        </span>
                      </div>
                    )}

                    {session.status && (
                      <div className="meta-item">
                        <span className={`status-indicator ${session.status}`}>
                          Status: {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                        </span>
                      </div>
                    )}
                  </div>

                  {session.uploadedFiles && session.uploadedFiles.length > 0 && (
                    <div className="session-files">
                      <span className="files-count">
                        📎 {session.uploadedFiles.length} file(s) uploaded
                      </span>
                    </div>
                  )}

                  {session.lastMessage && (
                    <div className="session-preview">
                      <div className="preview-label">Last activity:</div>
                      <div className="preview-text">{session.lastMessage}</div>
                    </div>
                  )}
                </div>

                <div className="session-actions">
                  {console.log('🔘 Rendering session actions for:', session._id)}
                  <button 
                    className="action-btn continue-btn"
                    onClick={() => handleOpenSession(session)}
                    title="Continue session"
                    style={{ backgroundColor: '#28a745', color: 'white', minHeight: '40px', minWidth: '100px' }}
                  >
                    <ChevronRight size={16} />
                    Continue
                  </button>
                  
                  <button 
                    className="action-btn delete-btn"
                    onClick={() => handleDeleteSession(session._id)}
                    disabled={isDeleting}
                    title="Delete session"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Sessions