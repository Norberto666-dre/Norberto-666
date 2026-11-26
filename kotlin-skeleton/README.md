# OVERCLOCK 9 — Esqueleto Kotlin / Jetpack Compose

Carpeta de **diseño técnico**, no un proyecto Android Studio completo. Contiene las clases base para portar la build web v2 a Android (minSdk 24). No hay IAP ni multijugador.

| Archivo | Responsabilidad |
|---|---|
| `Balance.kt` | Espejo de `js/balance.js`: voltaje, tableros, jefes, Nova, rojo, clústers y Falso Final |
| `VoltageState.kt` | Voltaje-vida: drenaje, tier `×1…×5`, congelación y penalizaciones rojas |
| `Model.kt` | `SkillNode`, `Chip`, `Cursor`, `PlayerProgress` |
| `Economy.kt` | `Scaled` (mantisa+exponente), hitos de combo y créditos `floor(score/10)` |
| `PrestigeManager.kt` | Reinicio de Núcleo |
| `Effects.kt` | Nova de una explosión, partículas y estelas; FX del antiguo Overdrive reutilizados en Pesadilla |
| `GameLoop.kt` | Bucle que separa tiempo real y tiempo de juego, con drenaje de voltaje por frame |
| `Persistence.kt` | Room (progreso) + DataStore (ajustes) + offline |
| `ui/IncrementalScreen.kt` | UI vertical móvil: árbol, tienda, mejoras y prestigio |

## Notas de integración

- El voltaje sustituye al temporizador: drena `3.0 + 0.4×(sector−1)` por segundo (`×0.8` con jefe vivo, `+5` por núcleo rojo activo). Llegar a 0 cierra el ciclo/run y liquida `floor(score/10)` CR.
- Llenar la barra sube un tier de multiplicador hasta `×5`; se conserva durante toda la run de hasta 999 ciclos. Se requiere rearmar por debajo de 95 para volver a subir.
- Tableros: `3×3` inicial, `4×3` a 100 000 puntos y `5×4` a 1 000 000. El Diario fuerza `3×3`, sin jefe, sin núcleo blanco y con `Loadout.daily()`.
- Overdrive ya no es mecánica. `timeScale` queda reservado para depuración/editor y debe ser `1.0` en partida; la banda y el destello pertenecen ahora al Falso Final (5 s de congelación y skin Pesadilla).
- Los jefes aparecen cada 5 ciclos, ocupan un hoyo real, se teletransportan y exigen impactos activos; Nova solo aporta 60 de daño sin dar voltaje.
- Los efectos se alimentan con `dtReal × timeScale`; el hit-stop usa `dtReal` para no estirarse en cámara lenta. `EffectSystem.nova()` es una sola explosión que paga el valor de los núcleos eliminados (`Balance.Nova.CORE_VALUES`); no hay ondas diferidas ni porcentajes.
- La aparición de núcleos es progresiva (`Balance.Spawn`): empieza muy lenta (2.2 s entre núcleos) y termina muy rápida (0.35 s) a lo largo de `RAMP_SECONDS`.
- `EconomyManager.closeCycle()` consume un `CycleSummary` con `voltageTier`, `board` y `fakeEndings` además del resumen clásico.
- Todas las constantes viven en `Balance.kt`; `docs/INCREMENTAL_DESIGN.md` explica la intención de balance.
- Para compilar: añadir Gradle (AGP 8.x, Kotlin 1.9, Compose BOM, Room y DataStore Preferences) y copiar estos archivos bajo `app/src/main/java/com/overclock9/incremental/`.
