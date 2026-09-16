/**
 * LADRIS — Browser Native Voice Engine
 * Built using the Web Speech API (window.speechSynthesis & SpeechSynthesisUtterance).
 * Zero external dependencies, no API keys, purely client-side.
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

let currentRate: number = 1.0

let currentState: VoiceEngineState = {
  isSpeaking: false,
  isPaused: false,
  isSupported: isSupported(),
  error: null,
  rate: 1.0,
}

const listeners = new Set<StateListener>()

function updateState(partial: Partial<VoiceEngineState>) {
  currentState = { ...currentState, ...partial }
  listeners.forEach((listener) => listener(currentState))
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

  // Set defaults: configured rate (default 1.0), pitch 1.0
  utterance.rate = options.rate ?? currentRate ?? 1.0
  utterance.pitch = options.pitch ?? 1.0
  utterance.lang = options.lang ?? 'en-US'

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
}

export default voiceEngine
