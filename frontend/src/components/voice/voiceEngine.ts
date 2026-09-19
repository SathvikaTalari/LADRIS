/**
 * LADRIS — Browser Native Voice Engine
 * Built using the Web Speech API (window.speechSynthesis & SpeechSynthesisUtterance).
 * Zero external dependencies, no API keys, purely client-side.
 * Selects an Indian English (en-IN) voice where supported, with closest English fallback.
 */

export type SpeechRate = 0.75 | 1.0 | 1.25 | 1.5
export const SUPPORTED_RATES: SpeechRate[] = [0.75, 1.0, 1.25, 1.5]

export interface VoiceEngineState {
  isSpeaking: boolean
  isPaused: boolean
  isSupported: boolean
  error: string | null
  rate: number
}

export interface SpeakOptions {
  rate?: number
  pitch?: number
  lang?: string
  onEnd?: () => void
  onError?: (event: SpeechSynthesisErrorEvent) => void
}

type StateListener = (state: VoiceEngineState) => void

// Check browser support
export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

let currentRate: number = 0.96 // Natural, comfortable speaking speed

let currentState: VoiceEngineState = {
  isSpeaking: false,
  isPaused: false,
  isSupported: isSupported(),
  error: null,
  rate: currentRate,
}

const listeners = new Set<StateListener>()

function updateState(partial: Partial<VoiceEngineState>) {
  currentState = { ...currentState, ...partial }
  listeners.forEach((listener) => listener(currentState))
}

// Preload voices when browser initializes speech synthesis
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices()
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices()
    }
  }
}

/**
 * Keywords for known Indian English female voices across Windows, Edge, Chrome, macOS, iOS, Android
 */
const INDIAN_FEMALE_VOICES = [
  'heera',     // Microsoft Heera (Windows/Edge - English India Female)
  'neerja',    // Microsoft Neerja (Windows/Edge Natural - English India Female)
  'veena',     // Apple Veena / Google Veena (English India Female)
  'isha',      // Apple Isha (English India Female)
  'sangeeta',  // Apple Sangeeta (English India Female)
  'kavya',     // Indian English Female
  'aditi',     // Indian English Female
  'ananya',    // Indian English Female
  'priya',     // Indian English Female
]

/**
 * Male voice keywords that must NEVER be selected for female voice playback
 */
const MALE_VOICE_KEYWORDS = [
  'ravi',      // Microsoft Ravi (Indian Male)
  'prabhat',   // Indian Male
  'david',     // US Male
  'mark',      // US Male
  'george',    // UK Male
  'guy',       // Male tag
  'male',      // Generic Male identifier
  'richard',
  'james',
  'daniel',
]

/**
 * Find preferred Indian English (en-IN) FEMALE voice.
 * Strictly avoids male voices (like Ravi, David) and prioritizes Heera, Neerja, Veena, etc.
 * Falls back to closest English female voice if Indian female is not installed.
 */
export function getPreferredVoice(): SpeechSynthesisVoice | null {
  if (!isSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices || voices.length === 0) return null

  const isMale = (v: SpeechSynthesisVoice): boolean => {
    const name = (v.name || '').toLowerCase()
    const id = (v.voiceURI || '').toLowerCase()
    return MALE_VOICE_KEYWORDS.some((kw) => name.includes(kw) || id.includes(kw))
  }

  // 1. TOP PRIORITY: Known Indian English Female voice (Heera, Neerja, Veena, Isha, etc.)
  const exactIndianFemale = voices.find((v) => {
    if (isMale(v)) return false
    const name = (v.name || '').toLowerCase()
    const id = (v.voiceURI || '').toLowerCase()
    const lang = (v.lang || '').replace('_', '-').toLowerCase()
    const isNamedIndianFemale = INDIAN_FEMALE_VOICES.some(
      (kw) => name.includes(kw) || id.includes(kw)
    )
    const isIndianLang = lang === 'en-in' || lang.startsWith('en-in') || name.includes('india')
    return isNamedIndianFemale && isIndianLang
  })
  if (exactIndianFemale) return exactIndianFemale

  // 1b. Any voice matching Indian female name even if lang is loosely formatted
  const namedIndianFemaleAnyLang = voices.find((v) => {
    if (isMale(v)) return false
    const name = (v.name || '').toLowerCase()
    const id = (v.voiceURI || '').toLowerCase()
    return INDIAN_FEMALE_VOICES.some((kw) => name.includes(kw) || id.includes(kw))
  })
  if (namedIndianFemaleAnyLang) return namedIndianFemaleAnyLang

  // 2. SECOND PRIORITY: en-IN voice with explicit 'female' or 'woman' tag and NOT male
  const taggedIndianFemale = voices.find((v) => {
    if (isMale(v)) return false
    const lang = (v.lang || '').replace('_', '-').toLowerCase()
    const name = (v.name || '').toLowerCase()
    const id = (v.voiceURI || '').toLowerCase()
    const isIndian = lang === 'en-in' || lang.startsWith('en-in') || name.includes('india')
    const hasFemaleTag = name.includes('female') || id.includes('female') || name.includes('woman')
    return isIndian && hasFemaleTag
  })
  if (taggedIndianFemale) return taggedIndianFemale

  // 3. THIRD PRIORITY: Any Indian English ('en-in') voice that is NOT male
  const generalIndianNonMale = voices.find((v) => {
    if (isMale(v)) return false
    const lang = (v.lang || '').replace('_', '-').toLowerCase()
    const name = (v.name || '').toLowerCase()
    return lang === 'en-in' || lang.startsWith('en-in') || name.includes('india')
  })
  if (generalIndianNonMale) return generalIndianNonMale

  // 4. FOURTH PRIORITY: Commonwealth / English Female voice fallback (Zira, Sonia, Jenny, Libby, Mia, Samantha)
  const commonwealthFemale = voices.find((v) => {
    if (isMale(v)) return false
    const name = (v.name || '').toLowerCase()
    const id = (v.voiceURI || '').toLowerCase()
    const lang = (v.lang || '').replace('_', '-').toLowerCase()
    const isEnglish = lang.startsWith('en')
    const isFemaleNamed = ['zira', 'sonia', 'jenny', 'libby', 'mia', 'samantha', 'victoria', 'karen', 'serena'].some(
      (kw) => name.includes(kw) || id.includes(kw)
    )
    const hasFemaleTag = name.includes('female') || id.includes('female')
    return isEnglish && (isFemaleNamed || hasFemaleTag)
  })
  if (commonwealthFemale) return commonwealthFemale

  // 5. Any English voice that is NOT male
  const anyNonMaleEnglish = voices.find((v) => {
    const lang = (v.lang || '').replace('_', '-').toLowerCase()
    return lang.startsWith('en') && !isMale(v)
  })
  if (anyNonMaleEnglish) return anyNonMaleEnglish

  // 6. Default fallback
  return voices.find((v) => v.default) || voices[0] || null
}

/**
 * Set voice playback rate (0.75, 1.0, 1.25, 1.5)
 * Does NOT interrupt currently playing speech.
 */
export function setRate(rate: number): void {
  currentRate = rate
  updateState({ rate })
}

/**
 * Get current voice playback rate
 */
export function getRate(): number {
  return currentRate
}

/**
 * Get current voice engine state
 */
export function getState(): VoiceEngineState {
  return currentState
}

/**
 * Check if speech is currently active
 */
export function isSpeaking(): boolean {
  if (!isSupported()) return false
  return currentState.isSpeaking || window.speechSynthesis.speaking
}

/**
 * Check if speech is currently paused
 */
export function isPaused(): boolean {
  if (!isSupported()) return false
  return currentState.isPaused || window.speechSynthesis.paused
}

/**
 * Subscribe to state changes (useful for React hooks / components)
 */
export function subscribe(listener: StateListener): () => void {
  listeners.add(listener)
  // Immediately call with current state
  listener(currentState)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Speak text using native SpeechSynthesisUtterance.
 * Cancels any currently running speech session first to prevent stacking.
 * Applies Indian English (en-IN) voice or closest English fallback.
 */
export function speak(text: string, options: SpeakOptions = {}): void {
  if (!isSupported()) {
    updateState({ error: 'Speech synthesis is not supported in this browser' })
    return
  }

  const trimmedText = text?.trim()
  if (!trimmedText) {
    return
  }

  // Cancel any existing utterance before starting new one to prevent stacking
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(trimmedText)

  // Configure preferred Indian English voice or closest fallback
  const preferredVoice = getPreferredVoice()
  if (preferredVoice) {
    utterance.voice = preferredVoice
    utterance.lang = preferredVoice.lang
  } else {
    utterance.lang = options.lang ?? 'en-IN'
  }

  // Normal speaking speed and natural, warm feminine tone
  utterance.rate = options.rate ?? currentRate ?? 0.95
  utterance.pitch = options.pitch ?? 1.05

  // Mark as speaking immediately to prevent duplicate triggers
  updateState({ isSpeaking: true, isPaused: false, error: null })

  utterance.onstart = () => {
    updateState({ isSpeaking: true, isPaused: false, error: null })
  }

  utterance.onend = () => {
    updateState({ isSpeaking: false, isPaused: false })
    options.onEnd?.()
  }

  utterance.onpause = () => {
    updateState({ isPaused: true })
  }

  utterance.onresume = () => {
    updateState({ isPaused: false })
  }

  utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
    // 'interrupted' and 'canceled' happen normally when stop() or a new speak() is invoked
    if (event.error !== 'interrupted' && event.error !== 'canceled') {
      updateState({ isSpeaking: false, isPaused: false, error: event.error })
      options.onError?.(event)
    } else {
      updateState({ isSpeaking: false, isPaused: false })
    }
  }

  window.speechSynthesis.speak(utterance)
}

/**
 * Pause speech if currently speaking
 */
export function pause(): void {
  if (!isSupported()) return
  if (currentState.isSpeaking && !currentState.isPaused) {
    window.speechSynthesis.pause()
    updateState({ isPaused: true })
  }
}

/**
 * Resume speech if paused
 */
export function resume(): void {
  if (!isSupported()) return
  if (currentState.isSpeaking && currentState.isPaused) {
    window.speechSynthesis.resume()
    updateState({ isPaused: false })
  }
}

/**
 * Stop speech and cancel queue
 */
export function stop(): void {
  if (!isSupported()) return
  window.speechSynthesis.cancel()
  updateState({ isSpeaking: false, isPaused: false })
}

export const voiceEngine = {
  isSupported,
  isSpeaking,
  isPaused,
  getState,
  subscribe,
  speak,
  pause,
  resume,
  stop,
  setRate,
  getRate,
  getPreferredVoice,
}

export default voiceEngine
