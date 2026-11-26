package com.overclock9.incremental

import kotlin.math.max
import kotlin.math.min

/**
 * Voltaje-vida del arcade. Sustituye al temporizador: drena con el tiempo y
 * al llegar a 0 cierra el ciclo. Llenar la barra sube un tier de multiplicador
 * que se conserva durante toda la run.
 */
class VoltageState(
    var voltage: Double = Balance.VOLTAGE_START,
    var tier: Int = 1,
    var armed: Boolean = false,
    var freezeSeconds: Double = 0.0
) {
    val depleted: Boolean get() = voltage <= 0.0

    /** Devuelve el número de tiers ganados (0 o 1) para anunciar el evento. */
    fun addGain(coreType: String): Int {
        val gain = Balance.VOLTAGE_GAIN[coreType] ?: 0.0
        if (voltage < Balance.REARM_BELOW) armed = true
        voltage = min(Balance.VOLTAGE_MAX, voltage + gain)
        if (voltage >= Balance.VOLTAGE_MAX && armed && tier < Balance.MAX_TIER) {
            armed = false
            tier++
            return 1
        }
        return 0
    }

    /**
     * Realiza el drenaje de un frame. El Falso Final congela el voltaje durante
     * 5 s; los núcleos rojos activos añaden drenaje y no se castiga por dejarlos
     * escapar (solo cuesta voltaje extra al escapar).
     */
    fun drain(realDt: Double, sector: Int, bossActive: Boolean, redActive: Int): Double {
        if (freezeSeconds > 0.0) {
            freezeSeconds = max(0.0, freezeSeconds - realDt)
            return voltage
        }
        val sectorDrain = Balance.DRAIN_PER_SEC + Balance.DRAIN_PER_SECTOR * max(0, sector - 1)
        val bossMult = if (bossActive) Balance.BOSS_DRAIN_MULT else 1.0
        val redDrain = Balance.Red.DRAIN_PER_SEC * max(0, redActive)
        voltage = max(0.0, voltage - (sectorDrain * bossMult + redDrain) * realDt)
        if (voltage < Balance.REARM_BELOW) armed = true
        return voltage
    }

    fun triggerFakeEnding() {
        freezeSeconds = Balance.FREEZE_SECONDS
    }

    fun reset(tierFromRun: Int = 1) {
        voltage = Balance.VOLTAGE_START
        tier = min(Balance.MAX_TIER, max(1, tierFromRun))
        armed = false
        freezeSeconds = 0.0
    }

    fun redTapPenalty(): Double = Balance.Red.TAP_PENALTY

    fun redComboPenalty(linked: Boolean): Int =
        if (linked) Balance.Red.TAP_COMBO_LINKED else Balance.Red.TAP_COMBO

    fun redEscapePenalty(): Double = Balance.Red.ESCAPE_PENALTY

    fun creditsFor(score: Double): Long =
        kotlin.math.floor(score * Balance.CREDITS_PER_SCORE).toLong()
}
