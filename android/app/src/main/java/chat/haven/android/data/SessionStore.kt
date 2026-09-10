package chat.haven.android.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.nio.ByteBuffer
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
private data class PersistedSession(val user: User, val tokens: TokenPair)

/** Stores opt-in sessions encrypted by a non-exportable key in Android Keystore. */
class SessionStore(context: Context) {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    fun save(auth: AuthResponse) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val clearText = json.encodeToString(PersistedSession(auth.user, auth.tokens)).encodeToByteArray()
        val encrypted = cipher.doFinal(clearText)
        val payload = ByteBuffer.allocate(Int.SIZE_BYTES + cipher.iv.size + encrypted.size)
            .putInt(cipher.iv.size)
            .put(cipher.iv)
            .put(encrypted)
            .array()
        preferences.edit().putString(SESSION_KEY, Base64.encodeToString(payload, Base64.NO_WRAP)).apply()
    }

    fun load(): AuthResponse? = runCatching {
        val encoded = preferences.getString(SESSION_KEY, null) ?: return null
        val payload = ByteBuffer.wrap(Base64.decode(encoded, Base64.NO_WRAP))
        val ivSize = payload.int
        require(ivSize in 12..32 && payload.remaining() > ivSize)
        val iv = ByteArray(ivSize).also(payload::get)
        val encrypted = ByteArray(payload.remaining()).also(payload::get)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(128, iv))
        val session = json.decodeFromString<PersistedSession>(cipher.doFinal(encrypted).decodeToString())
        AuthResponse(session.user, session.tokens)
    }.getOrElse {
        clear()
        null
    }

    fun clear() {
        preferences.edit().remove(SESSION_KEY).apply()
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER).run {
            init(
                KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .build(),
            )
            generateKey()
        }
    }

    companion object {
        private const val PREFERENCES_NAME = "haven_secure_session"
        private const val SESSION_KEY = "session"
        private const val KEY_ALIAS = "haven_session_key_v1"
        private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
