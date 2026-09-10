package chat.haven.android.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class User(
    val id: String,
    val username: String,
    @SerialName("avatar_url") val avatarUrl: String? = null,
    @SerialName("is_admin") val isAdmin: Boolean = false,
)

data class UserPresence(
    val userId: String,
    val username: String,
    val status: String,
)

@Serializable
data class VoiceChannelUser(
    @SerialName("channel_id") val channelId: String,
    @SerialName("user_id") val userId: String,
    val username: String,
    @SerialName("is_speaking") val isSpeaking: Boolean = false,
    @SerialName("is_muted") val isMuted: Boolean = false,
    @SerialName("is_deafened") val isDeafened: Boolean = false,
    @SerialName("is_camera_on") val isCameraOn: Boolean = false,
    @SerialName("is_screen_sharing") val isScreenSharing: Boolean = false,
)

@Serializable
data class TokenPair(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
)

@Serializable
data class AuthResponse(val user: User, val tokens: TokenPair)

@Serializable
data class Community(
    val id: String,
    val name: String,
    val description: String? = null,
    @SerialName("icon_url") val iconUrl: String? = null,
    @SerialName("is_private") val isPrivate: Boolean = false,
    val channels: List<Channel> = emptyList(),
)

@Serializable
data class Channel(
    val id: String,
    @SerialName("community_id") val communityId: String,
    val name: String,
    val type: String,
    val position: Int = 0,
)

@Serializable
data class RtcToken(
    val token: String,
    val url: String,
    @SerialName("room_name") val roomName: String,
)

@Serializable
data class ApiError(val error: String? = null, val message: String? = null)
