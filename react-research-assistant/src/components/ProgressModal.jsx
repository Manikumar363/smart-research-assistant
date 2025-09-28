import { useEffect, useState } from 'react'
import { Search, Globe, Brain, FileText, X } from 'lucide-react'
import { useResearch } from '../context/ResearchContext'
import './ProgressModal.css'

const ProgressModal = () => {
  const { isGenerating, generationProgress } = useResearch()
  const [currentStep, setCurrentStep] = useState(0)

  const steps = [
    {
      icon: Search,
      title: 'Searching uploaded files',
      description: 'Analyzing your documents for relevant information'
    },
    {
      icon: Globe,
      title: 'Fetching live data',
      description: 'Gathering fresh information from online sources'
    },
    {
      icon: Brain,
      title: 'Analyzing and summarizing',
      description: 'Processing and connecting insights from all sources'
    },
    {
      icon: FileText,
      title: 'Generating report',
      description: 'Creating your structured research report'
    }
  ]

  useEffect(() => {
    if (generationProgress <= 25) {
      setCurrentStep(0)
    } else if (generationProgress <= 50) {
      setCurrentStep(1)
    } else if (generationProgress <= 75) {
      setCurrentStep(2)
    } else {
      setCurrentStep(3)
    }
  }, [generationProgress])

  if (!isGenerating) return null

  return (
    <div className="progress-modal-overlay">
      <div className="progress-modal">
        <div className="progress-header">
          <h2>Generating Research Report</h2>
          <div className="progress-percentage">{generationProgress}%</div>
        </div>
        
        <div className="progress-steps">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = index === currentStep
            const isCompleted = index < currentStep
            
            return (
              <div 
                key={index} 
                className={`progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              >
                <div className="step-icon">
                  <Icon size={20} />
                  {isCompleted && <div className="completed-overlay">✓</div>}
                </div>
                <div className="step-content">
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
                {isActive && (
                  <div className="step-loader">
                    <div className="loader"></div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${generationProgress}%` }}
            ></div>
          </div>
          <div className="progress-labels">
            <span>Processing...</span>
            <span>{generationProgress}% Complete</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProgressModal