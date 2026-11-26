package com.overclock9.incremental

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.json.JSONObject

private val Context.dataStore by preferencesDataStore(name = "overclock9_settings")

object SettingsKeys {
    val AUDIO = booleanPreferencesKey("audio")
    val HAPTIC = booleanPreferencesKey("haptic")
    val REDUCE_FLASH = booleanPreferencesKey("reduce_flash")
    val COLORBLIND = booleanPreferencesKey("colorblind")
    val LAST_SEEN_MS = longPreferencesKey("last_seen_ms")
}

class SettingsStore(private val context: Context) {
    suspend fun load(): GameSettings {
        val p = context.dataStore.data.first()
        return GameSettings(
            audio = p[SettingsKeys.AUDIO] ?: true,
            haptic = p[SettingsKeys.HAPTIC] ?: true,
            reduceFlash = p[SettingsKeys.REDUCE_FLASH] ?: false,
            colorblind = p[SettingsKeys.COLORBLIND] ?: false,
            lastSeenMs = p[SettingsKeys.LAST_SEEN_MS] ?: 0L
        )
    }

    suspend fun save(settings: GameSettings) {
        context.dataStore.edit { p ->
            p[SettingsKeys.AUDIO] = settings.audio
            p[SettingsKeys.HAPTIC] = settings.haptic
            p[SettingsKeys.REDUCE_FLASH] = settings.reduceFlash
            p[SettingsKeys.COLORBLIND] = settings.colorblind
            p[SettingsKeys.LAST_SEEN_MS] = settings.lastSeenMs
        }
    }
}

data class GameSettings(
    val audio: Boolean = true,
    val haptic: Boolean = true,
    val reduceFlash: Boolean = false,
    val colorblind: Boolean = false,
    val lastSeenMs: Long = 0L
)

class Converters {
    @TypeConverter
    fun fromMap(value: Map<String, Int>): String = JSONObject(value).toString()

    @TypeConverter
    fun toMap(value: String): Map<String, Int> {
        if (value.isBlank()) return emptyMap()
        val json = JSONObject(value)
        return json.keys().asSequence().associateWith { json.getInt(it) }
    }

    @TypeConverter
    fun fromStringList(value: List<String>): String = value.joinToString(",")

    @TypeConverter
    fun toStringList(value: String): List<String> =
        if (value.isBlank()) emptyList() else value.split(',')
}

@Entity(tableName = "progress")
@TypeConverters(Converters::class)
data class ProgressEntity(
    @PrimaryKey val id: Int = 1,
    val creditM: Double,
    val creditE: Int,
    val lifetimeM: Double,
    val lifetimeE: Int,
    val bestM: Double,
    val bestE: Int,
    val fragments: Int,
    val sector: Int,
    val nodeLevels: Map<String, Int>,
    val chipLevels: Map<String, Int>,
    val equippedChips: List<String>,
    val cursorId: String,
    val cursorLevels: Map<String, Int>,
    val bossDefeatedSector: Int,
    val lastActiveAtMs: Long,
    val prestigeCount: Int,
    val dailyStreak: Int,
    val ascension: Int
)

@Dao
interface ProgressDao {
    @Query("SELECT * FROM progress WHERE id = 1")
    suspend fun load(): ProgressEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun save(entity: ProgressEntity)
}

@Database(entities = [ProgressEntity::class], version = 1, exportSchema = false)
@TypeConverters(Converters::class)
abstract class ProgressDatabase : RoomDatabase() {
    abstract fun progressDao(): ProgressDao

    companion object {
        fun build(context: Context): ProgressDatabase =
            Room.databaseBuilder(context, ProgressDatabase::class.java, "overclock9.db").build()
    }
}

/** Adaptador sin coroutines para el esqueleto; en producción usar Dispatchers.IO. */
class RoomProgressStore(private val dao: ProgressDao) : ProgressStore {
    override fun load(): PlayerProgress = runBlocking {
        val e = dao.load() ?: return@runBlocking PlayerProgress()
        PlayerProgress(
            credits = Scaled(e.creditM, e.creditE),
            lifetimeCredits = Scaled(e.lifetimeM, e.lifetimeE),
            fragments = e.fragments,
            sector = e.sector,
            nodeLevels = e.nodeLevels,
            chipLevels = e.chipLevels,
            equippedChips = e.equippedChips,
            cursorId = e.cursorId,
            cursorLevels = e.cursorLevels,
            bestCycleCredits = Scaled(e.bestM, e.bestE),
            bossDefeatedSector = e.bossDefeatedSector,
            lastActiveAtMs = e.lastActiveAtMs,
            prestigeCount = e.prestigeCount,
            dailyStreak = e.dailyStreak,
            ascension = e.ascension
        )
    }

    override fun save(progress: PlayerProgress) = runBlocking {
        dao.save(
            ProgressEntity(
                creditM = progress.credits.m, creditE = progress.credits.e,
                lifetimeM = progress.lifetimeCredits.m, lifetimeE = progress.lifetimeCredits.e,
                bestM = progress.bestCycleCredits.m, bestE = progress.bestCycleCredits.e,
                fragments = progress.fragments,
                sector = progress.sector,
                nodeLevels = progress.nodeLevels,
                chipLevels = progress.chipLevels,
                equippedChips = progress.equippedChips,
                cursorId = progress.cursorId,
                cursorLevels = progress.cursorLevels,
                bossDefeatedSector = progress.bossDefeatedSector,
                lastActiveAtMs = progress.lastActiveAtMs,
                prestigeCount = progress.prestigeCount,
                dailyStreak = progress.dailyStreak,
                ascension = progress.ascension
            )
        )
    }
}
