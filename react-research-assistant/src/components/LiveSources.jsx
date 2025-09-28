import React, { useState, useEffect } from 'react';
import './LiveSources.css';

const LiveSources = () => {
  const [templates, setTemplates] = useState([]);
  const [weatherCities, setWeatherCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ingestionResults, setIngestionResults] = useState(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [status, setStatus] = useState(null);

  // API helper
  const api = async (endpoint, options = {}) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`http://localhost:5000/api/simple-sources${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'API request failed');
    }

    return response.json();
  };

  // Load sources and templates
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading live sources data...');
      
      const [sourcesData, templatesData] = await Promise.all([
        api(''),
        api('/templates')
      ]);
      
      console.log('📊 Sources data:', sourcesData);
      console.log('📋 Templates data:', templatesData);
      
      setSources(sourcesData.sources || []);
      setTemplates(templatesData.templates || []);
      setError(null);
      
      console.log('✅ Data loaded successfully');
      console.log('- Sources count:', sourcesData.sources?.length || 0);
      console.log('- Templates count:', templatesData.templates?.length || 0);
    } catch (err) {
      console.error('❌ Failed to load live sources:', err);
      setError('Failed to load live sources: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Add source
  const handleAddSource = async () => {
    try {
      const payload = selectedTemplate 
        ? { templateId: selectedTemplate, enabled: true }
        : { customSource: { ...customSource, enabled: true } };

      await api('/add', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setShowAddModal(false);
      setSelectedTemplate('');
      setCustomSource({ name: '', url: '', type: 'rss', category: 'general' });
      await loadData();
    } catch (err) {
      setError('Failed to add source: ' + err.message);
    }
  };

  // Toggle source
  const handleToggleSource = async (sourceId, enabled) => {
    try {
      await api(`/${sourceId}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enabled: !enabled })
      });
      await loadData();
    } catch (err) {
      setError('Failed to toggle source: ' + err.message);
    }
  };

  // Remove source
  const handleRemoveSource = async (sourceId) => {
    if (!window.confirm('Are you sure you want to remove this source?')) return;

    try {
      await api(`/${sourceId}`, { method: 'DELETE' });
      await loadData();
    } catch (err) {
      setError('Failed to remove source: ' + err.message);
    }
  };

  // Ingest single source
  const handleIngestSource = async (sourceId) => {
    try {
      setIsIngesting(true);
      const result = await api(`/${sourceId}/ingest`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      
      setIngestionResults([result.result]);
      setTimeout(() => setIngestionResults(null), 5000);
    } catch (err) {
      setError('Failed to ingest source: ' + err.message);
    } finally {
      setIsIngesting(false);
    }
  };

  // Ingest all sources
  const handleIngestAll = async () => {
    try {
      setIsIngesting(true);
      const result = await api('/ingest-all', {
        method: 'POST',
        body: JSON.stringify({})
      });
      
      setIngestionResults(result.results);
      setTimeout(() => setIngestionResults(null), 10000);
    } catch (err) {
      setError('Failed to ingest all sources: ' + err.message);
    } finally {
      setIsIngesting(false);
    }
  };

  if (loading) {
    return (
      <div className="live-sources">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading live sources...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="live-sources">
      <div className="live-sources-header">
        <h2>📡 Live Source Ingestion</h2>
        <p>Automatically ingest content from RSS feeds, news sites, and blogs</p>
        
        <div className="header-actions">
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            ➕ Add Source
          </button>
          <button 
            className="btn btn-secondary"
            onClick={handleIngestAll}
            disabled={isIngesting || sources.filter(s => s.enabled).length === 0}
          >
            {isIngesting ? '🔄 Ingesting...' : '📥 Ingest All'}
          </button>
          <button 
            className="btn btn-outline"
            onClick={loadData}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error-alert">
          <span>❌ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {ingestionResults && (
        <div className="ingestion-results">
          <h3>📊 Ingestion Results</h3>
          {ingestionResults.map((result, index) => (
            <div key={index} className="result-item">
              <div className="result-header">
                <span className="source-name">{result.sourceName}</span>
                <span className="result-stats">
                  ✅ {result.ingested || 0} ingested, 
                  ⏭️ {result.skipped || 0} skipped,
                  ❌ {result.errors || 0} errors
                </span>
              </div>
              {result.error && (
                <div className="result-error">Error: {result.error}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="sources-grid">
        {sources.length === 0 ? (
          <div className="empty-state">
            <h3>No live sources configured</h3>
            <p>Add RSS feeds, news sites, or blogs to start automatic content ingestion</p>
            <button 
              className="btn btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              Add Your First Source
            </button>
          </div>
        ) : (
          sources.map(source => (
            <div key={source.id} className={`source-card ${!source.enabled ? 'disabled' : ''}`}>
              <div className="source-header">
                <h3>{source.name}</h3>
                <div className="source-controls">
                  <button
                    className={`toggle-btn ${source.enabled ? 'enabled' : 'disabled'}`}
                    onClick={() => handleToggleSource(source.id, source.enabled)}
                    title={source.enabled ? 'Disable source' : 'Enable source'}
                  >
                    {source.enabled ? '🟢' : '🔴'}
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => handleIngestSource(source.id)}
                    disabled={!source.enabled || isIngesting}
                    title="Ingest now"
                  >
                    📥
                  </button>
                  <button
                    className="action-btn delete"
                    onClick={() => handleRemoveSource(source.id)}
                    title="Remove source"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="source-details">
                <div className="detail-row">
                  <span className="label">Type:</span>
                  <span className="badge">{source.type.toUpperCase()}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Category:</span>
                  <span className="badge">{source.category}</span>
                </div>
                <div className="detail-row">
                  <span className="label">URL:</span>
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="source-url">
                    {source.url.length > 50 ? source.url.substring(0, 50) + '...' : source.url}
                  </a>
                </div>
              </div>

              <div className="source-stats">
                <div className="stat">
                  <span className="stat-value">{source.itemCount || 0}</span>
                  <span className="stat-label">Items</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{source.errorCount || 0}</span>
                  <span className="stat-label">Errors</span>
                </div>
                <div className="stat">
                  <span className="stat-value">
                    {source.lastChecked ? new Date(source.lastChecked).toLocaleDateString() : 'Never'}
                  </span>
                  <span className="stat-label">Last Check</span>
                </div>
              </div>

              <div className="source-status">
                <span className={`status-badge ${source.status}`}>
                  {source.status === 'active' ? '✅ Active' : 
                   source.status === 'error' ? '❌ Error' : '⏸️ Paused'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Source Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Add Live Source</h3>
              <button onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <div className="modal-content">
              <div className="source-options">
                <div className="option-section">
                  <h4>📋 Use Template</h4>
                  {console.log('🔍 Templates in render:', templates)}
                  <select 
                    value={selectedTemplate} 
                    onChange={(e) => {
                      console.log('📝 Template selected:', e.target.value);
                      setSelectedTemplate(e.target.value);
                      if (e.target.value) {
                        setCustomSource({ name: '', url: '', type: 'rss', category: 'general' });
                      }
                    }}
                  >
                    <option value="">Select a template...</option>
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.type})
                      </option>
                    ))}
                  </select>
                  
                  {selectedTemplate && (
                    <div className="template-preview">
                      {templates.find(t => t.id === selectedTemplate) && (
                        <>
                          <p><strong>URL:</strong> {templates.find(t => t.id === selectedTemplate).url}</p>
                          <p><strong>Category:</strong> {templates.find(t => t.id === selectedTemplate).category}</p>
                          <p><strong>Description:</strong> {templates.find(t => t.id === selectedTemplate).description}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="divider">OR</div>

                <div className="option-section">
                  <h4>🛠️ Custom Source</h4>
                  <div className="form-group">
                    <label>Name:</label>
                    <input
                      type="text"
                      value={customSource.name}
                      onChange={(e) => {
                        setCustomSource({...customSource, name: e.target.value});
                        if (e.target.value) setSelectedTemplate('');
                      }}
                      placeholder="My News Source"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>URL:</label>
                    <input
                      type="url"
                      value={customSource.url}
                      onChange={(e) => setCustomSource({...customSource, url: e.target.value})}
                      placeholder="https://example.com/feed.xml"
                    />
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Type:</label>
                      <select
                        value={customSource.type}
                        onChange={(e) => setCustomSource({...customSource, type: e.target.value})}
                      >
                        <option value="rss">RSS</option>
                        <option value="atom">Atom</option>
                        <option value="html">HTML</option>
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label>Category:</label>
                      <select
                        value={customSource.category}
                        onChange={(e) => setCustomSource({...customSource, category: e.target.value})}
                      >
                        <option value="general">General</option>
                        <option value="technology">Technology</option>
                        <option value="business">Business</option>
                        <option value="science">Science</option>
                        <option value="health">Health</option>
                        <option value="finance">Finance</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-outline" 
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleAddSource}
                disabled={!selectedTemplate && (!customSource.name || !customSource.url)}
              >
                Add Source
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveSources;