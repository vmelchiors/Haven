package chat.haven.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HavenPresenceClientTest {
    @Test
    fun parsesPresenceUpdate() {
        val presence = parsePresenceUpdate(
            """{"type":"presence_update","payload":{"user_id":"u1","username":"Alice","status":"online"}}""",
        )

        assertEquals(UserPresence("u1", "Alice", "online"), presence)
    }

    @Test
    fun ignoresOtherOrMalformedMessages() {
        assertNull(parsePresenceUpdate("""{"type":"ping","payload":{}}"""))
        assertNull(parsePresenceUpdate("not-json"))
    }

    @Test
    fun parsesVoiceSnapshotAndStateEvents() {
        val snapshot = parseServerEvent(
            """{"type":"voice_snapshot","payload":[{"channel_id":"c1","user_id":"u1","username":"Alice","is_muted":true,"is_screen_sharing":true}]}""",
        ) as HavenServerEvent.VoiceSnapshot
        assertEquals(1, snapshot.users.size)
        assertTrue(snapshot.users.single().isMuted)
        assertTrue(snapshot.users.single().isScreenSharing)

        val joined = parseServerEvent(
            """{"type":"user_joined_voice","payload":{"channel_id":"c1","user_id":"u2","username":"Bob"}}""",
        ) as HavenServerEvent.VoiceJoined
        assertEquals("Bob", joined.user.username)

        val left = parseServerEvent(
            """{"type":"user_left_voice","channel_id":"c1","payload":{"channel_id":"c1","user_id":"u2"}}""",
        ) as HavenServerEvent.VoiceLeft
        assertEquals("c1", left.channelId)
        assertEquals("u2", left.userId)
    }
}
