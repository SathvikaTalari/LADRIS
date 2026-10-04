/**
 * LADRIS — Saarthi AI Decision Assistant & Domain Companion
 * Voice-enabled, database-grounded, and interactive navigation widget.
 * Styled to seamlessly harmonize with the LADRIS executive command theme.
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
  ArrowRight,
  Bot
} from 'lucide-react'
import { chatbotAPI, type ChatActionItem } from '@/api/client'
import { useThemeStore } from '@/store/themeStore'
import { getPreferredVoice } from '@/components/voice/voiceEngine'

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
  'What is the Section 3D statutory rule?',
  'Show projects with active court cases',
]

// Simple Markdown Formatter Helper
function FormattedText({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let tableRows: string[][] = []
  let inTable = false

  const renderTable = (rows: string[][], keyPrefix: string) => {
    if (rows.length === 0) return null
    const header = rows[0]
    const body = rows.slice(1).filter((r) => !r.every((c) => c.trim().match(/^[:\- ]+$/)))

    return (
      <div key={keyPrefix} style={{ overflowX: 'auto', margin: '10px 0', width: '100%' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.78rem',
            textAlign: 'left',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-elevated)' }}>
              {header.map((col, idx) => (
                <th key={idx} style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
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
                  borderBottom: '1px solid var(--color-border-subtle)',
                  background: rIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                }}
              >
                {row.map((cell, cIdx) => (
                  <td key={cIdx} style={{ padding: '7px 10px', color: 'var(--color-text-secondary)' }}>
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
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--color-text-primary); font-weight: 600;">$1</strong>')
      .replace(/`([^`]+)`/g, '<code style="background: var(--color-bg-elevated); color: var(--color-text-primary); padding: 2px 5px; border-radius: 4px; font-size: 0.85em; font-family: var(--font-mono);">$1</code>')
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
        <h4 key={i} style={{ margin: '12px 0 6px', fontSize: '0.925rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {trimmed.replace('### ', '')}
        </h4>
      )
    } else if (trimmed.startsWith('#### ')) {
      elements.push(
        <h5 key={i} style={{ margin: '10px 0 4px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-accent-primary)' }}>
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
            background: 'var(--color-bg-elevated)',
            borderLeft: '3px solid var(--color-accent-primary)',
            borderRadius: '0 6px 6px 0',
            fontSize: '0.8rem',
            color: 'var(--color-text-secondary)',
          }}
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed.replace('> ', '')) }}
        />
      )
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <li
          key={i}
          style={{ marginLeft: 18, marginBottom: 4, fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--color-text-secondary)' }}
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed.substring(2)) }}
        />
      )
    } else if (trimmed.match(/^\d+\.\s/)) {
      elements.push(
        <div
          key={i}
          style={{ marginLeft: 6, marginBottom: 5, fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--color-text-secondary)' }}
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }}
        />
      )
    } else if (trimmed.length > 0) {
      elements.push(
        <p
          key={i}
          style={{ margin: '6px 0', fontSize: '0.825rem', lineHeight: 1.55, color: 'var(--color-text-secondary)' }}
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
        '🙏 **Namaste! How can I assist you today?**\n' +
        'Ask me about project delays, Section 3D statutory deadlines, or corridor risk alerts.',
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
    window.speechSynthesis.cancel()
    const cleanText = text.replace(/[*#`_>|]/g, ' ').replace(/\s+/g, ' ').trim()
    const utterance = new SpeechSynthesisUtterance(cleanText)
    const voice = getPreferredVoice()
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = 'en-IN'
    }
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0
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
        text: '🙏 Conversation reset. How can I assist you today?',
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
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              whileHover={{
                scale: 1.05,
                y: -2,
                boxShadow: '0 12px 28px rgba(0, 51, 102, 0.45), 0 0 18px rgba(56, 189, 248, 0.35)',
              }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setIsOpen(true)}
              title="Open Saarthi AI Copilot"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '10px 20px',
                borderRadius: 9999,
                background: 'linear-gradient(135deg, #001f3f 0%, #003366 50%, #0b3d75 100%)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                boxShadow:
                  '0 8px 24px rgba(0, 51, 102, 0.35), 0 2px 6px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                fontSize: '0.875rem',
                letterSpacing: '0.01em',
                backdropFilter: 'blur(12px)',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8',
                  filter: 'drop-shadow(0 0 5px rgba(56, 189, 248, 0.6))',
                }}
              >
                <Sparkles size={17} />
              </div>
              <span style={{ color: '#ffffff', textShadow: '0 1px 2px rgba(0, 0, 0, 0.35)' }}>
                Ask Saarthi
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Main Chat Window Modal ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="saarthi-chat-window"
            data-saarthi-open="true"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              width: isExpanded ? 'min(760px, calc(100vw - 48px))' : 'min(420px, calc(100vw - 32px))',
              height: isExpanded ? 'min(720px, calc(100vh - 48px))' : 'min(550px, calc(100vh - 48px))',
              borderRadius: 16,
              background: isDark ? 'var(--color-bg-secondary)' : '#ffffff',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 51, 102, 0.12)',
              boxShadow: isDark
                ? '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(0,0,0,0.4)'
                : '0 16px 40px rgba(0,51,102,0.18)',
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
                padding: '12px 16px',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--color-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    background: isDark
                      ? 'linear-gradient(135deg, #0b2545 0%, #134074 100%)'
                      : 'linear-gradient(135deg, #003366 0%, #004c99 100%)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38bdf8',
                    boxShadow: '0 2px 6px rgba(0, 51, 102, 0.25)',
                  }}
                >
                  <Bot size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      Saarthi AI
                    </h3>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '1px 7px',
                        borderRadius: 12,
                        fontSize: '0.62rem',
                        fontWeight: 600,
                        background: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                        color: isDark ? '#34d399' : '#059669',
                        border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.22)'}`,
                      }}
                    >
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: isDark ? '#34d399' : '#059669' }} />
                      Grounded
                    </span>
                  </div>
                  <p style={{ margin: '1px 0 0', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                    Statutory & Delay Decision Copilot
                  </p>
                </div>
              </div>

              {/* Header Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* TTS narration toggle */}
                <button
                  type="button"
                  onClick={() => setTtsEnabled(!ttsEnabled)}
                  title={ttsEnabled ? 'Mute Voice' : 'Enable Voice'}
                  style={{
                    background: ttsEnabled ? 'var(--color-bg-elevated)' : 'transparent',
                    border: 'none',
                    color: ttsEnabled ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    padding: 6,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {ttsEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                </button>

                {/* Clear Chat */}
                <button
                  type="button"
                  onClick={clearChat}
                  title="Clear conversation"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    padding: 6,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Trash2 size={15} />
                </button>

                {/* Expand / Minimize Window Size */}
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  title={isExpanded ? 'Compact View' : 'Expand View'}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    padding: 6,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
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
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    padding: 6,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 2,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '14px 16px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {messages.map((msg, idx) => {
                const isUser = msg.sender === 'user'
                const isLastAssistant = !isUser && idx === messages.length - 1

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
                        padding: isUser ? '9px 13px' : '11px 14px',
                        borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                        background: isUser
                          ? isDark
                            ? '#0a4275'
                            : '#003366'
                          : isDark
                            ? 'var(--color-bg-surface)'
                            : '#f8fafc',
                        color: isUser ? '#ffffff' : 'var(--color-text-primary)',
                        border: isUser
                          ? '1px solid rgba(255, 255, 255, 0.12)'
                          : '1px solid var(--color-border-subtle)',
                        boxShadow: isUser
                          ? '0 2px 6px rgba(0,0,0,0.12)'
                          : '0 1px 3px rgba(0,0,0,0.03)',
                      }}
                    >
                      {isUser ? (
                        <div style={{ fontSize: '0.825rem', fontWeight: 500, lineHeight: 1.45 }}>
                          {msg.text}
                        </div>
                      ) : (
                        <FormattedText text={msg.text} />
                      )}

                      {/* Direct In-App Action Buttons */}
                      {!isUser && msg.actions && msg.actions.length > 0 && (
                        <div
                          style={{
                            marginTop: 10,
                            paddingTop: 8,
                            borderTop: '1px solid var(--color-border-subtle)',
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
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '4px 10px',
                                borderRadius: 6,
                                background: 'var(--color-bg-elevated)',
                                border: '1px solid var(--color-border-subtle)',
                                color: 'var(--color-text-primary)',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--color-accent-primary)'
                                e.currentTarget.style.color = 'var(--color-accent-primary)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--color-border-subtle)'
                                e.currentTarget.style.color = 'var(--color-text-primary)'
                              }}
                            >
                              <span>{act.label}</span>
                              <ArrowRight size={11} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <span
                      style={{
                        fontSize: '0.64rem',
                        color: 'var(--color-text-muted)',
                        marginTop: 3,
                        marginLeft: 6,
                        marginRight: 6,
                      }}
                    >
                      {msg.timestamp}
                    </span>

                    {/* Contextual Suggestion Pills only on latest Assistant message */}
                    {isLastAssistant && msg.suggestions && msg.suggestions.length > 0 && (
                      <div
                        style={{
                          marginTop: 8,
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 6,
                          maxWidth: '100%',
                        }}
                      >
                        {msg.suggestions.slice(0, 3).map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => handleSendMessage(sug)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '5px 11px',
                              borderRadius: 16,
                              background: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 51, 102, 0.04)',
                              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 51, 102, 0.12)',
                              color: isDark ? 'var(--color-text-secondary)' : '#003366',
                              fontSize: '0.72rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              textAlign: 'left',
                              lineHeight: 1.3,
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'var(--color-accent-primary)'
                              e.currentTarget.style.color = 'var(--color-accent-primary)'
                              e.currentTarget.style.background = isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(0, 51, 102, 0.08)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 51, 102, 0.12)'
                              e.currentTarget.style.color = isDark ? 'var(--color-text-secondary)' : '#003366'
                              e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 51, 102, 0.04)'
                            }}
                          >
                            <Sparkles size={11} color="var(--color-accent-primary)" />
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
                    padding: '8px 12px',
                    borderRadius: '12px 12px 12px 2px',
                    background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Sparkles size={13} color="var(--color-accent-primary)" className="animate-spin" />
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Analyzing corridor records...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <div
              style={{
                padding: '10px 14px',
                background: 'var(--color-bg-card)',
                borderTop: '1px solid var(--color-border-subtle)',
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
                    title={isListening ? 'Stop listening' : 'Voice Input'}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      border: isListening ? '2px solid #ef4444' : '1px solid var(--color-border-subtle)',
                      background: isListening ? 'rgba(239, 68, 68, 0.12)' : 'var(--color-bg-surface)',
                      color: isListening ? '#ef4444' : 'var(--color-text-muted)',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                  >
                    {isListening ? (
                      <MicOff size={15} className="animate-pulse" />
                    ) : (
                      <Mic size={15} />
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
                      : 'Ask Saarthi anything...'
                  }
                  style={{
                    flex: 1,
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid var(--color-border-subtle)',
                    background: 'var(--color-bg-surface)',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.82rem',
                    outline: 'none',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--color-accent-primary)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--color-border-subtle)')}
                />

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={isLoading || !inputText.trim()}
                  title="Send message"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isLoading || !inputText.trim() ? 'not-allowed' : 'pointer',
                    background:
                      isLoading || !inputText.trim()
                        ? 'var(--color-bg-elevated)'
                        : 'var(--color-accent-primary)',
                    color: isLoading || !inputText.trim() ? 'var(--color-text-muted)' : '#ffffff',
                    border: 'none',
                    opacity: isLoading || !inputText.trim() ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                >
                  <Send size={15} />
                </button>
              </form>

              <div
                style={{
                  marginTop: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.64rem',
                  color: 'var(--color-text-muted)',
                  padding: '0 2px',
                }}
              >
                <span>NH Act 1956 & RFCTLARR 2013 grounded</span>
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
