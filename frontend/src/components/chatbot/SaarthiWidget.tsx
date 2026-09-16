/**
 * LADRIS — Saarthi AI Decision Assistant & Domain Companion
 * Voice-enabled, database-grounded, and interactive navigation widget.
 */
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  X,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Trash2,
  ChevronRight,
  Compass,
  Shield,
  ExternalLink
} from 'lucide-react'
import { chatbotAPI, type ChatActionItem } from '@/api/client'
import { useThemeStore } from '@/store/themeStore'

interface Message {
  id: string
  sender: 'user' | 'saarthi'
  text: string
  actions?: ChatActionItem[]
  suggestions?: string[]
  timestamp: string
}

const DEFAULT_SUGGESTIONS = [
  'Which projects have high delay risk?',
  'What is the Section 3D 1-year statutory rule?',
  'How does the Priority Score work?',
  'How to use the GIS Risk Map?',
  'Explain compensation under RFCTLARR 2013'
]

// Simple Markdown Formatter Helper
function FormattedText({ text }: { text: string }) {
  // Parse markdown tables, bold, headers, blockquotes, bullets
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let tableRows: string[][] = []
  let inTable = false

  const renderTable = (rows: string[][], keyPrefix: string) => {
    if (rows.length === 0) return null
    const header = rows[0]
    const body = rows.slice(1).filter((r) => !r.every((c) => c.trim().match(/^[:\- ]+$/)))

    return (
      <div key={keyPrefix} style={{ overflowX: 'auto', margin: '12px 0' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.8rem',
            textAlign: 'left',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid rgba(64,128,255,0.25)', background: 'rgba(64,128,255,0.08)' }}>
              {header.map((col, idx) => (
                <th key={idx} style={{ padding: '8px 10px', fontWeight: 600 }}>
                  {col.replace(/\*\*/g, '').trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, rIdx) => (
              <tr
                key={rIdx}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: rIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                }}
              >
                {row.map((cell, cIdx) => (
                  <td key={cIdx} style={{ padding: '7px 10px' }}>
                    <span dangerouslySetInnerHTML={{ __html: formatInline(cell.trim()) }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const formatInline = (str: string) => {
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code style="background: rgba(64,128,255,0.15); padding: 2px 5px; border-radius: 4px; font-size: 0.85em;">$1</code>')
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()

    // Table Row Detection
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true
      const cells = trimmed
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim())
      tableRows.push(cells)
      return
    } else if (inTable) {
      elements.push(renderTable(tableRows, `table-${i}`))
      tableRows = []
      inTable = false
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={i} style={{ margin: '14px 0 6px', fontSize: '0.975rem', fontWeight: 700, color: 'var(--color-primary-light, #5c9aff)' }}>
          {trimmed.replace('### ', '')}
        </h4>
      )
    } else if (trimmed.startsWith('#### ')) {
      elements.push(
        <h5 key={i} style={{ margin: '10px 0 4px', fontSize: '0.875rem', fontWeight: 700, color: '#f47721' }}>
          {trimmed.replace('#### ', '')}
        </h5>
      )
    } else if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          key={i}
          style={{
            margin: '8px 0',
            padding: '8px 12px',
            background: 'rgba(244,119,33,0.08)',
            borderLeft: '3px solid #f47721',
            borderRadius: '0 8px 8px 0',
            fontSize: '0.825rem',
            fontStyle: 'italic',
          }}
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed.replace('> ', '')) }}
        />
      )
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <li
          key={i}
          style={{ marginLeft: 18, marginBottom: 4, fontSize: '0.825rem', lineHeight: 1.5 }}
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed.substring(2)) }}
        />
      )
    } else if (trimmed.match(/^\d+\.\s/)) {
      elements.push(
        <div
          key={i}
          style={{ marginLeft: 6, marginBottom: 5, fontSize: '0.825rem', lineHeight: 1.5 }}
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }}
        />
      )
    } else if (trimmed.length > 0) {
      elements.push(
        <p
          key={i}
          style={{ margin: '6px 0', fontSize: '0.835rem', lineHeight: 1.55 }}
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }}
        />
      )
    }
  })

  if (inTable && tableRows.length > 0) {
    elements.push(renderTable(tableRows, 'table-end'))
  }

  return <div>{elements}</div>
}

export function SaarthiWidget() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'saarthi',
      text:
        '🙏 **Namaste! I am Saarthi**, your AI assistant for **LADRIS**.\n\n' +
        'I have real-time access to live national highway corridors, statutory regulations (**NH Act 1956**, **RFCTLARR 2013**), and platform tools.\n\n' +
        'Ask me anything about **project delays**, **Section 3D statutory deadlines**, or **GIS risk intelligence**!',
      suggestions: DEFAULT_SUGGESTIONS,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

  // Listen for external trigger events (e.g. from TopNav)
  useEffect(() => {
    const handleOpen = () => setIsOpen(true)
    window.addEventListener('open-saarthi', handleOpen)
    return () => window.removeEventListener('open-saarthi', handleOpen)
  }, [])

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  // Setup Web Speech API for voice input
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      setSpeechSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-IN'

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        if (transcript) {
          setInputText(transcript)
          handleSendMessage(transcript)
        }
        setIsListening(false)
      }

      recognition.onerror = () => {
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }
  }, [])

  // Text-To-Speech
  const speakText = (text: string) => {
    if (!ttsEnabled || !window.speechSynthesis) return
    window.speechSynthesis.cancel() // Stop any current speech
    const cleanText = text.replace(/[*#`_>|]/g, ' ').replace(/\s+/g, ' ').trim()
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.rate = 1.05
    utterance.pitch = 1.0
    window.speechSynthesis.speak(utterance)
  }

  const toggleVoiceInput = () => {
    if (!speechSupported || !recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      setIsListening(true)
      try {
        recognitionRef.current.start()
      } catch {
        setIsListening(false)
      }
    }
  }

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim()
    if (!query || isLoading) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputText('')
    setIsLoading(true)

    try {
      const historyPayload = messages.slice(-4).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }))

      const response = await chatbotAPI.chat({
        message: query,
        history: historyPayload,
        active_page: location.pathname,
      })

      const botMsg: Message = {
        id: `saarthi-${Date.now()}`,
        sender: 'saarthi',
        text: response.reply,
        actions: response.actions,
        suggestions: response.suggestions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, botMsg])
      speakText(response.reply)
    } catch {
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        sender: 'saarthi',
        text: '⚠️ I encountered an issue connecting to the decision intelligence service. Please check your backend connection and try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const clearChat = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    setMessages([
      {
        id: 'welcome-cleared',
        sender: 'saarthi',
        text: '🧹 Conversation reset. How may I assist your land acquisition analysis?',
        suggestions: DEFAULT_SUGGESTIONS,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ])
  }

  return (
    <>
      {/* ── Floating Launcher Trigger Button ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <AnimatePresence>
          {!isOpen && (
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              whileHover={{ scale: 1.06, y: -2 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => setIsOpen(true)}
              title="Open Saarthi AI Assistant"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 18px',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, #003366 0%, #0d47a1 50%, #f47721 100%)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.25)',
                boxShadow: '0 8px 30px rgba(0, 51, 102, 0.45), 0 0 15px rgba(244, 119, 33, 0.35)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans, inherit)',
                fontWeight: 700,
                fontSize: '0.875rem',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={18} color="#ffbb33" />
                <span
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: 7,
                    height: 7,
                    background: '#22c55e',
                    borderRadius: '50%',
                    border: '1px solid white',
                  }}
                />
              </div>
              <span>Ask Saarthi</span>
              <span
                style={{
                  fontSize: '0.675rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: 'rgba(255,255,255,0.2)',
                  padding: '2px 6px',
                  borderRadius: 6,
                  fontWeight: 800,
                }}
              >
                AI
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Main Chat Window Modal ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              width: isExpanded ? 'min(760px, calc(100vw - 48px))' : 'min(440px, calc(100vw - 48px))',
              height: isExpanded ? 'min(720px, calc(100vh - 48px))' : 'min(580px, calc(100vh - 48px))',
              borderRadius: 20,
              background: isDark ? 'rgba(10, 17, 32, 0.95)' : 'rgba(255, 255, 255, 0.96)',
              border: `1px solid ${isDark ? 'rgba(64, 128, 255, 0.25)' : 'rgba(0, 51, 102, 0.18)'}`,
              boxShadow: isDark
                ? '0 24px 60px rgba(0,0,0,0.6), 0 0 35px rgba(64,128,255,0.15)'
                : '0 20px 50px rgba(0,51,102,0.22), 0 0 25px rgba(244,119,33,0.1)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 9999,
              backdropFilter: 'blur(20px)',
              transition: 'width 0.25s ease, height 0.25s ease',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '14px 18px',
                background: isDark
                  ? 'linear-gradient(90deg, #0e1a30 0%, #091322 100%)'
                  : 'linear-gradient(90deg, #003366 0%, #0d47a1 100%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.15)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #f47721 0%, #ffbb33 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#060b14',
                    boxShadow: '0 2px 10px rgba(244,119,33,0.4)',
                  }}
                >
                  <Compass size={20} strokeWidth={2.4} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <h3 style={{ margin: 0, fontSize: '0.975rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                      Saarthi
                    </h3>
                    <span
                      style={{
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        background: 'rgba(34, 197, 94, 0.2)',
                        color: '#4ade80',
                        border: '1px solid rgba(34, 197, 94, 0.4)',
                        padding: '1px 5px',
                        borderRadius: 4,
                      }}
                    >
                      ONLINE
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.72rem', opacity: 0.8, color: '#e2e8f0' }}>
                    LADRIS Decision Copilot
                  </p>
                </div>
              </div>

              {/* Header Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {/* TTS narration toggle */}
                <button
                  type="button"
                  onClick={() => setTtsEnabled(!ttsEnabled)}
                  title={ttsEnabled ? 'Mute Voice Narration' : 'Enable Voice Narration'}
                  style={{
                    background: ttsEnabled ? 'rgba(255,255,255,0.2)' : 'transparent',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    padding: 6,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} opacity={0.7} />}
                </button>

                {/* Clear Chat */}
                <button
                  type="button"
                  onClick={clearChat}
                  title="Clear conversation"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    padding: 6,
                    borderRadius: 6,
                    opacity: 0.8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Trash2 size={16} />
                </button>

                {/* Expand / Minimize Window Size */}
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  title={isExpanded ? 'Compact View' : 'Expand View'}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    padding: 6,
                    borderRadius: 6,
                    opacity: 0.8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (window.speechSynthesis) window.speechSynthesis.cancel()
                    setIsOpen(false)
                  }}
                  title="Close Saarthi"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    padding: 6,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 4,
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Quick Context Pill bar */}
            <div
              style={{
                padding: '6px 14px',
                background: isDark ? 'rgba(64,128,255,0.06)' : 'rgba(0,51,102,0.04)',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.7rem',
                color: isDark ? '#94a3b8' : '#64748b',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              <Shield size={12} color="#f47721" />
              <span>Domain Grounded:</span>
              <span style={{ fontWeight: 600, color: isDark ? '#cbd5e1' : '#334155' }}>NH Act 1956</span>
              <span>•</span>
              <span style={{ fontWeight: 600, color: isDark ? '#cbd5e1' : '#334155' }}>RFCTLARR 2013</span>
              <span>•</span>
              <span style={{ fontWeight: 600, color: isDark ? '#cbd5e1' : '#334155' }}>Live 250 Corridors</span>
            </div>

            {/* Messages Scroll Area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 16px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {messages.map((msg) => {
                const isUser = msg.sender === 'user'

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isUser ? 'flex-end' : 'flex-start',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '88%',
                        padding: isUser ? '10px 14px' : '14px 16px',
                        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: isUser
                          ? 'linear-gradient(135deg, #003366 0%, #0d47a1 100%)'
                          : isDark
                          ? 'rgba(20, 31, 56, 0.75)'
                          : '#f1f5f9',
                        color: isUser ? 'white' : isDark ? '#e2e8f0' : '#0f172a',
                        boxShadow: isUser
                          ? '0 4px 14px rgba(0,51,102,0.2)'
                          : isDark
                          ? '0 4px 14px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)'
                          : '0 2px 8px rgba(0,0,0,0.05)',
                        border: isUser
                          ? 'none'
                          : `1px solid ${isDark ? 'rgba(64,128,255,0.18)' : 'rgba(0,51,102,0.08)'}`,
                      }}
                    >
                      {isUser ? (
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.45 }}>
                          {msg.text}
                        </div>
                      ) : (
                        <FormattedText
                          text={msg.text}
                        />
                      )}

                      {/* Direct In-App Action Buttons */}
                      {!isUser && msg.actions && msg.actions.length > 0 && (
                        <div
                          style={{
                            marginTop: 12,
                            paddingTop: 10,
                            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 6,
                          }}
                        >
                          {msg.actions.map((act, aIdx) => (
                            <button
                              key={aIdx}
                              onClick={() => {
                                navigate(act.path)
                                if (!isExpanded) setIsOpen(false)
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '6px 11px',
                                borderRadius: 8,
                                background: isDark ? 'rgba(64,128,255,0.15)' : 'rgba(0,51,102,0.08)',
                                border: `1px solid ${isDark ? 'rgba(64,128,255,0.35)' : 'rgba(0,51,102,0.2)'}`,
                                color: isDark ? '#7daaff' : '#003366',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span>{act.label}</span>
                              <ExternalLink size={12} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <span
                      style={{
                        fontSize: '0.65rem',
                        color: isDark ? '#64748b' : '#94a3b8',
                        marginTop: 4,
                        marginLeft: 6,
                        marginRight: 6,
                      }}
                    >
                      {msg.timestamp}
                    </span>

                    {/* Contextual Suggestion Pills beneath Assistant Reply */}
                    {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
                      <div
                        style={{
                          marginTop: 8,
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 6,
                          maxWidth: '96%',
                        }}
                      >
                        {msg.suggestions.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => handleSendMessage(sug)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '4px 10px',
                              borderRadius: 12,
                              background: isDark ? 'rgba(244,119,33,0.08)' : 'rgba(244,119,33,0.06)',
                              border: `1px solid ${isDark ? 'rgba(244,119,33,0.25)' : 'rgba(244,119,33,0.3)'}`,
                              color: isDark ? '#ffaa55' : '#c25409',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <ChevronRight size={11} strokeWidth={2.5} />
                            <span>{sug}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Typing Animation Loader */}
              {isLoading && (
                <div
                  style={{
                    alignSelf: 'flex-start',
                    padding: '12px 16px',
                    borderRadius: '16px 16px 16px 4px',
                    background: isDark ? 'rgba(20, 31, 56, 0.75)' : '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    border: `1px solid ${isDark ? 'rgba(64,128,255,0.2)' : 'rgba(0,51,102,0.1)'}`,
                  }}
                >
                  <Sparkles size={14} color="#f47721" className="animate-spin" />
                  <span style={{ fontSize: '0.78rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                    Consulting LADRIS Intelligence Engine...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <div
              style={{
                padding: '12px 16px',
                background: isDark ? 'rgba(10, 17, 32, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              }}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSendMessage()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {/* Voice Input Button */}
                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    title={isListening ? 'Stop listening' : 'Voice Input (Speak to Saarthi)'}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      border: isListening ? '2px solid #ef4444' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                      background: isListening
                        ? 'rgba(239, 68, 68, 0.15)'
                        : isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.03)',
                      color: isListening ? '#ef4444' : isDark ? '#94a3b8' : '#64748b',
                      transition: 'all 0.2s',
                    }}
                  >
                    {isListening ? (
                      <MicOff size={18} className="animate-pulse" />
                    ) : (
                      <Mic size={18} />
                    )}
                  </button>
                )}

                {/* Text Input */}
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    isListening
                      ? '🎙️ Listening... Speak now'
                      : 'Ask about high-risk corridors, 3A/3D rules, GIS...'
                  }
                  style={{
                    flex: 1,
                    height: 42,
                    padding: '0 14px',
                    borderRadius: 10,
                    border: `1px solid ${isDark ? 'rgba(64,128,255,0.3)' : 'rgba(0,51,102,0.2)'}`,
                    background: isDark ? 'rgba(14,22,40,0.8)' : '#ffffff',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxShadow: isDark
                      ? 'inset 0 1px 3px rgba(0,0,0,0.3)'
                      : 'inset 0 1px 2px rgba(0,0,0,0.04)',
                  }}
                />

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={isLoading || !inputText.trim()}
                  title="Send message"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isLoading || !inputText.trim() ? 'not-allowed' : 'pointer',
                    background:
                      isLoading || !inputText.trim()
                        ? isDark
                          ? 'rgba(64,128,255,0.2)'
                          : 'rgba(0,51,102,0.1)'
                        : 'linear-gradient(135deg, #003366 0%, #f47721 100%)',
                    color: 'white',
                    border: 'none',
                    opacity: isLoading || !inputText.trim() ? 0.5 : 1,
                    transition: 'all 0.2s',
                    boxShadow:
                      isLoading || !inputText.trim()
                        ? 'none'
                        : '0 2px 8px rgba(0,51,102,0.3)',
                  }}
                >
                  <Send size={16} />
                </button>
              </form>

              <div
                style={{
                  marginTop: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.675rem',
                  color: isDark ? '#64748b' : '#94a3b8',
                }}
              >
                <span>AI Decision Support • Non-Causal Guidance</span>
                {speechSupported && isListening && (
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>● Live Audio</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
