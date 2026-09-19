/**
 * LADRIS — Browser Native Voice Engine
 * Built using the Web Speech API (window.speechSynthesis & SpeechSynthesisUtterance).
 * Zero external dependencies, no API keys, purely client-side.
 *
 * Prioritizes high-clarity Indian English (en-IN) female voices:
 *   1. Microsoft Edge Natural Neural voices (e.g. Microsoft Neerja Online / Natural)
 *   2. Google English (India) female voices
 *   3. Windows OneCore / SAPI / macOS Indian female voices (Neerja, Heera, Veena, Isha)
 *
 * NOTE ON VOICE SHAKING / TREMOLO:
 * In Chromium (Chrome & Edge) and Windows Speech synthesizers, setting utterance.pitch
 * away from 1.0 (e.g. 1.05) runs the audio through a phase-vocoder pitch-shift filter.
 * On female voices, this causes an unnatural fluttering / vibrating "shaking" sound.
 * Keeping pitch at exactly 1.0 and rate at 1.0 eliminates this shaking completely,
 * delivering crystal-clear, steady, and natural pronunciation.
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

// Check browser support
export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

// 1.0 is standard, steady natural conversational speed
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

/**
 * Find preferred high-clarity Indian English (en-IN) FEMALE voice.
 * Prioritizes natural neural voices (Neerja Online Natural) which eliminate robotic jitter,
 * followed by standard Indian English female voices, and falls back to clean English female voices.
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

  // Filter out any voice that matches male keywords
  const femaleCandidates = voices.filter((v) => !isMale(v))
  const pool = femaleCandidates.length > 0 ? femaleCandidates : voices

  // Score each candidate to pick the clearest Indian English female voice
  const scored = pool.map((v) => {
    const name = (v.name || '').toLowerCase()
    const id = (v.voiceURI || '').toLowerCase()
    const lang = (v.lang || '').replace('_', '-').toLowerCase()

    let score = 0
    const isIndianLang =
      lang === 'en-in' ||
      lang.startsWith('en-in') ||
      name.includes('india') ||
      name.includes('en-in') ||
      id.includes('en-in') ||
      id.includes('india')
    const isEnglish = lang.startsWith('en')
    const isNatural =
      name.includes('natural') ||
      name.includes('neural') ||
      name.includes('online') ||
      id.includes('natural') ||
      id.includes('neural')

    // 1. Language matching
    if (isIndianLang) {
      score += 600
    } else if (isEnglish) {
      score += 50
    }

    // 2. High-fidelity Natural / Neural quality (crystal clear, silky smooth, no shaking)
    if (isNatural) {
      score += 500
    }

    // 3. Indian Female Name Hierarchy
    // Microsoft Neerja is known for exceptional clarity and natural conversational tone
    if (name.includes('neerja') || id.includes('neerja')) {
      score += 450
    } else if (name.includes('veena') || name.includes('isha') || name.includes('sangeeta')) {
      score += 350
    } else if (name.includes('kavya') || name.includes('aditi') || name.includes('ananya') || name.includes('priya')) {
      score += 300
    } else if (name.includes('swara') || name.includes('madhur')) {
      score += 280
    } else if (name.includes('heera') || id.includes('heera')) {
      // Heera Natural is great; legacy Heera is solid fallback
      score += isNatural ? 400 : 250
    } else if (name.includes('google') && isIndianLang) {
      score += 320
    }

    // 4. Female markers
    if (name.includes('female') || id.includes('female') || name.includes('woman')) {
      score += 150
    }

    // 5. High-quality English female fallbacks (if no en-IN is installed on user's machine)
    if (
      ['jenny', 'aria', 'sonia', 'libby', 'samantha', 'zira', 'karen', 'victoria'].some(
        (n) => name.includes(n) || id.includes(n)
      )
    ) {
      score += 80
    }

    return { voice: v, score }
  })

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score)

  return scored[0]?.voice || null
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
 * Applies Indian English (en-IN) female voice with pitch=1.0 and rate=1.0
 * to ensure clear, steady, non-shaking pronunciation.
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

  // CRITICAL FIX FOR VOICE SHAKING:
  // Setting pitch to 1.0 (natural voice pitch) prevents Chromium/Windows DSP
  // pitch-shifting filter from introducing tremolo/vibrato flutter.
  utterance.pitch = options.pitch ?? 1.0

  // Setting rate to 1.0 delivers natural, comfortable, and stable speaking speed
  utterance.rate = options.rate ?? currentRate ?? 1.0

  // Full volume clarity
  utterance.volume = 1.0

  // Mark as speaking immediately to prevent duplicate triggers
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

  // Small delay helps prevent Chrome/Edge cancellation race conditions
  setTimeout(() => {
    try {
      window.speechSynthesis.speak(utterance)
    } catch {
      // Fallback direct speak
      window.speechSynthesis.speak(utterance)
    }
  }, 25)
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
