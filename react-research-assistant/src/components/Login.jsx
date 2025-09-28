import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, Brain, Loader2, Github, Chrome } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Login.css'

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { login, socialLogin, error, clearError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const from = location.state?.from?.pathname || '/sessions'

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    if (error) clearError()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      await login(formData.email, formData.password)
      navigate(from, { replace: true })
    } catch (error) {
      // Error is handled by the context
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSocialLogin = async (provider) => {
    if (isSubmitting) return
    
    setIsSubmitting(true)
    try {
      await socialLogin(provider)
      navigate(from, { replace: true })
    } catch (error) {
      // Error is handled by the context
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-background">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <Brain className="logo-icon" />
              <h1>Smart Research Assistant</h1>
            </div>
            <h2>Welcome Back</h2>
            <p>Sign in to continue your research journey</p>
          </div>

          <div className="demo-credentials">
            <h4>🔐 Live Authentication Active</h4>
            <h4>Demo Username: demo@research.ai</h4>
            <h4>Demo Password: demo123</h4>
            <p>Create your own account or use these demo credentials</p>
          </div>

          {error && (
            <div className="error-message">
              <span>{error}</span>
              <button onClick={clearError} className="error-close">×</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-wrapper">
                <Mail className="input-icon" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  required
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="checkbox-label">
                <input type="checkbox" />
                <span className="checkmark"></span>
                Remember me
              </label>
              <Link to="/forgot-password" className="forgot-link">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isSubmitting || !formData.email || !formData.password}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="loading-icon" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>or continue with</span>
          </div>

          <div className="social-login">
            <button
              type="button"
              className="social-btn google"
              onClick={() => handleSocialLogin('google')}
              disabled={isSubmitting}
            >
              <Chrome size={20} />
              Google
            </button>
            <button
              type="button"
              className="social-btn github"
              onClick={() => handleSocialLogin('github')}
              disabled={isSubmitting}
            >
              <Github size={20} />
              GitHub
            </button>
          </div>

          <div className="auth-footer">
            <p>
              Don't have an account?{' '}
              <Link to="/signup" className="auth-link">
                Sign up for free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login