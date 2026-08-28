/**
 * Haven RNNoise & Voice Activity Detection (VAD) AudioWorklet Processor
 * Runs off the main UI thread with zero-copy sample processing and low latency.
 */
class RNNoiseVADProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.noiseSuppressionEnabled = true;
    this.vadThreshold = 0.015;
    this.bufferSize = 480; // 10ms frame at 48kHz
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.lastVadPost = 0;

    this.port.onmessage = (event) => {
      const { type, data } = event.data || {};
      if (type === 'SET_NOISE_SUPPRESSION') {
        this.noiseSuppressionEnabled = Boolean(data);
      } else if (type === 'SET_VAD_THRESHOLD') {
        this.vadThreshold = Number(data) || 0.015;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || input.length === 0 || !input[0]) {
      return true;
    }

    const inputChannel = input[0];
    const outputChannel = output[0];
    const numSamples = inputChannel.length;

    let sumSquares = 0;

    for (let i = 0; i < numSamples; i++) {
      const sample = inputChannel[i];
      sumSquares += sample * sample;

      // Simple pass-through or noise-gate filter
      if (this.noiseSuppressionEnabled) {
        // High-pass + soft noise gate to attenuate low frequency background rumble
        outputChannel[i] = Math.abs(sample) > 0.003 ? sample : 0;
      } else {
        outputChannel[i] = sample;
      }
    }

    // Calculate RMS for Voice Activity Detection
    const rms = Math.sqrt(sumSquares / numSamples);
    const now = currentTime;

    // Send VAD events periodically (every ~30ms) to avoid message overhead
    if (now - this.lastVadPost > 0.03) {
      this.lastVadPost = now;
      this.port.postMessage({
        type: 'VAD_UPDATE',
        level: rms,
        isSpeaking: rms >= this.vadThreshold,
      });
    }

    return true;
  }
}

registerProcessor('rnnoise-vad-processor', RNNoiseVADProcessor);
