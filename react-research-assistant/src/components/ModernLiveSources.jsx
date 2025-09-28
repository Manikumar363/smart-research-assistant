import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './ModernLiveSources.css';

const ModernLiveSources = () => {
  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [stats, setStats] = useState({
    totalSources: 0,
    activeSources: 0,
    totalEntries: 0,
    dataFreshness: 'Unknown'
  });

  const [newSource, setNewSource] = useState({
    sourceName: '',
    sourceType: 'weather',
    sourceUrl: '',
    maxEntries: 500,
    ingestionInterval: 300,
    config: {}
  });

  const { user } = useAuth();

  const sourceTypeIcons = {
    weather: '🌤️',
    news: '📰',
    rss: '📡',
    api: '🔗',
    social: '📱',
    custom: '⚙️'
  };

  const presetSources = {
    weather: {
      sourceName: 'Global Weather Data',
      sourceUrl: 'weather-api',
      config: { cities: ['New York', 'London', 'Tokyo', 'Sydney'] }
    },
    rss: {
      'BBC News': 'https://feeds.bbci.co.uk/news/rss.xml',
      'TechCrunch': 'https://techcrunch.com/feed/',
      'Reuters': 'https://feeds.reuters.com/reuters/topNews',
      'Hacker News': 'https://news.ycombinator.com/rss'
    }
  };

  useEffect(() => {
    fetchSources();
    const interval = setInterval(fetchSources, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSources = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('research_assistant_token');
      if (!token) {
        setError('Please log in to view live sources');
        return;
      }

      const response = await fetch('/api/pathway/sources', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSources(data.sources || []);
        
        // Calculate stats
        const activeSources = data.sources?.filter(s => s.isActive).length || 0;
        const totalEntries = data.sources?.reduce((sum, s) => sum + (s.stats?.currentEntries || 0), 0) || 0;
        
        setStats({
          totalSources: data.sources?.length || 0,
          activeSources,
          totalEntries,
          dataFreshness: activeSources > 0 ? 'Real-time' : 'No active sources'
        });
      } else if (response.status === 401) {
        setError('Session expired. Please log in again.');
      } else if (response.status === 503) {
        setError('Backend service unavailable. Please try again later.');
      } else {
        setError(`Failed to load sources (${response.status})`);
      }
    } catch (error) {
      console.error('Error fetching sources:', error);
      if (error.message.includes('fetch')) {
        setError('Cannot connect to server. Please check if the backend is running.');
      } else {
        setError('Network error. Please check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSource = async () => {
    console.log('🚀 handleAddSource called');
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('research_assistant_token');
      if (!token) {
        console.log('❌ No token found');
        setError('Please log in to create sources');
        return;
      }
      
      console.log('� Token found, using authenticated endpoint');
      console.log('📤 Sending request to backend...');
      const response = await fetch('/api/pathway/register-source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newSource)
      });
      
      console.log('📥 Response received:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Source created successfully');
        await fetchSources();
        setShowAddModal(false);
        setNewSource({
          sourceName: '',
          sourceType: 'weather',
          sourceUrl: '',
          maxEntries: 500,
          ingestionInterval: 300,
          config: {}
        });
      } else {
        const errorData = await response.text();
        console.log('❌ Backend error:', response.status, errorData);
        if (response.status === 403) {
          setError('Session expired. Please log in again.');
        } else {
          setError(`Failed to create source (${response.status})`);
        }
      }
    } catch (error) {
      console.log('💥 Network error:', error.message);
      if (error.message.includes('fetch')) {
        setError('Cannot connect to server. Please check if the backend is running.');
      } else {
        setError('Network error. Please check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSource = async (sourceId, currentStatus) => {
    try {
      const response = await fetch(`/api/pathway/sources/${sourceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('research_assistant_token')}`
        },
        body: JSON.stringify({ status: currentStatus === 'active' ? 'paused' : 'active' })
      });

      if (response.ok) {
        await fetchSources();
      }
    } catch (error) {
      console.error('Error toggling source:', error);
    }
  };

  const deleteSource = async (sourceId) => {
    if (!window.confirm('Are you sure you want to delete this source?')) return;
    
    try {
      const response = await fetch(`/api/pathway/sources/${sourceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('research_assistant_token')}`
        }
      });

      if (response.ok) {
        await fetchSources();
      }
    } catch (error) {
      console.error('Error deleting source:', error);
    }
  };

  const formatInterval = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const formatLastUpdate = (timestamp) => {
    if (!timestamp) return 'Never';
    const now = new Date();
    const lastUpdate = new Date(timestamp);
    const diffMs = now - lastUpdate;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <div className="modern-live-sources">
      {/* Header Section */}
      <div className="header-section">
        <div className="header-content">
          <div className="header-text">
            <h1>
              <span className="icon">📡</span>
              Live Data Sources
            </h1>
            <p>Manage real-time data streams with automatic rolling window cleanup</p>
          </div>
          <button 
            className="add-source-btn"
            onClick={() => setShowAddModal(true)}
            disabled={isLoading}
          >
            <span className="icon">➕</span>
            Add Source
          </button>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <div className="stat-value">{stats.totalSources}</div>
              <div className="stat-label">Total Sources</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🟢</div>
            <div className="stat-info">
              <div className="stat-value">{stats.activeSources}</div>
              <div className="stat-label">Active</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💾</div>
            <div className="stat-info">
              <div className="stat-value">{stats.totalEntries.toLocaleString()}</div>
              <div className="stat-label">Total Entries</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⚡</div>
            <div className="stat-info">
              <div className="stat-value">{stats.dataFreshness}</div>
              <div className="stat-label">Data Status</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sources Grid */}
      <div className="sources-container">
        {error ? (
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <h3>Unable to Load Sources</h3>
            <p>{error}</p>
            <button 
              className="retry-btn"
              onClick={fetchSources}
              disabled={isLoading}
            >
              {isLoading ? '⏳ Retrying...' : '🔄 Retry'}
            </button>
          </div>
        ) : isLoading && sources.length === 0 ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading sources...</p>
          </div>
        ) : sources.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📡</div>
            <h3>No Live Sources Yet</h3>
            <p>Add your first data source to start ingesting real-time information</p>
            <button 
              className="cta-button"
              onClick={() => setShowAddModal(true)}
            >
              <span className="icon">🚀</span>
              Get Started
            </button>
          </div>
        ) : (
          <div className="sources-grid">
            {sources.map(source => (
              <div key={source.sourceId} className={`source-card ${source.isActive ? 'active' : 'inactive'}`}>
                <div className="card-header">
                  <div className="source-info">
                    <div className="source-icon">
                      {sourceTypeIcons[source.sourceType] || '⚙️'}
                    </div>
                    <div className="source-details">
                      <h3>{source.sourceName}</h3>
                      <span className="source-type">{source.sourceType.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="card-actions">
                    <button
                      className={`toggle-btn ${source.isActive ? 'active' : 'inactive'}`}
                      onClick={() => toggleSource(source.sourceId, source.status)}
                      title={source.isActive ? 'Pause' : 'Start'}
                    >
                      {source.isActive ? '⏸️' : '▶️'}
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => deleteSource(source.sourceId)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="card-content">
                  <div className="source-url">
                    <span className="label">URL:</span>
                    <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">
                      {source.sourceUrl.length > 30 ? 
                        `${source.sourceUrl.substring(0, 30)}...` : 
                        source.sourceUrl
                      }
                    </a>
                  </div>

                  <div className="source-metrics">
                    <div className="metric">
                      <span className="metric-value">{source.stats?.currentEntries || 0}</span>
                      <span className="metric-label">Entries</span>
                    </div>
                    <div className="metric">
                      <span className="metric-value">{source.maxEntries}</span>
                      <span className="metric-label">Max</span>
                    </div>
                    <div className="metric">
                      <span className="metric-value">{formatInterval(source.ingestionInterval)}</span>
                      <span className="metric-label">Interval</span>
                    </div>
                  </div>

                  <div className="source-status">
                    <div className="status-indicator">
                      <div className={`status-dot ${source.isActive ? 'active' : 'inactive'}`}></div>
                      <span className="status-text">
                        {source.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div className="last-update">
                      Last: {formatLastUpdate(source.stats?.lastIngestion)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Source Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <span className="icon">➕</span>
                Add Live Data Source
              </h2>
              <button 
                className="close-btn"
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-content">
              {/* Error Display */}
              {error && (
                <div style={{ 
                  background: '#fee2e2', 
                  border: '1px solid #fecaca', 
                  borderRadius: '8px', 
                  padding: '12px', 
                  marginBottom: '20px',
                  color: '#dc2626'
                }}>
                  <strong>Error:</strong> {error}
                </div>
              )}

              <div className="form-group">
                <label>Source Type</label>
                <div className="source-type-grid">
                  {Object.entries(sourceTypeIcons).map(([type, icon]) => (
                    <button
                      key={type}
                      className={`type-option ${newSource.sourceType === type ? 'selected' : ''}`}
                      onClick={() => setNewSource(prev => ({ ...prev, sourceType: type }))}
                    >
                      <span className="type-icon">{icon}</span>
                      <span className="type-name">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {newSource.sourceType === 'weather' && (
                <div className="preset-section">
                  <button
                    className="preset-btn"
                    onClick={() => setNewSource(prev => ({
                      ...prev,
                      ...presetSources.weather
                    }))}
                  >
                    🌍 Use Global Weather Preset
                  </button>
                </div>
              )}

              {newSource.sourceType === 'rss' && (
                <div className="preset-section">
                  <label>Popular RSS Feeds</label>
                  <div className="preset-grid">
                    {Object.entries(presetSources.rss).map(([name, url]) => (
                      <button
                        key={name}
                        className="preset-option"
                        onClick={() => setNewSource(prev => ({
                          ...prev,
                          sourceName: name,
                          sourceUrl: url
                        }))}
                      >
                        📰 {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Source Name</label>
                <input
                  type="text"
                  value={newSource.sourceName}
                  onChange={(e) => setNewSource(prev => ({ ...prev, sourceName: e.target.value }))}
                  placeholder="My Data Source"
                />
              </div>

              <div className="form-group">
                <label>Source URL</label>
                <input
                  type="url"
                  value={newSource.sourceUrl}
                  onChange={(e) => setNewSource(prev => ({ ...prev, sourceUrl: e.target.value }))}
                  placeholder="https://api.example.com/data"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Max Entries</label>
                  <input
                    type="number"
                    min="10"
                    max="10000"
                    value={newSource.maxEntries}
                    onChange={(e) => setNewSource(prev => ({ ...prev, maxEntries: parseInt(e.target.value) }))}
                  />
                  <small>Rolling window size</small>
                </div>

                <div className="form-group">
                  <label>Update Interval</label>
                  <select
                    value={newSource.ingestionInterval}
                    onChange={(e) => setNewSource(prev => ({ ...prev, ingestionInterval: parseInt(e.target.value) }))}
                  >
                    <option value="60">1 minute</option>
                    <option value="300">5 minutes</option>
                    <option value="600">10 minutes</option>
                    <option value="1800">30 minutes</option>
                    <option value="3600">1 hour</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn-cancel"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-create"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddSource();
                }}
                disabled={!newSource.sourceName || !newSource.sourceUrl || isLoading}
              >
                {isLoading ? '⏳ Creating...' : '🚀 Create Source'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernLiveSources;