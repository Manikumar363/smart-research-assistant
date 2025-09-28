import { Download, Share2, File, Globe, Calendar } from 'lucide-react'
import { useResearch } from '../context/ResearchContext'
import './Reports.css'

const Reports = () => {
  const { reports } = useResearch()

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getSourceIcon = (source) => {
    if (source.type === 'file' || source.type === 'pdf') {
      return <File className="source-icon file" />
    }
    return <Globe className="source-icon web" />
  }

  const handleDownload = (report) => {
    // Simulate report download
    const reportContent = `
# ${report.title}

## Generated on: ${formatTimestamp(report.timestamp)}

## Key Takeaways:
${report.takeaways.map(takeaway => `- ${takeaway}`).join('\n')}

## Sources:
${report.sources.map(source => `- ${source.name}`).join('\n')}
    `
    
    const blob = new Blob([reportContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleShare = (report) => {
    if (navigator.share) {
      navigator.share({
        title: report.title,
        text: `Check out this research report: ${report.title}`,
        url: window.location.href
      })
    } else {
      // Fallback: copy to clipboard
      const shareText = `${report.title} - Generated on ${formatTimestamp(report.timestamp)}`
      navigator.clipboard.writeText(shareText).then(() => {
        alert('Report details copied to clipboard!')
      })
    }
  }

  if (reports.length === 0) {
    return (
      <div className="reports">
        <div className="reports-container">
          <h1>Generated Reports</h1>
          <div className="empty-state">
            <File className="empty-icon" />
            <h2>No reports generated yet</h2>
            <p>Start by asking a research question on the home page to generate your first report.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="reports">
      <div className="reports-container">
        <h1>Generated Reports</h1>
        <div className="reports-summary">
          <div className="summary-stat">
            <span className="summary-number">{reports.length}</span>
            <span className="summary-label">Total Reports</span>
          </div>
          <div className="summary-stat">
            <span className="summary-number">
              {reports.reduce((total, report) => total + report.sources.length, 0)}
            </span>
            <span className="summary-label">Sources Analyzed</span>
          </div>
        </div>
        
        <div className="reports-grid">
          {reports.map((report) => (
            <div key={report.id} className="report-card">
              <div className="report-header">
                <h3>{report.title}</h3>
                <div className="report-timestamp">
                  <Calendar size={16} />
                  {formatTimestamp(report.timestamp)}
                </div>
              </div>
              
              <div className="report-content">
                <div className="takeaways-section">
                  <h4>Key Takeaways</h4>
                  <ul className="takeaways-list">
                    {report.takeaways.map((takeaway, index) => (
                      <li key={index}>{takeaway}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="sources-section">
                  <h4>Sources & Citations ({report.sources.length})</h4>
                  <div className="sources-list">
                    {report.sources.map((source, index) => (
                      <div key={index} className="source-item">
                        {getSourceIcon(source)}
                        <span className="source-name">{source.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="report-actions">
                <button 
                  className="action-btn download"
                  onClick={() => handleDownload(report)}
                  aria-label="Download report"
                >
                  <Download size={16} />
                  Download
                </button>
                <button 
                  className="action-btn share"
                  onClick={() => handleShare(report)}
                  aria-label="Share report"
                >
                  <Share2 size={16} />
                  Share
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Reports