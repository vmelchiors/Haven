package chat.haven.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.FullscreenExit
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Headset
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.Tag
import androidx.compose.material.icons.filled.Tv
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.currentCompositeKeyHash
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import chat.haven.android.HavenUiState
import chat.haven.android.HavenViewModel
import chat.haven.android.data.Channel
import chat.haven.android.data.Community
import chat.haven.android.data.User
import chat.haven.android.data.VoiceChannelUser
import chat.haven.android.voice.VoiceCallParticipant
import chat.haven.android.voice.VoiceScreenShare
import io.livekit.android.renderer.TextureViewRenderer
import io.livekit.android.room.track.RemoteVideoTrack
import livekit.org.webrtc.RendererCommon

@Composable
fun HavenApp(viewModel: HavenViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    HavenTheme {
        Surface(modifier = Modifier.fillMaxSize().safeDrawingPadding(), color = HavenBackground) {
            if (state.isRestoringSession) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(Modifier.size(28.dp), strokeWidth = 2.dp)
                }
            } else if (state.user == null) {
                LoginScreen(state, viewModel::login)
            } else {
                HomeScreen(
                    state = state,
                    onCommunity = viewModel::selectCommunity,
                    onJoinVoice = viewModel::joinVoice,
                    onLeaveVoice = viewModel::leaveVoice,
                    onToggleMute = viewModel::toggleMute,
                    onToggleNoise = viewModel::toggleNoiseSuppression,
                    onLogout = viewModel::logout,
                )
            }
            state.error?.let {
                AlertDialog(
                    onDismissRequest = viewModel::dismissError,
                    confirmButton = { Button(onClick = viewModel::dismissError) { Text("Entendi") } },
                    title = { Text("Não foi possível conectar") },
                    text = { Text(it) },
                )
            }
        }
    }
}

@Composable
private fun LoginScreen(state: HavenUiState, onLogin: (String, String, Boolean) -> Unit) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var keepConnected by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            color = HavenSurface,
            border = BorderStroke(1.dp, HavenBorder),
        ) {
            Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                BrandMark()
                Spacer(Modifier.height(12.dp))
                Text("Haven", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                Text("Comunicação segura e minimalista", color = Color(0xFFA1A1AA), fontSize = 12.sp)
                Spacer(Modifier.height(24.dp))
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("Nome de usuário") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Senha") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(
                    Modifier.fillMaxWidth().clickable { keepConnected = !keepConnected },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Checkbox(checked = keepConnected, onCheckedChange = { keepConnected = it })
                    Text("Manter conectado", fontSize = 12.sp)
                }
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = { onLogin(username, password, keepConnected) },
                    enabled = !state.isLoading && username.isNotBlank() && password.isNotBlank(),
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                ) {
                    if (state.isLoading) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    else Text("Entrar")
                }
                Spacer(Modifier.height(14.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.GraphicEq, null, tint = HavenGreen, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("DTLN local • Zero-PII", color = Color(0xFF71717A), fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
private fun HomeScreen(
    state: HavenUiState,
    onCommunity: (Community) -> Unit,
    onJoinVoice: (Channel) -> Unit,
    onLeaveVoice: () -> Unit,
    onToggleMute: () -> Unit,
    onToggleNoise: () -> Unit,
    onLogout: () -> Unit,
) {
    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().background(HavenSurface).padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BrandMark(36)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text("Haven", fontWeight = FontWeight.Bold)
                Text(state.user?.username.orEmpty(), color = Color(0xFFA1A1AA), fontSize = 11.sp)
            }
            IconButton(onClick = onLogout) { Icon(Icons.AutoMirrored.Filled.Logout, "Sair") }
        }

        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            state.communities.forEach { community ->
                CommunityBubble(community, community.id == state.selectedCommunity?.id) { onCommunity(community) }
            }
        }

        Column(Modifier.weight(1f).padding(horizontal = 16.dp)) {
            Text(
                state.selectedCommunity?.name ?: "Suas comunidades",
                fontWeight = FontWeight.SemiBold,
                fontSize = 18.sp,
            )
            state.selectedCommunity?.description?.takeIf(String::isNotBlank)?.let {
                Text(it, color = Color(0xFFA1A1AA), fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.height(12.dp))
            OnlineMembers(state)
            Spacer(Modifier.height(14.dp))
            state.activeVoiceChannel?.let {
                CallParticipants(state)
                Spacer(Modifier.height(12.dp))
            }
            if (state.isLoading) {
                Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
                }
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(state.channels, key = Channel::id) { channel ->
                        ChannelRow(
                            channel = channel,
                            active = state.activeVoiceChannel?.id == channel.id,
                            members = state.voiceChannelMembers[channel.id].orEmpty(),
                        ) {
                            if (channel.type == "VOICE") onJoinVoice(channel)
                        }
                    }
                }
            }
        }

        state.activeVoiceChannel?.let { channel ->
            VoiceDock(
                channel = channel,
                muted = state.isMuted,
                noiseEnabled = state.noiseSuppressionEnabled,
                onMute = onToggleMute,
                onNoise = onToggleNoise,
                onLeave = onLeaveVoice,
            )
        }
        }
        FloatingScreenShare(state)
    }
}

@Composable
private fun OnlineMembers(state: HavenUiState) {
    val currentUser = state.user
    val community = state.selectedCommunity
    val memberMap = linkedMapOf<String, User>()
    state.members.forEach { memberMap[it.id] = it }

    if (community?.isPrivate != true && currentUser != null) {
        memberMap[currentUser.id] = currentUser
    }
    if (community?.isPrivate != true && state.members.isEmpty()) {
        state.presence.values.forEach { presence ->
            memberMap.putIfAbsent(
                presence.userId,
                User(id = presence.userId, username = presence.username),
            )
        }
    }

    val online = memberMap.values.filter { member ->
        member.id == currentUser?.id || state.presence[member.id]?.status?.lowercase() in setOf("online", "idle", "busy")
    }.sortedBy { it.username.lowercase() }

    Column {
        Text(
            "Online — ${online.size}",
            color = Color(0xFFA1A1AA),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(7.dp))
        if (online.isEmpty()) {
            Text("Ninguém online nesta comunidade", color = Color(0xFF71717A), fontSize = 11.sp)
        } else {
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                online.forEach { member -> OnlineMember(member) }
            }
        }
    }
}

@Composable
private fun OnlineMember(member: User) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(52.dp)) {
        Box(Modifier.size(34.dp)) {
            Box(
                Modifier.fillMaxSize().clip(CircleShape).background(HavenRaised),
                contentAlignment = Alignment.Center,
            ) {
                Text(member.username.take(2).uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
            Box(
                Modifier.align(Alignment.BottomEnd).size(10.dp).clip(CircleShape)
                    .background(HavenGreen).border(2.dp, HavenBackground, CircleShape),
            )
        }
        Spacer(Modifier.height(3.dp))
        Text(member.username, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 9.sp)
    }
}

@Composable
private fun CommunityBubble(community: Community, selected: Boolean, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(58.dp)) {
        Box(
            Modifier.size(46.dp).clip(if (selected) RoundedCornerShape(14.dp) else CircleShape)
                .background(if (selected) HavenAccent else HavenRaised).clickable(onClick = onClick),
            contentAlignment = Alignment.Center,
        ) {
            Text(community.name.take(2).uppercase(), fontWeight = FontWeight.Bold, fontSize = 12.sp)
        }
        Text(community.name, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 9.sp)
    }
}

@Composable
private fun ChannelRow(
    channel: Channel,
    active: Boolean,
    members: List<VoiceChannelUser>,
    onClick: () -> Unit,
) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
            .background(if (active) HavenAccent.copy(alpha = .18f) else HavenSurface)
            .clickable(enabled = channel.type == "VOICE", onClick = onClick).padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                if (channel.type == "VOICE") Icons.Default.Headset else Icons.Default.Tag,
                null,
                tint = if (active) HavenGreen else Color(0xFFA1A1AA),
            )
            Spacer(Modifier.width(12.dp))
            Text(channel.name, modifier = Modifier.weight(1f), fontWeight = FontWeight.Medium)
            if (active) Text("CONECTADO", color = HavenGreen, fontSize = 9.sp, fontWeight = FontWeight.Bold)
        }
        if (channel.type == "VOICE" && members.isNotEmpty()) {
            Spacer(Modifier.height(8.dp))
            Text(
                members.sortedBy { it.username.lowercase() }.joinToString("  •  ") { member ->
                    buildString {
                        append(member.username)
                        if (member.isScreenSharing) append(" · AO VIVO")
                        else if (member.isMuted) append(" · mudo")
                    }
                },
                modifier = Modifier.padding(start = 36.dp),
                color = Color(0xFFA1A1AA),
                fontSize = 10.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun CallParticipants(state: HavenUiState) {
    val participants = linkedMapOf<String, VoiceCallParticipant>()
    state.callParticipants.forEach { participants[it.identity] = it }
    state.activeVoiceChannel?.let { channel ->
        state.voiceChannelMembers[channel.id].orEmpty().forEach { member ->
            participants.putIfAbsent(
                member.userId,
                VoiceCallParticipant(
                    identity = member.userId,
                    name = member.username,
                    isLocal = member.userId == state.user?.id,
                    isSpeaking = member.isSpeaking,
                    isMuted = member.isMuted,
                    isScreenSharing = member.isScreenSharing,
                ),
            )
        }
    }

    Column {
        Text(
            "Na call — ${participants.size}",
            color = Color(0xFFA1A1AA),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(7.dp))
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            participants.values.forEach { participant ->
                val memberName = state.members.firstOrNull { it.id == participant.identity }?.username
                    ?: (if (participant.isLocal) state.user?.username else null)
                    ?: participant.name.ifBlank { participant.identity.take(8) }
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = HavenRaised,
                    border = BorderStroke(
                        1.dp,
                        if (participant.isSpeaking) HavenGreen else HavenBorder,
                    ),
                ) {
                    Row(Modifier.padding(horizontal = 10.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier.size(22.dp).clip(CircleShape)
                                .background(if (participant.isSpeaking) HavenGreen.copy(alpha = .2f) else HavenSurface),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(memberName.take(2).uppercase(), fontSize = 8.sp, fontWeight = FontWeight.Bold)
                        }
                        Spacer(Modifier.width(7.dp))
                        Column {
                            Text(if (participant.isLocal) "$memberName · você" else memberName, fontSize = 10.sp)
                            Text(
                                when {
                                    participant.isScreenSharing -> "Transmitindo"
                                    participant.isMuted -> "Microfone desligado"
                                    participant.isSpeaking -> "Falando"
                                    else -> "Na sala"
                                },
                                color = if (participant.isScreenSharing || participant.isSpeaking) HavenGreen else Color(0xFF71717A),
                                fontSize = 8.sp,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FloatingScreenShare(state: HavenUiState) {
    val announced = state.callParticipants.any(VoiceCallParticipant::isScreenSharing) ||
        state.activeVoiceChannel?.let { channel ->
            state.voiceChannelMembers[channel.id].orEmpty().any(VoiceChannelUser::isScreenSharing)
        } == true
    val shares = state.screenShares
    if (!announced && shares.isEmpty()) return

    var selectedIdentity by remember(shares.map(VoiceScreenShare::participantIdentity)) {
        mutableStateOf(shares.firstOrNull()?.participantIdentity)
    }
    val selected = shares.firstOrNull { it.participantIdentity == selectedIdentity } ?: shares.firstOrNull()
    var fullscreen by remember(selected?.participantIdentity) { mutableStateOf(false) }
    BackHandler(enabled = fullscreen) { fullscreen = false }

    if (fullscreen) {
        Surface(
            modifier = Modifier.fillMaxSize().zIndex(20f),
            color = Color.Black,
        ) {
            Column {
                ScreenShareHeader(
                    selected = selected,
                    shareCount = shares.size,
                    fullscreen = true,
                    onFullscreen = { fullscreen = false },
                    onNext = {
                        selectedIdentity = shares.nextAfter(selectedIdentity)?.participantIdentity
                    },
                )
                if (selected != null) {
                    RemoteScreenRenderer(selected, Modifier.fillMaxWidth().weight(1f))
                } else {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(Modifier.size(28.dp), strokeWidth = 2.dp)
                    }
                }
            }
        }
        return
    }

    BoxWithConstraints(Modifier.fillMaxSize().zIndex(10f)) {
        val density = LocalDensity.current
        val pipWidth = 240.dp
        val pipHeight = 178.dp
        val edge = 12.dp
        val voiceDockSpace = if (state.activeVoiceChannel != null) 118.dp else edge
        val containerWidthPx = with(density) { maxWidth.toPx() }
        val containerHeightPx = with(density) { maxHeight.toPx() }
        val pipWidthPx = with(density) { pipWidth.toPx() }
        val pipHeightPx = with(density) { pipHeight.toPx() }
        val edgePx = with(density) { edge.toPx() }
        val reservedBottomPx = with(density) { voiceDockSpace.toPx() }
        val maxX = (containerWidthPx - pipWidthPx - edgePx).coerceAtLeast(edgePx)
        val maxY = (containerHeightPx - pipHeightPx - reservedBottomPx).coerceAtLeast(edgePx)
        var position by remember(selected?.participantIdentity) { mutableStateOf<IntOffset?>(null) }
        val currentPosition = position ?: IntOffset(maxX.toInt(), maxY.toInt())

        Surface(
            modifier = Modifier
                .offset { currentPosition }
                .width(pipWidth)
                .height(pipHeight)
                .pointerInput(maxX, maxY) {
                    detectDragGestures { _, dragAmount ->
                        val origin = position ?: currentPosition
                        position = IntOffset(
                            x = (origin.x + dragAmount.x).toInt().coerceIn(edgePx.toInt(), maxX.toInt()),
                            y = (origin.y + dragAmount.y).toInt().coerceIn(edgePx.toInt(), maxY.toInt()),
                        )
                    }
                },
            shape = RoundedCornerShape(14.dp),
            color = Color.Black,
            shadowElevation = 12.dp,
            border = BorderStroke(1.dp, HavenGreen.copy(alpha = .55f)),
        ) {
            Column {
                ScreenShareHeader(
                    selected = selected,
                    shareCount = shares.size,
                    fullscreen = false,
                    onFullscreen = { fullscreen = true },
                    onNext = {
                        selectedIdentity = shares.nextAfter(selectedIdentity)?.participantIdentity
                    },
                )
                if (selected != null) {
                    RemoteScreenRenderer(selected, Modifier.fillMaxWidth().weight(1f))
                } else {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
                    }
                }
            }
        }
    }
}

@Composable
private fun ScreenShareHeader(
    selected: VoiceScreenShare?,
    shareCount: Int,
    fullscreen: Boolean,
    onFullscreen: () -> Unit,
    onNext: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().height(42.dp).padding(start = 10.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Default.Tv, null, tint = HavenGreen, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(7.dp))
        Text(
            selected?.let { "${it.participantName} · ao vivo" } ?: "Carregando transmissão…",
            modifier = Modifier.weight(1f).clickable(enabled = shareCount > 1, onClick = onNext),
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        if (shareCount > 1) Text("$shareCount", color = Color(0xFFA1A1AA), fontSize = 9.sp)
        IconButton(onClick = onFullscreen, modifier = Modifier.size(36.dp)) {
            Icon(
                if (fullscreen) Icons.Default.FullscreenExit else Icons.Default.Fullscreen,
                if (fullscreen) "Sair da tela cheia" else "Tela cheia",
                modifier = Modifier.size(20.dp),
            )
        }
    }
}

private fun List<VoiceScreenShare>.nextAfter(identity: String?): VoiceScreenShare? {
    if (isEmpty()) return null
    val currentIndex = indexOfFirst { it.participantIdentity == identity }
    return this[(currentIndex + 1).mod(size)]
}

@Composable
private fun RemoteScreenRenderer(share: VoiceScreenShare, modifier: Modifier = Modifier) {
    var boundTrack by remember(share.room) { mutableStateOf<RemoteVideoTrack?>(null) }
    var view by remember(share.room) { mutableStateOf<TextureViewRenderer?>(null) }

    fun bind(track: RemoteVideoTrack, renderer: TextureViewRenderer) {
        if (boundTrack === track) return
        view?.let { current -> boundTrack?.removeRenderer(current) }
        boundTrack = track
        track.addRenderer(renderer)
    }

    DisposableEffect(share.room, share.track) {
        onDispose {
            view?.let { renderer -> boundTrack?.removeRenderer(renderer) }
            boundTrack = null
        }
    }
    DisposableEffect(currentCompositeKeyHash.toString()) {
        onDispose { view?.release() }
    }

    AndroidView(
        factory = { context ->
            TextureViewRenderer(context).apply {
                share.room.initVideoRenderer(this)
                setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FIT)
                view = this
                bind(share.track, this)
            }
        },
        update = { bind(share.track, it) },
        modifier = modifier.background(Color.Black),
    )
}

@Composable
private fun VoiceDock(
    channel: Channel,
    muted: Boolean,
    noiseEnabled: Boolean,
    onMute: () -> Unit,
    onNoise: () -> Unit,
    onLeave: () -> Unit,
) {
    Surface(color = HavenSurface, border = BorderStroke(1.dp, HavenBorder)) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Voz conectada", color = HavenGreen, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text(channel.name, fontWeight = FontWeight.SemiBold)
                }
                IconButton(onClick = onMute) {
                    Icon(if (muted) Icons.Default.MicOff else Icons.Default.Mic, if (muted) "Ativar microfone" else "Silenciar")
                }
                IconButton(onClick = onNoise) {
                    Icon(Icons.Default.GraphicEq, "Redução de ruído", tint = if (noiseEnabled) HavenGreen else Color(0xFF71717A))
                }
                OutlinedButton(onClick = onLeave, colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFFB7185))) {
                    Text("Sair")
                }
            }
            Text(
                if (noiseEnabled) "Foco de Voz DTLN ativo no dispositivo" else "Redução neural desativada",
                color = Color(0xFF71717A),
                fontSize = 10.sp,
            )
        }
    }
}

@Composable
private fun BrandMark(size: Int = 44) {
    Box(
        Modifier.size(size.dp).clip(RoundedCornerShape((size / 3).dp)).background(HavenAccent),
        contentAlignment = Alignment.Center,
    ) {
        Text("H", color = Color.White, fontWeight = FontWeight.Black, fontSize = (size / 2).sp)
    }
}
