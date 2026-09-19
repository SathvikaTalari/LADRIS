/**
 * LADRIS — Browser Native Voice Engine
 * Built using the Web Speech API (window.speechSynthesis & SpeechSynthesisUtterance).
 * Zero external dependencies, no API keys, purely client-side.
 *
 * Selected Voice: High-clarity Indian English (en-IN) Female voice
 * (Microsoft Heera, Microsoft Neerja, Apple Veena, Google en-IN Female).
 *
 * PITCH & STABILITY NOTE:
 * utterance.pitch is set to 1.0 (natural pitch). Modifying pitch away from 1.0
 * triggers phase-vocoder DSP frequency shifting in Chrome/Edge which causes
 * noticeable trembling/vibrato (shaking voice). Keeping pitch=1.0 and rate=1.0
 * ensures smooth, crystal-clear, steady human pronunciation with ZERO shaking.
 */

export type SpeechRate = 0.75 | 1.0 | 1.25 | 1.5
export const SUPPORTED_RATES: SpeechRate[] = [0.75, 1.0, 1.25, 1.5]

export interface VoiceEngineState {
  isSpeaking: boolean
  isPaused: boolean
  isSupported: boolean
  error: string | null
  rate: number
  activeVoiceName?: string
}

export interface SpeakOptions {
  rate?: number
  pitch?: number
  lang?: string
  onEnd?: () => void
  onError?: (event: SpeechSynthesisErrorEvent) => void
}

type StateListener = (state: VoiceEngineState) => void

// Global reference to active utterance to prevent V8 garbage collection
// from silently aborting audio playback in Chrome and Edge
let activeUtterance: SpeechSynthesisUtterance | null = null

// Check browser support
export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

// 1.0 is standard natural conversational speed
let currentRate: number = 1.0

let currentState: VoiceEngineState = {
  isSpeaking: false,
  isPaused: false,
  isSupported: isSupported(),
  error: null,
  rate: currentRate,
  activeVoiceName: undefined,
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
 * Keywords for known female voices
 */
const FEMALE_VOICE_KEYWORDS = [
  'female',
  'woman',
  'girl',
  'heera',     // Microsoft Heera (Windows en-IN Female)
  'neerja',    // Microsoft Neerja (Windows en-IN Female)
  'veena',     // Apple Veena (en-IN Female)
  'isha',      // Apple Isha (en-IN Female)
  'sangeeta',  // Apple Sangeeta (en-IN Female)
  'kavya',     // Indian Female
  'aditi',     // Indian Female
  'ananya',    // Indian Female
  'priya',     // Indian Female
  'swara',     // Indian Female
  'madhur',    // Indian Female
  'zira',      // Microsoft Zira (US Female)
  'jenny',     // Microsoft Jenny (US Female)
  'aria',      // Microsoft Aria (US Female)
  'sonia',     // British Female
  'libby',     // British Female
  'samantha',  // Apple US Female
  'victoria',  // Apple Female
  'karen',     // Apple AU Female
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
  'richard',
  'james',
  'daniel',
  'stefan',
  'sean',
  'ryan',
  'paul',
  'cosmo',
  'alok',
  'amit',
  'arun',
  'hemant',
  'kallum',
]

export function isFemaleVoice(v: SpeechSynthesisVoice): boolean {
  const text = `${v.name || ''} ${v.voiceURI || ''}`.toLowerCase()
  return FEMALE_VOICE_KEYWORDS.some((kw) => text.includes(kw))
}

export function isMaleVoice(v: SpeechSynthesisVoice): boolean {
  // If explicitly female, never male!
  if (isFemaleVoice(v)) return false

  const text = `${v.name || ''} ${v.voiceURI || ''}`.toLowerCase()
  if (MALE_VOICE_KEYWORDS.some((kw) => text.includes(kw))) return true

  // Standalone word 'male' (ensuring it does not match substring of 'female')
  return /\bmale\b/.test(text) && !text.includes('female')
}

/**
 * Find preferred high-clarity Indian English (en-IN) FEMALE voice.
 * Prioritizes Microsoft Heera / Neerja, Apple Veena/Isha, and Google en-IN female voices.
 */
export function getPreferredVoice(): SpeechSynthesisVoice | null {
  if (!isSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices || voices.length === 0) return null

  // 1. TOP PRIORITY: Known Indian English Female voice (Heera, Neerja, Veena, Isha, etc.)
  const indianFemale = voices.find((v) => {
    if (isMaleVoice(v)) return false
    const text = `${v.name || ''} ${v.voiceURI || ''} ${v.lang || ''}`.toLowerCase()
    const isIndian = text.includes('en-in') || text.includes('india') || text.includes('in-')
    const isFemale = isFemaleVoice(v)
    return isIndian && isFemale
  })
  if (indianFemale) return indianFemale

  // 2. Any Indian English ('en-in') voice that is NOT male
  const anyIndianNonMale = voices.find((v) => {
    if (isMaleVoice(v)) return false
    const text = `${v.name || ''} ${v.voiceURI || ''} ${v.lang || ''}`.toLowerCase()
    return text.includes('en-in') || text.includes('india')
  })
  if (anyIndianNonMale) return anyIndianNonMale

  // 3. Known female voice in any English dialect (Zira, Jenny, Aria, Sonia, etc.)
  const anyEnglishFemale = voices.find((v) => {
    if (isMaleVoice(v)) return false
    const text = `${v.name || ''} ${v.voiceURI || ''} ${v.lang || ''}`.toLowerCase()
    return text.startsWith('en') && isFemaleVoice(v)
  })
  if (anyEnglishFemale) return anyEnglishFemale

  // 4. Any English voice that is NOT male
  const anyEnglishNonMale = voices.find((v) => {
    if (isMaleVoice(v)) return false
    const lang = (v.lang || '').toLowerCase()
    return lang.startsWith('en')
  })
  if (anyEnglishNonMale) return anyEnglishNonMale

  // 5. Default fallback
  return voices.find((v) => v.default) || voices[0] || null
}

/**
 * Set voice playback rate (0.75, 1.0, 1.25, 1.5)
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
  return currentState.isSpeaking || window.speechSynthesis.speaking || activeUtterance !== null
}

/**
 * Get active utterance reference
 */
export function getActiveUtterance(): SpeechSynthesisUtterance | null {
  return activeUtterance
}

/**
 * Check if speech is currently paused
 */
export function isPaused(): boolean {
  if (!isSupported()) return false
  return currentState.isPaused || window.speechSynthesis.paused
}

/**
 * Subscribe to state changes
 */
export function subscribe(listener: StateListener): () => void {
  listeners.add(listener)
  listener(currentState)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Speak text using native SpeechSynthesisUtterance.
 *
 * Key guarantees:
 *   - Synchronously invoked inside click handler to preserve browser user activation
 *   - Global activeUtterance reference to prevent V8 garbage collection dropping audio
 *   - pitch=1.0 strictly avoids phase-vocoder vibrato (eliminating voice shaking)
 *   - rate=1.0 provides steady natural conversational speed
 *   - resume() ensures synthesis isn't frozen by browser pause state
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

  try {
    // Unpause in case browser was stuck in paused state
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
    }
    // Cancel any previous utterance to avoid stacking
    window.speechSynthesis.cancel()
  } catch (e) {
    console.warn('Speech reset warning:', e)
  }

  const utterance = new SpeechSynthesisUtterance(trimmedText)
  activeUtterance = utterance // CRITICAL: Prevent V8 GC from collecting the utterance!

  const preferredVoice = getPreferredVoice()
  if (preferredVoice) {
    utterance.voice = preferredVoice
    utterance.lang = preferredVoice.lang
  } else {
    utterance.lang = options.lang ?? 'en-IN'
  }

  // Pitch=1.0: Native vocal pitch. Prevents browser pitch-shifting vibrato/flutter.
  utterance.pitch = 1.0

  // Rate=1.0: Normal, comfortable, steady speaking speed.
  utterance.rate = options.rate ?? currentRate ?? 1.0

  // Full volume clarity
  utterance.volume = 1.0

  updateState({
    isSpeaking: true,
    isPaused: false,
    error: null,
    activeVoiceName: preferredVoice ? preferredVoice.name : undefined,
  })

  utterance.onstart = () => {
    updateState({
      isSpeaking: true,
      isPaused: false,
      error: null,
      activeVoiceName: preferredVoice ? preferredVoice.name : undefined,
    })
  }

  utterance.onend = () => {
    activeUtterance = null
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
    activeUtterance = null
    if (event.error !== 'interrupted' && event.error !== 'canceled') {
      console.warn('Speech error:', event.error)
      updateState({ isSpeaking: false, isPaused: false, error: event.error })
      options.onError?.(event)
    } else {
      updateState({ isSpeaking: false, isPaused: false })
    }
  }

  // DIRECT SYNCHRONOUS INVOCATION:
  // Must be called in the user click event loop to satisfy browser user activation autoplay policy
  window.speechSynthesis.speak(utterance)

  // Double check resume in case browser started paused
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume()
  }
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
  activeUtterance = null
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
  getActiveUtterance,
}

export default voiceEngine
