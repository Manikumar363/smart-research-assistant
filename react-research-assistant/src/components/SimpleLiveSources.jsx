import React, { useState, useEffect } from 'react';
import './LiveSources.css';

const SimpleLiveSources = () => {
  const [templates, setTemplates] = useState([]);
  const [weatherCities, setWeatherCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ingestionResults, setIngestionResults] = useState(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [status, setStatus] = useState(null);
  const [pathwayStatus, setPathwayStatus] = useState(null);
  const [showPathwayConfig, setShowPathwayConfig] = useState(false);
  const [pathwayConfig, setPathwayConfig] = useState({
    weatherApiKey: '',
    ingestionInterval: 300,
    enabledCities: ['New York', 'London', 'Tokyo', 'Sydney', 'Paris']
  });

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
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  };

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading simple sources data...');
      
      // Load templates, weather cities, and pathway status in parallel
      const [templatesRes, citiesRes, statusRes, pathwayRes] = await Promise.all([
        api('/templates'),
        api('/weather/cities'),
        api('/status'),
        fetch('http://localhost:5000/api/pathway/status').then(r => r.ok ? r.json() : null).catch(() => null)
      ]);
      
      console.log('📋 Templates loaded:', templatesRes);
      console.log('🌍 Weather cities loaded:', citiesRes);
      console.log('📊 Status loaded:', statusRes);
      console.log('🚀 Pathway status loaded:', pathwayRes);
      
      setTemplates(templatesRes.templates || []);
      setWeatherCities(citiesRes.cities || []);
      setStatus(statusRes.status || null);
      setPathwayStatus(pathwayRes?.status || null);
      setError(null);
      
    } catch (err) {
      console.error('❌ Failed to load initial data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger weather data ingestion
  const handleWeatherIngestion = async () => {
    try {
      setIsIngesting(true);
      setIngestionResults(null);
      setError(null);
      
      console.log('🌤️ Starting weather data ingestion...');
      
      const response = await api('/weather/ingest', {
        method: 'POST',
        body: JSON.stringify({})
      });
      
      console.log('✅ Weather ingestion completed:', response);
      setIngestionResults(response.result);
      
      // Refresh status
      await loadInitialData();
      
    } catch (err) {
      console.error('❌ Weather ingestion failed:', err);
      setError(err.message);
    } finally {
      setIsIngesting(false);
    }
  };

  // Trigger demo data ingestion
  const handleDemoIngestion = async (sourceType = 'demo') => {
    try {
      setIsIngesting(true);
      setIngestionResults(null);
      setError(null);
      
      console.log(`🎭 Starting ${sourceType} data ingestion...`);
      
      const response = await api('/demo/ingest', {
        method: 'POST',
        body: JSON.stringify({ sourceType })
      });
      
      console.log('✅ Demo ingestion completed:', response);
      setIngestionResults(response.result);
      
      // Refresh status
      await loadInitialData();
      
    } catch (err) {
      console.error('❌ Demo ingestion failed:', err);
      setError(err.message);
    } finally {
      setIsIngesting(false);
    }
  };

  // Configure Pathway service
  const handlePathwayConfig = async () => {
    try {
      setIsIngesting(true);
      setError(null);
      
      console.log('⚙️ Configuring Pathway service...', pathwayConfig);
      
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:5000/api/pathway/configure', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pathwayConfig)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Pathway configuration updated:', result);
      
      setShowPathwayConfig(false);
      await loadInitialData(); // Refresh status
      
    } catch (err) {
      console.error('❌ Pathway configuration failed:', err);
      setError(err.message);
    } finally {
      setIsIngesting(false);
    }
  };

  if (loading) {
    return (
      <div className="live-sources">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading simple sources...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="live-sources">
      <div className="live-sources-header">
        <h1>🌐 Simple Live Data Sources</h1>
        <p>Ingest live data from weather APIs and demo content</p>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="close-error">×</button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2>🚀 Quick Actions</h2>
        
        <div className="action-buttons">
          <button 
            onClick={handleWeatherIngestion}
            disabled={isIngesting}
            className="action-btn weather-btn"
          >
            <span className="btn-icon">🌤️</span>
            <span className="btn-text">
              {isIngesting ? 'Ingesting Weather Data...' : 'Ingest Weather Data'}
            </span>
          </button>

          <button 
            onClick={() => handleDemoIngestion('demo')}
            disabled={isIngesting}
            className="action-btn demo-btn"
          >
            <span className="btn-icon">🎭</span>
            <span className="btn-text">
              {isIngesting ? 'Ingesting Demo Data...' : 'Ingest Demo Content'}
            </span>
          </button>

          <button 
            onClick={() => handleDemoIngestion('weather')}
            disabled={isIngesting}
            className="action-btn weather-demo-btn"
          >
            <span className="btn-icon">🌡️</span>
            <span className="btn-text">
              {isIngesting ? 'Ingesting Weather Demo...' : 'Weather Demo Data'}
            </span>
          </button>

          <button 
            onClick={() => setShowPathwayConfig(true)}
            disabled={isIngesting}
            className="action-btn pathway-btn"
          >
            <span className="btn-icon">🚀</span>
            <span className="btn-text">Configure Pathway Service</span>
          </button>
        </div>
      </div>

      {/* Pathway Configuration Modal */}
      {showPathwayConfig && (
        <div className="config-modal">
          <div className="config-modal-content">
            <h3>🚀 Pathway Service Configuration</h3>
            
            <div className="config-form">
              <div className="config-field">
                <label>Weather API Key:</label>
                <input
                  type="password"
                  value={pathwayConfig.weatherApiKey}
                  onChange={(e) => setPathwayConfig({...pathwayConfig, weatherApiKey: e.target.value})}
                  placeholder="Enter OpenWeatherMap API key (leave empty for mock data)"
                />
              </div>

              <div className="config-field">
                <label>Ingestion Interval (seconds):</label>
                <input
                  type="number"
                  value={pathwayConfig.ingestionInterval}
                  onChange={(e) => setPathwayConfig({...pathwayConfig, ingestionInterval: parseInt(e.target.value)})}
                  min="60"
                  max="3600"
                />
              </div>

              <div className="config-field">
                <label>Enabled Cities:</label>
                <div className="cities-checkboxes">
                  {['New York', 'London', 'Tokyo', 'Sydney', 'Paris', 'Berlin', 'Mumbai', 'São Paulo'].map(city => (
                    <label key={city} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={pathwayConfig.enabledCities.includes(city)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPathwayConfig({
                              ...pathwayConfig,
                              enabledCities: [...pathwayConfig.enabledCities, city]
                            });
                          } else {
                            setPathwayConfig({
                              ...pathwayConfig,
                              enabledCities: pathwayConfig.enabledCities.filter(c => c !== city)
                            });
                          }
                        }}
                      />
                      {city}
                    </label>
                  ))}
                </div>
              </div>

              <div className="config-actions">
                <button 
                  onClick={handlePathwayConfig}
                  disabled={isIngesting}
                  className="config-btn save-btn"
                >
                  {isIngesting ? 'Configuring...' : 'Save Configuration'}
                </button>
                <button 
                  onClick={() => setShowPathwayConfig(false)}
                  className="config-btn cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ingestion Results */}
      {ingestionResults && (
        <div className="ingestion-results">
          <h3>📊 Ingestion Results</h3>
          <div className="results-grid">
            <div className="result-item">
              <span className="result-label">Source Type:</span>
              <span className="result-value">{ingestionResults.sourceType}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Total Fetched:</span>
              <span className="result-value">{ingestionResults.totalFetched}</span>
            </div>
            <div className="result-item">
              <span className="result-label">New Items:</span>
              <span className="result-value">{ingestionResults.newItems}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Successfully Ingested:</span>
              <span className="result-value success">{ingestionResults.ingested}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Skipped:</span>
              <span className="result-value warning">{ingestionResults.skipped}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Errors:</span>
              <span className="result-value error">{ingestionResults.errors}</span>
            </div>
          </div>
          
          <button 
            onClick={() => setIngestionResults(null)}
            className="close-results-btn"
          >
            Close Results
          </button>
        </div>
      )}

      {/* Available Templates */}
      <div className="templates-section">
        <h2>📋 Available Source Types</h2>
        <div className="templates-grid">
          {templates.map(template => (
            <div key={template.id} className="template-card">
              <div className="template-header">
                <h3>{template.name}</h3>
                <span className="template-type">{template.type}</span>
              </div>
              <p className="template-description">{template.description}</p>
              <div className="template-category">
                <span className="category-badge">{template.category}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weather Cities */}
      <div className="weather-cities-section">
        <h2>🌍 Weather Data Cities</h2>
        <div className="cities-grid">
          {weatherCities.map(city => (
            <div key={city.id} className="city-card">
              <div className="city-header">
                <h3>{city.name}</h3>
                <span className="city-status enabled">📍 Available</span>
              </div>
              <p className="city-description">{city.description}</p>
              <div className="city-location">
                <span className="location-info">
                  📍 {city.location.lat.toFixed(2)}, {city.location.lon.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Information */}
      {status && (
        <div className="status-section">
          <h2>📊 Current Status</h2>
          <div className="status-grid">
            <div className="status-card">
              <h3>🌤️ Weather Sources</h3>
              <div className="status-stats">
                <div className="stat-item">
                  <span className="stat-label">Available Cities:</span>
                  <span className="stat-value">{status.weatherSources?.available || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Documents Ingested:</span>
                  <span className="stat-value">{status.weatherSources?.ingested || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Last Update:</span>
                  <span className="stat-value">
                    {status.weatherSources?.lastUpdate ? 
                      new Date(status.weatherSources.lastUpdate).toLocaleString() : 
                      'Never'
                    }
                  </span>
                </div>
              </div>
            </div>

            <div className="status-card">
              <h3>🎭 Demo Sources</h3>
              <div className="status-stats">
                <div className="stat-item">
                  <span className="stat-label">Documents Ingested:</span>
                  <span className="stat-value">{status.demoSources?.ingested || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Last Update:</span>
                  <span className="stat-value">
                    {status.demoSources?.lastUpdate ? 
                      new Date(status.demoSources.lastUpdate).toLocaleString() : 
                      'Never'
                    }
                  </span>
                </div>
              </div>
            </div>

            <div className="status-card">
              <h3>📈 Total Documents</h3>
              <div className="status-stats">
                <div className="stat-item">
                  <span className="stat-label">All Sources:</span>
                  <span className="stat-value total">{status.totalDocuments || 0}</span>
                </div>
              </div>
            </div>

            {pathwayStatus && (
              <div className="status-card">
                <h3>🚀 Pathway Integration</h3>
                <div className="status-stats">
                  <div className="stat-item">
                    <span className="stat-label">Status:</span>
                    <span className={`stat-value ${pathwayStatus.serviceStatus}`}>
                      {pathwayStatus.serviceStatus || 'Unknown'}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Total Documents:</span>
                    <span className="stat-value">{pathwayStatus.pathwayIntegration?.totalDocuments || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Health:</span>
                    <span className={`stat-value ${pathwayStatus.integrationHealth}`}>
                      {pathwayStatus.integrationHealth || 'Unknown'}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Last Update:</span>
                    <span className="stat-value">
                      {pathwayStatus.pathwayIntegration?.lastUpdate ? 
                        new Date(pathwayStatus.pathwayIntegration.lastUpdate).toLocaleString() : 
                        'Never'
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleLiveSources;