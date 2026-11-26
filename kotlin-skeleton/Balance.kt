package com.overclock9.incremental

/**
 * Valores iniciales de la build v2. Espejo de `js/balance.js`.
 * Todos son ajustables con telemetría; ninguna lógica debe escribir constantes sueltas.
 */
object Balance {
    const val VOLTAGE_MAX = 100.0
    const val VOLTAGE_START = 100.0
    const val DRAIN_PER_SEC = 3.0
    const val DRAIN_PER_SECTOR = 0.4
    const val BOSS_DRAIN_MULT = 0.8
    const val REARM_BELOW = 95.0
    const val MAX_TIER = 5
    const val TIER_REFILL = 0.15 // 15 % de margen al subir de peldaño
    const val EMPTY_REFILL = 0.15 // al vaciarse: baja un peldaño y recarga el margen
    const val FREEZE_SECONDS = 5.0

    const val CREDITS_PER_SCORE = 0.1
    const val MAX_CYCLES = 999
    const val BOSS_EVERY = 5
    const val BOSS_KILL_SCORE = 5_000.0

    /** Voltaje ganado por tipo de núcleo. El jefe nunca recarga. */
    val VOLTAGE_GAIN = mapOf(
        "normal" to 2.0,
        "perfect" to 3.0,
        "connected" to 4.0,
        "boss" to 0.0,
        "crono" to 4.0,
        "nova" to 6.0
    )

    object Red {
        const val DRAIN_PER_SEC = 5.0
        const val TAP_PENALTY = 8.0
        const val ESCAPE_PENALTY = 10.0
        const val TAP_COMBO = 1
        const val TAP_COMBO_LINKED = 2
        const val DRAG_THRESHOLD_PX = 60f
    }

    object Core {
        // El peor núcleo paga 20 puntos antes de multiplicadores.
        val VALUES = mapOf(
            "standard" to 20, "crono" to 40, "bomb" to 20,
            "nova" to 60, "white" to 100
        )
        const val CLUSTER_PER_CORE = 20
        const val BOSS_HIT = 20
    }

    object Boss {
        // Uno cada 5 ciclos; cada vuelta completa sube el nivel del jefe.
        val ROTATION = listOf(
            "golem", "mirror", "prisma", "crio", "sobrecarga",
            "sifon", "taquigrafo", "enjambre", "apagon", "cerrojo"
        )
        const val HIT_PERCENT = 0.05 // 20 golpes = 100 %
        const val LEVEL_HP_STEP = 0.12
        const val TELEPORT_EVERY = 3.0
        const val VANISH_SECONDS = 0.25
        const val ARRIVE_SECONDS = 0.4
        val HP = mapOf(
            "golem" to 300.0, "mirror" to 260.0, "prisma" to 240.0,
            "crio" to 220.0, "sobrecarga" to 280.0, "sifon" to 260.0,
            "taquigrafo" to 240.0, "enjambre" to 280.0,
            "apagon" to 260.0, "cerrojo" to 300.0
        )
        object Env {
            const val SIPHON_DRAIN_PER_LEVEL = 2.5
            const val TEMPO_FACTOR_PER_LEVEL = 0.08
            const val SWARM_FACTOR_PER_LEVEL = 0.12
            const val BLOCK_SECONDS = 3.2
            const val BLACKOUT_TELEGRAPH = 0.06
        }
    }

    object Nova {
        // Una sola explosión que paga el valor real de los núcleos eliminados.
        val CORE_VALUES get() = Core.VALUES
        const val HIT_STOP = 0.12
        const val SHAKE = 18f
        const val FLASH = 0.55f
    }

    object Spawn {
        // Ritmo progresivo de aparición: muy lento al inicio, muy rápido al final.
        const val START_INTERVAL = 2.2
        const val MIN_INTERVAL = 0.35
        const val RAMP_SECONDS = 180.0
    }

    object White {
        const val MIN_COMBO = 5
        const val MAX_VOLTAGE = 60.0
        const val SCORE_BONUS = 100.0
    }

    object Links {
        const val CHANCE_BASE = 0.34
        const val CHANCE_PER_SECTOR = 0.03
        const val MAX_SIZE = 3
        const val TRAP_WINDOW = 1.2
        const val TRAPPED_LIFE_BONUS = 0.6
        const val COMBO_PER_EXTRA = 1
        const val BONUS_PER_CORE = 20.0
    }

    val BOARDS = listOf(
        BoardSpec(BoardId.THREE_BY_THREE, 3, 3, 0, "3×3"),
        BoardSpec(BoardId.FOUR_BY_THREE, 4, 3, 100_000, "4×3"),
        BoardSpec(BoardId.FIVE_BY_FOUR, 5, 4, 1_000_000, "5×4")
    )
}

enum class BoardId(val key: String) {
    THREE_BY_THREE("3x3"),
    FOUR_BY_THREE("4x3"),
    FIVE_BY_FOUR("5x4");

    companion object {
        fun from(key: String): BoardId = values().firstOrNull { it.key == key } ?: THREE_BY_THREE
    }
}

data class BoardSpec(
    val id: BoardId,
    val cols: Int,
    val rows: Int,
    val unlockScore: Long,
    val label: String
)

/** Carga fija del reto diario: preserva la comparabilidad por fecha. */
data class Loadout(
    val hammer: String = "pulso",
    val chips: List<String> = emptyList(),
    val upgrades: Map<String, Int> = emptyMap(),
    val abilities: Map<String, Int> = emptyMap()
) {
    companion object {
        fun daily() = Loadout()
    }
}
