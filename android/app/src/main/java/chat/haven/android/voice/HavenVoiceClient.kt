package chat.haven.android.voice

import android.content.Context
import chat.haven.android.BuildConfig
import chat.haven.android.data.RtcToken
import io.livekit.android.AudioOptions
import io.livekit.android.LiveKit
import io.livekit.android.LiveKitOverrides
import io.livekit.android.audio.AudioProcessorOptions
import io.livekit.android.events.RoomEvent
import io.livekit.android.events.collect
import io.livekit.android.room.Room
import io.livekit.android.room.participant.Participant
import io.livekit.android.room.track.RemoteVideoTrack
import io.livekit.android.room.track.Track
import io.livekit.android.room.track.TrackPublication
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.HttpUrl.Companion.toHttpUrl

data class VoiceCallParticipant(
    val identity: String,
    val name: String,
    val isLocal: Boolean,
    val isSpeaking: Boolean,
    val isMuted: Boolean,
    val isScreenSharing: Boolean,
)

data class VoiceScreenShare(
    val participantIdentity: String,
    val participantName: String,
    val room: Room,
    val track: RemoteVideoTrack,
)

data class VoiceRoomSnapshot(
    val participants: List<VoiceCallParticipant> = emptyList(),
    val screenShares: List<VoiceScreenShare> = emptyList(),
)

class HavenVoiceClient(context: Context) {
    private val dtln = DtlnAudioProcessor(context.applicationContext)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val mutableSnapshot = MutableStateFlow(VoiceRoomSnapshot())
    private var room: Room? = null
    private var eventJob: Job? = null

    val snapshot: StateFlow<VoiceRoomSnapshot> = mutableSnapshot.asStateFlow()

    val noiseSuppressionReady: Boolean get() = dtln.isEnabled()

    suspend fun join(credentials: RtcToken) {
        leave()
        val nextRoom = LiveKit.create(
            appContext = dtln.context,
            overrides = LiveKitOverrides(
                audioOptions = AudioOptions(
                    audioProcessorOptions = AudioProcessorOptions(
                        capturePostProcessor = dtln,
                    ),
                ),
            ),
        )
        room = nextRoom
        eventJob = scope.launch {
            nextRoom.events.collect { event ->
                if (room !== nextRoom) return@collect
                when (event) {
                    is RoomEvent.ParticipantConnected,
                    is RoomEvent.ParticipantDisconnected,
                    is RoomEvent.ParticipantNameChanged,
                    is RoomEvent.ParticipantStateChanged,
                    is RoomEvent.TrackPublished,
                    is RoomEvent.TrackUnpublished,
                    is RoomEvent.TrackSubscribed,
                    is RoomEvent.TrackUnsubscribed,
                    is RoomEvent.TrackMuted,
                    is RoomEvent.TrackUnmuted,
                    is RoomEvent.ActiveSpeakersChanged,
                    is RoomEvent.Connected,
                    is RoomEvent.Reconnected,
                    -> syncRoom(nextRoom)
                    else -> Unit
                }
            }
        }
        try {
            nextRoom.connect(normalizeRtcUrl(credentials.url), credentials.token)
            nextRoom.localParticipant.setMicrophoneEnabled(true)
            syncRoom(nextRoom)
        } catch (error: Throwable) {
            leave()
            throw error
        }
    }

    fun setMuted(muted: Boolean) {
        room?.setMicrophoneMute(muted)
    }

    fun setNoiseSuppression(enabled: Boolean) {
        dtln.enabled = enabled
        room?.audioProcessorIsEnabled = enabled && dtln.isReady
    }

    fun leave() {
        eventJob?.cancel()
        eventJob = null
        room?.disconnect()
        room?.release()
        room = null
        mutableSnapshot.value = VoiceRoomSnapshot()
    }

    fun close() {
        leave()
        scope.cancel()
    }

    private fun syncRoom(currentRoom: Room) {
        if (room !== currentRoom) return
        val allParticipants = listOf<Participant>(currentRoom.localParticipant) +
            currentRoom.remoteParticipants.values
        val participants = allParticipants.map { participant ->
            val identity = participant.identity?.value.orEmpty()
            VoiceCallParticipant(
                identity = identity,
                name = participant.name?.takeIf(String::isNotBlank) ?: identity.take(12),
                isLocal = participant === currentRoom.localParticipant,
                isSpeaking = participant.isSpeaking,
                isMuted = !participant.isMicrophoneEnabled,
                isScreenSharing = participant.screenSharePublication()?.let { !it.muted } == true,
            )
        }.sortedWith(compareByDescending<VoiceCallParticipant> { it.isLocal }.thenBy { it.name.lowercase() })

        val screenShares = currentRoom.remoteParticipants.values.mapNotNull { participant ->
            val publication = participant.screenSharePublication() ?: return@mapNotNull null
            if (publication.muted) return@mapNotNull null
            val track = publication.track as? RemoteVideoTrack ?: return@mapNotNull null
            val identity = participant.identity?.value.orEmpty()
            VoiceScreenShare(
                participantIdentity = identity,
                participantName = participant.name?.takeIf(String::isNotBlank) ?: identity.take(12),
                room = currentRoom,
                track = track,
            )
        }
        mutableSnapshot.value = VoiceRoomSnapshot(participants, screenShares)
    }
}

private fun Participant.screenSharePublication(): TrackPublication? =
    trackPublications.values.firstOrNull { it.source == Track.Source.SCREEN_SHARE }

internal fun normalizeRtcUrl(value: String, baseUrl: String = BuildConfig.HAVEN_API_URL): String {
    val trimmed = value.trim()
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://") ||
        trimmed.startsWith("ws://") || trimmed.startsWith("wss://")
    ) {
        return trimmed
    }
    return baseUrl.trimEnd('/').toHttpUrl().resolve(trimmed.ifBlank { "/" })?.toString()
        ?: error("URL do servidor de voz inválida")
}
