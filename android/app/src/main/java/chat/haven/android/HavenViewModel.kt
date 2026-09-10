package chat.haven.android

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import chat.haven.android.data.Channel
import chat.haven.android.data.Community
import chat.haven.android.data.AuthResponse
import chat.haven.android.data.HavenApiException
import chat.haven.android.data.HavenPresenceClient
import chat.haven.android.data.HavenRepository
import chat.haven.android.data.SessionStore
import chat.haven.android.data.User
import chat.haven.android.data.UserPresence
import chat.haven.android.data.VoiceChannelUser
import chat.haven.android.voice.HavenVoiceClient
import chat.haven.android.voice.VoiceCallParticipant
import chat.haven.android.voice.VoiceScreenShare
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class HavenUiState(
    val user: User? = null,
    val communities: List<Community> = emptyList(),
    val channels: List<Channel> = emptyList(),
    val members: List<User> = emptyList(),
    val presence: Map<String, UserPresence> = emptyMap(),
    val voiceChannelMembers: Map<String, List<VoiceChannelUser>> = emptyMap(),
    val callParticipants: List<VoiceCallParticipant> = emptyList(),
    val screenShares: List<VoiceScreenShare> = emptyList(),
    val selectedCommunity: Community? = null,
    val activeVoiceChannel: Channel? = null,
    val isRestoringSession: Boolean = true,
    val isLoading: Boolean = false,
    val isMuted: Boolean = false,
    val noiseSuppressionEnabled: Boolean = true,
    val error: String? = null,
)

class HavenViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = HavenRepository()
    private val sessionStore = SessionStore(application)
    private val voice = HavenVoiceClient(application)
    private val mutableState = MutableStateFlow(HavenUiState())
    val state: StateFlow<HavenUiState> = mutableState.asStateFlow()
    private val presenceClient = HavenPresenceClient(
        onConnected = {
            mutableState.update { it.copy(presence = emptyMap(), voiceChannelMembers = emptyMap()) }
        },
        onPresence = { presence ->
            mutableState.update { state ->
                state.copy(presence = state.presence + (presence.userId to presence))
            }
        },
        onVoiceSnapshot = { channelId, users ->
            mutableState.update { state ->
                val grouped = users.groupBy(VoiceChannelUser::channelId)
                state.copy(
                    voiceChannelMembers = if (channelId == null) grouped
                    else if (users.isEmpty()) state.voiceChannelMembers - channelId
                    else state.voiceChannelMembers + (channelId to users),
                )
            }
        },
        onVoiceJoined = ::upsertVoiceMember,
        onVoiceLeft = ::removeVoiceMember,
        onVoiceState = ::upsertVoiceMember,
    )

    init {
        viewModelScope.launch {
            voice.snapshot.collect { snapshot ->
                mutableState.update {
                    it.copy(
                        callParticipants = snapshot.participants,
                        screenShares = snapshot.screenShares,
                    )
                }
            }
        }
        viewModelScope.launch { restoreSession() }
    }

    fun login(username: String, password: String, keepConnected: Boolean) = launchTask {
        val auth = repository.login(username.trim(), password)
        establishSession(auth, persist = keepConnected)
    }

    fun selectCommunity(community: Community) = launchTask {
        loadCommunity(community)
    }

    private suspend fun loadCommunity(community: Community) {
        mutableState.update { it.copy(selectedCommunity = community, channels = emptyList(), members = emptyList()) }
        val channels = repository.channels(community.id).sortedBy(Channel::position)
        val members = repository.members(community.id)
        mutableState.update { state ->
            if (state.selectedCommunity?.id == community.id) state.copy(channels = channels, members = members)
            else state
        }
    }

    fun joinVoice(channel: Channel) = launchTask {
        if (mutableState.value.activeVoiceChannel?.id == channel.id) return@launchTask
        mutableState.value.activeVoiceChannel?.let { previous ->
            presenceClient.sendVoiceLeave(previous.id)
            mutableState.update { state ->
                state.copy(
                    activeVoiceChannel = null,
                    voiceChannelMembers = state.voiceChannelMembers.removeVoiceMember(previous.id, state.user?.id),
                )
            }
        }
        val rtc = repository.rtcToken(channel.id)
        voice.join(rtc)
        voice.setNoiseSuppression(mutableState.value.noiseSuppressionEnabled)
        voice.setMuted(mutableState.value.isMuted)
        mutableState.update { it.copy(activeVoiceChannel = channel) }
        currentVoiceUser(channel.id)?.let { user ->
            upsertVoiceMember(user)
            presenceClient.sendVoiceJoin(user)
        }
    }

    fun leaveVoice() {
        val state = mutableState.value
        state.activeVoiceChannel?.let { channel ->
            presenceClient.sendVoiceLeave(channel.id)
            removeVoiceMember(channel.id, state.user?.id.orEmpty())
        }
        voice.leave()
        mutableState.update { it.copy(activeVoiceChannel = null, callParticipants = emptyList(), screenShares = emptyList()) }
    }

    fun toggleMute() {
        val muted = !mutableState.value.isMuted
        voice.setMuted(muted)
        mutableState.update { it.copy(isMuted = muted) }
        val channelId = mutableState.value.activeVoiceChannel?.id
        if (channelId != null) {
            currentVoiceUser(channelId)?.let { user ->
                upsertVoiceMember(user)
                presenceClient.sendVoiceState(user)
            }
        }
    }

    fun toggleNoiseSuppression() {
        val enabled = !mutableState.value.noiseSuppressionEnabled
        voice.setNoiseSuppression(enabled)
        mutableState.update { it.copy(noiseSuppressionEnabled = enabled) }
    }

    fun dismissError() = mutableState.update { it.copy(error = null) }

    fun logout() {
        leaveVoice()
        presenceClient.disconnect()
        repository.clearSession()
        sessionStore.clear()
        mutableState.value = HavenUiState(isRestoringSession = false)
    }

    private fun launchTask(block: suspend () -> Unit) {
        viewModelScope.launch {
            mutableState.update { it.copy(isLoading = true, error = null) }
            runCatching { block() }
                .onFailure { error ->
                    mutableState.update { it.copy(error = error.message ?: "Não foi possível concluir a operação") }
                }
            mutableState.update { it.copy(isLoading = false) }
        }
    }

    private suspend fun restoreSession() {
        val saved = sessionStore.load()
        if (saved == null) {
            mutableState.update { it.copy(isRestoringSession = false) }
            return
        }
        mutableState.update { it.copy(isLoading = true) }
        val refreshResult = runCatching { repository.refresh(saved.tokens.refreshToken) }
        val refreshed = refreshResult.getOrNull()
        if (refreshed != null) {
            runCatching { establishSession(refreshed, persist = true) }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(error = error.message ?: "Não foi possível carregar sua conta")
                    }
                }
        } else {
            repository.clearSession()
            if (refreshResult.exceptionOrNull() is HavenApiException) sessionStore.clear()
        }
        mutableState.update { it.copy(isLoading = false, isRestoringSession = false) }
    }

    private suspend fun establishSession(auth: AuthResponse, persist: Boolean) {
        repository.useSession(auth.tokens)
        if (persist) sessionStore.save(auth) else sessionStore.clear()
        mutableState.update { it.copy(user = auth.user, isRestoringSession = false) }
        presenceClient.connect(auth.tokens.accessToken)
        val communities = repository.communities()
        mutableState.update { it.copy(communities = communities) }
        communities.firstOrNull()?.let { loadCommunity(it) }
    }

    override fun onCleared() {
        voice.close()
        presenceClient.close()
        super.onCleared()
    }

    private fun currentVoiceUser(channelId: String): VoiceChannelUser? {
        val state = mutableState.value
        val user = state.user ?: return null
        return VoiceChannelUser(
            channelId = channelId,
            userId = user.id,
            username = user.username,
            isMuted = state.isMuted,
        )
    }

    private fun upsertVoiceMember(user: VoiceChannelUser) {
        mutableState.update { state ->
            val current = state.voiceChannelMembers[user.channelId].orEmpty()
            state.copy(
                voiceChannelMembers = state.voiceChannelMembers +
                    (user.channelId to (current.filterNot { it.userId == user.userId } + user)),
            )
        }
    }

    private fun removeVoiceMember(channelId: String, userId: String) {
        mutableState.update { state ->
            state.copy(voiceChannelMembers = state.voiceChannelMembers.removeVoiceMember(channelId, userId))
        }
    }
}

private fun Map<String, List<VoiceChannelUser>>.removeVoiceMember(
    channelId: String,
    userId: String?,
): Map<String, List<VoiceChannelUser>> {
    if (userId.isNullOrBlank()) return this
    val remaining = this[channelId].orEmpty().filterNot { it.userId == userId }
    return if (remaining.isEmpty()) this - channelId else this + (channelId to remaining)
}
