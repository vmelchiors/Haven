package chat.haven.android.data

import chat.haven.android.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class HavenRepository(
    private val baseUrl: String = BuildConfig.HAVEN_API_URL,
    private val client: OkHttpClient = OkHttpClient(),
) {
    private val json = Json { ignoreUnknownKeys = true }
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private var accessToken: String? = null

    suspend fun login(username: String, password: String): AuthResponse {
        val body = buildJsonObject {
            put("username", username)
            put("password", password)
        }.toString()
        return post("/api/auth/login", body, authenticated = false)
    }

    suspend fun refresh(refreshToken: String): AuthResponse {
        val body = buildJsonObject { put("refresh_token", refreshToken) }.toString()
        return post("/api/auth/refresh", body, authenticated = false)
    }

    fun useSession(tokens: TokenPair) {
        accessToken = tokens.accessToken
    }

    suspend fun communities(): List<Community> = get("/api/communities")

    suspend fun channels(communityId: String): List<Channel> =
        get("/api/communities/$communityId/channels")

    suspend fun members(communityId: String): List<User> =
        get("/api/communities/$communityId/members")

    suspend fun rtcToken(channelId: String): RtcToken =
        post("/api/channels/$channelId/rtc-token", "{}")

    fun clearSession() {
        accessToken = null
    }

    private suspend inline fun <reified T> get(path: String): T = execute(
        Request.Builder().url(url(path)).apply(::authenticate).get().build(),
    )

    private suspend inline fun <reified T> post(
        path: String,
        body: String,
        authenticated: Boolean = true,
    ): T = execute(
        Request.Builder().url(url(path)).apply {
            if (authenticated) authenticate(this)
            post(body.toRequestBody(jsonMediaType))
        }.build(),
    )

    private fun authenticate(builder: Request.Builder) {
        accessToken?.let { builder.header("Authorization", "Bearer $it") }
    }

    private fun url(path: String) = "${baseUrl.trimEnd('/')}/${path.trimStart('/')}"

    private suspend inline fun <reified T> execute(request: Request): T = withContext(Dispatchers.IO) {
        client.newCall(request).execute().use { response ->
            val body = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val apiError = runCatching { json.decodeFromString<ApiError>(body) }.getOrNull()
                throw HavenApiException(apiError?.message ?: apiError?.error ?: "HTTP ${response.code}")
            }
            json.decodeFromString<T>(body)
        }
    }
}

class HavenApiException(message: String) : Exception(message)
