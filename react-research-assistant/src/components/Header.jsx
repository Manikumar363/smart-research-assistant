import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Brain, BarChart3, FileText, CreditCard, User, LogOut, ChevronDown, FolderOpen, Search, Radio } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Header.css'

const Header = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const { isAuthenticated, user, logout } = useAuth()
  const userMenuRef = useRef(null)

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const navigation = [
    { name: 'Sessions', href: '/sessions', icon: FolderOpen },
    { name: 'Research', href: '/home', icon: Search },
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    { name: 'Live Sources', href: '/live-sources', icon: Radio },
    { name: 'Reports', href: '/reports', icon: FileText },
    { name: 'Usage', href: '/usage', icon: CreditCard }
  ]

  const handleLogout = async () => {
    await logout()
    navigate('/login')
    setIsUserMenuOpen(false)
  }

  // Don't show navigation on auth pages
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup'

  return (
    <header className="header">
      <div className="header-container">
        <Link to={isAuthenticated ? "/sessions" : "/login"} className="logo">
          <Brain className="logo-icon" />
          <h1>Smart Research Assistant</h1>
        </Link>
        
        {!isAuthPage && isAuthenticated && (
          <>
            <nav className={`nav ${isMenuOpen ? 'nav-open' : ''}`}>
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.href
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Icon size={18} />
                    {item.name}
                  </Link>
                )
              })}
            </nav>

            <div className="header-actions">
              <div className="user-menu" ref={userMenuRef}>
                <button 
                  className="user-menu-trigger"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  <User size={18} />
                  <span>{user?.name || user?.email || 'User'}</span>
                  <ChevronDown size={16} />
                </button>
                
                {isUserMenuOpen && (
                  <div className="user-menu-dropdown">
                    <div className="user-info">
                      <p className="user-name">{user?.name || 'User'}</p>
                      <p className="user-email">{user?.email}</p>
                    </div>
                    <hr />
                    <button 
                      className="logout-btn"
                      onClick={handleLogout}
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button 
              className="menu-toggle"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </>
        )}
      </div>
    </header>
  )
}

export default Header