package chat.haven.android.voice

import org.junit.Assert.assertEquals
import org.junit.Test

class HavenVoiceClientTest {
    @Test
    fun resolvesBrowserRelativeLiveKitRootAgainstPublicOrigin() {
        assertEquals(
            "https://haven.vmelchior.tech/",
            normalizeRtcUrl("/", "https://haven.vmelchior.tech"),
        )
    }

    @Test
    fun preservesAbsoluteLiveKitUrl() {
        assertEquals(
            "wss://voice.example.com",
            normalizeRtcUrl("wss://voice.example.com", "https://haven.vmelchior.tech"),
        )
    }
}
