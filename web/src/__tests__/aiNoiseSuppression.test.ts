import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAINoiseSuppressionPipeline,
  DTLN_SAMPLE_RATE,
  startNoiseSuppressionTransition,
  type AINoiseSuppressionPipeline,
  type NoiseSuppressionRuntimeStatus,
} from '../lib/aiNoiseSuppression';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createStream() {
  const track = {
    enabled: true,
    applyConstraints: vi.fn().mockResolvedValue(undefined),
  };
  const stream = {
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, track };
}

function createPipeline(stream: MediaStream, ready: Promise<void>): AINoiseSuppressionPipeline {
  return {
    stream,
    ready,
    dispose: vi.fn().mockResolvedValue(undefined),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AI noise suppression transitions', () => {
  it('preserves the latest mute state while loading becomes active', async () => {
    const raw = createStream();
    const processed = createStream();
    const modelReady = deferred<void>();
    const pipeline = createPipeline(processed.stream, modelReady.promise);
    const statuses: NoiseSuppressionRuntimeStatus[] = [];
    let effectivelyMuted = false;
    const activateStream = vi.fn(async (stream: MediaStream) => {
      stream.getAudioTracks()[0].enabled = !effectivelyMuted;
    });

    const transition = startNoiseSuppressionTransition({
      inputStream: raw.stream,
      enabled: true,
      signal: new AbortController().signal,
      activateStream,
      setStatus: (status) => statuses.push(status),
      createPipeline: vi.fn().mockResolvedValue(pipeline),
    });

    await vi.waitFor(() => expect(statuses).toEqual(['loading']));
    effectivelyMuted = true;
    raw.track.enabled = !effectivelyMuted;
    expect(raw.track.enabled).toBe(false);
    effectivelyMuted = false;
    raw.track.enabled = !effectivelyMuted;

    modelReady.resolve();
    await transition;

    expect(activateStream).toHaveBeenNthCalledWith(1, raw.stream);
    expect(activateStream).toHaveBeenNthCalledWith(2, processed.stream);
    expect(processed.track.enabled).toBe(true);
    expect(statuses).toEqual(['loading', 'active']);
  });

  it('cancels a stale model load during rapid enable/disable toggles', async () => {
    const raw = createStream();
    const processed = createStream();
    const pipelineCreated = deferred<AINoiseSuppressionPipeline>();
    const pipeline = createPipeline(processed.stream, Promise.resolve());
    const firstController = new AbortController();
    const firstStatuses: NoiseSuppressionRuntimeStatus[] = [];
    const firstActivation = vi.fn().mockResolvedValue(undefined);

    const firstTransition = startNoiseSuppressionTransition({
      inputStream: raw.stream,
      enabled: true,
      signal: firstController.signal,
      activateStream: firstActivation,
      setStatus: (status) => firstStatuses.push(status),
      createPipeline: () => pipelineCreated.promise,
    });
    await vi.waitFor(() => expect(firstStatuses).toEqual(['loading']));

    firstController.abort();
    const secondStatuses: NoiseSuppressionRuntimeStatus[] = [];
    const secondActivation = vi.fn().mockResolvedValue(undefined);
    const secondTransition = await startNoiseSuppressionTransition({
      inputStream: raw.stream,
      enabled: false,
      signal: new AbortController().signal,
      activateStream: secondActivation,
      setStatus: (status) => secondStatuses.push(status),
    });
    pipelineCreated.resolve(pipeline);

    expect(await firstTransition).toBeNull();
    expect(secondTransition?.analysisStream).toBe(raw.stream);
    expect(secondStatuses).toEqual(['disabled']);
    expect(firstStatuses).toEqual(['loading']);
    expect(firstActivation).toHaveBeenCalledTimes(1);
    expect(secondActivation).toHaveBeenCalledTimes(1);
    expect(pipeline.dispose).toHaveBeenCalledOnce();
  });

  it('uses native noise suppression when DTLN initialization fails', async () => {
    const raw = createStream();
    const statuses: NoiseSuppressionRuntimeStatus[] = [];
    const activateStream = vi.fn().mockResolvedValue(undefined);

    const result = await startNoiseSuppressionTransition({
      inputStream: raw.stream,
      enabled: true,
      signal: new AbortController().signal,
      activateStream,
      setStatus: (status) => statuses.push(status),
      createPipeline: vi.fn().mockRejectedValue(new Error('model unavailable')),
    });

    expect(raw.track.applyConstraints).toHaveBeenCalledWith({ noiseSuppression: true });
    expect(activateStream).toHaveBeenLastCalledWith(raw.stream);
    expect(result).toEqual({ analysisStream: raw.stream, pipeline: null });
    expect(statuses).toEqual(['loading', 'fallback']);
  });

  it('rejects browsers that ignore the required 16 kHz AudioContext rate', async () => {
    const originalAudioContext = window.AudioContext;
    const close = vi.fn().mockResolvedValue(undefined);
    class WrongSampleRateAudioContext {
      sampleRate = 48_000;
      state: AudioContextState = 'running';
      resume = vi.fn().mockResolvedValue(undefined);
      close = close;
    }
    window.AudioContext = WrongSampleRateAudioContext as unknown as typeof AudioContext;
    vi.stubGlobal('AudioWorkletNode', class {});

    try {
      await expect(createAINoiseSuppressionPipeline(createStream().stream)).rejects.toThrow(
        `DTLN requires a ${DTLN_SAMPLE_RATE} Hz AudioContext; received 48000 Hz`,
      );
      expect(close).toHaveBeenCalledOnce();
    } finally {
      window.AudioContext = originalAudioContext;
    }
  });
});
