export interface AINoiseSuppressionPipeline {
  stream: MediaStream;
  ready: Promise<void>;
  dispose: () => Promise<void>;
}

export type NoiseSuppressionRuntimeStatus = 'loading' | 'active' | 'fallback' | 'disabled';

export interface NoiseSuppressionTransitionOptions {
  inputStream: MediaStream;
  enabled: boolean;
  signal: AbortSignal;
  activateStream: (stream: MediaStream) => Promise<void>;
  setStatus: (status: NoiseSuppressionRuntimeStatus) => void;
  createPipeline?: (stream: MediaStream) => Promise<AINoiseSuppressionPipeline>;
  onError?: (error: unknown) => void;
}

export interface NoiseSuppressionTransitionResult {
  analysisStream: MediaStream;
  pipeline: AINoiseSuppressionPipeline | null;
}

export const DTLN_SAMPLE_RATE = 16_000;

async function enableNativeNoiseSuppression(inputStream: MediaStream): Promise<void> {
  const inputTrack = inputStream.getAudioTracks()[0];
  await inputTrack?.applyConstraints({ noiseSuppression: true }).catch(() => undefined);
}

function waitForAbort(signal: AbortSignal): Promise<'aborted'> {
  if (signal.aborted) return Promise.resolve('aborted');
  return new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve('aborted'), { once: true });
  });
}

/**
 * Coordinates raw, DTLN and native-fallback streams without allowing an old
 * async model load to update a newer toggle operation.
 */
export async function startNoiseSuppressionTransition(
  options: NoiseSuppressionTransitionOptions,
): Promise<NoiseSuppressionTransitionResult | null> {
  const {
    inputStream,
    enabled,
    signal,
    activateStream,
    setStatus,
    createPipeline = createAINoiseSuppressionPipeline,
    onError,
  } = options;

  const isCurrent = () => !signal.aborted;
  const updateStatus = (status: NoiseSuppressionRuntimeStatus) => {
    if (isCurrent()) setStatus(status);
  };

  if (!isCurrent()) return null;
  await activateStream(inputStream);
  if (!isCurrent()) return null;

  if (!enabled) {
    updateStatus('disabled');
    return { analysisStream: inputStream, pipeline: null };
  }

  updateStatus('loading');
  let pipeline: AINoiseSuppressionPipeline;
  try {
    pipeline = await createPipeline(inputStream);
  } catch (error) {
    if (!isCurrent()) return null;
    onError?.(error);
    await enableNativeNoiseSuppression(inputStream);
    if (!isCurrent()) return null;
    await activateStream(inputStream);
    updateStatus('fallback');
    return { analysisStream: inputStream, pipeline: null };
  }

  if (!isCurrent()) {
    await pipeline.dispose();
    return null;
  }

  const readiness = await Promise.race([
    pipeline.ready.then(
      () => ({ state: 'ready' as const }),
      (error) => ({ state: 'failed' as const, error }),
    ),
    waitForAbort(signal).then(() => ({ state: 'aborted' as const })),
  ]);

  if (readiness.state === 'aborted' || !isCurrent()) {
    await pipeline.dispose();
    return null;
  }

  if (readiness.state === 'failed') {
    onError?.(readiness.error);
    await enableNativeNoiseSuppression(inputStream);
    if (!isCurrent()) {
      await pipeline.dispose();
      return null;
    }
    await activateStream(inputStream);
    updateStatus('fallback');
    await pipeline.dispose();
    return { analysisStream: inputStream, pipeline: null };
  }

  await activateStream(pipeline.stream);
  if (!isCurrent()) {
    await pipeline.dispose();
    return null;
  }
  updateStatus('active');
  return { analysisStream: pipeline.stream, pipeline };
}

/**
 * Creates a mono, speech-focused DTLN denoising pipeline.
 *
 * The model runs locally in an AudioWorklet through WebAssembly. While the
 * model is loading, audio is passed through unchanged so joining a call never
 * depends on the AI runtime being available.
 */
export async function createAINoiseSuppressionPipeline(
  inputStream: MediaStream,
): Promise<AINoiseSuppressionPipeline> {
  const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextConstructor || typeof AudioWorkletNode === 'undefined') {
    throw new Error('AudioWorklet is not supported in this environment');
  }

  const audioContext = new AudioContextConstructor({
    latencyHint: 'interactive',
    sampleRate: DTLN_SAMPLE_RATE,
  }) as AudioContext;

  let source: MediaStreamAudioSourceNode | null = null;
  let destination: MediaStreamAudioDestinationNode | null = null;
  let disposed = false;

  try {
    await audioContext.resume();

    // MediaStreamAudioSourceNode resamples the microphone to the context rate.
    // DTLN itself expects exactly 16 kHz, so a browser that ignores the
    // requested context rate must fall back instead of feeding invalid frames.
    if (audioContext.sampleRate !== DTLN_SAMPLE_RATE) {
      throw new Error(
        `DTLN requires a ${DTLN_SAMPLE_RATE} Hz AudioContext; received ${audioContext.sampleRate} Hz`,
      );
    }

    const { createNoiseSuppressionAudioWorklet } = await import(
      '@workadventure/noise-suppression/audio-worklet'
    );
    const worklet = await createNoiseSuppressionAudioWorklet(audioContext, {
      bypassUntilReady: true,
      threads: false,
      readyTimeoutMs: 30_000,
    });

    source = audioContext.createMediaStreamSource(inputStream);
    destination = audioContext.createMediaStreamDestination();
    source.connect(worklet.node);
    worklet.node.connect(destination);

    const outputStream = destination.stream;
    const ready = worklet.ready.then(() => undefined);

    return {
      stream: outputStream,
      ready,
      dispose: async () => {
        if (disposed) return;
        disposed = true;
        source?.disconnect();
        worklet.dispose();
        destination?.stream.getTracks().forEach((track) => track.stop());
        destination?.disconnect();
        if (audioContext.state !== 'closed') {
          await audioContext.close().catch(() => undefined);
        }
      },
    };
  } catch (error) {
    source?.disconnect();
    destination?.stream.getTracks().forEach((track) => track.stop());
    destination?.disconnect();
    if (audioContext.state !== 'closed') {
      await audioContext.close().catch(() => undefined);
    }
    throw error;
  }
}
