import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, Brain, Loader2, Github, Chrome, User, Check, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Login.css' // Reusing the same styles

const Signup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)
  
  const { signup, socialLogin, error, clearError } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    if (name === 'password') {
      calculatePasswordStrength(value)
    }
    
    if (error) clearError()
  }

  const calculatePasswordStrength = (password) => {
    let strength = 0
    if (password.length >= 8) strength += 1
    if (/[A-Z]/.test(password)) strength += 1
    if (/[a-z]/.test(password)) strength += 1
    if (/[0-9]/.test(password)) strength += 1
    if (/[^A-Za-z0-9]/.test(password)) strength += 1
    setPasswordStrength(strength)
  }

  const getPasswordStrengthText = () => {
    switch (passwordStrength) {
      case 0:
      case 1:
        return 'Very Weak'
      case 2:
        return 'Weak'
      case 3:
        return 'Good'
      case 4:
        return 'Strong'
      case 5:
        return 'Very Strong'
      default:
        return ''
    }
  }

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case 0:
      case 1:
        return '#dc3545'
      case 2:
        return '#fd7e14'
      case 3:
        return '#ffc107'
      case 4:
        return '#198754'
      case 5:
        return '#20c997'
      default:
        return '#e9ecef'
    }
  }

  const passwordsMatch = formData.password && formData.confirmPassword && formData.password === formData.confirmPassword
  const passwordsDontMatch = formData.confirmPassword && formData.password !== formData.confirmPassword

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return

    if (formData.password !== formData.confirmPassword) {
      return
    }

    setIsSubmitting(true)
    try {
      await signup(formData.name, formData.email, formData.password)
      navigate('/sessions')
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
      navigate('/sessions')
    } catch (error) {
      // Error is handled by the context
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = formData.name && formData.email && formData.password && formData.confirmPassword && passwordsMatch && passwordStrength >= 2

  return (
    <div className="auth-container">
      <div className="auth-background">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <Brain className="logo-icon" />
              <h1>Smart Research Assistant</h1>
            </div>
            <h2>Create Account</h2>
            <p>Join thousands of researchers and unlock the power of AI-driven insights</p>
          </div>

          <div className="demo-credentials">
            <h4>🔐 Live Authentication Active</h4>
            <h4>Demo Login: demo@research.ai / demo123</h4>
            <p>Create your own secure account or use demo credentials for testing</p>
          </div>

          {error && (
            <div className="error-message">
              <span>{error}</span>
              <button onClick={clearError} className="error-close">×</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <div className="input-wrapper">
                <User className="input-icon" />
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

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
                  placeholder="Create a strong password"
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
              {formData.password && (
                <div className="password-strength">
                  <div className="strength-bar">
                    <div 
                      className="strength-fill"
                      style={{ 
                        width: `${(passwordStrength / 5) * 100}%`,
                        backgroundColor: getPasswordStrengthColor()
                      }}
                    ></div>
                  </div>
                  <span 
                    className="strength-text"
                    style={{ color: getPasswordStrengthColor() }}
                  >
                    {getPasswordStrengthText()}
                  </span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  required
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isSubmitting}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                {formData.confirmPassword && (
                  <div className={`password-match-indicator ${passwordsMatch ? 'match' : 'no-match'}`}>
                    {passwordsMatch ? <Check size={16} /> : <X size={16} />}
                  </div>
                )}
              </div>
              {passwordsDontMatch && (
                <div className="password-error">
                  Passwords do not match
                </div>
              )}
            </div>

            <div className="form-options">
              <label className="checkbox-label">
                <input type="checkbox" required />
                <span className="checkmark"></span>
                I agree to the{' '}
                <Link to="/terms" className="auth-link">Terms of Service</Link>{' '}
                and{' '}
                <Link to="/privacy" className="auth-link">Privacy Policy</Link>
              </label>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isSubmitting || !isFormValid}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="loading-icon" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>or sign up with</span>
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
              Already have an account?{' '}
              <Link to="/login" className="auth-link">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Signup