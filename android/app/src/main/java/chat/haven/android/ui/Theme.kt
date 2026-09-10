package chat.haven.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val HavenBackground = Color(0xFF09090B)
val HavenSurface = Color(0xFF18181B)
val HavenRaised = Color(0xFF27272A)
val HavenBorder = Color(0xFF3F3F46)
val HavenAccent = Color(0xFF6366F1)
val HavenGreen = Color(0xFF34D399)

private val colors = darkColorScheme(
    primary = HavenAccent,
    secondary = Color(0xFF22D3EE),
    tertiary = HavenGreen,
    background = HavenBackground,
    surface = HavenSurface,
    surfaceVariant = HavenRaised,
    outline = HavenBorder,
    onPrimary = Color.White,
    onBackground = Color(0xFFF4F4F5),
    onSurface = Color(0xFFF4F4F5),
    onSurfaceVariant = Color(0xFFA1A1AA),
)

@Composable
fun HavenTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = colors, content = content)
}
