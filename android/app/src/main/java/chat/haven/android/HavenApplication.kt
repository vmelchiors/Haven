package chat.haven.android

import android.app.Application
import io.livekit.android.LiveKit

class HavenApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        LiveKit.init(this)
    }
}
