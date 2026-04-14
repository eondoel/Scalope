import { useState, useEffect, useRef, useCallback } from 'react'
import {
  SCALES,
  NOTE_NAMES,
  freqToMidi,
  midiToNoteName,
  midiToNoteIndex,
  getScaleNotes,
  getIntervalLabel,
  getCentsOff,
  BASS_STRINGS,
  FRET_COUNT,
  fretNoteIndex,
  BASS_FIGURES,
} from './musicTheory.js'
import { PitchDetector } from './pitchDetection.js'

// Tone.js bass synth setup
let basssynth = null
let currentFilter = null

function initBassSynth(soundType = 'warm') {
  if (basssynth) return basssynth

  const Tone = window.Tone

  const soundPresets = {
    warm: {
      oscillator: { type: 'sine', partials: [1, 2, 3, 4, 5, 6] },
      envelope: { attack: 0.005, decay: 0.28, sustain: 0.05, release: 0.15 },
      filter: { frequency: 2500, rolloff: -6 },
    },
    bright: {
      oscillator: { type: 'triangle', partials: [1, 2, 3] },
      envelope: { attack: 0.003, decay: 0.2, sustain: 0.02, release: 0.1 },
      filter: { frequency: 4000, rolloff: -12 },
    },
    punchy: {
      oscillator: { type: 'sawtooth', partials: [1, 2, 3, 4] },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.08 },
      filter: { frequency: 3500, rolloff: -12 },
    },
    smooth: {
      oscillator: { type: 'sine', partials: [1, 2] },
      envelope: { attack: 0.01, decay: 0.35, sustain: 0.1, release: 0.2 },
      filter: { frequency: 2000, rolloff: -6 },
    },
    aggressive: {
      oscillator: { type: 'square', partials: [1, 3, 5] },
      envelope: { attack: 0.002, decay: 0.12, sustain: 0.03, release: 0.1 },
      filter: { frequency: 4500, rolloff: -12 },
    },
  }

  const preset = soundPresets[soundType] || soundPresets.warm

  basssynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: preset.oscillator,
    envelope: preset.envelope,
  }).toDestination()

  currentFilter = new Tone.Filter({
    frequency: preset.filter.frequency,
    type: 'lowpass',
    rolloff: preset.filter.rolloff,
  })
  basssynth.connect(currentFilter)
  currentFilter.toDestination()

  basssynth.volume.value = 0 // dB

  return basssynth
}

async function playNote(noteName, duration = 0.5, onPlay = null, soundType = 'warm') {
  if (!basssynth) basssynth = initBassSynth(soundType)

  if (onPlay) onPlay()

  // Play the note
  basssynth.triggerAttackRelease(noteName + '2', duration)
}

async function playScale(rootNote, scaleKey, tempo = 120, onNotePlay = null, soundType = 'warm') {
  const scale = SCALES[scaleKey]
  if (!scale || !rootNote) return

  const Tone = window.Tone
  await Tone.start() // Start audio context

  if (!basssynth) basssynth = initBassSynth(soundType)

  const beatDuration = 60 / tempo // duration of one beat in seconds
  const noteIndices = scale.intervals.map(iv => (NOTE_NAMES.indexOf(rootNote) + iv) % 12)
  const allNotes = [...noteIndices, NOTE_NAMES.indexOf(rootNote)] // include root again at end

  // Play each note in the scale
  let delay = 0
  allNotes.forEach((noteIdx, idx) => {
    const noteName = NOTE_NAMES[noteIdx]
    const octave = idx === allNotes.length - 1 ? 3 : 2 // root octave up at end

    setTimeout(() => {
      if (onNotePlay) onNotePlay(noteName)
      basssynth.triggerAttackRelease(noteName + octave, beatDuration * 0.9)
    }, delay * 1000)

    delay += beatDuration
  })
}

// ─── Fretboard ────────────────────────────────────────────────────────────────
function Fretboard({ rootIndex, scaleKey, color, currentPlayingNote }) {
  if (rootIndex === null || !scaleKey) return null
  const scale = SCALES[scaleKey]
  const scaleNoteIndices = new Set(
    scale.intervals.map(i => (rootIndex + i) % 12)
  )
  const playingNoteIndex = currentPlayingNote ? NOTE_NAMES.indexOf(currentPlayingNote) : null

  // Show only frets 0-5 (beginner-friendly range)
  const minFret = 0
  const maxFret = 5
  const FRETS = 6

  const fretMarkers = [3, 5]

  // Pre-calculate which notes should be shown on which string
  // Iterate E, A, D, G order (indices 3, 2, 1, 0) so E string gets first notes
  const noteAssignments = new Map() // note name -> should show on this iteration
  const shownNotes = new Set()

  const stringOrder = [3, 2, 1, 0] // E, A, D, G order for assignment
  for (const si of stringOrder) {
    const string = BASS_STRINGS[si]
    for (let f = minFret; f <= maxFret; f++) {
      const noteIdx = fretNoteIndex(string.openMidi, f)
      if (scaleNoteIndices.has(noteIdx)) {
        const noteName = NOTE_NAMES[noteIdx]
        if (!shownNotes.has(noteName)) {
          noteAssignments.set(`${si}-${noteName}`, true)
          shownNotes.add(noteName)
        }
      }
    }
  }

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{ minWidth: 480 }}>
        {/* Fret numbers */}
        <div style={{ display: 'flex', marginLeft: 28, marginBottom: 4 }}>
          {Array.from({ length: FRETS }, (_, i) => {
            const fret = minFret + i
            return (
              <div key={i} style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 10,
                color: fretMarkers.includes(fret) ? 'var(--text-dim)' : 'transparent',
                fontFamily: 'Space Mono, monospace',
                fontWeight: 700,
              }}>
                {fret === 0 ? '' : fret}
              </div>
            )
          })}
        </div>

        {/* Strings - reversed order */}
        {BASS_STRINGS.map((string, si) => (
          <div key={string.name} style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: si < BASS_STRINGS.length - 1 ? 6 : 0,
            position: 'relative',
          }}>
            {/* String label */}
            <div style={{
              width: 24,
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-dim)',
              fontFamily: 'Space Mono, monospace',
              flexShrink: 0,
            }}>
              {string.name}
            </div>

            {/* Frets */}
            {Array.from({ length: FRETS }, (_, i) => {
              const f = minFret + i
              const noteIdx = fretNoteIndex(string.openMidi, f)
              const inScale = scaleNoteIndices.has(noteIdx)
              const isRoot = noteIdx === rootIndex
              const noteName = NOTE_NAMES[noteIdx]
              const interval = inScale
                ? scale.intervals.find(iv => (rootIndex + iv) % 12 === noteIdx)
                : null

              // Check if this note should be shown on this string (based on pre-calculated assignment)
              const shouldShow = inScale && noteAssignments.has(`${si}-${noteName}`)

              return (
                <div key={i} style={{
                  flex: 1,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  borderLeft: i === 0
                    ? '3px solid var(--text-muted)'
                    : '1px solid var(--border)',
                }}>
                  {/* String line */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    right: 0,
                    height: si === 3 ? 3 : si === 2 ? 2.5 : si === 1 ? 2 : 1.5,
                    background: 'var(--border)',
                    transform: 'translateY(-50%)',
                    zIndex: 0,
                  }} />

                  {/* Note dot - only show if this is the first occurrence */}
                  {shouldShow && (
                    <div style={{
                      position: 'relative',
                      zIndex: 1,
                      width: isRoot ? 44 : 40,
                      height: isRoot ? 44 : 40,
                      borderRadius: '50%',
                      background: noteIdx === playingNoteIndex ? '#FFD700' : (isRoot ? color : `${color}dd`),
                      border: `3px solid ${noteIdx === playingNoteIndex ? '#FFD700' : (isRoot ? color : `${color}ff`)}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: noteIdx === playingNoteIndex
                        ? '0 0 20px #FFD700, 0 0 40px #FFA500'
                        : (isRoot ? `0 0 16px ${color}88` : `0 0 8px ${color}66`),
                      transition: 'all 0.1s',
                      animation: noteIdx === playingNoteIndex ? 'pulse-ring 0.3s ease' : 'none',
                    }}>
                      <span style={{
                        fontSize: noteName.length > 1 ? 12 : 13,
                        fontWeight: 700,
                        color: isRoot ? '#fff' : '#1a1a1a',
                        fontFamily: 'Space Mono, monospace',
                        lineHeight: 1,
                      }}>
                        {noteName}
                      </span>
                      <span style={{
                        fontSize: 9,
                        color: isRoot ? 'rgba(255,255,255,0.8)' : '#1a1a1a99',
                        fontFamily: 'Space Mono, monospace',
                        lineHeight: 1,
                        marginTop: 1,
                      }}>
                        {getIntervalLabel(interval)}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* Fret dot markers */}
        <div style={{ display: 'flex', marginLeft: 28, marginTop: 6 }}>
          {Array.from({ length: FRETS }, (_, i) => {
            const fret = minFret + i
            return (
              <div key={i} style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
              }}>
                {fretMarkers.includes(fret) && (
                  <div style={{
                    width: fret === 12 ? 10 : 7,
                    height: fret === 12 ? 10 : 7,
                    borderRadius: '50%',
                    background: 'var(--border)',
                    ...(fret === 12 && {
                      outline: '3px solid var(--border)',
                      outlineOffset: 2,
                    }),
                  }} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Scale Notes Strip ─────────────────────────────────────────────────────────
function ScaleNoteStrip({ rootIndex, scaleKey, color, currentPlayingNote }) {
  if (rootIndex === null || !scaleKey) return null
  const scale = SCALES[scaleKey]
  const notes = scale.intervals.map(interval => ({
    name: NOTE_NAMES[(rootIndex + interval) % 12],
    interval,
    isRoot: interval === 0,
  }))
  const playingNoteIndex = currentPlayingNote ? NOTE_NAMES.indexOf(currentPlayingNote) : null

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
      {notes.map(({ name, interval, isRoot }, i) => (
        <div key={i} style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          animation: `note-pop 0.25s ease ${i * 40}ms both`,
        }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            background: playingNoteIndex === NOTE_NAMES.indexOf(name) ? '#FFD700' : (isRoot ? color : `${color}1a`),
            border: `2px solid ${playingNoteIndex === NOTE_NAMES.indexOf(name) ? '#FFD700' : (isRoot ? color : `${color}44`)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Space Mono, monospace',
            fontSize: name.length > 1 ? 16 : 18,
            fontWeight: 700,
            color: playingNoteIndex === NOTE_NAMES.indexOf(name) ? '#000' : (isRoot ? '#fff' : color),
            boxShadow: playingNoteIndex === NOTE_NAMES.indexOf(name)
              ? '0 0 20px #FFD700, 0 0 40px #FFA500'
              : (isRoot ? `0 4px 20px ${color}44` : 'none'),
            transition: 'all 0.1s',
            animation: playingNoteIndex === NOTE_NAMES.indexOf(name) ? 'pulse-ring 0.3s ease' : 'none',
          }}>
            {name}
          </div>
          <span style={{
            fontSize: 11,
            color: isRoot ? color : 'var(--text-muted)',
            fontFamily: 'Space Mono, monospace',
            fontWeight: 700,
          }}>
            {getIntervalLabel(interval)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Cents Meter ──────────────────────────────────────────────────────────────
function CentsMeter({ cents }) {
  const clamped = Math.max(-50, Math.min(50, cents))
  const pct = ((clamped + 50) / 100) * 100
  const inTune = Math.abs(cents) <= 10

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: '100%',
        maxWidth: 200,
        height: 6,
        borderRadius: 3,
        background: 'var(--bg3)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Center mark */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: 2,
          background: 'var(--border)',
          transform: 'translateX(-50%)',
        }} />
        {/* Needle */}
        <div style={{
          position: 'absolute',
          left: `${pct}%`,
          top: 0,
          bottom: 0,
          width: 4,
          borderRadius: 2,
          background: inTune ? '#2ECC71' : '#E85D75',
          transform: 'translateX(-50%)',
          transition: 'left 0.1s, background 0.3s',
          boxShadow: inTune ? '0 0 8px #2ECC7188' : '0 0 8px #E85D7588',
        }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Space Mono, monospace' }}>
        {inTune ? '✓ in tune' : `${cents > 0 ? '+' : ''}${cents}¢`}
      </span>
    </div>
  )
}

// ─── Song Suggestions ──────────────────────────────────────────────────────────
function SongSuggestions({ rootNote, scaleKey, color }) {
  if (!rootNote || !scaleKey) return null
  const figures = BASS_FIGURES[scaleKey] || []

  const playFigure = async (pattern) => {
    const Tone = window.Tone
    await Tone.start()
    if (!basssynth) basssynth = initBassSynth('warm')

    const scale = SCALES[scaleKey]
    const noteIndices = pattern.map(iv => (NOTE_NAMES.indexOf(rootNote) + iv) % 12)

    let delay = 0
    const beatDuration = 0.5 // half second per note
    noteIndices.forEach((noteIdx) => {
      const noteName = NOTE_NAMES[noteIdx]
      setTimeout(() => {
        basssynth.triggerAttackRelease(noteName + '2', beatDuration * 0.9)
      }, delay * 1000)
      delay += beatDuration
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
        Try these bass figures with {rootNote} {SCALES[scaleKey].name}:
      </p>
      {figures.map((figure, i) => {
        const notes = figure.pattern.map(p => {
          const noteIdx = (NOTE_NAMES.indexOf(rootNote) + p) % 12
          return NOTE_NAMES[noteIdx]
        })
        return (
          <div
            key={i}
            style={{
              padding: '16px',
              background: 'var(--bg3)',
              borderLeft: `4px solid ${color}`,
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}>
              <div>
                <div style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text)',
                }}>
                  {figure.name}
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  marginTop: 2,
                }}>
                  {figure.description}
                </div>
              </div>
              <button
                onClick={() => playFigure(figure.pattern)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `2px solid ${color}`,
                  background: 'transparent',
                  color: color,
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = color + '22'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                ▶ Play
              </button>
            </div>
            {/* Large note sequence */}
            <div style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'center',
              padding: '12px',
              background: color + '11',
              borderRadius: 8,
              flexWrap: 'wrap',
            }}>
              {notes.map((note, j) => (
                <div
                  key={j}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 10,
                    background: color + '22',
                    border: `2px solid ${color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'Space Mono, monospace',
                    fontSize: 20,
                    fontWeight: 700,
                    color: color,
                  }}
                >
                  {note}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Genre Card ───────────────────────────────────────────────────────────────
function GenreCard({ scaleKey, scale, selected, onClick }) {
  return (
    <button
      onClick={() => onClick(scaleKey)}
      style={{
        padding: '12px 16px',
        borderRadius: 10,
        border: `2px solid ${selected ? scale.color : 'var(--border)'}`,
        background: selected ? scale.color + '22' : 'var(--bg3)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        flexShrink: 0,
        minWidth: 120,
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = scale.color + '88'
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = 'var(--border)'
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{scale.emoji}</span>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: selected ? scale.color : 'var(--text-dim)',
        }}>
          {scale.name}
        </span>
      </div>
      <span style={{
        fontSize: 10,
        color: 'var(--text-muted)',
        textAlign: 'left',
        lineHeight: 1.3,
      }}>
        {scale.description}
      </span>
    </button>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [isListening, setIsListening] = useState(false)
  const [detectedFreq, setDetectedFreq] = useState(null)
  const [detectedNote, setDetectedNote] = useState(null)
  const [detectedNoteIndex, setDetectedNoteIndex] = useState(null)
  const [cents, setCents] = useState(0)
  const [lockedNote, setLockedNote] = useState(null)
  const [lockedNoteIndex, setLockedNoteIndex] = useState(null)
  const [selectedScale, setSelectedScale] = useState('blues')
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('fretboard') // 'fretboard' | 'notes'
  const [manualNote, setManualNote] = useState(null) // fallback: tap a note
  const [showManual, setShowManual] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [tempo, setTempo] = useState(120)
  const [volume, setVolume] = useState(0)
  const [soundType, setSoundType] = useState('warm')
  const [currentPlayingNote, setCurrentPlayingNote] = useState(null)

  const detectorRef = useRef(null)
  const playTimeoutRef = useRef(null)
  const lockTimerRef = useRef(null)
  const lastFreqRef = useRef(null)
  const stableCountRef = useRef(0)

  const handlePitch = useCallback((freq) => {
    if (freq < 0) {
      // Silence — after 1.5s of silence, clear the detected note
      stableCountRef.current = 0
      return
    }

    // Bass range: ~30Hz (B0) to ~400Hz (G4) — filter out-of-range detections
    if (freq < 28 || freq > 500) return

    const midi = freqToMidi(freq)
    const noteName = midiToNoteName(midi)
    const noteIndex = midiToNoteIndex(midi)
    const c = getCentsOff(freq)

    setDetectedFreq(freq)
    setDetectedNote(noteName)
    setDetectedNoteIndex(noteIndex)
    setCents(c)

    // Lock note when signal is stable for ~15 frames (~250ms)
    if (lastFreqRef.current !== null && Math.abs(freq - lastFreqRef.current) < freq * 0.02) {
      stableCountRef.current++
      if (stableCountRef.current >= 12) {
        setLockedNote(noteName)
        setLockedNoteIndex(noteIndex)
        setManualNote(null)
      }
    } else {
      stableCountRef.current = 0
    }
    lastFreqRef.current = freq
  }, [])

  const startListening = async () => {
    setError(null)
    const detector = new PitchDetector()
    const ok = await detector.start(handlePitch)
    if (ok) {
      detectorRef.current = detector
      setIsListening(true)
    } else {
      setError('Could not access microphone. Please allow microphone access and try again.')
    }
  }

  const stopListening = () => {
    if (detectorRef.current) {
      detectorRef.current.stop()
      detectorRef.current = null
    }
    setIsListening(false)
    setDetectedFreq(null)
    setDetectedNote(null)
    stableCountRef.current = 0
    lastFreqRef.current = null
  }

  const handleManualNote = (noteName) => {
    const idx = NOTE_NAMES.indexOf(noteName)
    setManualNote(noteName)
    setLockedNote(noteName)
    setLockedNoteIndex(idx)
  }

  const handlePlayScale = () => {
    if (isPlaying || !activeNote || !selectedScale) return

    setIsPlaying(true)
    const scale = SCALES[selectedScale]
    const beatDuration = 60 / tempo
    const totalDuration = (scale.intervals.length + 1) * beatDuration // +1 for root octave

    playScale(
      activeNote,
      selectedScale,
      tempo,
      (noteName) => setCurrentPlayingNote(noteName),
      soundType
    )

    // Clear flag after scale finishes
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current)
    playTimeoutRef.current = setTimeout(() => {
      setIsPlaying(false)
      setCurrentPlayingNote(null)
    }, totalDuration * 1000 + 100)
  }

  // Update synth volume when volume slider changes
  useEffect(() => {
    if (basssynth) {
      basssynth.volume.value = volume
    }
  }, [volume])

  // Reinitialize synth when sound type changes
  useEffect(() => {
    if (basssynth) {
      basssynth.dispose()
      if (currentFilter) currentFilter.dispose()
      basssynth = null
      currentFilter = null
    }
    // Reinit will happen on next note play
  }, [soundType])

  // Initialize Tone.js on first user interaction
  useEffect(() => {
    const initAudio = async () => {
      const Tone = window.Tone
      if (Tone) await Tone.start()
    }

    const handleInteraction = () => {
      initAudio()
      document.removeEventListener('click', handleInteraction)
    }

    document.addEventListener('click', handleInteraction)
    return () => document.removeEventListener('click', handleInteraction)
  }, [])

  useEffect(() => {
    return () => {
      if (detectorRef.current) detectorRef.current.stop()
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current)
    }
  }, [])

  const activeNoteIndex = lockedNoteIndex
  const activeNote = lockedNote
  const scale = SCALES[selectedScale]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 800,
      margin: '0 auto',
      padding: '0 0 40px',
    }}>
      {/* Header */}
      <header style={{
        padding: '20px 20px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: '-0.5px',
            background: `linear-gradient(135deg, ${scale.color}, #fff)`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Scalope
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Real-time scale detector
          </p>
        </div>

        {/* Mic button */}
        <button
          onClick={isListening ? stopListening : startListening}
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            background: isListening
              ? '#E85D75'
              : 'var(--bg3)',
            boxShadow: isListening
              ? '0 0 0 0 rgba(232,93,117,0.4)'
              : 'none',
            animation: isListening ? 'pulse-ring 1.5s ease infinite' : 'none',
            transition: 'background 0.3s',
            position: 'relative',
          }}
          title={isListening ? 'Stop listening' : 'Start listening'}
        >
          {isListening ? '⏹' : '🎙'}
        </button>
      </header>

      {/* Error */}
      {error && (
        <div style={{
          margin: '12px 20px 0',
          padding: '12px 16px',
          background: '#E85D7522',
          border: '1px solid #E85D7566',
          borderRadius: 10,
          fontSize: 13,
          color: '#E85D75',
        }}>
          {error}
        </div>
      )}

      {/* Detected note display */}
      <div style={{
        margin: '20px 20px 0',
        padding: '20px',
        background: 'var(--bg2)',
        borderRadius: 'var(--radius)',
        border: `1px solid ${activeNote ? scale.color + '44' : 'var(--border)'}`,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        transition: 'border-color 0.3s',
      }}>
        {/* Big note */}
        <div style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: activeNote ? `${scale.color}22` : 'var(--bg3)',
          border: `3px solid ${activeNote ? scale.color : 'var(--border)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.3s',
          boxShadow: activeNote ? `0 8px 30px ${scale.color}44` : 'none',
        }}>
          <span style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: activeNote ? (activeNote.length > 1 ? 28 : 34) : 32,
            fontWeight: 700,
            color: activeNote ? scale.color : 'var(--text-muted)',
            transition: 'all 0.2s',
          }}>
            {activeNote || (isListening ? '?' : '—')}
          </span>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            {isListening
              ? detectedNote
                ? `Detecting: ${detectedNote} • ${detectedFreq ? detectedFreq.toFixed(1) + ' Hz' : ''}`
                : 'Listening… play a note'
              : activeNote
                ? `Locked: ${activeNote}`
                : 'Tap 🎙 to start or pick a note below'}
          </div>

          {detectedFreq && isListening && (
            <CentsMeter cents={cents} />
          )}

          {!isListening && !activeNote && (
            <button
              onClick={() => setShowManual(v => !v)}
              style={{
                background: 'none',
                border: `1px solid var(--border)`,
                borderRadius: 8,
                padding: '6px 12px',
                cursor: 'pointer',
                color: 'var(--text-dim)',
                fontSize: 12,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {showManual ? 'Hide' : 'Pick note manually'}
            </button>
          )}
        </div>
      </div>

      {/* Manual note picker */}
      {showManual && !isListening && (
        <div style={{
          margin: '12px 20px 0',
          padding: '16px',
          background: 'var(--bg2)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          animation: 'fade-in 0.2s ease',
        }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Pick your root note:
          </p>
          <div className="note-picker" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {NOTE_NAMES.map(note => (
              <button
                key={note}
                onClick={() => handleManualNote(note)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  border: `2px solid ${lockedNote === note ? scale.color : 'var(--border)'}`,
                  background: lockedNote === note ? `${scale.color}22` : 'var(--bg3)',
                  cursor: 'pointer',
                  fontFamily: 'Space Mono, monospace',
                  fontSize: 13,
                  fontWeight: 700,
                  color: lockedNote === note ? scale.color : 'var(--text)',
                  transition: 'all 0.15s',
                  padding: '8px',
                  minHeight: '48px',
                }}
              >
                {note}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scale selector */}
      <div style={{ margin: '20px 20px 0' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Scale / Genre
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(SCALES).map(([key, s]) => (
            <GenreCard
              key={key}
              scaleKey={key}
              scale={s}
              selected={selectedScale === key}
              onClick={setSelectedScale}
            />
          ))}
        </div>
      </div>

      {/* Scale result */}
      {activeNoteIndex !== null && (
        <div style={{
          margin: '20px 20px 0',
          background: 'var(--bg2)',
          borderRadius: 'var(--radius)',
          border: `1px solid ${scale.color}44`,
          overflow: 'hidden',
          animation: 'fade-in 0.3s ease',
        }}>
          {/* Result header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{scale.emoji}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: scale.color }}>
                  {activeNote} {scale.name}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {scale.description}
              </p>
            </div>
            <button
              onClick={handlePlayScale}
              disabled={isPlaying}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: `2px solid ${scale.color}`,
                background: isPlaying ? scale.color + '44' : 'transparent',
                cursor: isPlaying ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700,
                color: scale.color,
                fontSize: 13,
                whiteSpace: 'nowrap',
                opacity: isPlaying ? 1 : 1,
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
              title="Play scale notes"
            >
              {isPlaying ? '♪ Playing...' : '▶ Play'}
            </button>
          </div>

          {/* Tabs & Controls */}
          <div className="control-bar" style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            alignItems: 'stretch',
          }}>
            {/* Tabs */}
            <div className="control-section" style={{
              display: 'flex',
              flex: 1,
              borderRight: '1px solid var(--border)',
            }}>
              {[
                { key: 'fretboard', label: '🎸 Fretboard' },
                { key: 'suggestions', label: '💡 Ideas' },
                { key: 'notes', label: '♩ Notes' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: tab === t.key ? 700 : 400,
                    color: tab === t.key ? scale.color : 'var(--text-muted)',
                    borderBottom: `2px solid ${tab === t.key ? scale.color : 'transparent'}`,
                    transition: 'all 0.2s',
                    fontFamily: 'Inter, sans-serif',
                    minHeight: '48px',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tempo Control */}
            <div className="control-section" style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              gap: 8,
              minWidth: 180,
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                ♩ BPM
              </span>
              <input
                type="range"
                min="60"
                max="200"
                value={tempo}
                onChange={(e) => setTempo(Number(e.target.value))}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background: 'var(--bg3)',
                  outline: 'none',
                  accentColor: scale.color,
                  cursor: 'pointer',
                }}
              />
              <span style={{
                fontSize: 12,
                fontFamily: 'Space Mono, monospace',
                fontWeight: 700,
                color: 'var(--text-muted)',
                minWidth: 32,
                textAlign: 'right',
              }}>
                {tempo}
              </span>
            </div>

            {/* Volume Control */}
            <div className="control-section" style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              gap: 8,
              minWidth: 160,
              borderLeft: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                🔊 VOL
              </span>
              <input
                type="range"
                min="-20"
                max="10"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background: 'var(--bg3)',
                  outline: 'none',
                  accentColor: scale.color,
                  cursor: 'pointer',
                }}
              />
              <span style={{
                fontSize: 12,
                fontFamily: 'Space Mono, monospace',
                fontWeight: 700,
                color: 'var(--text-muted)',
                minWidth: 28,
                textAlign: 'right',
              }}>
                {volume > 0 ? '+' : ''}{volume}
              </span>
            </div>

            {/* Sound Type Selector */}
            <div className="control-section" style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              gap: 8,
              minWidth: 180,
              borderLeft: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                🎵 TONE
              </span>
              <select
                value={soundType}
                onChange={(e) => setSoundType(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg3)',
                  color: 'var(--text)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <option value="warm">Warm</option>
                <option value="bright">Bright</option>
                <option value="punchy">Punchy</option>
                <option value="smooth">Smooth</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>
          </div>

          {/* Tab content */}
          <div style={{ padding: '20px' }}>
            {tab === 'fretboard' && (
              <Fretboard
                key={`${activeNoteIndex}-${selectedScale}`}
                rootIndex={activeNoteIndex}
                scaleKey={selectedScale}
                color={scale.color}
                currentPlayingNote={currentPlayingNote}
              />
            )}
            {tab === 'suggestions' && (
              <SongSuggestions
                key={`suggestions-${activeNoteIndex}-${selectedScale}`}
                rootNote={activeNote}
                scaleKey={selectedScale}
                color={scale.color}
              />
            )}
            {tab === 'notes' && (
              <ScaleNoteStrip
                key={`${activeNoteIndex}-${selectedScale}`}
                rootIndex={activeNoteIndex}
                scaleKey={selectedScale}
                color={scale.color}
                currentPlayingNote={currentPlayingNote}
              />
            )}
          </div>

          {/* Scale formula */}
          <div style={{
            padding: '0 20px 16px',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}>
            {SCALES[selectedScale].intervals.map((interval, i) => (
              <div key={i} style={{
                padding: '4px 10px',
                borderRadius: 20,
                background: 'var(--bg3)',
                fontSize: 12,
                fontFamily: 'Space Mono, monospace',
                color: interval === 0 ? scale.color : 'var(--text-muted)',
                fontWeight: interval === 0 ? 700 : 400,
                border: `1px solid ${interval === 0 ? scale.color + '44' : 'transparent'}`,
              }}>
                {getIntervalLabel(interval)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {activeNoteIndex === null && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          gap: 12,
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48 }}>🎸</div>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-dim)' }}>
            Play a note to see the scale
          </p>
          <p style={{ fontSize: 13, maxWidth: 280, lineHeight: 1.6 }}>
            Hit 🎙, play a bass note, select your scale —
            the fretboard will light up with every note in that scale.
          </p>
        </div>
      )}
    </div>
  )
}
