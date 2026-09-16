/**
 * LADRIS — Contact & Feedback page
 * Route: /help/contact
 */
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { useEffect, useState } from 'react'

type FormState = 'idle' | 'loading' | 'success' | 'error'

export default function ContactFeedback() {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const [formState, setFormState] = useState<FormState>('idle')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const c = {
    bg: isDark ? '#060f1e' : '#f0f4f9',
    heading: isDark ? '#f0f6fc' : '#0a1d37',
    body: isDark ? '#94a9c9' : '#4a6280',
    label: isDark ? '#5a7194' : '#94a3b8',
    border: isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0',
    divider: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
    navBg: isDark ? '#070c1b' : '#ffffff',
    navBorder: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
    inputBg: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
    inputText: isDark ? '#c9d8f0' : '#0a1d37',
    errorColor: isDark ? '#f87171' : '#dc2626',
    fieldLabel: isDark ? '#94a9c9' : '#334155',
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required.'
    if (!email.trim()) {
      e.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.email = 'Enter a valid email address.'
    }
    if (!category) e.category = 'Please select a category.'
    if (!message.trim()) e.message = 'Message is required.'
    else if (message.trim().length < 10) e.message = 'Message must be at least 10 characters.'
    return e
  }

  const handleBlur = (field: string) => {
    setTouched(t => ({ ...t, [field]: true }))
    const e = validate()
    setErrors(e)
  }

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    const allTouched = { name: true, email: true, category: true, message: true }
    setTouched(allTouched)
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return

    // Simulate async submission (replace with real API call when backend is ready)
    setFormState('loading')
    setTimeout(() => {
      setFormState('success')
    }, 1200)
  }

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%',
    padding: '10px 13px',
    borderRadius: 6,
    border: `1.5px solid ${touched[field] && errors[field] ? c.errorColor : c.border}`,
    background: c.inputBg,
    color: c.inputText,
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  })

  const categories = [
    'General Feedback',
    'Feature Suggestion',
    'Technical Issue',
    'Data / Prediction Feedback',
  ]

  return (
    <div style={{ minHeight: '100vh', background: c.bg, fontFamily: 'Inter, system-ui, sans-serif', color: c.heading }}>

      {/* Minimal page header */}
      <div style={{
        background: c.navBg,
        borderBottom: `1px solid ${c.navBorder}`,
        padding: '0 32px',
        height: 56,
        display: 'flex', alignItems: 'center',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate('/landing')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.855rem', fontWeight: 500,
              color: isDark ? '#94a9c9' : '#334155',
              fontFamily: 'inherit', padding: '4px 0', transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = isDark ? '#f0f6fc' : '#003366')}
            onMouseLeave={e => (e.currentTarget.style.color = isDark ? '#94a9c9' : '#334155')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back
          </button>
          <span style={{ color: c.divider }}>|</span>
          <span style={{ fontSize: '0.8rem', color: c.label }}>LADRIS</span>
        </div>
      </div>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '56px 24px 80px' }}>

        {/* Heading */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: c.label, marginBottom: 10,
          }}>
            Help & Feedback
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: c.heading, margin: '0 0 10px', lineHeight: 1.25 }}>
            Contact & Feedback
          </h1>
          <p style={{ fontSize: '0.93rem', color: c.body, lineHeight: 1.7, margin: 0 }}>
            Your feedback helps improve LADRIS.
          </p>
        </div>

        <hr style={{ border: 'none', borderTop: `1px solid ${c.divider}`, margin: '0 0 40px' }} />

        {formState === 'success' ? (
          <div style={{
            padding: '40px 32px',
            border: `1px solid ${c.border}`,
            borderRadius: 8,
            background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
            textAlign: 'center',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#94a9c9' : '#003366'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m20 6-11 11-5-5" />
              </svg>
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: c.heading, marginBottom: 8 }}>
              Feedback received.
            </div>
            <div style={{ fontSize: '0.9rem', color: c.body, lineHeight: 1.65, marginBottom: 28 }}>
              Thank you for helping improve LADRIS.
            </div>
            <button
              onClick={() => navigate('/landing')}
              style={{
                padding: '9px 24px', background: '#003366',
                border: 'none', borderRadius: 6,
                color: '#ffffff', fontWeight: 600,
                fontSize: '0.875rem', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Back to LADRIS
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {/* Name */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: c.fieldLabel, marginBottom: 6 }}>
                Name <span style={{ color: c.errorColor }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={() => handleBlur('name')}
                placeholder="Your full name"
                style={inputStyle('name')}
              />
              {touched.name && errors.name && (
                <div style={{ fontSize: '0.77rem', color: c.errorColor, marginTop: 5 }}>{errors.name}</div>
              )}
            </div>

            {/* Email */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: c.fieldLabel, marginBottom: 6 }}>
                Email <span style={{ color: c.errorColor }}>*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => handleBlur('email')}
                placeholder="your.email@example.gov.in"
                style={inputStyle('email')}
              />
              {touched.email && errors.email && (
                <div style={{ fontSize: '0.77rem', color: c.errorColor, marginTop: 5 }}>{errors.email}</div>
              )}
            </div>

            {/* Category */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: c.fieldLabel, marginBottom: 6 }}>
                Category <span style={{ color: c.errorColor }}>*</span>
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                onBlur={() => handleBlur('category')}
                style={{
                  ...inputStyle('category'),
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  paddingRight: 36,
                  cursor: 'pointer',
                }}
              >
                <option value="">Select a category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {touched.category && errors.category && (
                <div style={{ fontSize: '0.77rem', color: c.errorColor, marginTop: 5 }}>{errors.category}</div>
              )}
            </div>

            {/* Message */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: c.fieldLabel, marginBottom: 6 }}>
                Message <span style={{ color: c.errorColor }}>*</span>
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                onBlur={() => handleBlur('message')}
                placeholder="Describe your feedback or issue..."
                rows={5}
                style={{
                  ...inputStyle('message'),
                  resize: 'vertical',
                  minHeight: 120,
                }}
              />
              {touched.message && errors.message && (
                <div style={{ fontSize: '0.77rem', color: c.errorColor, marginTop: 5 }}>{errors.message}</div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={formState === 'loading'}
              style={{
                width: '100%',
                padding: '11px 0',
                background: formState === 'loading' ? (isDark ? '#1a2e4a' : '#e2e8f0') : '#003366',
                border: 'none', borderRadius: 6,
                color: formState === 'loading' ? c.label : '#ffffff',
                fontWeight: 700, fontSize: '0.9rem',
                cursor: formState === 'loading' ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', letterSpacing: '0.02em',
                transition: 'background 0.15s',
              }}
            >
              {formState === 'loading' ? 'Sending…' : 'Send Feedback'}
            </button>
          </form>
        )}

      </main>
    </div>
  )
}
