package com.overclock9.incremental

/** Nodo del árbol incremental. `baseCost` y `growth` son valores iniciales. */
data class SkillNode(
    val id: String,
    val name: String,
    val branch: Branch,
    val baseCost: Double,
    val maxLevel: Int = 5,
    val growth: Double = 1.6,
    val requires: String? = null,
    val requiresLevel: Int = 0,
    val description: String = ""
) {
    fun cost(level: Int): Double = baseCost * Math.pow(growth, level.toDouble())
    fun unlockedBy(levels: Map<String, Int>): Boolean =
        requires == null || (levels[requires] ?: 0) >= requiresLevel

    companion object {
        val ALL = listOf(
            SkillNode("pulso_rapido", "Pulso Rápido", Branch.PULSO, 400.0, 5, description = "+4 % ventana Perfecto"),
            SkillNode("mira_laser", "Mira Láser", Branch.PULSO, 1200.0, 5, description = "+5 % puntuación"),
            SkillNode("doble_toque", "Doble Toque", Branch.PULSO, 3000.0, 3, requires = "mira_laser", requiresLevel = 3),
            SkillNode("sincronia", "Sincronía", Branch.PULSO, 8000.0, 3, requires = "doble_toque", requiresLevel = 1),
            SkillNode("nucleo_denso", "Núcleo Denso", Branch.NUCLEO, 600.0, 5),
            SkillNode("cadena", "Cadena", Branch.NUCLEO, 1800.0, 3, requires = "nucleo_denso", requiresLevel = 2),
            SkillNode("sobrecarga", "Sobrecarga", Branch.NUCLEO, 4500.0, 4, requires = "cadena", requiresLevel = 1),
            SkillNode("rompejefes", "Rompejefes", Branch.NUCLEO, 12000.0, 3, requires = "sobrecarga", requiresLevel = 2),
            SkillNode("eco_1", "Generador de Eco", Branch.ECO, 1000.0, 5),
            SkillNode("memoria_termica", "Memoria Térmica", Branch.ECO, 3500.0, 4, requires = "eco_1", requiresLevel = 2),
            SkillNode("cache_chips", "Caché de Chips", Branch.ECO, 7000.0, 2, requires = "eco_1", requiresLevel = 3),
            SkillNode("aegis", "Aegis", Branch.SUPERVIVENCIA, 1500.0, 3),
            SkillNode("cronometro", "Cronómetro", Branch.SUPERVIVENCIA, 4000.0, 3, requires = "aegis", requiresLevel = 1),
            SkillNode("escudo_nv", "Escudo NV", Branch.SUPERVIVENCIA, 9000.0, 4, requires = "cronometro", requiresLevel = 2),
            SkillNode("sector_abierto", "Sector Abierto", Branch.PROGRESION, 25000.0, 5)
        )
    }
}

enum class Branch { PULSO, NUCLEO, ECO, SUPERVIVENCIA, PROGRESION }

enum class Rarity(val multiplier: Double) {
    COMUN(1.0), RARO(1.5), EPICO(2.0), LEGENDARIO(3.0)
}

data class Chip(
    val id: String,
    val name: String,
    val rarity: Rarity,
    val baseEffect: Double,
    val maxLevel: Int = 3,
    val growth: Double = 1.8,
    val description: String = ""
) {
    fun effect(level: Int): Double = baseEffect * rarity.multiplier * level
    fun cost(level: Int): Double = 100.0 * rarity.multiplier * Math.pow(growth, level.toDouble())

    companion object {
        val ALL = listOf(
            Chip("veloz", "Veloz", Rarity.COMUN, 0.06),
            Chip("mirada", "Mirada", Rarity.COMUN, 0.05),
            Chip("volc_bomb", "Bombas → Voltaje", Rarity.RARO, 20.0),
            Chip("chrono_x3", "Crono ×3", Rarity.RARO, 3.0),
            Chip("perfect_window", "Ventana ×1.5", Rarity.RARO, 0.5),
            Chip("chain_master", "Rayo Maestro", Rarity.EPICO, 2.0),
            Chip("mirror_core", "Núcleo Espejo", Rarity.EPICO, 1.0),
            Chip("reflejo", "Reflejo", Rarity.EPICO, 1.0),
            Chip("criogenia", "Criogenia", Rarity.EPICO, 0.25),
            Chip("nucleo", "Núcleo", Rarity.EPICO, 0.15),
            Chip("nova_echo", "Eco Nova", Rarity.EPICO, 0.15),
            Chip("eco_core", "Eco Core", Rarity.LEGENDARIO, 0.25),
            Chip("doble_nucleo", "Doble Núcleo", Rarity.LEGENDARIO, 1.0, maxLevel = 2),
            Chip("resonancia", "Resonancia", Rarity.LEGENDARIO, 0.10, maxLevel = 2),
            Chip("racha_flash", "Racha Flash", Rarity.LEGENDARIO, 0.20)
        )
    }
}

data class Cursor(
    val id: String,
    val name: String,
    val baseCost: Double,
    val unlock: CursorUnlock,
    val description: String
) {
    fun upgradeCost(level: Int): Double = baseCost * Math.pow(2.0, level.toDouble())
}

sealed interface CursorUnlock {
    data object Free : CursorUnlock
    data class Shop(val credits: Double) : CursorUnlock
    data class Boss(val sector: Int) : CursorUnlock
    data class Prestige(val fragments: Int) : CursorUnlock
}

val CURSORS = listOf(
    Cursor("pulso", "Pulso", 0.0, CursorUnlock.Free, "Estela cian equilibrada"),
    Cursor("tesla", "Tesla", 8000.0, CursorUnlock.Shop(8000.0), "+1 objetivo de cadena"),
    Cursor("aegis", "Aegis", 15000.0, CursorUnlock.Shop(15000.0), "Ignora 1 bomba por ciclo"),
    Cursor("crono", "Crono", 22000.0, CursorUnlock.Shop(22000.0), "+1 s en Crono"),
    Cursor("nova", "Nova", 0.0, CursorUnlock.Boss(2), "+10 % pago Nova"),
    Cursor("prisma", "Prisma", 0.0, CursorUnlock.Boss(3), "+8 % golpe reflejado"),
    Cursor("criogenico", "Criogénico", 0.0, CursorUnlock.Boss(4), "−20 % hielo"),
    Cursor("nucleo", "Núcleo", 0.0, CursorUnlock.Prestige(10), "+15 % global")
)

/** Estado persistente del jugador. `Scaled` permite crecer más allá de Double. */
data class PlayerProgress(
    val credits: Scaled = Scaled.ZERO,
    val lifetimeCredits: Scaled = Scaled.ZERO,
    val fragments: Int = 0,
    val sector: Int = 1,
    val nodeLevels: Map<String, Int> = emptyMap(),
    val chipLevels: Map<String, Int> = emptyMap(),
    val equippedChips: List<String> = listOf("veloz", "mirada"),
    val cursorId: String = "pulso",
    val cursorLevels: Map<String, Int> = emptyMap(),
    val bestCycleCredits: Scaled = Scaled.ZERO,
    val bossDefeatedSector: Int = 0,
    val boardId: BoardId = BoardId.THREE_BY_THREE,
    val bestScoreByBoard: Map<BoardId, Long> = emptyMap(),
    val fakeEndings: Long = 0,
    val bossKills: Int = 0,
    val lastActiveAtMs: Long = 0L,
    val prestigeCount: Int = 0,
    val dailyStreak: Int = 0,
    val ascension: Int = 0
) {
    fun unlockedBoards(): List<BoardSpec> {
        val best = (bestScoreByBoard.values.maxOrNull() ?: 0L)
        return Balance.BOARDS.filter { best >= it.unlockScore }
    }

    fun level(id: String): Int = nodeLevels[id] ?: 0
}
