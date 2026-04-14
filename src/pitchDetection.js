// Autocorrelation-based pitch detection
// Works well for monophonic instruments like bass guitar
export function autoCorrelate(buffer, sampleRate) {
  const SIZE = buffer.length
  const MAX_SAMPLES = Math.floor(SIZE / 2)

  // Check if signal is loud enough (RMS threshold)
  let rms = 0
  for (let i = 0; i < SIZE; i++) {
    rms += buffer[i] * buffer[i]
  }
  rms = Math.sqrt(rms / SIZE)
  if (rms < 0.01) return -1 // Too quiet

  // Normalize
  let r1 = 0, r2 = SIZE - 1
  const threshold = 0.2
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) { r1 = i; break }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < threshold) { r2 = SIZE - i; break }
  }

  const trimmed = buffer.slice(r1, r2)
  const len = trimmed.length

  // Autocorrelation
  const c = new Array(MAX_SAMPLES).fill(0)
  for (let i = 0; i < MAX_SAMPLES; i++) {
    for (let j = 0; j < len - i; j++) {
      c[i] += trimmed[j] * trimmed[j + i]
    }
  }

  // Find first valley (d[i] starts going down)
  let d = 0
  while (d < MAX_SAMPLES && c[d] > c[d + 1]) d++

  // Find first peak after valley
  let maxVal = -Infinity
  let maxPos = -1
  for (let i = d; i < MAX_SAMPLES; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i]
      maxPos = i
    }
  }

  if (maxPos < 0 || maxVal < 0) return -1

  // Parabolic interpolation for better accuracy
  let T0 = maxPos
  const x1 = c[T0 - 1]
  const x2 = c[T0]
  const x3 = c[T0 + 1]
  const a = (x1 + x3 - 2 * x2) / 2
  const b = (x3 - x1) / 2
  if (a !== 0) T0 = T0 - b / (2 * a)

  return sampleRate / T0
}

export class PitchDetector {
  constructor() {
    this.audioContext = null
    this.analyser = null
    this.source = null
    this.stream = null
    this.buffer = null
    this.animFrameId = null
    this.onPitch = null
    this.isRunning = false
  }

  async start(onPitch) {
    this.onPitch = onPitch

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.0

      this.source = this.audioContext.createMediaStreamSource(this.stream)
      this.source.connect(this.analyser)

      this.buffer = new Float32Array(this.analyser.fftSize)
      this.isRunning = true
      this._loop()
      return true
    } catch (err) {
      console.error('Microphone access error:', err)
      return false
    }
  }

  _loop() {
    if (!this.isRunning) return
    this.analyser.getFloatTimeDomainData(this.buffer)
    const freq = autoCorrelate(this.buffer, this.audioContext.sampleRate)
    if (this.onPitch) this.onPitch(freq)
    this.animFrameId = requestAnimationFrame(() => this._loop())
  }

  stop() {
    this.isRunning = false
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId)
    if (this.source) this.source.disconnect()
    if (this.stream) this.stream.getTracks().forEach(t => t.stop())
    if (this.audioContext) this.audioContext.close()
  }
}
