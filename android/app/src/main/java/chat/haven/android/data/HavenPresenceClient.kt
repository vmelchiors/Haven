package chat.haven.android.data

import chat.haven.android.BuildConfig
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

class HavenPresenceClient(
    private val onConnected: () -> Unit,
    private val onPresence: (UserPresence) -> Unit,
    private val onVoiceSnapshot: (channelId: String?, users: List<VoiceChannelUser>) -> Unit = { _, _ -> },
    private val onVoiceJoined: (VoiceChannelUser) -> Unit = {},
    private val onVoiceLeft: (channelId: String, userId: String) -> Unit = { _, _ -> },
    private val onVoiceState: (VoiceChannelUser) -> Unit = {},
    private val baseUrl: String = BuildConfig.HAVEN_API_URL,
) {
    private val client = OkHttpClient.Builder()
        .pingInterval(25, TimeUnit.SECONDS)
        .build()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @Volatile
    private var stopped = true
    private var accessToken: String? = null
    private var socket: WebSocket? = null
    private var reconnectJob: Job? = null

    @Synchronized
    fun connect(token: String) {
        disconnect()
        stopped = false
        accessToken = token
        openSocket()
    }

    @Synchronized
    fun disconnect() {
        stopped = true
        reconnectJob?.cancel()
        reconnectJob = null
        socket?.cancel()
        socket = null
        accessToken = null
    }

    fun close() {
        disconnect()
        scope.cancel()
        client.dispatcher.executorService.shutdown()
    }

    fun sendVoiceJoin(user: VoiceChannelUser) = sendVoiceEvent("user_joined_voice", user)

    fun sendVoiceLeave(channelId: String) {
        send(
            type = "user_left_voice",
            channelId = channelId,
            payload = buildJsonObject { put("channel_id", channelId) },
        )
    }

    fun sendVoiceState(user: VoiceChannelUser) = sendVoiceEvent("voice_state_update", user)

    @Synchronized
    private fun openSocket() {
        val token = accessToken ?: return
        if (stopped || socket != null) return

        val httpUrl = baseUrl.trimEnd('/').toHttpUrl()
        // OkHttp accepts http(s) URLs here and performs the WebSocket upgrade itself.
        val wsUrl = httpUrl.newBuilder()
            .addPathSegment("ws")
            .addQueryParameter("token", token)
            .build()
        val request = Request.Builder().url(wsUrl).build()

        socket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                if (webSocket === socket) onConnected()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                if (webSocket !== socket) return
                text.lineSequence().filter(String::isNotBlank).forEach(::handleMessage)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                handleDisconnect(webSocket)
            }

            override fun onFailure(webSocket: WebSocket, error: Throwable, response: Response?) {
                handleDisconnect(webSocket)
            }
        })
    }

    private fun handleMessage(message: String) {
        when (val event = parseServerEvent(message)) {
            is HavenServerEvent.Presence -> onPresence(event.value)
            is HavenServerEvent.VoiceSnapshot -> onVoiceSnapshot(event.channelId, event.users)
            is HavenServerEvent.VoiceJoined -> onVoiceJoined(event.user)
            is HavenServerEvent.VoiceLeft -> onVoiceLeft(event.channelId, event.userId)
            is HavenServerEvent.VoiceState -> onVoiceState(event.user)
            null -> Unit
        }
    }

    private fun sendVoiceEvent(type: String, user: VoiceChannelUser) {
        send(
            type = type,
            channelId = user.channelId,
            payload = user.toJson(),
        )
    }

    private fun send(type: String, channelId: String, payload: JsonObject) {
        val message = buildJsonObject {
            put("type", type)
            put("channel_id", channelId)
            put("payload", payload)
        }.toString()
        socket?.send(message)
    }

    @Synchronized
    private fun handleDisconnect(webSocket: WebSocket) {
        if (webSocket !== socket) return
        socket = null
        if (stopped) return
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            delay(3_000)
            openSocket()
        }
    }
}

private val presenceJson = Json { ignoreUnknownKeys = true }

internal sealed interface HavenServerEvent {
    data class Presence(val value: UserPresence) : HavenServerEvent
    data class VoiceSnapshot(val channelId: String?, val users: List<VoiceChannelUser>) : HavenServerEvent
    data class VoiceJoined(val user: VoiceChannelUser) : HavenServerEvent
    data class VoiceLeft(val channelId: String, val userId: String) : HavenServerEvent
    data class VoiceState(val user: VoiceChannelUser) : HavenServerEvent
}

internal fun parseServerEvent(message: String): HavenServerEvent? = runCatching {
    val envelope = presenceJson.parseToJsonElement(message).jsonObject
    val type = envelope["type"]?.jsonPrimitive?.contentOrNull ?: return@runCatching null
    when (type) {
        "presence_update" -> {
            val payload = envelope["payload"]?.jsonObject ?: return@runCatching null
            val userId = payload.string("user_id") ?: return@runCatching null
            HavenServerEvent.Presence(
                UserPresence(
                    userId = userId,
                    username = payload.string("username") ?: userId.take(8),
                    status = payload.string("status") ?: "offline",
                ),
            )
        }
        "voice_snapshot" -> {
            val payload = envelope["payload"] as? JsonArray ?: return@runCatching null
            HavenServerEvent.VoiceSnapshot(
                channelId = envelope.string("channel_id"),
                users = payload.mapNotNull { (it as? JsonObject)?.toVoiceUser() },
            )
        }
        "user_joined_voice" -> HavenServerEvent.VoiceJoined(
            envelope["payload"]?.jsonObject?.toVoiceUser() ?: return@runCatching null,
        )
        "user_left_voice" -> {
            val payload = envelope["payload"]?.jsonObject ?: return@runCatching null
            HavenServerEvent.VoiceLeft(
                channelId = payload.string("channel_id") ?: envelope.string("channel_id") ?: return@runCatching null,
                userId = payload.string("user_id") ?: return@runCatching null,
            )
        }
        "voice_state_update" -> HavenServerEvent.VoiceState(
            envelope["payload"]?.jsonObject?.toVoiceUser() ?: return@runCatching null,
        )
        else -> null
    }
}.getOrNull()

internal fun parsePresenceUpdate(message: String): UserPresence? =
    (parseServerEvent(message) as? HavenServerEvent.Presence)?.value

private fun JsonObject.toVoiceUser(): VoiceChannelUser? {
    val channelId = string("channel_id") ?: return null
    val userId = string("user_id") ?: return null
    return VoiceChannelUser(
        channelId = channelId,
        userId = userId,
        username = string("username") ?: userId.take(8),
        isSpeaking = boolean("is_speaking"),
        isMuted = boolean("is_muted"),
        isDeafened = boolean("is_deafened"),
        isCameraOn = boolean("is_camera_on"),
        isScreenSharing = boolean("is_screen_sharing"),
    )
}

private fun VoiceChannelUser.toJson() = buildJsonObject {
    put("channel_id", channelId)
    put("user_id", userId)
    put("username", username)
    put("is_speaking", isSpeaking)
    put("is_muted", isMuted)
    put("is_deafened", isDeafened)
    put("is_camera_on", isCameraOn)
    put("is_screen_sharing", isScreenSharing)
}

private fun JsonObject.string(key: String) = this[key]?.jsonPrimitive?.contentOrNull
private fun JsonObject.boolean(key: String) = this[key]?.jsonPrimitive?.booleanOrNull ?: false
