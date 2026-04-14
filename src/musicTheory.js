export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

// Scales defined as semitone intervals from root
export const SCALES = {
  blues: {
    name: 'Blues',
    intervals: [0, 3, 5, 6, 7, 10],
    description: 'Blues, R&B, soul',
    color: '#4F8EF7',
    emoji: '🎸',
  },
  minor_pentatonic: {
    name: 'Minor Pentatonic',
    intervals: [0, 3, 5, 7, 10],
    description: 'Rock, metal, funk',
    color: '#E85D75',
    emoji: '🔥',
  },
  major_pentatonic: {
    name: 'Major Pentatonic',
    intervals: [0, 2, 4, 7, 9],
    description: 'Country, pop, folk',
    color: '#F5A623',
    emoji: '☀️',
  },
  natural_minor: {
    name: 'Natural Minor',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    description: 'Dark rock, classical',
    color: '#9B59B6',
    emoji: '🌙',
  },
  major: {
    name: 'Major',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    description: 'Pop, classical, jazz',
    color: '#2ECC71',
    emoji: '✨',
  },
  dorian: {
    name: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    description: 'Jazz, funk, modal',
    color: '#1ABC9C',
    emoji: '🎷',
  },
  mixolydian: {
    name: 'Mixolydian',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    description: 'Blues-rock, funk',
    color: '#E67E22',
    emoji: '⚡',
  },
  phrygian: {
    name: 'Phrygian',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    description: 'Flamenco, Spanish',
    color: '#C0392B',
    emoji: '🦂',
  },
}

// Convert frequency (Hz) to MIDI note number
export function freqToMidi(freq) {
  return Math.round(12 * Math.log2(freq / 440) + 69)
}

// Convert MIDI note to note name (e.g. 69 → "A", 70 → "A#")
export function midiToNoteName(midi) {
  return NOTE_NAMES[((midi % 12) + 12) % 12]
}

// Convert MIDI note to note index 0-11
export function midiToNoteIndex(midi) {
  return ((midi % 12) + 12) % 12
}

// Get scale notes (note names) given a root note index and scale key
export function getScaleNotes(rootIndex, scaleKey) {
  const scale = SCALES[scaleKey]
  if (!scale) return []
  return scale.intervals.map(interval => {
    const noteIndex = (rootIndex + interval) % 12
    return NOTE_NAMES[noteIndex]
  })
}

// Get interval label for display (e.g. 0 → "R", 3 → "b3", etc.)
export function getIntervalLabel(semitones) {
  const labels = {
    0: 'R',
    1: 'b2',
    2: '2',
    3: 'b3',
    4: '3',
    5: '4',
    6: 'b5',
    7: '5',
    8: 'b6',
    9: '6',
    10: 'b7',
    11: '7',
  }
  return labels[semitones] ?? '?'
}

// Bass standard tuning: open string note indices (E2=4, A2=9, D3=2, G3=7)
export const BASS_STRINGS = [
  { name: 'G', openMidi: 43 },
  { name: 'D', openMidi: 38 },
  { name: 'A', openMidi: 33 },
  { name: 'E', openMidi: 28 },
]

export const FRET_COUNT = 12

// For each string/fret, return the note index (0-11)
export function fretNoteIndex(openMidi, fret) {
  return ((openMidi + fret) % 12 + 12) % 12
}

// Get cents deviation from nearest note
export function getCentsOff(freq) {
  const midi = 12 * Math.log2(freq / 440) + 69
  const rounded = Math.round(midi)
  return Math.round((midi - rounded) * 100)
}

// Bass figures / song suggestions for each scale
export const BASS_FIGURES = {
  blues: [
    { name: 'Root Pocket', pattern: [0, 7, 0, 3], description: 'Classic blues walk' },
    { name: 'Fifth Groove', pattern: [0, 7, 10, 7], description: 'Add the flat-7 for blues feel' },
    { name: 'Simple Root', pattern: [0, 0, 0], description: 'Hold the root steady' },
  ],
  minor_pentatonic: [
    { name: 'Root Pound', pattern: [0, 0, 7, 7], description: 'Powerful and driving' },
    { name: 'Minor Feel', pattern: [0, 3, 7, 3], description: 'Emphasize the minor 3rd' },
    { name: 'Pentatonic Walk', pattern: [0, 3, 5, 7], description: 'Move through all notes' },
  ],
  major_pentatonic: [
    { name: 'Happy Root', pattern: [0, 7, 9, 7], description: 'Bright and uplifting' },
    { name: 'Major Feel', pattern: [0, 4, 7], description: 'Classic major chord tones' },
    { name: 'Pentatonic Hop', pattern: [0, 2, 4, 7], description: 'Skip through the scale' },
  ],
  natural_minor: [
    { name: 'Minor Walk', pattern: [0, 2, 3, 5], description: 'Traditional minor line' },
    { name: 'Dark Root', pattern: [0, 0, 5, 3], description: 'Moody and introspective' },
    { name: 'Full Minor', pattern: [0, 3, 5, 7, 10], description: 'Explore all notes' },
  ],
  major: [
    { name: 'Bright Groove', pattern: [0, 4, 7, 4], description: 'Highlight the major 3rd' },
    { name: 'Root Bounce', pattern: [0, 7, 9, 7], description: 'Upbeat and fun' },
    { name: 'Full Major', pattern: [0, 2, 4, 5, 7], description: 'Walk the full scale' },
  ],
  dorian: [
    { name: 'Dorian Walk', pattern: [0, 2, 3, 5, 7], description: 'Jazz-fusion groove' },
    { name: 'Dorian Vibe', pattern: [0, 5, 7, 9], description: 'Modal and funky' },
    { name: 'Simple Dorian', pattern: [0, 2, 5], description: 'Keep it minimal' },
  ],
  mixolydian: [
    { name: 'Dominant Funk', pattern: [0, 7, 9, 10], description: 'Funky dominant feel' },
    { name: 'Mixolydian Rock', pattern: [0, 5, 7, 9], description: 'Blues-rock foundation' },
    { name: 'Simple Groove', pattern: [0, 4, 7], description: 'Straightforward pocket' },
  ],
  phrygian: [
    { name: 'Flamenco Stomp', pattern: [0, 1, 3, 5], description: 'Spanish flavor' },
    { name: 'Phrygian Vibe', pattern: [0, 1, 5, 8], description: 'Exotic and dark' },
    { name: 'Root Anchor', pattern: [0, 0, 1, 0], description: 'Emphasize the flat-2' },
  ],
}
