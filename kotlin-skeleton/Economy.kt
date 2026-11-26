package com.overclock9.incremental

import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

/**
 * Mantisa + exponente decimal. Permite créditos más allá del rango de Double
 * sin pagar BigDecimal en cada frame del bucle arcade.
 */
data class Scaled(val m: Double, val e: Int) : Comparable<Scaled> {
    val logValue: Double
        get() = if (m == 0.0) Double.NEGATIVE_INFINITY else log10(m) + e

    override fun compareTo(other: Scaled): Int = when {
        m == 0.0 && other.m == 0.0 -> 0
        m == 0.0 -> -1
        other.m == 0.0 -> 1
        else -> logValue.compareTo(other.logValue)
    }

    operator fun plus(o: Scaled): Scaled {
        if (m == 0.0) return o
        if (o.m == 0.0) return this
        val maxE = max(e, o.e)
        val a = m * 10.0.pow((e - maxE).toDouble())
        val b = o.m * 10.0.pow((o.e - maxE).toDouble())
        return fromLog(log10(a + b) + maxE)
    }

    operator fun minus(o: Scaled): Scaled {
        if (o.m == 0.0) return this
        if (this <= o) return ZERO
        val maxE = max(e, o.e)
        val a = m * 10.0.pow((e - maxE).toDouble())
        val b = o.m * 10.0.pow((o.e - maxE).toDouble())
        return fromLog(log10(a - b) + maxE)
    }

    operator fun times(o: Scaled): Scaled = fromLog(logValue + o.logValue)
    fun scale(factor: Double): Scaled =
        if (factor <= 0.0 || m == 0.0) ZERO else fromLog(logValue + log10(factor))

    fun div(factor: Double): Scaled = scale(1.0 / factor)
    fun pow(n: Int): Scaled = fromLog(logValue * n)

    fun toDouble(): Double =
        if (e > 307) Double.MAX_VALUE else m * 10.0.pow(e.toDouble())

    fun toLongSaturated(): Long = min(toDouble(), Long.MAX_VALUE.toDouble()).toLong()

    fun format(): String {
        if (m == 0.0) return "0"
        val tiers = arrayOf("", "K", "M", "B", "T", "Qa", "Qi")
        val tier = floor(logValue / 3).toInt().coerceIn(0, tiers.lastIndex)
        return "%.2f%s".format(10.0.pow(logValue - tier * 3), tiers[tier])
    }

    companion object {
        val ZERO = Scaled(0.0, 0)

        fun of(value: Double): Scaled =
            if (value <= 0.0 || !value.isFinite()) ZERO else fromLog(log10(value))

        fun fromLog(log: Double): Scaled {
            if (!log.isFinite() || log < -300.0) return ZERO
            val exponent = floor(log).toInt()
            return Scaled(10.0.pow(log - exponent), exponent)
        }
    }
}

data class CycleSummary(
    val score: Scaled,
    val perfectStreak: Int,
    val bossPhase: Int,
    val acceptedEnding: Boolean,
    val novaHits: Int,
    val sector: Int,
    val voltageTier: Int = 1,
    val board: BoardId = BoardId.THREE_BY_THREE,
    val fakeEndings: Int = 0
)

interface ProgressStore {
    fun load(): PlayerProgress
    fun save(progress: PlayerProgress)
}

/** Todas las fórmulas de economía viven aquí; la UI solo las consume. */
class EconomyManager(private val store: ProgressStore) {
    var progress: PlayerProgress = store.load()
        private set

    private fun save() = store.save(progress)
    private fun node(id: String) = progress.level(id)

    /** Usado por PrestigeManager: reemplaza el estado completo y persiste. */
    fun replaceProgress(next: PlayerProgress) {
        progress = next
        save()
    }

    private fun chipBonus(id: String): Double {
        val chip = Chip.ALL.firstOrNull { it.id == id } ?: return 0.0
        return chip.effect(progress.chipLevels[id] ?: 0)
    }

    private val cursorMult: Double
        get() = when (progress.cursorId) {
            "nucleo" -> 1.15 * (1 + 0.03 * (progress.cursorLevels["nucleo"] ?: 0))
            "nova" -> 1.0 + 0.10 * (progress.cursorLevels["nova"] ?: 0)
            else -> 1.0 + 0.02 * (progress.cursorLevels[progress.cursorId] ?: 0)
        }

    /** Escalones de combo: 1/1.5/2/3/4/5 en 5/10/20/30/40, después por centenas y miles. */
    private fun comboStep(combo: Int): Double = when {
        combo < 5 -> 1.0
        combo < 10 -> 1.5
        combo < 20 -> 2.0
        combo < 30 -> 3.0
        combo < 40 -> 4.0
        combo < 50 -> 5.0
        combo < 100 -> 5.0 + 0.5 * ((combo - 40) / 10)
        combo < 1000 -> 8.0 + 5.0 * ((combo - 100) / 100)
        combo < 10000 -> 55.0 + 10.0 * ((combo - 1000) / 1000)
        else -> 145.0 + 10.0 * ((combo - 10000) / 1000)
    }

    /** Valor de un golpe: la habilidad manda, los nodos solo la amplifican. */
    fun hitValue(
        combo: Int,
        perfect: Boolean,
        perfectStreak: Int = 0,
        phase: Int = 0,
        voltageTier: Int = 1
    ): Scaled {
        val comboMult = comboStep(combo)
        val perfectMult = if (perfect) 2.0 else 1.0
        val scoreMult = 1.0 + node("mira_laser") * 0.05 + chipBonus("mirada")
        val streakMult = if (perfectStreak >= 10) 1.0 + chipBonus("racha_flash") else 1.0
        val sectorMult = 1.0 + 0.25 * (progress.sector - 1) + node("sector_abierto") * 0.05
        val fragmentMult = 1.0 + 0.08 * progress.fragments + node("nucleo_denso") * 0.08
        val bossMult = 1.0 + phase * 0.05
        val tierMult = voltageTier.coerceIn(1, Balance.MAX_TIER).toDouble()
        return Scaled.of(100.0)
            .scale(comboMult * perfectMult * scoreMult * streakMult * sectorMult * fragmentMult * bossMult * cursorMult * tierMult)
    }

    /** Cierre de ciclo: convierte puntuación en Créditos y actualiza récords. */
    fun closeCycle(summary: CycleSummary): Scaled {
        val mult = (1.0 + node("mira_laser") * 0.05) *
            (if (summary.acceptedEnding) 1.10 else 1.0) *
            (1.0 + 0.08 * progress.fragments) *
            (1.0 + 0.02 * summary.novaHits)
        val earned = summary.score.scale(Balance.CREDITS_PER_SCORE).scale(mult)
        progress = progress.copy(
            credits = progress.credits + earned,
            lifetimeCredits = progress.lifetimeCredits + earned,
            bestCycleCredits = if (earned > progress.bestCycleCredits) earned else progress.bestCycleCredits,
            bossDefeatedSector = maxOf(progress.bossDefeatedSector, if (summary.bossPhase > 0) summary.sector else 0),
            lastActiveAtMs = System.currentTimeMillis()
        )
        save()
        return earned
    }

    fun buyNode(id: String): Boolean {
        val nodeDef = SkillNode.ALL.firstOrNull { it.id == id } ?: return false
        val level = progress.level(id)
        if (level >= nodeDef.maxLevel || !nodeDef.unlockedBy(progress.nodeLevels)) return false
        val cost = Scaled.of(nodeDef.cost(level))
        if (progress.credits < cost) return false
        progress = progress.copy(
            credits = progress.credits - cost,
            nodeLevels = progress.nodeLevels + (id to level + 1)
        )
        save()
        return true
    }

    fun buyChip(id: String): Boolean {
        val chip = Chip.ALL.firstOrNull { it.id == id } ?: return false
        val level = progress.chipLevels[id] ?: 0
        if (level >= chip.maxLevel) return false
        val cost = Scaled.of(chip.cost(level))
        if (progress.credits < cost) return false
        progress = progress.copy(
            credits = progress.credits - cost,
            chipLevels = progress.chipLevels + (id to level + 1)
        )
        save()
        return true
    }

    fun buyCursor(id: String): Boolean {
        val cursor = CURSORS.firstOrNull { it.id == id } ?: return false
        val level = progress.cursorLevels[id] ?: 0
        if (level >= 4) return false
        if (level == 0) {
            val owned = when (val unlock = cursor.unlock) {
                CursorUnlock.Free -> true
                is CursorUnlock.Shop -> progress.credits >= Scaled.of(unlock.credits)
                is CursorUnlock.Boss -> progress.bossDefeatedSector >= unlock.sector
                is CursorUnlock.Prestige -> progress.fragments >= unlock.fragments
            }
            if (!owned) return false
        }
        val cost = Scaled.of(cursor.upgradeCost(level))
        if (progress.credits < cost) return false
        progress = progress.copy(
            credits = progress.credits - cost,
            cursorLevels = progress.cursorLevels + (id to level + 1),
            cursorId = id
        )
        save()
        return true
    }

    fun equipChip(id: String): Boolean {
        val slots = 2 + node("cache_chips")
        if (id !in progress.equippedChips && progress.equippedChips.size >= slots) return false
        progress = progress.copy(
            equippedChips = if (id in progress.equippedChips) progress.equippedChips - id
            else progress.equippedChips + id
        )
        save()
        return true
    }

    private val ecoEfficiency: Double
        get() = 1.0 + 0.10 * node("memoria_termica")

    private val ecoPerSecond: Double
        get() {
            val level = node("eco_1")
            if (level == 0) return 0.0
            val recent = System.currentTimeMillis() - progress.lastActiveAtMs < 24L * 3600_000
            if (!recent) return 0.0
            return (0.05 + 0.01 * level) * progress.bestCycleCredits.toDouble() / 30.0 * ecoEfficiency
        }

    /** Eco en tiempo real; `timeScale` NO acelera la economía pasiva. */
    fun tickEco(dtReal: Double, timeScale: Double = 1.0): Scaled {
        val dt = dtReal * timeScale
        val gained = Scaled.of(ecoPerSecond * dt)
        if (gained > Scaled.ZERO) {
            progress = progress.copy(credits = progress.credits + gained)
            save()
        }
        return gained
    }

    /** Offline: máximo 4 h, 50 % de eficiencia, requiere Eco I. */
    fun offlineGain(nowMs: Long, lastSeenMs: Long): Scaled {
        if (node("eco_1") == 0 || lastSeenMs <= 0L) return Scaled.ZERO
        val hours = min(4.0, max(0.0, (nowMs - lastSeenMs) / 3600_000.0))
        return Scaled.of(ecoPerSecond * hours * 3600.0 * 0.50)
    }

    fun applyOffline(nowMs: Long, lastSeenMs: Long): Scaled {
        val gained = offlineGain(nowMs, lastSeenMs)
        if (gained > Scaled.ZERO) {
            progress = progress.copy(credits = progress.credits + gained)
            save()
        }
        return gained
    }
}
