import { useState, useEffect, useRef } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { searchAPI } from '@/api/client'
import type { GlobalSearchResult } from '@/types'
import { useNavigate } from 'react-router-dom'

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const data = await searchAPI.query(query)
        setResults(data)
        setIsOpen(true)
      } catch (err) {
        console.error('Search failed:', err)
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: 12,
            color: 'var(--color-text-muted)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects, districts, agencies..."
          style={{
            width: '100%',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-full)',
            padding: '6px 12px 6px 34px',
            fontSize: '0.8125rem',
            color: 'var(--color-text-primary)',
            outline: 'none',
            transition: 'all 0.15s',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-accent-primary)'
            e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-glow)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-default)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
        {isLoading && (
          <Loader2
            size={14}
            className="spinner"
            style={{
              position: 'absolute',
              right: 12,
              color: 'var(--color-text-muted)',
            }}
          />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 6,
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            zIndex: 100,
          }}
        >
          <ul style={{ listStyle: 'none', margin: 0, padding: '4px 0', maxHeight: 280, overflowY: 'auto' }}>
            {results.map((result) => (
              <li key={result.project_id}>
                <button
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    transition: 'background 0.15s',
                  }}
                  onClick={() => {
                    navigate(`/projects/${result.project_id}`)
                    setIsOpen(false)
                    setQuery('')
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-tertiary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {result.project_name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <code style={{ fontSize: '0.7rem', color: 'var(--color-accent-primary)', fontFamily: 'var(--font-mono)' }}>
                      {result.project_identifier}
                    </code>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                      • {result.match_type === 'CODE' ? 'Matched by Code' : result.match_type === 'NAME' ? 'Matched by Name' : 'Matched'}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 6,
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-md)',
            padding: 12,
            textAlign: 'center',
            fontSize: '0.8125rem',
            color: 'var(--color-text-muted)',
            zIndex: 100,
          }}
        >
          No projects found matching "{query}"
        </div>
      )}
    </div>
  )
}
