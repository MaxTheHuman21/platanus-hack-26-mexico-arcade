# Implementation Plan: Banana Chilanga

## Overview

Implementación completa del juego arcade "Banana Chilanga" en `game.js` usando Phaser 3 (v3.87.0) con JavaScript puro. El juego es un plataformero al estilo NES con temática CDMX: 3 niveles + jefe final, gráficos procedurales, power-ups, HUD y persistencia de HighScore. El único archivo a modificar es `game.js` (≤ 50 KB minificado).

## Tasks

- [x] 1. Refactorizar la estructura base: módulos funcionales y GameState
  - Reemplazar el `Phaser.Game` actual (escena única `preload/create/update`) por un objeto `Phaser.Game` que registre las 6 escenas: `BootScene`, `MenuScene`, `GameScene`, `BossScene`, `GameOverScene`, `WinScene`.
  - Definir el singleton `GameState` con campos: `score`, `highScore`, `lives`, `level`, `powerState`, `paused`; inicializarlo con valores por defecto y exponerlo en `this.registry` de Phaser.
  - Implementar los módulos funcionales `AudioManager` (8 funciones de sonido) y `StorageAdapter` (`loadHighScore`, `saveHighScore`) con manejo de errores silencioso.
  - Mantener el objeto `CABINET_KEYS` existente intacto; agregar solo entradas de prueba local si se necesitan (`P1_U: ['w']` ya existe, no tocarlo).
  - _Requirements: 1.1, 1.6, 1.7, 2.8, 8.5, 8.6, 8.7, 10.1, 10.4, 10.7, 10.8_

- [x] 2. Implementar BootScene: generación de texturas y carga de HighScore
  - [x] 2.1 Crear la clase `BootScene` con `create()` que genere las 18 texturas requeridas usando el helper `_genTex(key, w, h, drawFn)`.
    - Texturas: `banana` (20×30, amarillo con ojos), `banana-sombrero` (24×36, sombrero charro + bigote), `banana-salsa` (24×36, aura roja), `microbus` (40×25, rosa/rojo, 2 ventanas, 2 ruedas), `chilango` (20×36, humanoide: cabeza circular + cuerpo rect + piernas), `boss` (120×80, microbús grande con marcadores de vida), `powerup-sombrero` (20×20, sombrero charro), `powerup-salsa` (12×24, botella de salsa), `coin` (12×12, círculo dorado), `qblock` (20×20, bloque amarillo con "?"), `platform` (80×16, marrón), `checkpoint` (30×50, letrero "PARADA"), `fireball` (8×8, bola de fuego naranja), `particle` (4×4, cuadrado blanco), `bg-tiles-1` (800×600, calles CDMX), `bg-tiles-2` (800×600, mercado), `bg-tiles-3` (800×600, metro/túnel), `bg-boss` (800×600, tráfico caótico).
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  - [x]* 2.2 Verificar que `BootScene` genera exactamente las 18 claves de textura listadas (test de ejemplo).
    - Confirmar con `this.textures.exists(key)` para cada clave; ninguna debe fallar.
    - _Requirements: 2.1_
  - [x] 2.3 En `BootScene.create()`, llamar a `StorageAdapter.loadHighScore()` y almacenar el resultado en `this.registry`; luego iniciar `MenuScene`.
    - _Requirements: 8.6, 8.7, 10.8_

- [ ] 3. Implementar MenuScene
  - [x] 3.1 Crear la clase `MenuScene` con `create()` que dibuje título "BANANA CHILANGA", HighScore y el texto exacto "Presiona START para jugar" centrados en el lienzo 800×600.
    - _Requirements: 9.4_
  - [ ] 3.2 En `MenuScene.update()` detectar START1 e iniciar `GameScene` con `{ level: 1 }`.
    - _Requirements: 1.1, 9.5_

- [ ] 4. Checkpoint 1 — Asegurar arranque de escenas
  - Asegurar que el juego arranca sin errores: BootScene completa → MenuScene visible con título e instrucción.
  - Ejecutar `npm run check-restrictions` y confirmar que el archivo sigue ≤ 50 KB.
  - Asegurar que todos los tests pasan; preguntar al usuario si surgen dudas.

- [x] 5. Implementar módulos funcionales puros (lógica extraíble)
  - [x] 5.1 Implementar `applyTransition(state, event)`: máquina de estados de PowerState.
    - Inputs: `state` ∈ {`plain`, `sombrero`, `salsa`}, `event` ∈ {`powerup-sombrero`, `powerup-salsa`, `damage`}.
    - Tabla completa de transiciones según el diseño (sección Data Models → PowerState).
    - Siempre retorna un valor dentro del conjunto {`plain`, `sombrero`, `salsa`}.
    - _Requirements: 3.2, 3.7, 3.8, 3.9_
  - [x]* 5.2 Escribir property test para `applyTransition` — Property 1: Transiciones correctas y completas.
    - **Property 1: PowerState transitions are correct and complete**
    - **Validates: Requirements 3.2, 3.7, 3.8, 3.9**
    - Para cualquier `state` y `event` válidos, el resultado siempre pertenece a {`plain`, `sombrero`, `salsa`} y coincide con la tabla de transiciones.
  - [x] 5.3 Implementar `addScore(score, action)`: aritmética de puntuación (+50 moneda, +100 stomp, +200 fireball, +500 checkpoint).
    - Retorna exactamente `score + delta(action)`; nunca negativo.
    - _Requirements: 5.5, 5.6, 6.5, 8.3, 8.4_
  - [ ]* 5.4 Escribir property test para `addScore` — Property 4: Aritmética de puntuación es aditiva y correcta.
    - **Property 4: Score arithmetic is additive and correct**
    - **Validates: Requirements 5.5, 5.6, 6.5, 8.3, 8.4**
  - [x] 5.5 Implementar `isGameOver(lives)`: retorna `true` si `lives ≤ 0`, `false` si `lives > 0`.
    - _Requirements: 1.2, 8.9_
  - [ ]* 5.6 Escribir property test para `isGameOver` — Property 5: Condición de GameOver cuando lives ≤ 0.
    - **Property 5: GameOver condition when lives ≤ 0**
    - **Validates: Requirements 1.2, 8.9**
  - [x] 5.7 Implementar `shouldDestroyFireball(bounceCount)`: `false` para bounceCount ∈ {0,1,2}, `true` para bounceCount === 3.
    - _Requirements: 3.6_
  - [ ]* 5.8 Escribir property test para `shouldDestroyFireball` — Property 3: Fireball se destruye exactamente en el tercer rebote.
    - **Property 3: Fireball is destroyed exactly on the third bounce**
    - **Validates: Requirements 3.6**
  - [x] 5.9 Implementar `spawnFireball(lastDir, fireballActive)`: retorna descripción de Fireball o `null` si ya existe una activa.
    - Si `fireballActive === false`: `velocityX = lastDir === 'right' ? 300 : -300`.
    - Si `fireballActive === true`: retorna `null` (idempotencia).
    - _Requirements: 3.5, 3.10_
  - [ ]* 5.10 Escribir property test para `spawnFireball` — Property 2: Invariantes de spawn de Fireball.
    - **Property 2: Fireball spawn invariants**
    - **Validates: Requirements 3.5, 3.10**
  - [x] 5.11 Implementar `hitBlock(block)`: dado un QuestionBlock con `used` flag, revela ítem exactamente una vez; idempotente tras primer golpe.
    - _Requirements: 6.4_
  - [ ]* 5.12 Escribir property test para `hitBlock` — Property 6: QuestionBlock es idempotente tras el primer golpe.
    - **Property 6: QuestionBlock is idempotent after first hit**
    - **Validates: Requirements 6.4**
  - [x] 5.13 Implementar `damageBoss(boss)` y `getBossSpeed(hp)`: reducción de HP, timer de invulnerabilidad 1000 ms, velocidad 250 si hp ≤ 2, 150 si hp > 2.
    - _Requirements: 7.4, 7.5, 7.7_
  - [ ]* 5.14 Escribir property test para `damageBoss`/`getBossSpeed` — Property 7: Daño al Boss y velocidad como funciones de HP.
    - **Property 7: Boss damage and speed are correct functions of HP**
    - **Validates: Requirements 7.4, 7.5, 7.7**
  - [x] 5.15 Implementar `validateHighScore(v)`: retorna `v` solo si es entero ≥ 0; en caso contrario retorna `0`.
    - _Requirements: 8.7, 10.8_
  - [ ]* 5.16 Escribir property test para `validateHighScore` — Property 8: Validación de HighScore acepta solo enteros no negativos.
    - **Property 8: HighScore validation accepts only non-negative integers**
    - **Validates: Requirements 8.7, 10.8**

- [x] 6. Implementar PlayerController: física, movimiento y estados de la Banana
  - [x] 6.1 Implementar `createPlayer(scene, x, y)`: crea el sprite `banana` con física Arcade, `setCollideWorldBounds(true)`, `maxVelocity(200, 500)`, `dragX(1200)`, `bounceY(0.1)`, PowerState inicial `plain`.
    - _Requirements: 3.1, 4.1, 4.2, 4.4_
  - [x] 6.2 Implementar `handleInput(scene, player, keys, delta)`: movimiento horizontal (accel 2000 px/s², max 200 px/s), salto desde suelo (velocityY −450 px/s) con animación stretch (scaleX 0.8, scaleY 1.2, 80 ms), squash al aterrizar (scaleX 1.3, scaleY 0.7, 100 ms).
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7_
  - [x] 6.3 Implementar `applyPowerState(scene, player, state)`: ajusta tamaño visual del sprite (`plain` 20×30, `sombrero` 24×36, `salsa` 24×36), muestra/oculta sombrero charro y bigote procedurales, muestra/oculta aura roja.
    - Usar `applyTransition` (tarea 5.1) para cambios de estado.
    - _Requirements: 2.2, 3.1, 3.2, 3.4, 3.7, 3.8_
  - [x] 6.4 Implementar `takeDamage(scene, player)`: hace downgrade de PowerState vía `applyTransition(state, 'damage')`; si `plain` → pierde 1 Life y activa 2 s de invulnerabilidad con parpadeo a 8 Hz (8 ciclos visible/invisible por segundo).
    - _Requirements: 3.7, 3.8, 3.9, 8.8_
  - [x] 6.5 Implementar `spawnFireballSprite(scene, player)`: usa `spawnFireball` (tarea 5.9) para crear el sprite `fireball` con física, `velocityX ±300`, `bounceY 0.6`; contar rebotes y destruir al 3er rebote usando `shouldDestroyFireball` (tarea 5.7); destruir al salir de worldBounds.
    - _Requirements: 3.5, 3.6, 3.10_
  - [ ]* 6.6 Escribir tests unitarios para `handleInput`: verificar aceleración, velocidad máxima y que el salto solo ocurre cuando `body.touching.down === true`.
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 7. Implementar generación de niveles (LevelBuilder) y fondos temáticos
  - [x] 7.1 Definir la estructura de datos declarativa `LEVELS` (array con id 1–3): `name`, `width` (≥ 3200 px), `bgTheme`, `platforms` (al menos escalonadas, horizontales y combinadas entre los 3 niveles), `enemies`, `coins` (≥ 8 por nivel), `qblocks`, `checkpointX`.
    - _Requirements: 6.1, 6.3, 6.5, 6.8_
  - [x] 7.2 Implementar `_buildBackground(scene, level)`: dibuja fondo temático con `Graphics` usando la textura `bg-tiles-{level}` generada en BootScene.
    - Nivel 1 (Calles): edificios, señales de tráfico CDMX.
    - Nivel 2 (Mercado): puestos, colores vivos, toldos.
    - Nivel 3 (Metro): túneles oscuros, rieles, letreros de metro.
    - _Requirements: 6.2_
  - [x] 7.3 Implementar `_buildLevel(scene, levelData)`: crear plataformas estáticas con `physics.add.staticGroup` usando la textura `platform`; crear monedas, QuestionBlocks y el Checkpoint; configurar límites de cámara al ancho del nivel; activar `camera.startFollow(player)`.
    - _Requirements: 6.3, 6.4, 6.7, 6.8_
  - [ ]* 7.4 Escribir test de ejemplo: `_buildLevel` con nivel 1 genera ≥ 8 monedas y 1 Checkpoint.
    - _Requirements: 6.1, 6.5_

- [x] 8. Implementar EnemyManager: Microbús, Chilango_Enojado y colisiones
  - [x] 8.1 Implementar spawn de Microbús en `_spawnEnemies`: sprite `microbus`, velocidad 60–120 px/s, inversión de dirección al borde de plataforma o colisión con muro.
    - _Requirements: 5.1, 5.2_
  - [x] 8.2 Implementar spawn de Chilango_Enojado: sprite `chilango`, persecución a 100 px/s cuando `distancia < 200 px`, deambular aleatorio con inversión cada 1000–2000 ms cuando `distancia ≥ 200 px`.
    - _Requirements: 5.1, 5.3, 5.4_
  - [x] 8.3 Implementar callbacks de colisión: `_onEnemyStomp` (jugador encima, velocityY ≥ 0 → enemy.disableBody, +100 pts, bounce −300 px/s), `_onFireballHit` (fireball + enemy → enemy.disableBody, +200 pts), destrucción automática si `enemy.y > worldHeight`.
    - Emitir partículas con `Phaser.GameObjects.Particles` en la posición del enemy eliminado.
    - Usar `addScore` (tarea 5.3) para sumar puntos.
    - _Requirements: 5.5, 5.6, 5.7, 5.8_
  - [ ]* 8.4 Escribir tests unitarios para `_onEnemyStomp`: verificar que score sube exactamente 100 pts y que el bounce vertical es −300 px/s.
    - _Requirements: 5.5_

- [x] 9. Implementar GameScene completa (niveles 1–3) y transición a BossScene
  - [x] 9.1 Crear clase `GameScene` con `init(data)`, `create()` y `update(time, delta)`. En `create()`: construir nivel (`_buildLevel`), instanciar player (`createPlayer`), spawnear enemigos, pickups y checkpoint, construir HUD, configurar todas las colisiones/overlaps de Arcade Physics.
    - _Requirements: 1.1, 6.1, 6.7_
  - [x] 9.2 En `GameScene.update()`: llamar a `handleInput`, mover enemigos, gestionar Fireball, actualizar HUD, detectar game-over (`isGameOver`), gestionar pausa.
    - _Requirements: 4.7, 9.1, 9.2_
  - [x] 9.3 Implementar `_onCheckpointReach`: animación de celebración ≥ 1 s (Banana saltando o confeti con `Graphics`), sumar +500 pts con `addScore`, luego transicionar a siguiente nivel o a `BossScene` si `level === 3`.
    - _Requirements: 6.6, 8.4_
  - [x] 9.4 Implementar `_onBlockHit`: si `player.body.touching.up`, marcar QuestionBlock como `used`, revelar PowerUp o moneda según PowerState usando `hitBlock` (tarea 5.11).
    - _Requirements: 3.3, 6.4_
  - [x] 9.5 Implementar `_onPickupPowerUp`: cambiar PowerState con `applyTransition`, llamar `applyPowerState`.
    - _Requirements: 3.2, 3.4_
  - [x] 9.6 Implementar `_onPlayerDamage`: llamar `takeDamage`; si lives > 0, reaparecer en inicio del nivel con PowerState `plain`; si lives ≤ 0, guardar HighScore y transicionar a `GameOverScene`.
    - _Requirements: 3.7, 3.8, 3.9, 8.8, 8.9_
  - [x] 9.7 Implementar lógica de pausa (`_togglePause`): START1 → `scene.physics.pause()`, overlay semitransparente "PAUSA"; START2 en pausa → `scene.physics.resume()` + transicionar a `MenuScene` reiniciando `GameState`.
    - _Requirements: 9.1, 9.2, 9.3_
  - [ ]* 9.8 Escribir test de ejemplo: flujo nivel 3 completado → `BossScene` arranca con `GameState.level === 3`.
    - _Requirements: 1.1, 6.6_

- [x] 10. Checkpoint 2 — Verificar flujo completo de niveles 1–3
  - Confirmar que los 3 niveles se suceden correctamente, el HUD se actualiza y el HighScore persiste.
  - Ejecutar `npm run check-restrictions`; si el tamaño supera 50 KB, reducir vértices en rutinas `Graphics` y/o acortar nombres de variables.
  - Asegurar que todos los tests pasan; preguntar al usuario si surgen dudas.

- [x] 11. Implementar BossScene: arena, El Microbús Maldito y barra de vida
  - [x] 11.1 Crear clase `BossScene` con `create()`: construir arena con `_buildArena()` (fondo `bg-boss`, plataformas), spawnear player (`createPlayer`) y Boss (`_spawnBoss`), construir HUD con barra de vida.
    - Boss: sprite `boss` 120×80, HP 5, velocidad inicial 150 px/s.
    - _Requirements: 7.1, 7.2, 7.8_
  - [x] 11.2 Implementar `BossScene.update()`: mover Boss horizontalmente invirtiendo al alcanzar límites de arena, gestionar input del jugador (movimiento, salto, fireball), detectar proyectiles del Boss.
    - _Requirements: 7.3_
  - [x] 11.3 Implementar `_bossJumpTimer()` y `_bossFireTimer()`: timers Phaser para salto cada 3 s (velocityY −400 px/s) y disparo de proyectil cada 4 s hacia la Banana.
    - Proyectil: 200 px/s en dirección de Banana; se destruye al cruzar límites de arena.
    - _Requirements: 7.3, 7.9_
  - [x] 11.4 Implementar `_onBossStomp` y `_onFireballBossHit`: llamar `damageBoss` (tarea 5.13), flash blanco 200 ms, actualizar barra de vida con `_updateBossHealthBar`; aumentar velocidad a 250 px/s cuando `hp ≤ 2` usando `getBossSpeed`.
    - _Requirements: 7.4, 7.5, 7.7_
  - [x] 11.5 Implementar `_onBossDefeated()`: animación de derrota ≥ 2 s (Boss parpadeando y expandiéndose), luego `this.scene.start('Win')`.
    - _Requirements: 7.6_
  - [x] 11.6 Implementar `_onBossProjectileHit`: proyectil impacta Banana → `takeDamage`; si lives ≤ 0 → `GameOverScene`.
    - _Requirements: 7.9, 8.9_
  - [ ]* 11.7 Escribir test de ejemplo: flujo completo BossHP 5→0 con 5 stomps → `WinScene` arranca con score preservado.
    - _Requirements: 7.4, 7.6_

- [x] 12. Implementar HUDLayer y sistema de vidas completo
  - [x] 12.1 Implementar `_buildHUD(scene)`: crear textos fijos (`setScrollFactor(0)`) para Score, Lives (íconos de banana) y HighScore; en BossScene agregar barra de vida del Boss.
    - _Requirements: 8.1, 8.2_
  - [x] 12.2 Implementar `_updateHUD(scene)`: refrescar todos los textos HUD en cada frame; barra de vida del Boss proporcional a HP actual.
    - _Requirements: 8.2_
  - [x] 12.3 Implementar animación de muerte (duración ≤ 1 s): player parpadea en rojo, detiene movimiento, luego reaparece en inicio de nivel o transiciona a GameOverScene.
    - _Requirements: 8.8, 8.9_

- [x] 13. Implementar StorageAdapter y sincronización de HighScore
  - [x] 13.1 Implementar `StorageAdapter.loadHighScore()`: llama `platanusArcadeStorage.get('banana-chilanga/highscore')`; valida resultado con `validateHighScore` (tarea 5.15); retorna 0 si falla o valor inválido.
    - _Requirements: 8.6, 8.7, 10.7, 10.8_
  - [x] 13.2 Implementar `StorageAdapter.saveHighScore(score)`: llama `platanusArcadeStorage.set('banana-chilanga/highscore', score)` envuelto en try/catch; no lanza excepciones; actualiza `GameState.highScore` en memoria antes del set.
    - _Requirements: 8.5, 10.7_
  - [ ]* 13.3 Escribir test de ejemplo: `loadHighScore` con valor `null` retorna `0`; con string retorna `0`; con `-5` retorna `0`; con `3.14` retorna `0`; con `42` retorna `42`.
    - _Requirements: 8.7, 10.8_

- [x] 14. Implementar GameOverScene y WinScene
  - [x] 14.1 Crear `GameOverScene`: mostrar "GAME OVER", Score, HighScore actualizado y "Press START"; START1 → `MenuScene` con `GameState` reiniciado.
    - _Requirements: 1.2, 1.3_
  - [x] 14.2 Crear `WinScene`: mostrar "¡VICTORIA!", Score final, HighScore y "Press START"; START1 → `MenuScene` con `GameState` reiniciado.
    - _Requirements: 1.4, 1.5_
  - [ ]* 14.3 Escribir test de ejemplo: flujo `GameOverScene` con score=500 y highScore anterior=300 → HighScore actualizado a 500 en memoria.
    - _Requirements: 1.2, 8.9_

- [x] 15. Checkpoint 3 — Integración completa y validación de restricciones
  - Probar flujo completo: BootScene → MenuScene → Nivel 1 → Nivel 2 → Nivel 3 → BossScene → WinScene sin crashes.
  - Probar flujo GameOver: jugador pierde 3 vidas → GameOverScene → MenuScene reinicia correctamente.
  - Ejecutar `npm run check-restrictions`: verificar ≤ 50 KB, sin imports, sin URLs externas, sin network calls.
  - Si el tamaño supera 50 KB: reducir capas decorativas en `_buildBackground`, simplificar vértices en los sprites del Boss o enemigos, acortar nombres de variables internas.
  - Asegurar que todos los tests pasan; preguntar al usuario si surgen dudas.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido.
- Cada tarea referencia requerimientos específicos para trazabilidad.
- Los módulos funcionales de la tarea 5 deben exponerse como funciones accesibles en el scope de `game.js` (sin `export`), para poder testearse desde un archivo de test separado que los importa como módulo ESM solo en desarrollo.
- Los tests PBT usan `fast-check` como devDependency; **no se incluyen en el bundle de producción**. Ejecutar con `node --experimental-vm-modules node_modules/.bin/jest` o similar en entorno dev.
- La validación de tamaño (`npm run check-restrictions`) debe ejecutarse después de cada checkpoint.
- Todos los controles deben pasar por `CABINET_KEYS`; nunca usar teclas raw en la lógica principal.
- `window.platanusArcadeStorage` puede no estar disponible; todos los accesos deben manejarse con try/catch y valores por defecto.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "5.1", "5.3", "5.5", "5.7", "5.9", "5.11", "5.13", "5.15"] },
    { "id": 2, "tasks": ["2.2", "2.3", "5.2", "5.4", "5.6", "5.8", "5.10", "5.12", "5.14", "5.16"] },
    { "id": 3, "tasks": ["3.1", "6.1", "7.1"] },
    { "id": 4, "tasks": ["3.2", "6.2", "6.3", "7.2", "7.3"] },
    { "id": 5, "tasks": ["6.4", "6.5", "7.4", "8.1", "8.2"] },
    { "id": 6, "tasks": ["6.6", "8.3", "12.1"] },
    { "id": 7, "tasks": ["8.4", "9.1", "13.1", "13.2"] },
    { "id": 8, "tasks": ["9.2", "9.3", "9.4", "9.5", "9.6", "9.7", "12.2", "12.3", "13.3"] },
    { "id": 9, "tasks": ["9.8", "14.1", "14.2"] },
    { "id": 10, "tasks": ["11.1", "14.3"] },
    { "id": 11, "tasks": ["11.2", "11.3"] },
    { "id": 12, "tasks": ["11.4", "11.5", "11.6"] },
    { "id": 13, "tasks": ["11.7"] }
  ]
}
```
