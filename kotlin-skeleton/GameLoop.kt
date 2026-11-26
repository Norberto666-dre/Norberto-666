package com.overclock9.incremental

/**
 * Bucle puente entre el arcade (dt real) y la capa incremental.
 * En producción, sustituir el callback por el `update` del motor y el `render` de Compose Canvas.
 *
 * Overdrive ya no existe: el voltaje es la vida y el único multiplicador de
 * ritmo es el tier ganado al llenar la barra. `timeScale` queda reservado para
 * depuración/editor y debe ser 1.0 en partida.
 */
class GameLoop(
    private val effects: EffectSystem,
    private val economy: EconomyManager,
    private val onFrame: (gameDt: Double, realDt: Double) -> Unit,
    private val onRenderFrame: () -> Unit,
    private val voltage: VoltageState? = null
) {
    var timeScale: Double = 1.0
        set(value) { field = if (value > 0.0) value else 1.0 }

    var sector: Int = 1
    var bossActive: Boolean = false
    var redActive: Int = 0

    private var lastTimeMs: Long = 0L
    private var running = false

    fun start(nowMs: Long) {
        lastTimeMs = nowMs
        running = true
    }

    fun frame(nowMs: Long) {
        if (!running) return
        val realDt = minOf((nowMs - lastTimeMs) / 1000.0, 0.1) // clamp anti-salto tras background
        lastTimeMs = nowMs
        val gameDt = if (effects.hitStop > 0.0) 0.0 else realDt * timeScale

        voltage?.drain(realDt, sector, bossActive, redActive)
        effects.update(realDt, timeScale)
        economy.tickEco(realDt, timeScale)
        onFrame(gameDt, realDt)
        onRenderFrame()
    }

    fun stop() { running = false }
}
