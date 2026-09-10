package chat.haven.android.voice

import org.junit.Assert.assertEquals
import org.junit.Test
import kotlin.math.sin

class RealFftTest {
    @Test
    fun inverseRestoresInput() {
        val input = FloatArray(512) { sin(it * 0.07).toFloat() }
        val fft = RealFft(512)
        val restored = fft.inverse(fft.forward(input))
        input.indices.forEach { assertEquals(input[it], restored[it], 0.0001f) }
    }
}
