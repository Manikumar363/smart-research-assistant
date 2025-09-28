import { useState, useRef, useEffect } from 'react'
import { Send, Upload, X, File, FileText, Paperclip, Bot, User, Sparkles, Save, XCircle, ArrowLeft } from 'lucide-react'
import { useResearch } from '../context/ResearchContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './HomeChatNew.css'

const Home = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { accessToken, isAuthenticated, user } = useAuth()
  
  // Session state from navigation
  const existingSession = location.state?.existingSession
  const initialQuestion = location.state?.question || ''
  
  const [message, setMessage] = useState('')
  const [currentSession, setCurrentSession] = useState(existingSession || null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const chatEndRef = useRef(null)
  const textareaRef = useRef(null)
  
  const { uploadedFiles, addUploadedFile, removeUploadedFile, generateReport, refreshSessions } = useResearch()

  // Initialize chat messages based on session
  useEffect(() => {
    if (existingSession && existingSession.chatHistory && existingSession.chatHistory.length > 0) {
      // Load existing chat history
      const existingMessages = existingSession.chatHistory.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
      setChatMessages(existingMessages)
      
      // Also restore uploaded files if they exist (enhanced for Pinecone integration)
      if (existingSession.uploadedFiles && existingSession.uploadedFiles.length > 0) {
        console.log('🔍 Restoring uploaded files with Pinecone metadata:', existingSession.uploadedFiles)
        existingSession.uploadedFiles.forEach(file => {
          addUploadedFile({
            id: file.id || file.docId || `restored_${Date.now()}_${Math.random()}`,
            name: file.name || file.fileName,
            size: file.size || file.fileSize || 0,
            type: file.type || file.mimeType || 'unknown',
            lastModified: file.lastModified || file.uploadDate,
            // Pinecone-specific metadata
            docId: file.docId,
            pineconeFileId: file.pineconeFileId,
            pineconeIds: file.pineconeIds,
            chunksCount: file.chunksCount,
            wordCount: file.wordCount,
            embeddingsGenerated: file.embeddingsGenerated || false,
            storedInPinecone: file.storedInPinecone || false,
            processingComplete: file.processingComplete || false,
            // Don't include actual file object since it's stored in Pinecone
            file: null
          })
        })
        
        const restoredCount = existingSession.uploadedFiles.length
        const embeddedCount = existingSession.uploadedFiles.filter(f => f.embeddingsGenerated).length
        console.log(`✅ Restored ${restoredCount} files (${embeddedCount} with embeddings) from session`)
        
        // Show restoration message
        const restorationMessage = {
          id: Date.now() + Math.random(),
          type: 'system',
          content: `🔄 Session restored with ${restoredCount} files (${embeddedCount} searchable). All embedded documents are available for semantic search.`,
          timestamp: new Date()
        }
        setChatMessages(prev => [...prev, restorationMessage])
      }
    } else {
      // Default welcome message
      setChatMessages([
        {
          id: 1,
          type: 'bot',
          content: existingSession 
            ? `Welcome back! I've loaded your session: "${existingSession.title || existingSession.query}". Continue your research or ask new questions.`
            : 'Hello! I\'m your Smart Research Assistant. Ask me any question and I\'ll help you find evidence-based answers. You can also upload documents for more comprehensive research.',
          timestamp: new Date()
        }
      ])
    }
  }, [existingSession])

  // API base URL
  const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://your-backend-production-url.com/api' 
    : 'http://localhost:5001/api'

  // Load initial question if provided
  useEffect(() => {
    if (initialQuestion && !message) {
      setMessage(initialQuestion)
    }
    
    // Debug: Check authentication status
    const authToken = accessToken || localStorage.getItem('research_assistant_token')
    console.log('Home component authentication status:', {
      hasToken: !!authToken,
      tokenLength: authToken ? authToken.length : 0,
      tokenStart: authToken ? authToken.substring(0, 10) + '...' : 'No token'
    })
    
    if (!authToken) {
      console.warn('No authentication token found. User should be redirected to login.')
    }
  }, [initialQuestion, message, accessToken])

  // Authentication debugging - Add this to verify tokens
  useEffect(() => {
    console.log('🔍 Authentication Status Check:')
    console.log('- Auth Context accessToken:', accessToken ? `${accessToken.substring(0, 10)}...` : 'None')
    console.log('- LocalStorage research_assistant_token:', localStorage.getItem('research_assistant_token') ? `${localStorage.getItem('research_assistant_token').substring(0, 10)}...` : 'None')
    console.log('- LocalStorage token:', localStorage.getItem('token') ? `${localStorage.getItem('token').substring(0, 10)}...` : 'None')
    console.log('- isAuthenticated:', isAuthenticated)
    console.log('- User:', user)
  }, [accessToken, isAuthenticated, user])

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, isTyping])

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [message])

  const handleMessageSubmit = async (e) => {
    e.preventDefault()
    if (!message.trim()) return

    const authToken = accessToken || localStorage.getItem('research_assistant_token')
    if (!authToken) {
      alert('Please log in to send messages')
      return
    }

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: message.trim(),
      timestamp: new Date()
    }

    setChatMessages(prev => [...prev, userMessage])
    setMessage('')
    setIsTyping(true)

    // Create a new session if one doesn't exist
    let sessionToUse = currentSession
    if (!currentSession) {
      try {
        const response = await fetch(`${API_BASE_URL}/user/sessions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            question: userMessage.content,
            title: userMessage.content.length > 50 ? userMessage.content.substring(0, 47) + '...' : userMessage.content,
            status: 'in-progress'
          })
        })

        if (response.ok) {
          const responseData = await response.json()
          sessionToUse = responseData.data
          setCurrentSession(sessionToUse)
          setHasUnsavedChanges(false) // Fresh session, no unsaved changes yet
          
          // Refresh sessions list to show the new session
          await refreshSessions()
        }
      } catch (error) {
        console.error('Error creating session:', error)
        // Continue without session if creation fails
      }
    } else {
      // Mark existing session as having unsaved changes
      setHasUnsavedChanges(true)
    }

    try {
      // Use the new dual mode research-answer endpoint
      const researchResponse = await fetch(`${API_BASE_URL}/files/research-answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          query: userMessage.content,
          sessionId: sessionToUse?._id,
          searchLimit: 10,
          includeFileData: true,
          includeLiveData: true,
          ensureSessionInit: true
        })
      })

      const result = await researchResponse.json()

      if (!researchResponse.ok) {
        throw new Error(result.message || 'Research query failed')
      }

      console.log('🎯 Research results:', result)

      // Extract response data
      const { answer, sources, confidence, conversationContext, retrievedData } = result
      
      // Format the bot response with answer and sources
      let botResponse = answer.response || answer

      // Add source information if available
      if (sources && sources.length > 0) {
        botResponse += '\n\n**Sources:**\n'
        sources.slice(0, 5).forEach((source, index) => {
          botResponse += `${index + 1}. ${source.title || source.source || 'Source'}\n`
          if (source.snippet) {
            botResponse += `   "${source.snippet}"\n`
          }
        })
        
        if (sources.length > 5) {
          botResponse += `\n... and ${sources.length - 5} more sources`
        }
      }

      // Add confidence information
      if (confidence) {
        const confidenceText = confidence > 0.8 ? 'High' : confidence > 0.6 ? 'Medium' : 'Low'
        botResponse += `\n\n*Answer confidence: ${confidenceText} (${Math.round(confidence * 100)}%)*`
      }

      // Add conversation context info if available
      if (conversationContext && conversationContext.conversationLength > 2) {
        botResponse += `\n\n💬 *This answer considers our previous conversation context*`
      }

      // Add bot response to chat
      const aiMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: botResponse,
        timestamp: new Date(),
        hasReportOption: true,
        sources: sources || [],
        confidence: confidence,
        conversationContext: conversationContext,
        retrievedData: retrievedData
      }
      setChatMessages(prev => [...prev, aiMessage])
      setIsTyping(false)
      
      // Mark as having unsaved changes after bot response
      setHasUnsavedChanges(true)

    } catch (error) {
      console.error('❌ Research error:', error)
      
      // Fallback response
      const botResponse = {
        id: Date.now() + 1,
        type: 'bot',
        content: `I encountered an issue while researching your question: "${userMessage.content}". ${error.message || 'Please try again or rephrase your question.'}\n\n📊 You can still generate a comprehensive report on this topic.`,
        timestamp: new Date(),
        hasReportOption: true,
        isError: true
      }
      setChatMessages(prev => [...prev, botResponse])
      setIsTyping(false)
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true)
    }
  }

  const handleGenerateReport = async (question) => {
    const authToken = accessToken || localStorage.getItem('research_assistant_token')
    if (!authToken) {
      alert('Please log in to generate reports')
      return
    }

    if (!currentSession || !currentSession._id) {
      alert('Please start a conversation first to generate a report')
      return
    }

    try {
      // Show that we're generating a report 
      const reportStartMessage = {
        id: Date.now(),
        type: 'system',
        content: `🔍 **Generating Comprehensive Report**\n\nAnalyzing your entire conversation history and available sources...\n\n📊 This may take a moment as I review all questions and generate a complete report.`,
        timestamp: new Date(),
        isReportGeneration: true
      }
      setChatMessages(prev => [...prev, reportStartMessage])

      // First, get a report preview
      const previewResponse = await fetch(`${API_BASE_URL}/files/report-preview/${currentSession._id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (previewResponse.ok) {
        const previewData = await previewResponse.json()
        
        const previewMessage = {
          id: Date.now() + 1,
          type: 'system',
          content: `� **Report Preview**\n\n**Questions to be covered:** ${previewData.reportPreview.questionsToAnswer.length}\n**Estimated topics:** ${previewData.reportPreview.estimatedTopics.slice(0, 5).join(', ')}${previewData.reportPreview.estimatedTopics.length > 5 ? '...' : ''}\n\n⏳ Generating comprehensive report...`,
          timestamp: new Date()
        }
        setChatMessages(prev => [...prev, previewMessage])
      }

      // Generate the actual report
      const reportResponse = await fetch(`${API_BASE_URL}/files/generate-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          sessionId: currentSession._id,
          reportTitle: `Research Session Report - ${new Date().toLocaleDateString()}`,
          includeFileData: true,
          includeLiveData: true,
          searchLimit: 25
        })
      })

      const reportResult = await reportResponse.json()

      if (!reportResponse.ok) {
        throw new Error(reportResult.message || 'Report generation failed')
      }

      console.log('📊 Report generated:', reportResult)

      // Format and display the comprehensive report
      const { report, conversationContext, processingDetails } = reportResult
      
      // Create a formatted report message
      let reportContent = `# 📊 ${report.title}\n\n`
      
      // Add metadata
      reportContent += `**Generated:** ${new Date().toLocaleString()}\n`
      reportContent += `**Questions Answered:** ${conversationContext.questionsAnswered}\n`
      reportContent += `**Sources Used:** ${report.sources.length}\n`
      reportContent += `**Confidence:** ${Math.round(report.confidence * 100)}%\n\n`
      
      // Add the main report content
      reportContent += report.content
      
      // Add sources section
      if (report.sources && report.sources.length > 0) {
        reportContent += '\n\n---\n\n## 📚 Sources Referenced\n\n'
        report.sources.forEach((source, index) => {
          reportContent += `${index + 1}. **${source.title || source.source}**\n`
          if (source.snippet) {
            reportContent += `   "${source.snippet}"\n`
          }
          reportContent += '\n'
        })
      }

      const reportMessage = {
        id: Date.now() + 2,
        type: 'report',
        content: reportContent,
        timestamp: new Date(),
        isComprehensiveReport: true,
        reportData: report,
        metadata: {
          questionsAnswered: conversationContext.questionsAnswered,
          confidence: report.confidence,
          sourcesCount: report.sources.length,
          generatedAt: new Date().toISOString()
        }
      }
      setChatMessages(prev => [...prev, reportMessage])

      // Add the report to the research context for the Reports page
      generateReport(question, {
        title: report.title,
        content: report.content,
        sources: report.sources,
        metadata: report.metadata,
        confidence: report.confidence,
        questionsAnswered: conversationContext.questionsAnswered
      })

      // Success message
      const successMessage = {
        id: Date.now() + 3,
        type: 'system',
        content: `✅ **Report Generated Successfully!**\n\nYour comprehensive report is ready and has been added to your Reports section. The report covers all ${conversationContext.questionsAnswered} questions from this session with ${report.sources.length} sources.`,
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, successMessage])
      
    } catch (error) {
      console.error('❌ Error generating report:', error)
      
      // Error message
      const errorMessage = {
        id: Date.now(),
        type: 'system',
        content: `❌ **Report Generation Failed**\n\n${error.message || 'An error occurred while generating the report.'}\n\nPlease try again or contact support if the issue persists.`,
        timestamp: new Date(),
        isError: true
      }
      setChatMessages(prev => [...prev, errorMessage])
      
      // Fallback to original method if available
      try {
        generateReport(question)
        const fallbackMessage = {
          id: Date.now() + 1,
          type: 'system',
          content: `📊 Generating basic report for: "${question}" using fallback method.`,
          timestamp: new Date()
        }
        setChatMessages(prev => [...prev, fallbackMessage])
      } catch (fallbackError) {
        console.error('Fallback report generation also failed:', fallbackError)
      }
    }
  }

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    const authToken = accessToken || localStorage.getItem('research_assistant_token');
    if (!authToken) {
      alert('Please log in to upload files');
      return;
    }

    // Ensure we have a current session
    if (!currentSession?._id) {
      alert('Please start a session before uploading files');
      return;
    }

    console.log(`📤 Starting upload of ${files.length} files to Pinecone-enabled backend`);

    // Show upload started message
    const uploadStartMessage = {
      id: Date.now() + Math.random(),
      type: 'system',
      content: `📤 Processing ${files.length} file(s) - Extracting text and generating embeddings...`,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, uploadStartMessage]);

    try {
      // Prepare form data
      const formData = new FormData();
      Array.from(files).forEach(file => {
        if (file.size <= 10 * 1024 * 1024) { // 10MB limit
          formData.append('files', file);
        } else {
          const errorMsg = {
            id: Date.now() + Math.random(),
            type: 'system',
            content: `❌ File ${file.name} is too large (${formatFileSize(file.size)}). Maximum size is 10MB.`,
            timestamp: new Date()
          };
          setChatMessages(prev => [...prev, errorMsg]);
        }
      });

      formData.append('sessionId', currentSession._id);

      // Upload and process files
      const response = await fetch(`${API_BASE_URL}/files/upload-and-embed`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `Upload failed: ${response.statusText}`);
      }

      console.log('📄 File processing results:', result);

      // Process successful uploads
      if (result.results && result.results.length > 0) {
        result.results.forEach(fileResult => {
          // Add file to local state with Pinecone metadata
          addUploadedFile({
            id: fileResult.docId,
            name: fileResult.fileName,
            size: fileResult.summary?.originalFile?.size || 0,
            type: fileResult.summary?.originalFile?.mimeType || 'unknown',
            lastModified: Date.now(),
            // Pinecone-specific metadata
            docId: fileResult.docId,
            pineconeFileId: fileResult.pineconeFileId,
            pineconeIds: fileResult.pineconeIds,
            chunksCount: fileResult.chunksCount,
            wordCount: fileResult.wordCount,
            embeddingsGenerated: true,
            storedInPinecone: true,
            processingComplete: true,
            processingTime: fileResult.processingTime
          });

          // Show success message with processing details
          const successMessage = {
            id: Date.now() + Math.random() + Math.random(),
            type: 'system',
            content: `✅ ${fileResult.fileName}: Generated ${fileResult.chunksCount} chunks, ${fileResult.wordCount} words processed and embedded in vector database (${fileResult.processingTime}ms)`,
            timestamp: new Date()
          };
          setChatMessages(prev => [...prev, successMessage]);
        });
      }

      // Process errors
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(error => {
          const errorMessage = {
            id: Date.now() + Math.random() + Math.random(),
            type: 'system',
            content: `❌ Failed to process ${error.fileName}: ${error.error || error.errors?.join(', ') || 'Unknown error'}`,
            timestamp: new Date()
          };
          setChatMessages(prev => [...prev, errorMessage]);
        });
      }

      // Show final summary
      const summaryMessage = {
        id: Date.now() + Math.random() + Math.random(),
        type: 'system',
        content: `📊 Upload Summary: ${result.processed} files processed successfully, ${result.failed} failed. Files are now searchable across your research sessions.`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, summaryMessage]);

      // Mark as having unsaved changes
      setHasUnsavedChanges(true);

    } catch (error) {
      console.error('❌ File upload error:', error);
      
      const errorMessage = {
        id: Date.now() + Math.random(),
        type: 'system',
        content: `❌ Upload failed: ${error.message}. Please try again.`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    handleFileUpload(files)
  }

  const handleFileInputChange = (e) => {
    handleFileUpload(e.target.files)
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

    // Report download and sharing functions
  const downloadReport = (reportMessage) => {
    const reportContent = reportMessage.content
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `research_report_${timestamp}.md`
    
    const blob = new Blob([reportContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const shareReport = (reportMessage) => {
    const reportTitle = `Research Report - ${new Date().toLocaleDateString()}`
    const shareText = `Check out this comprehensive research report generated on ${new Date().toLocaleDateString()}`
    
    if (navigator.share) {
      navigator.share({
        title: reportTitle,
        text: shareText,
        url: window.location.href
      }).catch(err => console.log('Error sharing:', err))
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`${reportTitle}\n\n${shareText}\n\nGenerated at: ${window.location.href}`).then(() => {
        alert('Report details copied to clipboard!')
      }).catch(err => {
        console.error('Failed to copy to clipboard:', err)
        alert('Sharing failed. Please copy the report manually.')
      })
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Session management functions
  const handleSaveSession = async () => {
    if (chatMessages.length <= 1) return
    
    console.log('🔍 Save Session Debug:')
    console.log('- Chat messages length:', chatMessages.length)
    console.log('- Uploaded files count:', uploadedFiles.length)
    console.log('- Has unsaved changes:', hasUnsavedChanges)
    console.log('- Current session:', currentSession)
    
    setIsSaving(true)
    
    try {
      const sessionSummary = chatMessages
        .filter(msg => msg.type === 'user')
        .map(msg => msg.content)
        .join(' | ')

      const authToken = accessToken || localStorage.getItem('research_assistant_token')
      
      if (!authToken) {
        const errorMessage = {
          id: Date.now(),
          type: 'bot',
          content: '❌ No authentication token found. Please log in again.',
          timestamp: new Date()
        }
        setChatMessages(prev => [...prev, errorMessage])
        
        // Redirect to login after showing message
        setTimeout(() => {
          navigate('/login')
        }, 2000)
        return
      }
      
      console.log('Saving session with token:', authToken ? 'Token exists' : 'No token')
      
      // Test backend connectivity
      try {
        const healthCheck = await fetch(`${API_BASE_URL}/health`)
        if (!healthCheck.ok) {
          throw new Error('Backend health check failed')
        }
        console.log('Backend is reachable')
      } catch (healthError) {
        console.error('Backend connectivity issue:', healthError)
        throw new Error('Cannot connect to backend server. Please ensure it is running.')
      }
      
      // If no session exists, create a new one
      if (!currentSession || !currentSession._id) {
        console.log('Creating new session...')
        const response = await fetch(`${API_BASE_URL}/user/sessions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
            body: JSON.stringify({
              question: sessionSummary.substring(0, 100),
              title: sessionSummary.length > 50 ? sessionSummary.substring(0, 47) + '...' : sessionSummary,
              status: 'in-progress',
              result: {
                chatHistory: chatMessages,
                lastMessage: sessionSummary.substring(0, 100) + '...',
                uploadedFiles: uploadedFiles.map(file => ({
                  id: file.id,
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  lastModified: file.lastModified,
                  uploadDate: file.uploadDate,
                  // Include Pinecone/embedding metadata
                  docId: file.docId,
                  pineconeFileId: file.pineconeFileId,
                  pineconeIds: file.pineconeIds,
                  chunksCount: file.chunksCount,
                  wordCount: file.wordCount,
                  embeddingsGenerated: file.embeddingsGenerated,
                  storedInPinecone: file.storedInPinecone,
                  processingComplete: file.processingComplete
                }))
              }
            })
          })

          console.log('🔍 Create session request sent with:', {
            chatHistoryLength: chatMessages.length,
            uploadedFilesCount: uploadedFiles.length,
            uploadedFiles: uploadedFiles
          })
          
        if (response.ok) {
          const responseData = await response.json()
          setCurrentSession(responseData.data)
          setHasUnsavedChanges(false)
          
          // Refresh sessions list to show the new session
          await refreshSessions()
          
          const successMessage = {
            id: Date.now(),
            type: 'bot',
            content: '✅ Session created and saved successfully! Your progress has been preserved.',
            timestamp: new Date()
          }
          setChatMessages(prev => [...prev, successMessage])
        } else {
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }))
          console.error('Session creation failed:', response.status, errorData)
          throw new Error(`Failed to create session: ${response.status} - ${errorData.message || 'Unknown error'}`)
        }
      } else {
        // Update existing session
        console.log('Updating existing session:', currentSession._id)
        const response = await fetch(`${API_BASE_URL}/user/sessions/${currentSession._id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: 'in-progress',
            result: {
              chatHistory: chatMessages,
              lastMessage: sessionSummary.substring(0, 100) + '...',
              uploadedFiles: uploadedFiles.map(file => ({
                id: file.id,
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified,
                uploadDate: file.uploadDate,
                // Include Pinecone/embedding metadata
                docId: file.docId,
                pineconeFileId: file.pineconeFileId,
                pineconeIds: file.pineconeIds,
                chunksCount: file.chunksCount,
                wordCount: file.wordCount,
                embeddingsGenerated: file.embeddingsGenerated,
                storedInPinecone: file.storedInPinecone,
                processingComplete: file.processingComplete
              }))
            }
          })
        })

        console.log('🔍 Update session request sent with:', {
          sessionId: currentSession._id,
          chatHistoryLength: chatMessages.length,
          uploadedFilesCount: uploadedFiles.length,
          uploadedFiles: uploadedFiles
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }))
          console.error('Session update failed:', response.status, errorData)
          throw new Error(`Failed to update session: ${response.status} - ${errorData.message || 'Unknown error'}`)
        }

        setHasUnsavedChanges(false)
        
        // Refresh sessions list to show the updated session
        await refreshSessions()
        
        // Show success message
        const successMessage = {
          id: Date.now(),
          type: 'bot',
          content: '✅ Session updated successfully! Your progress has been preserved.',
          timestamp: new Date()
        }
        setChatMessages(prev => [...prev, successMessage])
      }

    } catch (error) {
      console.error('Error saving session:', error)
      console.error('Error details:', {
        message: error.message,
        uploadedFilesCount: uploadedFiles.length,
        chatMessagesCount: chatMessages.length,
        hasUnsavedChanges,
        currentSession: currentSession
      })
      
      // Show error message
      const errorMessage = {
        id: Date.now(),
        type: 'bot',
        content: `❌ Failed to save session: ${error.message}. Please try again.`,
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelSession = async () => {
    const confirmCancel = window.confirm(
      currentSession ? 
        'Are you sure you want to cancel this session? This will delete the session permanently and cannot be undone.' :
        'Are you sure you want to cancel and return to sessions? All chat history will be lost.'
    )
    if (!confirmCancel) return

    // If there's a current session, delete it from the backend
    if (currentSession && currentSession._id) {
      try {
        const authToken = accessToken || localStorage.getItem('research_assistant_token')
        const response = await fetch(`${API_BASE_URL}/user/sessions/${currentSession._id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        })

        if (!response.ok) {
          throw new Error('Failed to delete session')
        }

        console.log('Session deleted successfully')
      } catch (error) {
        console.error('Error deleting session:', error)
        // Show error but still navigate away
        alert('Warning: Failed to delete session from server. Please try deleting it from the sessions page.')
      }
    }

    // Navigate back to sessions page
    navigate('/sessions')
  }

  const handleBackToSessions = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        'You have unsaved changes. Do you want to save before leaving?'
      )
      if (confirmLeave) {
        handleSaveSession().then(() => {
          navigate('/sessions')
        })
        return
      }
    }
    navigate('/sessions')
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleMessageSubmit(e)
    }
  }

  return (
    <div className={`chat-container ${isDragOver ? 'drag-over' : ''}`}
         onDragOver={handleDragOver}
         onDragLeave={handleDragLeave}
         onDrop={handleDrop}>
      
      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-title">
          <Bot className="bot-icon" />
          <div>
            <h2>Research Assistant</h2>
            <p>Ask questions • Upload documents • Generate reports</p>
            {currentSession && (
              <div className="session-info">
                <span className="session-indicator">
                  📋 Session: {currentSession.title || currentSession.query?.substring(0, 30) + '...'}
                </span>
                {hasUnsavedChanges && (
                  <span className="unsaved-indicator">• Unsaved changes</span>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="header-controls">
          {uploadedFiles.length > 0 && (
            <div className="uploaded-files-indicator">
              <Paperclip size={16} />
              <span>{uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          
          {/* Session Controls - Show if session exists OR if chat has started */}
          {(currentSession || chatMessages.length > 1) && (
            <div className="session-controls">
              <button 
                className="session-control-btn back-btn"
                onClick={handleBackToSessions}
                title="Back to Sessions"
              >
                <ArrowLeft size={16} />
                Back
              </button>
              
              <button 
                className="session-control-btn cancel-btn"
                onClick={handleCancelSession}
                title="Cancel Session"
              >
                <XCircle size={16} />
                Cancel
              </button>
              
              <button 
                className={`session-control-btn save-btn ${hasUnsavedChanges ? 'has-changes' : ''}`}
                onClick={handleSaveSession}
                disabled={!hasUnsavedChanges || isSaving}
                title={hasUnsavedChanges ? "Save Changes" : "No changes to save"}
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="chat-messages">
        {chatMessages.map((msg) => (
          <div key={msg.id} className={`message ${msg.type} ${msg.isComprehensiveReport ? 'comprehensive-report' : ''} ${msg.isError ? 'error' : ''}`}>
            <div className="message-avatar">
              {msg.type === 'user' ? <User size={16} /> : 
               msg.type === 'bot' ? <Bot size={16} /> : 
               msg.type === 'system' ? <Sparkles size={16} /> :
               msg.type === 'report' ? <FileText size={16} /> :
               <Paperclip size={16} />}
            </div>
            <div className="message-content">
              <div className="message-text">
                <div className={`message-text-content ${msg.isComprehensiveReport ? 'report-content' : ''}`}>
                  {msg.isComprehensiveReport ? (
                    <div className="comprehensive-report-display">
                      <div className="report-header">
                        <h3>📊 Comprehensive Research Report</h3>
                        {msg.metadata && (
                          <div className="report-metadata">
                            <span>Questions: {msg.metadata.questionsAnswered}</span>
                            <span>Sources: {msg.metadata.sourcesCount}</span>
                            <span>Confidence: {Math.round(msg.metadata.confidence * 100)}%</span>
                          </div>
                        )}
                      </div>
                      <div className="report-content-formatted">
                        {msg.content.split('\n').map((line, index) => {
                          if (line.startsWith('# ')) {
                            return <h1 key={index}>{line.substring(2)}</h1>
                          } else if (line.startsWith('## ')) {
                            return <h2 key={index}>{line.substring(3)}</h2>
                          } else if (line.startsWith('### ')) {
                            return <h3 key={index}>{line.substring(4)}</h3>
                          } else if (line.startsWith('**') && line.endsWith('**')) {
                            return <p key={index}><strong>{line.slice(2, -2)}</strong></p>
                          } else if (line.startsWith('*') && line.endsWith('*')) {
                            return <p key={index}><em>{line.slice(1, -1)}</em></p>
                          } else if (line === '---') {
                            return <hr key={index} />
                          } else if (line.trim()) {
                            return <p key={index}>{line}</p>
                          }
                          return <br key={index} />
                        })}
                      </div>
                      <div className="report-actions">
                        <button 
                          className="action-btn download"
                          onClick={() => downloadReport(msg)}
                        >
                          📥 Download Report
                        </button>
                        <button 
                          className="action-btn share"
                          onClick={() => shareReport(msg)}
                        >
                          📤 Share
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="regular-message-content">
                      {msg.content.split('\n').map((line, index) => {
                        if (line.startsWith('**') && line.endsWith('**')) {
                          return <p key={index}><strong>{line.slice(2, -2)}</strong></p>
                        } else if (line.startsWith('*') && line.endsWith('*')) {
                          return <p key={index}><em>{line.slice(1, -1)}</em></p>
                        } else if (line.trim()) {
                          return <p key={index}>{line}</p>
                        }
                        return <br key={index} />
                      })}
                    </div>
                  )}
                </div>
                
                {/* Show source information for bot responses */}
                {msg.sources && msg.sources.length > 0 && !msg.isComprehensiveReport && (
                  <div className="message-sources">
                    <h4>📚 Sources ({msg.sources.length})</h4>
                    <div className="sources-list">
                      {msg.sources.slice(0, 3).map((source, index) => (
                        <div key={index} className="source-item">
                          <strong>{source.title || source.source}</strong>
                          {source.snippet && <p className="source-snippet">"{source.snippet}"</p>}
                        </div>
                      ))}
                      {msg.sources.length > 3 && (
                        <p className="more-sources">... and {msg.sources.length - 3} more sources</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Show confidence indicator */}
                {msg.confidence && !msg.isComprehensiveReport && (
                  <div className="confidence-indicator">
                    <span className={`confidence-badge ${msg.confidence > 0.8 ? 'high' : msg.confidence > 0.6 ? 'medium' : 'low'}`}>
                      Confidence: {Math.round(msg.confidence * 100)}%
                    </span>
                  </div>
                )}
              </div>
              
              {/* Generate Report Button for regular bot responses */}
              {msg.hasReportOption && !msg.isComprehensiveReport && (
                <button 
                  className="generate-report-btn"
                  onClick={() => handleGenerateReport(chatMessages.find(m => m.type === 'user' && m.id < msg.id)?.content)}
                >
                  <Sparkles size={16} />
                  Generate Comprehensive Report
                </button>
              )}
              
              <div className="message-time">{formatTime(msg.timestamp)}</div>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="message bot">
            <div className="message-avatar">
              <Bot size={16} />
            </div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Uploaded Files Display */}
      {uploadedFiles.length > 0 && (
        <div className="chat-files">
          <div className="files-scroll">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="file-chip">
                <File size={14} />
                <span>{file.name}</span>
                <button
                  onClick={() => removeUploadedFile(file.id)}
                  className="file-remove-btn"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Input */}
      <div className="chat-input-container">
        <div className="chat-input">
          <button
            type="button"
            className="upload-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Upload documents"
          >
            <Paperclip size={18} />
          </button>
          
          <form onSubmit={handleMessageSubmit} className="message-form">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about your research..."
              rows={1}
              className="message-input"
            />
            <button
              type="submit"
              disabled={!message.trim()}
              className="send-btn"
            >
              <Send size={18} />
            </button>
          </form>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>
    </div>
  )
}

export default Home