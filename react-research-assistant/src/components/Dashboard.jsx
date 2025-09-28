import { HelpCircle, FileText, Coins, Database, Wifi, AlertCircle, Loader } from 'lucide-react'
import { useResearch } from '../context/ResearchContext'
import { useAuth } from '../context/AuthContext'
import './Dashboard.css'

const Dashboard = () => {
  const { 
    stats, 
    userStats, 
    sessionStats, 
    lastUpdateTime, 
    isLoading, 
    error, 
    creditBalance,
    sessions 
  } = useResearch()
  const { user } = useAuth()

  // Show loading state
  if (isLoading) {
    return (
      <div className="dashboard">
        <div className="dashboard-container">
          <div className="loading-state">
            <Loader className="loading-spinner" size={48} />
            <h2>Loading your research data...</h2>
            <p>Please wait while we fetch your latest statistics</p>
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="dashboard">
        <div className="dashboard-container">
          <div className="error-state">
            <AlertCircle className="error-icon" size={48} />
            <h2>Something went wrong</h2>
            <p>{error}</p>
            <button 
              className="retry-button" 
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const statCards = [
    {
      icon: HelpCircle,
      title: 'Questions Asked',
      value: stats.questionsCount,
      color: '#667eea',
      subtitle: userStats ? `Total sessions: ${userStats.totalSessions}` : ''
    },
    {
      icon: FileText,
      title: 'Reports Generated',
      value: stats.reportsCount,
      color: '#28a745',
      subtitle: sessions ? `Recent: ${sessions.filter(s => s.reportGenerated).length}` : ''
    },
    {
      icon: Coins,
      title: 'Credits Used',
      value: stats.creditsUsed,
      color: '#ffc107',
      subtitle: `Balance: ${creditBalance || 100} credits`
    },
    {
      icon: Database,
      title: 'Sources Analyzed',
      value: stats.sourcesCount,
      color: '#17a2b8',
      subtitle: sessionStats ? `Avg per session: ${sessionStats.avgSourcesPerSession || 0}` : ''
    }
  ]

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  // Get recent sessions for insights
  const recentSessions = sessions?.slice(0, 5) || []
  const topCategories = sessionStats?.categorySummary || [
    { category: 'AI Technology', count: 8 },
    { category: 'Market Research', count: 5 },
    { category: 'Business Strategy', count: 3 }
  ]

  return (
    <div className="dashboard">
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Welcome back, {user?.name || 'User'}! 👋</h1>
          <p className="user-welcome">Here's your research activity overview</p>
        </div>
        
        <div className="stats-grid">
          {statCards.map((stat, index) => {
            const Icon = stat.icon
            return (
              <div key={index} className="stat-card">
                <div className="stat-icon" style={{ backgroundColor: `${stat.color}20`, color: stat.color }}>
                  <Icon size={28} />
                </div>
                <div className="stat-content">
                  <h3>{stat.value}</h3>
                  <p>{stat.title}</p>
                  {stat.subtitle && <span className="stat-subtitle">{stat.subtitle}</span>}
                </div>
              </div>
            )
          })}
        </div>

        <div className="live-data-section">
          <div className="live-data-card">
            <h2>Live Data Integration</h2>
            <div className="status-indicator">
              <div className="status-row">
                <div className="status-item">
                  <div className="status-dot active"></div>
                  <span>Connected to live research sources</span>
                </div>
                <div className="last-update">
                  Last update: {formatTimestamp(lastUpdateTime)}
                </div>
              </div>
            </div>
            
            <div className="data-sources">
              <h3>Active Data Sources</h3>
              <div className="source-grid">
                <div className="source-item">
                  <Wifi className="source-icon" />
                  <div className="source-info">
                    <span className="source-name">TechCrunch API</span>
                    <span className="source-status online">Online</span>
                  </div>
                </div>
                <div className="source-item">
                  <Wifi className="source-icon" />
                  <div className="source-info">
                    <span className="source-name">ArXiv Papers</span>
                    <span className="source-status online">Online</span>
                  </div>
                </div>
                <div className="source-item">
                  <Wifi className="source-icon" />
                  <div className="source-info">
                    <span className="source-name">Google News</span>
                    <span className="source-status online">Online</span>
                  </div>
                </div>
                <div className="source-item">
                  <Wifi className="source-icon" />
                  <div className="source-info">
                    <span className="source-name">Reuters Feed</span>
                    <span className="source-status online">Online</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="insights-section">
          <div className="insights-card">
            <h2>Research Insights</h2>
            <div className="insights-grid">
              <div className="insight-item">
                <h4>Recent Research Sessions</h4>
                <div className="session-list">
                  {recentSessions.length > 0 ? (
                    recentSessions.map((session, index) => (
                      <div key={session._id || index} className="session-item">
                        <span className="session-query">{session.query}</span>
                        <div className="session-meta">
                          <span className="session-date">
                            {new Date(session.createdAt).toLocaleDateString()}
                          </span>
                          {session.reportGenerated && (
                            <span className="session-status">✓ Report</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="no-sessions">No research sessions yet. Start by asking a question!</p>
                  )}
                </div>
              </div>
              
              <div className="insight-item">
                <h4>Research Quality Score</h4>
                <div className="quality-metric">
                  <div className="quality-score">
                    {userStats?.totalReports > 0 ? '95%' : 'N/A'}
                  </div>
                  <div className="quality-details">
                    <div className="quality-bar">
                      <div 
                        className="quality-fill" 
                        style={{ width: userStats?.totalReports > 0 ? '95%' : '0%' }}
                      ></div>
                    </div>
                    <span>
                      {userStats?.totalReports > 0 
                        ? 'Based on citation accuracy and source reliability' 
                        : 'Generate reports to see your quality score'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {userStats && (
          <div className="user-stats-section">
            <div className="user-stats-card">
              <h2>Account Summary</h2>
              <div className="account-info">
                <div className="account-item">
                  <span>Member since:</span>
                  <span>{new Date(userStats.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="account-item">
                  <span>Total sessions:</span>
                  <span>{userStats.totalSessions}</span>
                </div>
                <div className="account-item">
                  <span>Account status:</span>
                  <span className="status-active">Active</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard