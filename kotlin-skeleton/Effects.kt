package com.overclock9.incremental

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import kotlin.math.max
import kotlin.math.min

private data class Particle(
    var x: Float, var y: Float,
    var px: Float, var py: Float,
    var vx: Float, var vy: Float,
    var life: Float, val maxLife: Float,
    val color: Color, val size: Float, val streak: Boolean
)

private data class Shockwave(
    val x: Float, val y: Float,
    var life: Float, val maxLife: Float, val radius: Float,
    var delay: Double = 0.0, val payout: Float = 1f
)

private data class Ripple(var x: Float, var y: Float, var life: Float)

/**
 * Efectos avanzados sin assets externos. Todo se integra con dtReal × timeScale;
 * el hit-stop usa dtReal para no estirarse durante cámara lenta.
 * Nova es una sola explosión que paga los núcleos eliminados; Overdrive fue
 * eliminado y sus FX se reutilizan en el Falso Final (Pesadilla).
 */
class EffectSystem {
    private val particles = ArrayList<Particle>(260)
    private val waves = ArrayList<Shockwave>(8)
    private val ripples = ArrayList<Ripple>(12)

    var hitStop: Double = 0.0
        private set
    var shake: Float = 0f
        private set
    var flash: Float = 0f
        private set
    var reduceFlash: Boolean = false

    fun update(dtReal: Double, timeScale: Double) {
        val dt = dtReal * timeScale
        val frames = (dt * 60.0).toFloat()

        if (hitStop > 0.0) hitStop = max(0.0, hitStop - dtReal)
        shake *= 0.85f
        if (shake < 0.5f) shake = 0f
        flash *= 0.75f
        if (flash < 0.02f) flash = 0f

        var i = particles.lastIndex
        while (i >= 0) {
            val p = particles[i]
            p.px = p.x; p.py = p.y
            p.x += p.vx * frames
            p.y += p.vy * frames
            p.vy += 0.05f * frames
            val drag = Math.pow(0.985, frames.toDouble()).toFloat()
            p.vx *= drag; p.vy *= drag
            p.life -= dt.toFloat()
            if (p.life <= 0f) particles.removeAt(i)
            i--
        }
        i = waves.lastIndex
        while (i >= 0) {
            val w = waves[i]
            if (w.delay > 0.0) {
                w.delay -= dt
            } else {
                w.life -= dt.toFloat()
                if (w.life <= 0f) waves.removeAt(i)
            }
            i--
        }
        i = ripples.lastIndex
        while (i >= 0) {
            val r = ripples[i]
            r.life -= dt.toFloat()
            if (r.life <= 0f) ripples.removeAt(i)
            i--
        }
    }

    fun tap(x: Float, y: Float) {
        if (ripples.size >= 12) ripples.removeAt(0)
        ripples.add(Ripple(x, y, 0.35f))
    }

    fun burst(x: Float, y: Float, color: Color, count: Int, streak: Boolean = false) {
        repeat(count) {
            if (particles.size >= 260) particles.removeAt(0)
            particles.add(
                Particle(
                    x = x, y = y, px = x, py = y,
                    vx = (Math.random().toFloat() - 0.5f) * 6f,
                    vy = (Math.random().toFloat() - 0.5f) * 6f - 1f,
                    life = 0.4f + Math.random().toFloat() * 0.5f,
                    maxLife = 0.9f,
                    color = color,
                    size = 2f + Math.random().toFloat() * 3f,
                    streak = streak
                )
            )
        }
    }

    /** Resonancia Nova: una explosión, sin ondas diferidas ni porcentajes. */
    fun nova(x: Float, y: Float, reach: Float) {
        if (waves.size >= 8) waves.removeAt(0)
        waves.add(Shockwave(x, y, 0.75f, 0.75f, reach * 1.3f + 40f, 0.0, 1f))
        burst(x, y, Color(0xFFFFC400), 36, streak = true)
        hitStop = Balance.Nova.HIT_STOP
        shake = Balance.Nova.SHAKE
        flash = if (reduceFlash) 0f else Balance.Nova.FLASH
    }

    fun draw(scope: DrawScope) {
        ripples.forEach { r ->
            val t = 1f - max(0f, r.life / 0.35f)
            scope.drawCircle(
                color = Color(0xFF00F3FF),
                radius = 10f + t * 34f,
                center = Offset(r.x, r.y),
                alpha = (1f - t) * 0.45f,
                style = Stroke(width = 2f * (1f - t) + 0.5f)
            )
        }

        waves.forEach { w ->
            if (w.delay > 0.0) return@forEach
            val t = 1f - max(0f, w.life / w.maxLife)
            val payoutAlpha = 0.5f + 0.5f * w.payout
            listOf(0f, 0.09f).forEachIndexed { index, delay ->
                val local = min(1f, max(0f, (t - delay) / (1f - delay)))
                if (local <= 0f) return@forEachIndexed
                val radius = w.radius * (1f - (1f - local) * (1f - local))
                val alpha = Math.pow((1f - local).toDouble(), 1.6).toFloat() *
                    (if (index == 0) 0.8f else 0.45f) * payoutAlpha
                scope.drawCircle(
                    color = if (index == 0) Color(0xFFFFCC00) else Color(0xFFFF6A00),
                    radius = radius,
                    center = Offset(w.x, w.y),
                    alpha = alpha,
                    style = Stroke(width = (if (index == 0) 9f else 4f) * (1f - local * 0.5f))
                )
            }
        }

        particles.forEach { p ->
            val a = max(0f, p.life / p.maxLife)
            if (p.streak) {
                scope.drawLine(
                    color = p.color,
                    start = Offset(p.px, p.py),
                    end = Offset(p.x, p.y),
                    strokeWidth = max(1f, p.size * a * 0.8f),
                    cap = StrokeCap.Round,
                    alpha = a
                )
            } else {
                scope.drawCircle(p.color, p.size * a, Offset(p.x, p.y), alpha = a)
            }
        }
    }
}
