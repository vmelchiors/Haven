package chat.haven.android.voice

import android.content.Context
import io.livekit.android.audio.AudioProcessorInterface
import org.tensorflow.lite.Interpreter
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * Native Android port of the same two-stage, quantized DTLN pipeline used by
 * the desktop client. LiveKit supplies 10 ms PCM frames; they are converted to
 * 16 kHz, processed in 512-sample windows with a 128-sample hop, then returned
 * to WebRTC. If model initialization fails, isEnabled() becomes false and
 * LiveKit/WebRTC keeps its native audio processing path.
 */
class DtlnAudioProcessor(val context: Context) : AudioProcessorInterface {
    @Volatile var enabled: Boolean = true
    @Volatile var isReady: Boolean = false
        private set

    private var sampleRate = 0
    private var channels = 1
    private var engine: DtlnEngine? = null
    private val input16k = ArrayDeque<Float>()
    private val output16k = ArrayDeque<Float>()
    private var previousOutput16k = 0f

    override fun isEnabled(): Boolean = enabled && isReady && sampleRate % TARGET_SAMPLE_RATE == 0
    override fun getName(): String = "Haven DTLN"

    @Synchronized
    override fun initializeAudioProcessing(sampleRateHz: Int, numChannels: Int) {
        sampleRate = sampleRateHz
        channels = numChannels.coerceAtLeast(1)
        input16k.clear()
        output16k.clear()
        previousOutput16k = 0f
        repeat(HOP_SIZE) { output16k.addLast(0f) }

        if (engine == null) {
            engine = runCatching { DtlnEngine(context) }.getOrNull()
        }
        isReady = engine != null && sampleRateHz % TARGET_SAMPLE_RATE == 0
    }

    @Synchronized
    override fun resetAudioProcessing(newRate: Int) {
        initializeAudioProcessing(newRate, channels)
    }

    @Synchronized
    override fun processAudio(numBands: Int, numFrames: Int, buffer: ByteBuffer) {
        val currentEngine = engine ?: return
        if (!isEnabled() || numFrames <= 0) return

        val ratio = sampleRate / TARGET_SAMPLE_RATE
        if (ratio <= 0 || sampleRate % TARGET_SAMPLE_RATE != 0) return

        // WebRTC's external audio processor supplies normalized PCM floats, not
        // 16-bit shorts. Reading this buffer with getShort() corrupts the IEEE-754
        // samples and produces loud bursts/static as soon as capture starts.
        val pcm = buffer.duplicate().order(ByteOrder.nativeOrder()).apply { clear() }.asFloatBuffer()
        val frameCount = minOf(numFrames, pcm.capacity() / channels)
        val lowRateCount = frameCount / ratio
        for (lowIndex in 0 until lowRateCount) {
            var sum = 0f
            var count = 0
            for (sourceOffset in 0 until ratio) {
                val frame = lowIndex * ratio + sourceOffset
                if (frame >= numFrames) break
                var channelSum = 0f
                for (channel in 0 until channels) {
                    val sampleIndex = frame * channels + channel
                    if (sampleIndex < pcm.capacity()) {
                        channelSum += pcm.get(sampleIndex)
                    }
                }
                sum += channelSum / channels
                count++
            }
            input16k.addLast(if (count == 0) 0f else sum / count)
        }

        while (input16k.size >= HOP_SIZE) {
            val block = FloatArray(HOP_SIZE) { input16k.removeFirst() }
            currentEngine.processHop(block).forEach(output16k::addLast)
        }

        val processed = FloatArray(lowRateCount) {
            if (output16k.isNotEmpty()) output16k.removeFirst() else 0f
        }
        var previous = previousOutput16k
        processed.forEachIndexed { lowIndex, currentSample ->
            val current = currentSample.coerceIn(-1f, 1f)
            for (phase in 0 until ratio) {
                val frame = lowIndex * ratio + phase
                if (frame >= frameCount) break
                val fraction = (phase + 1f) / ratio
                val value = previous + (current - previous) * fraction
                for (channel in 0 until channels) {
                    val sampleIndex = frame * channels + channel
                    if (sampleIndex < pcm.capacity()) pcm.put(sampleIndex, value)
                }
            }
            previous = current
        }
        previousOutput16k = previous
    }

    companion object {
        const val TARGET_SAMPLE_RATE = 16_000
        const val HOP_SIZE = 128
    }
}

internal class DtlnEngine(context: Context) {
    private val first = loadInterpreter(context, "model_quant_1.tflite")
    private val second = loadInterpreter(context, "model_quant_2.tflite")
    private val fft = RealFft(WINDOW_SIZE)
    private val inputWindow = FloatArray(WINDOW_SIZE)
    private val outputWindow = FloatArray(WINDOW_SIZE)
    private val state1 = FloatArray(first.getInputTensor(1).numBytes() / Float.SIZE_BYTES)
    private val state2 = FloatArray(second.getInputTensor(1).numBytes() / Float.SIZE_BYTES)

    init {
        require(first.getInputTensor(0).numBytes() / Float.SIZE_BYTES == SPECTRUM_SIZE)
        require(second.getInputTensor(0).numBytes() / Float.SIZE_BYTES == WINDOW_SIZE)
    }

    fun processHop(samples: FloatArray): FloatArray {
        require(samples.size == DtlnAudioProcessor.HOP_SIZE)
        inputWindow.copyInto(inputWindow, 0, DtlnAudioProcessor.HOP_SIZE)
        samples.copyInto(inputWindow, WINDOW_SIZE - DtlnAudioProcessor.HOP_SIZE)

        val spectrum = fft.forward(inputWindow)
        val magnitude = FloatArray(SPECTRUM_SIZE) { index ->
            val real = spectrum[index * 2]
            val imaginary = spectrum[index * 2 + 1]
            kotlin.math.sqrt(real * real + imaginary * imaginary)
        }
        val mask = FloatArray(SPECTRUM_SIZE)
        runModel(first, magnitude, state1, mask, state1)
        for (index in 0 until SPECTRUM_SIZE) {
            spectrum[index * 2] *= mask[index]
            spectrum[index * 2 + 1] *= mask[index]
        }

        val estimated = fft.inverse(spectrum)
        val cleanBlock = FloatArray(WINDOW_SIZE)
        runModel(second, estimated, state2, cleanBlock, state2)

        outputWindow.copyInto(outputWindow, 0, DtlnAudioProcessor.HOP_SIZE)
        outputWindow.fill(0f, WINDOW_SIZE - DtlnAudioProcessor.HOP_SIZE)
        for (index in outputWindow.indices) outputWindow[index] += cleanBlock[index]
        return outputWindow.copyOfRange(0, DtlnAudioProcessor.HOP_SIZE)
    }

    private fun runModel(
        interpreter: Interpreter,
        signal: FloatArray,
        state: FloatArray,
        signalOutput: FloatArray,
        stateOutput: FloatArray,
    ) {
        val inputSignal = floatBuffer(signal)
        val inputState = floatBuffer(state)
        val outputSignal = ByteBuffer.allocateDirect(signalOutput.size * Float.SIZE_BYTES).order(ByteOrder.nativeOrder())
        val outputState = ByteBuffer.allocateDirect(stateOutput.size * Float.SIZE_BYTES).order(ByteOrder.nativeOrder())
        interpreter.runForMultipleInputsOutputs(
            arrayOf(inputSignal, inputState),
            mutableMapOf<Int, Any>(0 to outputSignal, 1 to outputState),
        )
        outputSignal.rewind()
        outputState.rewind()
        outputSignal.asFloatBuffer().get(signalOutput)
        outputState.asFloatBuffer().get(stateOutput)
    }

    companion object {
        private const val WINDOW_SIZE = 512
        private const val SPECTRUM_SIZE = 257

        private fun loadInterpreter(context: Context, asset: String): Interpreter {
            val bytes = context.assets.open(asset).use { it.readBytes() }
            val model = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder())
            model.put(bytes).rewind()
            return Interpreter(model, Interpreter.Options().setNumThreads(2))
        }

        private fun floatBuffer(values: FloatArray): ByteBuffer =
            ByteBuffer.allocateDirect(values.size * Float.SIZE_BYTES)
                .order(ByteOrder.nativeOrder())
                .apply {
                    asFloatBuffer().put(values)
                    rewind()
                }
    }
}

/** In-place radix-2 FFT with the real half-spectrum format DTLN expects. */
internal class RealFft(private val size: Int) {
    init { require(size > 0 && size and (size - 1) == 0) }

    fun forward(input: FloatArray): FloatArray {
        val real = input.copyOf(size)
        val imaginary = FloatArray(size)
        transform(real, imaginary, inverse = false)
        return FloatArray((size / 2 + 1) * 2).also { output ->
            for (index in 0..size / 2) {
                output[index * 2] = real[index]
                output[index * 2 + 1] = imaginary[index]
            }
        }
    }

    fun inverse(halfSpectrum: FloatArray): FloatArray {
        val real = FloatArray(size)
        val imaginary = FloatArray(size)
        for (index in 0..size / 2) {
            real[index] = halfSpectrum[index * 2]
            imaginary[index] = halfSpectrum[index * 2 + 1]
            if (index in 1 until size / 2) {
                real[size - index] = real[index]
                imaginary[size - index] = -imaginary[index]
            }
        }
        transform(real, imaginary, inverse = true)
        return real
    }

    private fun transform(real: FloatArray, imaginary: FloatArray, inverse: Boolean) {
        var target = 0
        for (source in 1 until size) {
            var bit = size shr 1
            while (target and bit != 0) {
                target = target xor bit
                bit = bit shr 1
            }
            target = target xor bit
            if (source < target) {
                val r = real[source]; real[source] = real[target]; real[target] = r
                val i = imaginary[source]; imaginary[source] = imaginary[target]; imaginary[target] = i
            }
        }

        var length = 2
        while (length <= size) {
            val angle = (if (inverse) 2.0 else -2.0) * PI / length
            val stepReal = cos(angle).toFloat()
            val stepImaginary = sin(angle).toFloat()
            for (start in 0 until size step length) {
                var twiddleReal = 1f
                var twiddleImaginary = 0f
                for (offset in 0 until length / 2) {
                    val even = start + offset
                    val odd = even + length / 2
                    val oddReal = real[odd] * twiddleReal - imaginary[odd] * twiddleImaginary
                    val oddImaginary = real[odd] * twiddleImaginary + imaginary[odd] * twiddleReal
                    real[odd] = real[even] - oddReal
                    imaginary[odd] = imaginary[even] - oddImaginary
                    real[even] += oddReal
                    imaginary[even] += oddImaginary
                    val nextReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary
                    twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal
                    twiddleReal = nextReal
                }
            }
            length = length shl 1
        }
        if (inverse) {
            for (index in 0 until size) {
                real[index] /= size
                imaginary[index] /= size
            }
        }
    }
}
