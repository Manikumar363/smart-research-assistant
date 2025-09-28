import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProgressModal from './ProgressModal';
import './LiveSources.css';

const SimpleLiveSources = () => {
  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [pathwayStatus, setPathwayStatus] = useState(null);
  const [results, setResults] = useState(null);
  const [newSource, setNewSource] = useState({
    sourceName: '',
    sourceType: 'weather',
    sourceUrl: '',
    maxEntries: 500,
    ingestionInterval: 300,
    config: {}
  });

  const { user } = useAuth();

  useEffect(() => {
    fetchSources();
    fetchPathwayStatus();
    // Poll status every 30 seconds
    const interval = setInterval(fetchPathwayStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSources = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/pathway/sources', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSources(data.sources || []);
      } else {
        console.error('Failed to fetch sources');
      }
    } catch (error) {
      console.error('Error fetching sources:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPathwayStatus = async () => {
    try {
      const response = await fetch('/api/pathway/status');
      if (response.ok) {
        const data = await response.json();
        setPathwayStatus(data);
      }
    } catch (error) {
      console.error('Error fetching pathway status:', error);
    }
  };

  const handleRegisterSource = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/pathway/register-source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newSource)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Source registered:', data);
        setShowSourceModal(false);
        setNewSource({
          sourceName: '',
          sourceType: 'weather',
          sourceUrl: '',
          maxEntries: 500,
          ingestionInterval: 300,
          config: {}
        });
        await fetchSources();
        setResults({
          success: true,
          message: `Live source "${newSource.sourceName}" registered successfully!`,
          details: `Type: ${newSource.sourceType}, Max entries: ${newSource.maxEntries} (rolling window)`
        });
      } else {
        const error = await response.json();
        setResults({
          success: false,
          message: 'Failed to register source',
          details: error.message
        });
      }
    } catch (error) {
      console.error('Error registering source:', error);
      setResults({
        success: false,
        message: 'Error registering source',
        details: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSource = async (sourceId, updates) => {
    try {
      const response = await fetch(`/api/pathway/sources/${sourceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        await fetchSources();
        setResults({
          success: true,
          message: 'Source updated successfully'
        });
      } else {
        const error = await response.json();
        setResults({
          success: false,
          message: 'Failed to update source',
          details: error.message
        });
      }
    } catch (error) {
      console.error('Error updating source:', error);
      setResults({
        success: false,
        message: 'Error updating source',
        details: error.message
      });
    }
  };

  const handleDeleteSource = async (sourceId) => {
    if (!confirm('Are you sure you want to delete this source? This will stop data ingestion and deactivate the source.')) return;

    try {
      const response = await fetch(`/api/pathway/sources/${sourceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        await fetchSources();
        setResults({
          success: true,
          message: 'Source deleted successfully'
        });
      } else {
        const error = await response.json();
        setResults({
          success: false,
          message: 'Failed to delete source',
          details: error.message
        });
      }
    } catch (error) {
      console.error('Error deleting source:', error);
      setResults({
        success: false,
        message: 'Error deleting source',
        details: error.message
      });
    }
  };

  const formatInterval = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  const getUsageColor = (currentEntries, maxEntries) => {
    const percentage = (currentEntries / maxEntries) * 100;
    if (percentage < 50) return 'green';
    if (percentage < 80) return 'orange';
    return 'red';
  };

  return (
    <div className="live-sources">
      <div className="live-sources-header">
        <h2>🌐 Live Data Sources</h2>
        <p>Manage real-time data ingestion with rolling window data management (max 500 entries per source)</p>
        
        {pathwayStatus && (
          <div className="pathway-status">
            <div className="status-item">
              <span className="status-label">Active Sources:</span>
              <span className="status-value">{pathwayStatus.pathway?.activeSources || 0}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Total Vectors:</span>
              <span className="status-value">{pathwayStatus.pinecone?.totalVectors || 0}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Index Usage:</span>
              <span className="status-value">{pathwayStatus.pinecone?.indexFullness || 0}%</span>
            </div>
          </div>
        )}
      </div>

      <div className="sources-actions">
        <button 
          className="btn btn-primary"
          onClick={() => setShowSourceModal(true)}
          disabled={isLoading}
        >
          📡 Register New Source
        </button>
        <button 
          className="btn btn-secondary"
          onClick={fetchSources}
          disabled={isLoading}
        >
          🔄 Refresh Sources
        </button>
      </div>

      {/* Sources List */}
      <div className="sources-grid">
        {isLoading && sources.length === 0 ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading live sources...</p>
          </div>
        ) : sources.length === 0 ? (
          <div className="no-sources">
            <h3>📭 No sources configured</h3>
            <p>Register your first live data source to start ingesting real-time data with automatic rolling window management</p>
            <button 
              className="btn btn-primary"
              onClick={() => setShowSourceModal(true)}
            >
              📡 Register Your First Source
            </button>
          </div>
        ) : (
          sources.map((source) => (
            <div key={source.sourceId} className="source-card">
              <div className="source-header">
                <h3>{source.sourceName}</h3>
                <div className="source-badges">
                  <span className={`status-badge status-${source.status}`}>
                    {source.status}
                  </span>
                  <span className="type-badge">{source.sourceType}</span>
                </div>
              </div>
              
              <div className="source-details">
                <div className="detail-row">
                  <span>📍 URL:</span>
                  <span className="url-text" title={source.sourceUrl}>
                    {source.sourceUrl.length > 40 
                      ? `${source.sourceUrl.substring(0, 40)}...` 
                      : source.sourceUrl
                    }
                  </span>
                </div>
                <div className="detail-row">
                  <span>🗂️ Rolling Window:</span>
                  <span>{source.maxEntries} entries max</span>
                </div>
                <div className="detail-row">
                  <span>⏱️ Interval:</span>
                  <span>{formatInterval(source.ingestionInterval)}</span>
                </div>
                <div className="detail-row">
                  <span>📊 Current Usage:</span>
                  <span style={{ 
                    color: getUsageColor(source.stats?.currentEntries || 0, source.maxEntries) 
                  }}>
                    {source.stats?.currentEntries || 0} / {source.maxEntries}
                    <small> ({Math.round(((source.stats?.currentEntries || 0) / source.maxEntries) * 100)}%)</small>
                  </span>
                </div>
              </div>

              <div className="source-stats">
                <div className="stat-item">
                  <span>✅ Success:</span>
                  <span>{source.stats?.successfulIngestions || 0}</span>
                </div>
                <div className="stat-item">
                  <span>❌ Errors:</span>
                  <span>{source.stats?.failedIngestions || 0}</span>
                </div>
                <div className="stat-item">
                  <span>🕒 Last Update:</span>
                  <span>
                    {source.lastIngestedAt 
                      ? new Date(source.lastIngestedAt).toLocaleString()
                      : 'Never'
                    }
                  </span>
                </div>
                {source.stats?.oldestEntry && (
                  <div className="stat-item">
                    <span>📅 Data Range:</span>
                    <span>
                      {new Date(source.stats.oldestEntry).toLocaleDateString()} - {' '}
                      {new Date(source.stats.newestEntry).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="source-actions">
                <button 
                  className="btn btn-sm"
                  onClick={() => handleUpdateSource(source.sourceId, {
                    status: source.status === 'active' ? 'paused' : 'active'
                  })}
                  title={source.status === 'active' ? 'Pause ingestion' : 'Resume ingestion'}
                >
                  {source.status === 'active' ? '⏸️ Pause' : '▶️ Resume'}
                </button>
                <button 
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDeleteSource(source.sourceId)}
                  title="Delete source and stop ingestion"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Source Registration Modal */}
      {showSourceModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>📡 Register New Live Source</h3>
              <button 
                className="modal-close"
                onClick={() => setShowSourceModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Source Name:</label>
                <input
                  type="text"
                  value={newSource.sourceName}
                  onChange={(e) => setNewSource(prev => ({
                    ...prev,
                    sourceName: e.target.value
                  }))}
                  placeholder="e.g., Weather Data NYC, Tech News Feed"
                />
              </div>

              <div className="form-group">
                <label>Source Type:</label>
                <select
                  value={newSource.sourceType}
                  onChange={(e) => setNewSource(prev => ({
                    ...prev,
                    sourceType: e.target.value
                  }))}
                >
                  <option value="weather">🌤️ Weather API</option>
                  <option value="news">📰 News Feed</option>
                  <option value="rss">📡 RSS Feed</option>
                  <option value="social">💬 Social Media</option>
                  <option value="api">🔗 Custom API</option>
                </select>
              </div>

              <div className="form-group">
                <label>Source URL:</label>
                <input
                  type="url"
                  value={newSource.sourceUrl}
                  onChange={(e) => setNewSource(prev => ({
                    ...prev,
                    sourceUrl: e.target.value
                  }))}
                  placeholder="https://api.example.com/data"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Max Entries (Rolling Window):</label>
                  <input
                    type="number"
                    min="10"
                    max="10000"
                    value={newSource.maxEntries}
                    onChange={(e) => setNewSource(prev => ({
                      ...prev,
                      maxEntries: parseInt(e.target.value)
                    }))}
                  />
                  <small>⚠️ Older entries are automatically removed when limit is reached</small>
                </div>

                <div className="form-group">
                  <label>Ingestion Interval:</label>
                  <select
                    value={newSource.ingestionInterval}
                    onChange={(e) => setNewSource(prev => ({
                      ...prev,
                      ingestionInterval: parseInt(e.target.value)
                    }))}
                  >
                    <option value="60">1 minute</option>
                    <option value="300">5 minutes</option>
                    <option value="600">10 minutes</option>
                    <option value="1800">30 minutes</option>
                    <option value="3600">1 hour</option>
                    <option value="21600">6 hours</option>
                    <option value="86400">24 hours</option>
                  </select>
                  <small>How often to fetch new data</small>
                </div>
              </div>

              {newSource.sourceType === 'weather' && (
                <div className="config-section">
                  <h4>🌤️ Weather API Configuration</h4>
                  <div className="form-group">
                    <label>API Key (Optional):</label>
                    <input
                      type="password"
                      placeholder="Your OpenWeatherMap API key"
                      onChange={(e) => setNewSource(prev => ({
                        ...prev,
                        config: { ...prev.config, apiKey: e.target.value }
                      }))}
                    />
                    <small>Leave empty to use mock weather data for demo</small>
                  </div>
                  <div className="form-group">
                    <label>Cities (comma-separated):</label>
                    <input
                      type="text"
                      placeholder="New York, London, Tokyo"
                      onChange={(e) => setNewSource(prev => ({
                        ...prev,
                        config: { 
                          ...prev.config, 
                          cities: e.target.value.split(',').map(c => c.trim()).filter(c => c) 
                        }
                      }))}
                    />
                  </div>
                </div>
              )}

              <div className="rolling-window-info">
                <h4>📊 Rolling Window Data Management</h4>
                <ul>
                  <li>✅ Automatically maintains {newSource.maxEntries} most recent entries</li>
                  <li>🔄 Older entries are removed when limit is exceeded</li>
                  <li>💾 Optimizes storage and keeps data fresh</li>
                  <li>⚡ Provides consistent query performance</li>
                </ul>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowSourceModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleRegisterSource}
                disabled={!newSource.sourceName || !newSource.sourceUrl || isLoading}
              >
                {isLoading ? 'Registering...' : 'Register Source'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      <ProgressModal 
        isOpen={!!results}
        onClose={() => setResults(null)}
        results={results}
      />
    </div>
  );
};

export default SimpleLiveSources;