# Requirements Document

## Introduction

"Banana Chilanga" es un juego arcade de plataformas para un solo jugador, al estilo del Mario Bros clásico de NES, implementado en Phaser 3 (v3.87.0) dentro de un único archivo `game.js` de ≤50 KB minificado. El protagonista es una banana que recorre escenarios icónicos de la Ciudad de México (calles, mercado, metro) para rescatar a su amada, saltando plataformas, eliminando enemigos, recogiendo ítems de poder y derrotando a un jefe final. Todos los gráficos se generan proceduralmente con `Phaser.GameObjects.Graphics` y el audio con la Web Audio API de Phaser.

---

## Glossary

- **Game**: La instancia de `Phaser.Game` que ejecuta todo el juego.
- **Banana**: El personaje protagonista controlado por el jugador (P1).
- **PowerState**: El estado de poder activo de la Banana: `plain` (sin accesorios), `sombrero` (con sombrero charro y bigote) o `salsa` (con bola de fuego disponible).
- **Fireball**: Proyectil disparado por la Banana en estado `salsa`; rebota en el suelo y elimina enemigos.
- **Enemy**: Entidad hostil que daña a la Banana al contacto lateral o frontal; muere al recibir un salto encima o una Fireball.
- **Microbús**: Tipo de Enemy de movimiento horizontal que patrulla plataformas, temática urbana CDMX.
- **Chilango_Enojado**: Tipo de Enemy de movimiento errático que persigue a la Banana cuando está cerca.
- **Boss**: Enemigo especial del último nivel con barra de vida; no muere de un solo golpe.
- **QuestionBlock**: Bloque que al ser golpeado desde abajo revela un PowerUp o moneda.
- **PowerUp**: Ítem revelado por un QuestionBlock o dispuesto en el nivel; otorga a la Banana el siguiente PowerState.
- **Checkpoint**: Parada de microbús al final de cada nivel; al alcanzarla se completa el nivel.
- **Life**: Unidad de vida del jugador; la Banana comienza con 3 Lives y pierde una al morir.
- **Score**: Puntuación acumulada por monedas, ítems y enemigos eliminados.
- **HighScore**: Puntaje máximo histórico, persistido mediante `window.platanusArcadeStorage`.
- **HUD**: Interfaz de usuario superpuesta al juego que muestra Score, Lives y PowerState.
- **BootScene**: Escena de inicialización que genera texturas y configura el juego.
- **MenuScene**: Escena de menú principal con título y opción de inicio.
- **GameScene**: Escena de juego activa para los niveles 1–3.
- **BossScene**: Escena del nivel con jefe final.
- **GameOverScene**: Escena mostrada cuando las Lives llegan a 0.
- **WinScene**: Escena mostrada al completar el BossScene con éxito.
- **CABINET_KEYS**: Mapa de teclas del gabinete arcade físico; no debe modificarse.
- **PlatanusArcadeStorage**: API de persistencia proporcionada por `window.platanusArcadeStorage`.

---

## Requirements

### Requirement 1: Estructura de escenas y flujo de juego

**User Story:** Como jugador, quiero que el juego pase por menú, niveles y pantallas de fin de juego en orden lógico, para que la experiencia sea fluida y comprensible.

#### Acceptance Criteria

1. THE Game SHALL inicializar la secuencia de escenas en el orden: BootScene → MenuScene → GameScene (niveles 1–3) → BossScene → WinScene; ninguna escena SHALL omitirse ni reordenarse durante una partida normal.
2. WHEN el jugador tiene 0 Lives, THE Game SHALL detener la escena activa y mostrar GameOverScene, preservando el Score acumulado hasta ese momento.
3. WHEN el jugador presiona START1 en GameOverScene, THE Game SHALL destruir GameOverScene y reiniciar desde MenuScene con Score = 0, Lives = 3 y PowerState = `plain`.
4. WHEN el jugador completa BossScene, THE Game SHALL mostrar WinScene con el Score final de la partida y el HighScore actualizado.
5. WHEN el jugador presiona START1 en WinScene, THE Game SHALL volver a MenuScene con Score, Lives y PowerState reiniciados a sus valores iniciales.
6. THE Game SHALL ejecutarse en un lienzo de 800 × 600 píxeles con escala automática (`Phaser.Scale.FIT`) sin deformar el contenido del juego.
7. THE Game SHALL usar `Phaser.Physics.Arcade` como único sistema de física con gravedad vertical de 900 px/s² aplicada a todos los cuerpos dinámicos.

---

### Requirement 2: Generación procedural de gráficos y audio

**User Story:** Como desarrollador, quiero que todos los assets se generen en código, para cumplir la restricción de no usar imágenes externas ni superar 50 KB minificado.

#### Acceptance Criteria

1. THE BootScene SHALL generar las texturas con claves `banana`, `banana-sombrero`, `banana-salsa`, `microbus`, `chilango`, `boss`, `powerup-sombrero`, `powerup-salsa`, `coin`, `qblock`, `platform`, `checkpoint` usando `Phaser.GameObjects.Graphics.generateTexture` antes de iniciar MenuScene.
2. THE Game SHALL representar la Banana como una figura de banana amarilla con ojos negros dibujados con `Graphics`; en PowerState `sombrero` SHALL mostrar además un sombrero charro marrón y un bigote negro; en PowerState `salsa` SHALL mostrar adicionalmente un aura roja.
3. THE Game SHALL representar el Microbús como un rectángulo rosa o rojo con al menos 2 ventanas rectangulares y 2 ruedas circulares dibujados con `Graphics`.
4. THE Game SHALL representar el Chilango_Enojado como una figura humanoide simplificada con al menos una cabeza circular, un cuerpo rectangular y dos piernas rectangulares dibujada con `Graphics`.
5. THE Game SHALL representar el Boss como un Microbús de al menos 120 × 80 px con marcadores de vida dibujados con `Graphics` sobre su superficie.
6. THE Game SHALL representar cada PowerUp con un ícono visualmente distinto generado con `Graphics`: sombrero charro para `powerup-sombrero` y botella de salsa para `powerup-salsa`.
7. THE Game SHALL representar el Checkpoint como una parada de microbús con un letrero de texto "PARADA" dibujado con `Graphics`.
8. THE Game SHALL generar al menos los siguientes efectos de sonido usando la Web Audio API interna de Phaser: salto, recogida de moneda, power-up obtenido, daño recibido, eliminación de Enemy, disparo de Fireball y victoria/derrota.
9. THE `game.js` tras minificación SHALL medir ≤50 KB según `npm run check-restrictions`; si se supera este límite, SHALL reducirse el número de vértices o capas en las rutinas `Graphics` hasta cumplirlo.

---

### Requirement 3: Sistema de power-ups y estados de la Banana

**User Story:** Como jugador, quiero que la Banana pueda crecer con accesorios y ganar habilidades especiales al recoger ítems, para que el juego tenga progresión de dificultad y recompensa.

#### Acceptance Criteria

1. THE Banana SHALL iniciar cada nivel en PowerState `plain` con tamaño base de 20 × 30 px y sin accesorios visibles.
2. WHEN la Banana (en PowerState `plain` o `sombrero`) toca un PowerUp de sombrero, THE Banana SHALL cambiar a PowerState `sombrero`, aumentar su tamaño a 24 × 36 px y mostrar sombrero charro y bigote procedurales.
3. WHILE la Banana está en PowerState `sombrero`, THE Banana SHALL romper QuestionBlocks y bloques normales al golpearlos con la cabeza desde abajo, consumiendo el bloque y revelando su contenido.
4. WHEN la Banana (en PowerState `plain` o `sombrero`) toca un PowerUp de salsa, THE Banana SHALL cambiar a PowerState `salsa` sin modificar su tamaño.
5. WHILE la Banana está en PowerState `salsa`, WHEN el jugador presiona P1_1, THE Banana SHALL disparar una Fireball en la última dirección horizontal de movimiento; si la Banana no se ha movido horizontalmente aún, la Fireball SHALL dispararse hacia la derecha.
6. THE Fireball SHALL moverse horizontalmente a 300 px/s, rebotar en el suelo con coeficiente de restitución 0.6, y destruirse al contacto con un Enemy, al colisionar con un muro lateral, o después de completar su tercer rebote; el impacto del tercer rebote SHALL ejecutarse antes de destruir la Fireball.
7. WHEN la Banana (en PowerState `salsa`) recibe daño, THE Banana SHALL cambiar a PowerState `sombrero` sin perder una Life.
8. WHEN la Banana (en PowerState `sombrero`) recibe daño, THE Banana SHALL cambiar a PowerState `plain` sin perder una Life.
9. WHEN la Banana (en PowerState `plain`) recibe daño, THE Banana SHALL perder una Life y mostrar 2 segundos de invulnerabilidad con parpadeo a 8 Hz (8 ciclos de visible/invisible por segundo).
10. IF la Banana está en PowerState `salsa` y ya existe una Fireball activa en pantalla, THEN THE Game SHALL ignorar la entrada P1_1 sin disparar una segunda Fireball.

---

### Requirement 4: Mecánicas de movimiento y salto de la Banana

**User Story:** Como jugador, quiero que la Banana responda con precisión a los controles del gabinete arcade, para que el juego se sienta responsivo y justo.

#### Acceptance Criteria

1. WHEN el jugador presiona P1_L o P1_R, THE Banana SHALL moverse horizontalmente a una velocidad máxima de 200 px/s con aceleración de 2000 px/s².
2. WHEN el jugador suelta P1_L o P1_R, THE Banana SHALL desacelerar con fricción (`dragX`) de 1200 px/s² hasta detenerse completamente.
3. WHILE la Banana está en contacto con el suelo, WHEN el jugador presiona P1_1 (salto), THE Banana SHALL saltar con velocidad vertical inicial de −450 px/s.
4. THE Banana SHALL colisionar con los límites del mundo y con todas las plataformas usando `Phaser.Physics.Arcade`; el cuerpo físico de la Banana SHALL configurarse con `setCollideWorldBounds(true)`.
5. WHEN la Banana aterriza en una plataforma, THE Game SHALL reproducir una animación de squash (scaleX 1.3, scaleY 0.7) de 100 ms que luego se revierte a scaleX 1.0, scaleY 1.0 en otros 100 ms.
6. WHEN la Banana inicia un salto, THE Game SHALL reproducir una animación de stretch (scaleX 0.8, scaleY 1.2) de 80 ms que luego se revierte a scaleX 1.0, scaleY 1.0.
7. THE Game SHALL mapear todos los controles de juego exclusivamente a los códigos definidos en CABINET_KEYS sin utilizar teclas de teclado crudas en la lógica de juego principal.

---

### Requirement 5: Enemigos

**User Story:** Como jugador, quiero enfrentar al menos dos tipos de enemigos con comportamientos distintos y temática CDMX, para que el juego sea variado y desafiante.

#### Acceptance Criteria

1. THE GameScene SHALL contener al menos un Microbús y un Chilango_Enojado por nivel.
2. WHEN el Microbús alcanza el borde de su plataforma o colisiona con un muro, THE Microbús SHALL invertir su dirección horizontal; entre inversiones, THE Microbús SHALL patrullar a una velocidad constante entre 60 y 120 px/s.
3. WHILE la Banana está a menos de 200 px del Chilango_Enojado (distancia euclidiana), THE Chilango_Enojado SHALL moverse hacia la Banana a 100 px/s.
4. WHILE la Banana está a 200 px o más del Chilango_Enojado, THE Chilango_Enojado SHALL deambular horizontalmente e invertir su dirección aleatoriamente cada 1000–2000 ms.
5. WHEN la Banana salta encima de un Enemy (velocidad vertical del cuerpo físico ≥ 0 y contacto registrado desde la parte superior del Enemy), THE Enemy SHALL desactivarse, THE Game SHALL sumar 100 puntos al Score y THE Banana SHALL recibir un impulso vertical de −300 px/s.
6. WHEN una Fireball colisiona con un Enemy, THE Enemy SHALL desactivarse y THE Game SHALL sumar 200 puntos al Score.
7. IF un Enemy cae fuera de los límites del mundo (posición Y > altura del mundo), THEN THE Enemy SHALL ser destruido sin sumar puntos al Score.
8. WHEN un Enemy es eliminado, THE Game SHALL generar partículas de explosión usando `Phaser.GameObjects.Particles` en la posición del Enemy.

---

### Requirement 6: Niveles y diseño de mundo

**User Story:** Como jugador, quiero recorrer al menos tres niveles con temática de la Ciudad de México antes del jefe final, para experimentar variedad visual y de dificultad progresiva.

#### Acceptance Criteria

1. THE Game SHALL incluir exactamente 3 niveles en GameScene antes de BossScene, con temáticas diferenciadas: Calles de CDMX (nivel 1), Mercado (nivel 2) y Metro (nivel 3).
2. THE GameScene SHALL generar el fondo del nivel activo con `Graphics`: edificios y señales de tráfico para nivel 1, puestos de mercado y colores vivos para nivel 2, y túneles y rieles para nivel 3.
3. THE GameScene SHALL posicionar plataformas en configuraciones distintas para cada nivel, con al menos una disposición vertical (plataformas escalonadas), una horizontal (plataformas en línea) y una combinada presente entre los tres niveles.
4. WHEN un QuestionBlock es golpeado desde abajo, THE QuestionBlock SHALL revelar un PowerUp si la Banana está en PowerState `plain` o `sombrero`; SHALL revelar una moneda (+50 pts) si la Banana está en PowerState `salsa`; y cada QuestionBlock SHALL poder ser golpeado solo una vez.
5. EACH nivel SHALL contener al menos 8 monedas coleccionables; WHEN la Banana toca una moneda, THE Game SHALL incrementar el Score en 50 puntos y destruir la moneda.
6. WHEN la Banana alcanza el Checkpoint al final del nivel, THE GameScene SHALL reproducir una animación de celebración de al menos 1 segundo (por ejemplo, la Banana saltando o confeti con `Graphics`) y luego transicionar al nivel siguiente, o a BossScene si el nivel actual es el 3.
7. THE GameScene SHALL desplazar la cámara horizontalmente siguiendo a la Banana con `camera.startFollow`, con límites de cámara configurados al ancho del nivel.
8. EACH nivel SHALL tener un ancho mínimo de 3200 px para permitir desplazamiento horizontal significativo.

---

### Requirement 7: Jefe final (Boss)

**User Story:** Como jugador, quiero enfrentar un jefe final desafiante con barra de vida visible al completar los tres niveles, para que haya un clímax memorable en el juego.

#### Acceptance Criteria

1. THE BossScene SHALL presentar al Boss llamado "El Microbús Maldito" como un Microbús sobredimensionado de al menos 120 × 80 px generado proceduralmente con `Graphics`.
2. THE Boss SHALL tener 5 puntos de vida representados como una barra de vida visible en el HUD de BossScene, actualizada en tiempo real.
3. WHILE BossScene está activa, THE Boss SHALL ejecutar el siguiente patrón de ataque en bucle: moverse horizontalmente a 150 px/s invirtiendo dirección al alcanzar los límites de la arena, saltar con velocidad −400 px/s cada 3 segundos, y disparar un proyectil horizontal hacia la Banana cada 4 segundos.
4. WHEN la Banana salta encima del Boss y el Boss no está en su período de invulnerabilidad post-impacto, THE Boss SHALL perder 1 punto de vida, THE Game SHALL reproducir un efecto visual de impacto (flash blanco de 200 ms), y THE Boss SHALL activar un período de invulnerabilidad de 1 segundo durante el cual no puede perder más vida.
5. WHEN una Fireball colisiona con el Boss y el Boss no está en su período de invulnerabilidad, THE Boss SHALL perder 1 punto de vida y activar el mismo período de invulnerabilidad de 1 segundo.
6. WHEN los puntos de vida del Boss llegan a 0, THE BossScene SHALL mostrar una animación de derrota de al menos 2 segundos (por ejemplo, el Boss parpadeando y expandiéndose antes de desaparecer) y luego transicionar a WinScene.
7. IF los puntos de vida del Boss son 2 o menos, THEN THE Boss SHALL aumentar su velocidad de movimiento horizontal a 250 px/s.
8. THE BossScene SHALL mostrar un fondo generado con `Graphics` distinto a los tres niveles normales, representando un tráfico caótico de CDMX (vehículos superpuestos, colores caóticos).
9. THE proyectil del Boss SHALL moverse horizontalmente a 200 px/s en la dirección de la Banana al momento del disparo; SHALL destruirse al alcanzar los límites de la arena; WHEN colisiona con la Banana, THE Banana SHALL recibir daño según su PowerState actual.

---

### Requirement 8: Sistema de vidas y puntaje

**User Story:** Como jugador, quiero ver mi puntaje en tiempo real, gestionar mis vidas y que mi récord personal se guarde entre sesiones, para tener incentivo de mejorar.

#### Acceptance Criteria

1. THE Game SHALL otorgar al jugador exactamente 3 Lives al iniciar una nueva partida.
2. WHILE GameScene o BossScene está activa, THE HUD SHALL mostrar el Score actual, el número de Lives restantes y el HighScore en todo momento, actualizados en tiempo real.
3. WHEN el jugador recoge una moneda, THE Game SHALL incrementar el Score en 50 puntos.
4. WHEN el jugador completa un nivel (alcanza el Checkpoint), THE Game SHALL incrementar el Score en 500 puntos de bonificación.
5. WHEN el Score de la partida supera el HighScore almacenado, THE Game SHALL actualizar el HighScore en memoria y llamar a `window.platanusArcadeStorage.set('banana-chilanga/highscore', score)`; IF la llamada falla, THE Game SHALL preservar el HighScore actualizado en memoria para la sesión sin interrumpir el juego.
6. WHEN el juego inicia (BootScene o MenuScene), THE Game SHALL recuperar el HighScore llamando a `window.platanusArcadeStorage.get('banana-chilanga/highscore')`.
7. IF el valor retornado por `platanusArcadeStorage.get` no es un entero mayor o igual a 0, THEN THE Game SHALL inicializar el HighScore en 0.
8. WHEN el jugador pierde una Life, THE Game SHALL mostrar una animación de muerte de duración máxima de 1 segundo y luego reaparecer a la Banana en la posición de inicio del nivel actual con PowerState `plain`.
9. WHEN el jugador pierde su última Life, THE Game SHALL actualizar el HighScore si corresponde y luego transicionar a GameOverScene sin reiniciar el Score.

---

### Requirement 9: Pausa y menú principal

**User Story:** Como jugador, quiero poder pausar el juego y volver al menú, para tener control sobre la sesión de juego.

#### Acceptance Criteria

1. WHEN el jugador presiona START1 durante GameScene o BossScene (y el juego no está en pausa), THE Game SHALL llamar a `scene.physics.pause()`, congelar el ciclo de actualización de todos los Enemies activos y mostrar un overlay semitransparente con el texto "PAUSA" centrado en pantalla.
2. WHEN el juego está en pausa y el jugador presiona START1, THE Game SHALL llamar a `scene.physics.resume()`, reanudar el ciclo de actualización de Enemies y ocultar el overlay de pausa.
3. WHEN el juego está en pausa y el jugador presiona START2, THE Game SHALL reanudar la física, ocultar el overlay y transicionar a MenuScene reiniciando Score = 0, Lives = 3 y PowerState = `plain`.
4. THE MenuScene SHALL mostrar el título "BANANA CHILANGA", el HighScore y el texto exacto "Presiona START para jugar".
5. WHEN el jugador presiona START1 en MenuScene, THE Game SHALL iniciar GameScene con el nivel 1.

---

### Requirement 10: Restricciones técnicas del entorno de ejecución

**User Story:** Como organizador del hackathon, quiero que el juego opere completamente sin conexión y dentro de las restricciones de tamaño del gabinete, para que pueda ejecutarse en el entorno de producción.

#### Acceptance Criteria

1. THE Game SHALL estar contenido íntegramente en `game.js` sin utilizar `import` ni `require` en ninguna línea del archivo.
2. THE Game SHALL no realizar ninguna llamada de red mediante `fetch`, `XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon`, `EventSource` u otras APIs de red.
3. THE Game SHALL no referenciar ninguna URL externa que comience con `http://`, `https://` o `//`; las URIs `data:` (base64) están explícitamente permitidas.
4. THE Game SHALL no modificar ni eliminar ninguna entrada existente del objeto CABINET_KEYS.
5. WHEN se requieran teclas adicionales para pruebas locales, THE Game SHALL solo agregarlas al arreglo de la entrada correspondiente en CABINET_KEYS (por ejemplo, `P1_U: ['w', 'ArrowUp']`).
6. THE `game.js` tras minificación SHALL medir un tamaño máximo de 50 KB según la herramienta `npm run check-restrictions`.
7. THE Game SHALL usar `window.platanusArcadeStorage` para toda persistencia de datos, con claves que cumplan el patrón `[A-Za-z0-9._:/-]` de 1–128 caracteres y valores JSON de menos de 64 KiB.
8. IF `window.platanusArcadeStorage` no está disponible en el entorno de ejecución, THEN THE Game SHALL continuar sin lanzar excepciones no controladas, usando valores por defecto para Score y HighScore.
