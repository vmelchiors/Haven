export interface AINoiseSuppressionPipeline {
  stream: MediaStream;
  ready: Promise<void>;
  dispose: () => Promise<void>;
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
    sampleRate: 16_000,
  }) as AudioContext;

  let source: MediaStreamAudioSourceNode | null = null;
  let destination: MediaStreamAudioDestinationNode | null = null;
  let disposed = false;

  try {
    await audioContext.resume();

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
