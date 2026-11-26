package com.overclock9.incremental.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.overclock9.incremental.Branch
import com.overclock9.incremental.Chip
import com.overclock9.incremental.CursorUnlock
import com.overclock9.incremental.CURSORS
import com.overclock9.incremental.EffectSystem
import com.overclock9.incremental.PlayerProgress
import com.overclock9.incremental.Rarity
import com.overclock9.incremental.Scaled
import com.overclock9.incremental.SkillNode

private val Bg = Color(0xFF040408)
private val Panel = Color(0xFF121222)
private val Cyan = Color(0xFF00F3FF)
private val Gold = Color(0xFFFFCC00)
private val Magenta = Color(0xFFCC00FF)
private val Dim = Color(0xFF9A9AB5)

private fun rarityColor(r: Rarity) = when (r) {
    Rarity.COMUN -> Dim
    Rarity.RARO -> Cyan
    Rarity.EPICO -> Magenta
    Rarity.LEGENDARIO -> Gold
}

/** UI vertical móvil: HUD diegético + árbol / tienda / mejoras / prestigio. */
@Composable
fun IncrementalScreen(
    progress: PlayerProgress,
    previewFragments: Int,
    effects: EffectSystem,
    onBuyNode: (String) -> Unit,
    onBuyChip: (String) -> Unit,
    onEquipChip: (String) -> Unit,
    onBuyCursor: (String) -> Unit,
    onPrestige: () -> Unit,
    onBack: () -> Unit
) {
    var tab by remember { mutableIntStateOf(0) }
    val tabs = listOf("ÁRBOL", "TIENDA", "MEJORAS", "NÚCLEO")

    Column(
        Modifier.fillMaxSize().background(Bg).padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        DiegeticHud(progress, effects)
        Spacer(Modifier.height(8.dp))
        TabRow(
            selectedTabIndex = tab,
            containerColor = Panel,
            contentColor = Cyan
        ) {
            tabs.forEachIndexed { i, label ->
                Tab(selected = tab == i, onClick = { tab = i }, text = { Text(label, fontSize = 11.sp) })
            }
        }
        Spacer(Modifier.height(8.dp))
        when (tab) {
            0 -> TreeTab(progress, onBuyNode)
            1 -> CursorTab(progress, onBuyCursor)
            2 -> ChipTab(progress, onBuyChip, onEquipChip)
            3 -> PrestigeTab(progress, previewFragments, onPrestige)
        }
        Spacer(Modifier.height(8.dp))
        Button(
            onClick = onBack,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = Panel, contentColor = Cyan)
        ) { Text("VOLVER A LA CABINA") }
    }
}

@Composable
private fun DiegeticHud(progress: PlayerProgress, effects: EffectSystem) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Panel),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(Modifier.padding(10.dp)) {
            Text(
                "OVERCLOCK 9 · NÚCLEO",
                color = Cyan,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("CR ${progress.credits.format()}", color = Gold, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Text("FN ${progress.fragments}", color = Magenta, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Text("S${progress.sector}", color = Cyan, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Text("RACHA ${progress.dailyStreak}", color = Dim, fontSize = 12.sp)
            }
            // Vista previa de la onda Nova: el mismo EffectSystem del juego, sin assets.
            Canvas(Modifier.fillMaxWidth().height(54.dp)) { effects.draw(this) }
        }
    }
}

@Composable
private fun TreeTab(progress: PlayerProgress, onBuy: (String) -> Unit) {
    val groups = SkillNode.ALL.groupBy { it.branch }
    LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        groups.forEach { (branch, nodes) ->
            item {
                Text(
                    when (branch) {
                        Branch.PULSO -> "PULSO · REFLEJO"
                        Branch.NUCLEO -> "NÚCLEO · PODER"
                        Branch.ECO -> "ECO · INCREMENTAL"
                        Branch.SUPERVIVENCIA -> "SUPERVIVENCIA"
                        Branch.PROGRESION -> "SECTORES"
                    },
                    color = Gold, fontSize = 11.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 6.dp)
                )
            }
            items(nodes) { node -> NodeRow(node, progress, onBuy) }
        }
    }
}

@Composable
private fun NodeRow(node: SkillNode, progress: PlayerProgress, onBuy: (String) -> Unit) {
    val level = progress.level(node.id)
    val unlocked = node.unlockedBy(progress.nodeLevels)
    val cost = Scaled.of(node.cost(level))
    val affordable = progress.credits >= cost
    Card(colors = CardDefaults.cardColors(containerColor = Panel), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(node.name, color = if (unlocked) Color.White else Dim, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                Text(node.description, color = Dim, fontSize = 10.sp)
                Text("NV $level/${node.maxLevel} · ${node.cost(level).toLong()} CR", color = Gold, fontSize = 10.sp)
            }
            Button(
                onClick = { onBuy(node.id) },
                enabled = unlocked && affordable && level < node.maxLevel,
                colors = ButtonDefaults.buttonColors(containerColor = Cyan.copy(alpha = 0.18f), contentColor = Cyan)
            ) { Text("+", fontSize = 16.sp) }
        }
    }
}

@Composable
private fun CursorTab(progress: PlayerProgress, onBuy: (String) -> Unit) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        items(CURSORS) { cursor ->
            val level = progress.cursorLevels[cursor.id] ?: 0
            val cost = if (level == 0 && cursor.unlock is CursorUnlock.Shop)
                Scaled.of(cursor.unlock.credits) else Scaled.of(cursor.upgradeCost(level))
            val owned = when (val u = cursor.unlock) {
                CursorUnlock.Free -> true
                is CursorUnlock.Shop -> level > 0 || progress.credits >= cost
                is CursorUnlock.Boss -> progress.bossDefeatedSector >= u.sector
                is CursorUnlock.Prestige -> progress.fragments >= u.fragments
            }
            Card(colors = CardDefaults.cardColors(containerColor = Panel), modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            cursor.name + if (progress.cursorId == cursor.id) " · ACTIVO" else "",
                            color = if (owned) Gold else Dim, fontSize = 13.sp, fontWeight = FontWeight.Bold
                        )
                        Text(cursor.description, color = Dim, fontSize = 10.sp)
                        Text(
                            when (val u = cursor.unlock) {
                                CursorUnlock.Free -> "Inicial"
                                is CursorUnlock.Shop -> "${cost.toLong()} CR"
                                is CursorUnlock.Boss -> "Jefe sector ${u.sector}"
                                is CursorUnlock.Prestige -> "${u.fragments} FN"
                            },
                            color = Cyan, fontSize = 10.sp
                        )
                    }
                    Button(onClick = { onBuy(cursor.id) }, enabled = owned && level < 4) { Text(if (level == 0) "EQ" else "+") }
                }
            }
        }
    }
}

@Composable
private fun ChipTab(
    progress: PlayerProgress,
    onBuy: (String) -> Unit,
    onEquip: (String) -> Unit
) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        items(Chip.ALL) { chip ->
            val level = progress.chipLevels[chip.id] ?: 0
            val equipped = chip.id in progress.equippedChips
            Card(colors = CardDefaults.cardColors(containerColor = Panel), modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(chip.name, color = rarityColor(chip.rarity), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        Text("${chip.rarity} · NV $level/${chip.maxLevel}", color = Dim, fontSize = 10.sp)
                        Text("${chip.cost(level).toLong()} CR", color = Gold, fontSize = 10.sp)
                    }
                    Button(onClick = { onEquip(chip.id) }, enabled = level > 0 || equipped) {
                        Text(if (equipped) "ON" else "EQ")
                    }
                    Button(onClick = { onBuy(chip.id) }, enabled = level < chip.maxLevel) { Text("+") }
                }
            }
        }
    }
}

@Composable
private fun PrestigeTab(progress: PlayerProgress, preview: Int, onPrestige: () -> Unit) {
    val can = progress.bossDefeatedSector >= 2 && progress.lifetimeCredits >= Scaled.of(10_000.0)
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Card(colors = CardDefaults.cardColors(containerColor = Panel), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp)) {
                Text("REINICIO DE NÚCLEO", color = Magenta, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Text(
                    "La cabina se apaga. Los fragmentos de la máquina anterior vuelven a latir.",
                    color = Dim, fontSize = 11.sp
                )
                Spacer(Modifier.height(8.dp))
                Text("Requisito: jefe S2+ y 10 000 CR de vida", color = if (can) Cyan else Dim, fontSize = 11.sp)
                Text("Fragmentos a ganar: +$preview", color = Gold, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Text("Se borran: CR, nodos, Chips comunes/raros/épicos, Cursores", color = Dim, fontSize = 10.sp)
                Text("Se conservan: FN, Sectores, racha, Chips Legendarios", color = Dim, fontSize = 10.sp)
            }
        }
        Button(
            onClick = onPrestige, enabled = can,
            colors = ButtonDefaults.buttonColors(containerColor = Magenta, contentColor = Color.White),
            modifier = Modifier.fillMaxWidth()
        ) { Text("REINICIAR NÚCLEO") }
    }
}
