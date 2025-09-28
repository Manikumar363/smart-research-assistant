import { Coins, HelpCircle, FileText, Clock, TrendingUp } from 'lucide-react'
import { useResearch } from '../context/ResearchContext'
import './Usage.css'

const Usage = () => {
  const { creditBalance, stats, activities } = useResearch()

  const getActivityIcon = (type) => {
    if (type === 'report') {
      return <FileText className="activity-icon report" />
    }
    return <HelpCircle className="activity-icon question" />
  }

  const totalSpent = stats.creditsUsed
  const remainingCredits = creditBalance

  return (
    <div className="usage">
      <div className="usage-container">
        <h1>Usage & Billing</h1>
        
        <div className="billing-overview">
          <div className="balance-card">
            <div className="balance-header">
              <h2>Current Balance</h2>
              <Coins className="balance-icon" />
            </div>
            <div className="balance-amount">
              <span className="amount">{remainingCredits}</span>
              <span className="currency">Credits</span>
            </div>
            <div className="balance-status">
              {remainingCredits > 20 ? (
                <span className="status good">Good balance</span>
              ) : remainingCredits > 10 ? (
                <span className="status warning">Running low</span>
              ) : (
                <span className="status critical">Critical - Please top up</span>
              )}
            </div>
          </div>

          <div className="usage-stats">
            <h2>Usage Statistics</h2>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-icon">
                  <HelpCircle />
                </div>
                <div className="stat-details">
                  <span className="stat-value">{stats.questionsCount}</span>
                  <span className="stat-label">Questions Asked</span>
                  <span className="stat-cost">{stats.questionsCount} credits</span>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-icon">
                  <FileText />
                </div>
                <div className="stat-details">
                  <span className="stat-value">{stats.reportsCount}</span>
                  <span className="stat-label">Reports Generated</span>
                  <span className="stat-cost">{stats.reportsCount * 2} credits</span>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-icon">
                  <TrendingUp />
                </div>
                <div className="stat-details">
                  <span className="stat-value">{totalSpent}</span>
                  <span className="stat-label">Total Spent</span>
                  <span className="stat-cost">This month</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pricing-section">
          <h2>Pricing Information</h2>
          <div className="pricing-cards">
            <div className="pricing-card">
              <div className="pricing-header">
                <HelpCircle className="pricing-icon" />
                <h3>Questions</h3>
              </div>
              <div className="pricing-details">
                <span className="price">1 Credit</span>
                <span className="price-desc">per question asked</span>
              </div>
              <div className="pricing-features">
                <ul>
                  <li>Instant AI-powered search</li>
                  <li>Access to uploaded documents</li>
                  <li>Live data integration</li>
                </ul>
              </div>
            </div>

            <div className="pricing-card featured">
              <div className="pricing-header">
                <FileText className="pricing-icon" />
                <h3>Reports</h3>
              </div>
              <div className="pricing-details">
                <span className="price">2 Credits</span>
                <span className="price-desc">per report generated</span>
              </div>
              <div className="pricing-features">
                <ul>
                  <li>Comprehensive analysis</li>
                  <li>Multiple source citations</li>
                  <li>Downloadable format</li>
                  <li>Fresh data integration</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="activity-section">
          <h2>Recent Activity</h2>
          {activities.length === 0 ? (
            <div className="empty-activity">
              <Clock className="empty-icon" />
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="activity-list">
              {activities.map((activity) => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-left">
                    {getActivityIcon(activity.type)}
                    <div className="activity-content">
                      <p className="activity-description">{activity.description}</p>
                      <span className="activity-time">{activity.timestamp}</span>
                    </div>
                  </div>
                  <div className="activity-cost">
                    <span className="cost-amount">-{activity.cost}</span>
                    <span className="cost-label">Credit{activity.cost !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="credit-management">
          <h2>Credit Management</h2>
          <div className="management-card">
            <div className="management-content">
              <h3>Need more credits?</h3>
              <p>Purchase additional credits to continue using the Smart Research Assistant.</p>
              <div className="credit-packages">
                <div className="package">
                  <span className="package-amount">50 Credits</span>
                  <span className="package-price">$10</span>
                </div>
                <div className="package featured">
                  <span className="package-amount">100 Credits</span>
                  <span className="package-price">$18</span>
                  <span className="package-save">Save 10%</span>
                </div>
                <div className="package">
                  <span className="package-amount">250 Credits</span>
                  <span className="package-price">$40</span>
                  <span className="package-save">Save 20%</span>
                </div>
              </div>
              <button className="purchase-btn">
                <Coins size={18} />
                Purchase Credits
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Usage