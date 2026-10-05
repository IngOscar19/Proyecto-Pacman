# SPEC 02 — Power pellets

> **Status:** Implemented
> **Depends on:** SPEC 01
> **Date:** 2026-10-05
> **Objective:** Cuatro power pellets que al ser comidas ponen a los cuatro fantasmas en modo asustado —azules, más lentos y moviéndose al azar— para que Pacman pueda comérselos.

## Contexto

`src/js/game.js` resuelve la colisión Pacman/fantasma en `update()` (game.js:189) y hoy siempre significa muerte de Pacman. `src/js/maze.js` solo conoce tres tiles: `1` pared, `2` dot y `3` puerta del pen. `src/js/render.js` dibuja por valor de tile y `ghost-ai.js` elige siempre la dirección que más acerca al objetivo de la personalidad. SPEC 01 dejó los puntos de poder fuera de scope explícitamente; este spec los añade.

## Scope

**In:**

- Tile nuevo `4` (power pellet) con cuatro posiciones en el laberinto.
- Comer una pellet: 50 puntos, frightened para los fantasmas `active`, timer de 6s.
- Fantasmas asustados: azul, a 0.05 celdas/frame, dirección aleatoria entre legales.
- Comer fantasmas asustados con cadena 200 / 400 / 800 / 1600.
- El fantasma comido se dibuja solo con ojos, vuelve al pen y sale de nuevo normal.
- Parpadeo del laberinto mientras dura el frightened y flash blanco en los últimos 2s.
- Tests con `node --test` en `tests/power-pellets.test.js`.

**Out of scope (for future specs):**

- Frutas bonus y su puntuación.
- Fases scatter/chase con timer y esquinas para blinky, pinky e inky.
- Inversión de dirección en tiles concretos (la de aquí solo aplica al fantasma asustado).
- Frenado de fantasmas dentro del túnel.
- Niveles adicionales, vidas extra, high scores, controles táctiles.

## Data model

```js
// src/js/maze.js — tile nuevo
//   '#' pared(1) · '.' dot(2) · 'o' power pellet(4) · ' ' vacio(0) · '-' puerta(3)
'#.####.##.########.##.####.#'  ->  '#o####.##.########.##.####o#'   // fila 6
'#......##....##....##......#'  ->  '#o.....##....##....##.....o#'   // fila 26

const POWER_PELLETS = [ { x: 1, y: 6 }, { x: 26, y: 6 }, { x: 1, y: 26 }, { x: 26, y: 26 } ];
const FRIGHT_FRAMES = 6 * FPS;       // 6s de frightened
const FRIGHT_FLASH_FRAMES = 2 * FPS; // ultimos 2s parpadeando en blanco
const FRIGHT_CHAIN = [ 200, 400, 800, 1600 ];
```

```js
// src/js/game.js — estado de partida
frightUntilFrame: 0,  // frames jugados; 0 = nadie asustado
frightScore: 200,     // siguiente puntuacion de la cadena
rng: Math.random,     // inyectable para que los tests sean deterministas

// src/js/game.js — por fantasma
mode: 'pen' | 'active' | 'frightened' | 'eaten',
didReverse: false,    // registro del giro forzado (sin ninguna otra salida legal)
```

Velocidades: `FRIGHT_SPEED = 0.05`, `EYES_SPEED = 0.16`. Ninguna se guarda en `g.speed`: la resuelve `speedOf( g )` a partir de `g.mode`, para que no pueda quedar desincronizada.

Reglas de `mode`:

- `pen`: oscila y espera su `releaseAtFrame` (SPEC 01, sin cambios).
- `frightened`: dirección aleatoria entre las legales salvo la inversa; si la inversa es la única salida, la toma y marca `didReverse`.
- `eaten`: objetivo = la celda de **dentro** de la puerta del pen más cercana, `(13,13)` o `(14,13)`. Al entrar en `PEN` pasa a `pen`, y como su `releaseAtFrame` ya pasó, `releaseGhost` lo saca en el frame siguiente. Si el objetivo fuese la puerta en sí, el fantasma la pisaría, vería que ya está encima y daría media vuelta para siempre sin bajar al pen.
- Comer una pellet solo afecta a los fantasmas con `mode === 'active'`.
- Comer una pellet renueva `frightUntilFrame` y pone `frightScore` a 200.
- La muerte de Pacman limpia `frightUntilFrame` y `frightScore` en `resetPositions`.
- `dotsRemaining` y `dotsEaten` siguen contando solo tiles de tipo `2`.

Convención nueva: el rng se pasa como `ctx.rng` a `chooseDirection` y vale `Math.random` si no se pasa. Solo lo usan los fantasmas `frightened`; las cuatro IAs de SPEC 01 no lo tocan, así que sus tests siguen pasando sin tocar nada.

## Implementation plan

1. `maze.js`: `parseTile` reconoce `'o'` como `4`, las filas 6 y 26 llevan pellet, `POWER_PELLETS`, `FRIGHT_FRAMES`, `FRIGHT_FLASH_FRAMES` y `FRIGHT_CHAIN` en el `api`. Test en `tests/power-pellets.test.js`: 31x28, 276 tiles de tipo 2, 4 tiles de tipo 4 y `POWER_PELLETS` coincidiendo con ellos. Manual: el laberinto se ve igual, sin errores. Commit: power pellets en el laberinto.
2. `render.js`: `drawDots` dibuja el tile 4 como círculo de radio 5. Manual: se ven 4 círculos grandes parpadeando en el laberinto; `node --test` pasa. Commit: dibujo de la power pellet.
3. `game.js`: en `movePacman` la rama del tile 4 pone la celda a 0, suma 50, marca `frightUntilFrame = game.frames + FRIGHT_FRAMES`, pone `frightScore` a 200 y pasa a `frightened` (con `didReverse = false`) a los fantasmas `active`. `update` expira el timer y los devuelve a `active`. `speedOf` en `game.js` resuelve la velocidad por mode. Tests: puntuación, timer, expiración, renovación y que los del pen no se asustan. Manual: al comer una pellet los 4 fantasmas se ralentizan y a los 6s recuperan su ritmo. Commit: comer una pellet activa el modo asustado.
4. `ghost-ai.js`: `computeTarget` devuelve la puerta del pen para `eaten` y el objetivo existente para `frightened`; `chooseDirection` con `mode === 'frightened'` elige al azar entre las legales salvo la inversa (o la inversa si es la única, marcando `didReverse`), y exporta `insidePen`. Tests con `rng` inyectado: determinismo y legalidad. Manual: los fantasmas asustados ya no persiguen a Pacman. Commit: frightened se mueve al azar.
5. `game.js`: en `update` la colisión con un `frightened` suma `frightScore` (doblado y con tope en `FRIGHT_CHAIN[3]`), lo pasa a `eaten` y no le quita la vida; un `eaten` nunca hace daño. `updateGhost` detecta la entrada en el pen y lo devuelve a modo `pen`. En `ghost-ai.js` el objetivo de `eaten` es la celda de dentro de la puerta, no la puerta. Tests: cadena 200/400/800/1600, tope, `eaten` no mata, ojos vuelven y salen. Manual: Pacman se come fantasmas y ve los ojos volver al pen y salir. Commit: comer fantasmas asustados.
6. `render.js`: fantasmas `frightened` en azul con boca abierta y en blanco durante los últimos `FRIGHT_FLASH_FRAMES`; fantasmas `eaten` solo con ojos; paredes en blanco o azul mientras dure el frightened. Manual: se ve el parpadeo y se distingue asustado de comido. Commit: render del modo asustado.

## Acceptance criteria

- [x] `node --test` termina con 0 tests fallidos.
- [x] `src/index.html` carga sin errores en la consola.
- [x] `MAZE` conserva 31 filas de 28 columnas, con 276 tiles de tipo 2 y 4 de tipo 4: 280 celdas comibles, las mismas que en SPEC 01.
- [x] Hay exactamente 4 tiles de tipo 4 y están en (1,6), (26,6), (1,26) y (26,26).
- [x] `POWER_PELLETS` coincide con las celdas de tipo 4 del laberinto.
- [x] Comer una pellet suma 50, deja la celda en 0 y fija `frightUntilFrame = frames + FRIGHT_FRAMES`.
- [x] Comer una pellet asusta solo a los fantasmas con `mode === 'active'`; los del pen siguen en `pen`.
- [x] Un fantasma `frightened` se mueve a 0.05 celdas/frame y uno `eaten` a 0.16.
- [x] Con `rng` inyectado, un `frightened` elige siempre una dirección legal distinta de la inversa y dos llamadas seguidas dan la misma.
- [x] Un `frightened` solo se invierte cuando no hay ninguna otra salida legal, y en ese caso marca `didReverse`; el flag se limpia al comer una pellet nueva y al expirar el frightened.
- [x] Pasados `FRIGHT_FRAMES` desde la última pellet, todos vuelven a `active` y `frightScore` vuelve a 200.
- [x] Comer una segunda pellet renueva el timer y reinicia la cadena en 200.
- [x] Los 4 fantasmas comidos en la misma fase suman 200, 400, 800 y 1600; el quinto y siguientes siguen en 1600.
- [x] Un fantasma comido queda `eaten`, se dibuja solo con ojos y no le quita vida a Pacman.
- [x] Un `eaten` se dirige a la puerta del pen, entra y vuelve a salir como `active`.
- [x] Un fantasma `active` que toca a Pacman le quita una vida y reinicia `frightUntilFrame`.
- [x] La victoria sigue exigiendo vaciar los dots de tipo 2 (275 al empezar, porque la celda de inicio de Pacman ya está vacía; las pellets no cuentan).
- [x] `resetPositions` devuelve a los 4 fantasmas a `pen` y limpia `frightUntilFrame` y `frightScore`.
- [x] El laberinto parpadea en blanco/azul mientras dure el frightened y los asustados en blanco en los últimos `FRIGHT_FLASH_FRAMES`.

## Decisions

- **Yes:** 4 pellets en las posiciones clásicas (1,6), (26,6), (1,26), (26,26). Verificado que las cuatro son tiles de tipo 2, así que `POWER_PELLETS` y la matriz no pueden desincronizarse.
- **No:** solo 2 pellets. Menos frightened por nivel y menos superficie que probar.
- **Yes:** tile `4` en la matriz en vez de una lista aparte. El render ya dibuja por valor de tile y comerlo es la misma rama que el dot.
- **No:** `POWER_PELLETS` como única fuente de verdad sin tocar la matriz. Habría que filtrar en cada paso para que el tile se coma y se dibuje.
- **Yes:** frightened al original: azul, lento, aleatorio, cadena 200/400/800/1600 y ojos de vuelta al pen. Es lo que el jugador ya reconoce.
- **Yes:** 6s fijo. Es el valor del nivel 1 del original; cuando existan niveles, se decrementa.
- **No:** frightened decreciente ya. No hay niveles, y un valor que no se pueda observar no aporta.
- **Yes:** `rng` inyectado en `ctx` y en `game`. Los tests de este spec necesitan aleatoriedad reproducible; sin esto, `node --test` sería inestable.
- **No:** frightened con la personalidad intacta. Hace que "asustado" no se note y deja el `didReverse` sin sentido.
- **Yes:** `didReverse` como registro del giro forzado, no como bloqueo. En el original un asustado solo puede invertirse una vez por periodo, pero este laberinto es completamente cíclico y no tiene ni un callejón, asi que la regla no se puede observar: queda como marca que se limpia en cada cambio de periodo.
- **No:** aceleración por cercanía, frightened creciente al comer fantasmas, ni modo "comiendo" con pausa. Cada uno es otro spec.
- **Yes:** velocidad derivada del `mode` con `speedOf(g)` en vez de mutar `g.speed`. Un resto de velocidad desincronizada al expirar el timer sería un bug difícil de ver.
- **Yes:** la elección de dirección asustada y los objetivos `eaten`/`frightened` van en `ghost-ai.js`, no en un `fright.js` nuevo. `ghost-ai.js` ya es el sitio donde se decide la dirección; no se crea ningún módulo nuevo.
- **Yes:** el parpadeo se aplica al color de paredes y cuerpos, no con un overlay global. Un overlay tiñería a Pacman y a los fantasmas.
- **Yes:** `dotsRemaining` sigue contando solo tipo 2, y las 4 pellets pasar de 280 a 276 dots comibles no es una perdida de contenido: son las mismas 280 celdas de SPEC 01 repartidas entre dots y pellets.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Comer una pellet asusta también a los fantasmas que bobbean en el pen | La conversión exige `mode === 'active'`; los del pen conservan su `releaseAtFrame`. |
| Los ojos no consiguen entrar al pen y se quedan orbitando la puerta | `computeTarget` les devuelve la celda de dentro de la puerta, no la puerta: al pisarla siguen bajando. Al entrar en `PEN` pasan a `pen`, cuyo `releaseAtFrame` ya venció, y salen en el frame siguiente. |
| `ctx.rng` rompe los tests de SPEC 01 | Las cuatro IAs no leen `rng`; el default `Math.random` solo lo consumen los `frightened`. |
| Un fantasma asustado se queda atascado vibrando contra un muro | `chooseDirection` solo devuelve direcciones legales y, si no queda ninguna, devuelve la inversa. |
| Expirar el frightened deja velocidad o color a medias | `speedOf(g)` y el color se derivan de `g.mode` en cada frame; no hay estado que limpiar. |
| Las filas 6 y 26 del laberinto cambian de largo al poner `'o'` | Test que comprueba 28 columnas y 276 + 4 tiles en el mismo arranque. |

## What is **not** in this spec

- Frutas bonus y su puntuación.
- Fases scatter/chase con timer.
- Inversión de dirección en tiles concretos.
- Frenado de fantasmas dentro del túnel.
- Niveles adicionales, vidas extra, high scores y controles táctiles.

Cada uno, si aterriza, va en su propio spec.