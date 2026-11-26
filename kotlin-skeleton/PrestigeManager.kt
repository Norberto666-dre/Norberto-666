package com.overclock9.incremental

/**
 * Reinicio de Núcleo. Reglas iniciales:
 * - requisitos: jefe de sector >= 2 y 10 000 créditos de vida;
 * - FN = floor(sqrt(lifetime / 10 000)) + bonus por jefe;
 * - se conservan FN, Sectores, racha y Chips Legendarios;
 * - se borran CR, nodos, Chips no legendarios y Cursores comprados;
 * - cada reinicio endurece jefes (+12 % vida) y telegrafía (−0.03 s, suelo 0.55 s).
 */
class PrestigeManager(private val economy: EconomyManager) {
    private val lifetimeThreshold = Scaled.of(10_000.0)

    fun canPrestige(): Boolean {
        val p = economy.progress
        return p.bossDefeatedSector >= 2 && p.lifetimeCredits >= lifetimeThreshold
    }

    fun previewFragments(): Int {
        val p = economy.progress
        if (!canPrestige()) return 0
        val ratio = p.lifetimeCredits.div(10_000.0).toDouble()
        val base = kotlin.math.floor(kotlin.math.sqrt(ratio)).toInt()
        val bossBonus = if (p.bossDefeatedSector >= 2) 1 else 0
        return base + bossBonus
    }

    fun execute(): Int {
        val gained = previewFragments()
        if (gained <= 0) return 0
        val old = economy.progress
        val reset = PlayerProgress(
            credits = Scaled.ZERO,
            lifetimeCredits = Scaled.ZERO,
            fragments = old.fragments + gained,
            sector = old.sector,
            nodeLevels = emptyMap(),
            chipLevels = old.chipLevels.filterKeys { id ->
                Chip.ALL.firstOrNull { it.id == id }?.rarity == Rarity.LEGENDARIO
            },
            equippedChips = old.equippedChips.filter { id ->
                Chip.ALL.firstOrNull { it.id == id }?.rarity == Rarity.LEGENDARIO
            }.ifEmpty { listOf("veloz", "mirada") },
            cursorId = "pulso",
            cursorLevels = emptyMap(),
            bestCycleCredits = Scaled.ZERO,
            bossDefeatedSector = 0,
            lastActiveAtMs = old.lastActiveAtMs,
            prestigeCount = old.prestigeCount + 1,
            dailyStreak = old.dailyStreak,
            ascension = old.ascension + 1
        )
        economy.replaceProgress(reset)
        return gained
    }

    /** Parámetros que el bucle arcade debe leer tras cada reinicio. */
    fun difficultyModifiers(): DifficultyModifiers {
        val n = economy.progress.prestigeCount
        return DifficultyModifiers(
            bossHpMultiplier = 1.0 + 0.12 * n,
            telegraphScale = (1.0 - 0.03 * n).coerceAtLeast(0.55),
            creditMultiplier = 1.0 + 0.08 * economy.progress.fragments
        )
    }
}

data class DifficultyModifiers(
    val bossHpMultiplier: Double,
    val telegraphScale: Double,
    val creditMultiplier: Double
)
