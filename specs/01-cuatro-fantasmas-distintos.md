# SPEC 01 — Cuatro fantasmas con comportamientos distintos

> **Status:** Approved
> **Depends on:** (ninguna — primer spec del proyecto)
> **Date:** 2026-10-02
> **Objective:** Cuatro fantasmas con cuatro estrategias de persecución distintas —uno de ellos persigue a Pacman sin descanso— que salen del pen progresivamente según los dots comidos.

## Contexto

`src/js/game.js` ya tiene un juego funcional con **2 fantasmas**: un `hunter` que elige la dirección que minimiza la distancia Manhattan a Pacman (`game.js:113`) y un `random` que camina al azar. Los dos arrancan dentro del pen y salen por la puerta sin ninguna restricción. Este spec reemplaza esa lógica por cuatro personalidades completas con control de salida del pen.

## Scope

**In:**

- Cuatro fantasmas con `kind` `blinky`, `pinky`, `inky` y `clyde`, cada uno con su propia función de decisión.
- Blinky como perseguidor puro y más rápido que los otros tres.
- Pen con capacidad para 4 fantasmas, liberación progresiva por dots comidos y oscilación mientras esperan.
- Los fantasmas dentro del pen se dirigen a la puerta más cercana hasta salir por arriba.
- Tests con `node --test` para las cuatro IAs.

**Out of scope (for future specs):**

- Puntos de poder, frutas y modo *frightened*.
- Fases *scatter/chase* con timer.
- Esquinas de dispersión para Blinky, Pinky e Inky (solo Clyde usa la suya en este spec).
- Inversión de dirección en tiles específicos.
- Penalización de velocidad dentro del túnel.
- Niveles adicionales, vidas extra, high scores, controles táctiles.

## Data model

```js
// src/js/maze.js — reemplaza el GHOST_STARTS actual
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'blinky', releaseAtDots: 0 },
  { x: 14, y: 14, kind: 'pinky',  releaseAtDots: 30 },
  { x: 15, y: 14, kind: 'inky',  releaseAtDots: 60 },
  { x: 12, y: 14, kind: 'clyde', releaseAtDots: 90 },
];

const PEN = { x0: 11, y0: 13, x1: 16, y1: 15 }; // interior transitable
const PEN_DOORS = [ { x: 13, y: 12 }, { x: 14, y: 12 } ];
const CORNERS = {
  blinky: { x: 25, y: 0 },
  pinky:  { x: 2,  y: 0 },
  inky:   { x: 27, y: 35 },
  clyde:  { x: 0,  y: 35 },
};
```

```js
// src/js/grid.js — extraído de game.js
const DIRS = { left: {x:-1,y:0}, right: {x:1,y:0}, up: {x:0,y:-1}, down: {x:0,y:1} };
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };
const DIR_PRIORITY = [ 'up', 'left', 'down', 'right' ];

function aligned( v ) {}
function isWall( grid, x, y, actor ) {}   // actor: 'pacman' | 'ghost'
function canMove( grid, x, y, dir, actor ) {}
function wrapTunnel( actor, width ) {}
```

```js
// src/js/ghost-ai.js — funciones puras
function aheadOf( pacman, n ) {}          // celda n celdas por delante de Pacman
function computeTarget( kind, ctx ) {}    // -> { x, y }
function chooseDirection( ctx ) {}        // -> 'up' | 'left' | 'down' | 'right'
// ctx = { grid, self, pacman, blinky, mode }
```

`computeTarget` por personalidad:

| kind | objetivo |
| --- | --- |
| `blinky` | Celda de Pacman, redondeada. |
| `pinky` | `aheadOf(pacman, 4)`. |
| `inky` | `blinky + 2 * (aheadOf(pacman, 4) - blinky)`. |
| `clyde` | Celda de Pacman si la distancia Euclidiana desde `self` es `> 8`; si no, `CORNERS.clyde`. |
| cualquiera con `mode === 'pen'` | `PEN_DOORS` más cercana a `self` por Manhattan. |

`chooseDirection` recorre `DIR_PRIORITY`, descarta las direcciones no legales (`canMove`) y la opuesta a `self.dir` —salvo que sea la única legal—, y devuelve la de menor distancia Manhattan a `computeTarget(ctx)`. Si no queda ninguna, devuelve la opuesta (callejón sin salida).

Estado de partida nuevo:

```js
dotsEaten: 0,   // dots comidos; alimenta los umbrales del pen
ghosts: [ { x, y, dir, speed, kind, mode: 'pen' | 'active', releaseAtDots, bobDir } ]
```

Velocidades: `GHOST_SPEED = 0.1` para pinky/inky/clyde, `BLINKY_SPEED = 0.11` para blinky.

Conventions: coordenadas en unidades de celda (float entre celdas), origen arriba-izquierda, velocidad en celdas/frame, empates resueltos por `DIR_PRIORITY`.

## Implementation plan

1. Crear `src/js/grid.js` con `DIRS`, `OPPOSITE`, `DIR_PRIORITY`, `aligned`, `isWall`, `canMove` y `wrapTunnel` movidos desde `game.js`, exportados como `window.GRID` y `module.exports`. Borrarlos de `game.js`, leerlos de `window.GRID` y añadir `<script src="js/grid.js">` antes de `js/game.js` en `src/index.html`. Manual: el juego se juega igual que antes, con 2 fantasmas.
2. Actualizar `src/js/maze.js` con los 4 `GHOST_STARTS`, `PEN`, `PEN_DOORS` y `CORNERS`, y proteger las asignaciones `window.*` con `typeof window !== 'undefined'` añadiendo `module.exports`. Manual: el juego sigue jugable; los fantasmas 3 y 4 todavía se mueven al azar de forma temporal.
3. Crear `src/js/ghost-ai.js` con `aheadOf`, `computeTarget` y `chooseDirection` más su bloque `module.exports`, y `tests/ghosts.test.js` con `node:test` cubriendo las cuatro IAs, el desempate por `DIR_PRIORITY`, la prohibición de giro de 180° y el objetivo de Clyde según distancia. Manual: `node --test` pasa; el juego aún no usa `ghost-ai.js`.
4. Cablear la IA en `src/js/game.js`: `decideGhost` delega en `chooseDirection` y desaparece la rama `hunter`/aleatoria; `createGame` añade `dotsEaten`, `mode`, `bobDir`, `releaseAtDots` y `BLINKY_SPEED` para blinky. Manual: los 4 fantasmas ya se mueven con personalidad propia, aunque todavía salen todos del pen de inmediato.
5. Implementar la lógica del pen en `game.js`: con `mode === 'pen'` el fantasma oscila entre `homeY − 0.4` y `homeY + 0.4` siguiendo `bobDir` y no puntúa; al cumplirse `dotsEaten >= releaseAtDots` pasa a `mode = 'active'`, se ancla a su fila y `dir = 'up'`; mientras siga dentro de `PEN` su objetivo es la puerta más cercana. Manual: blinky ronda el laberinto desde el inicio y los otros tres van saliendo conforme se vacía.
6. Actualizar `resetPositions`: los 4 fantasmas vuelven a su `GHOST_STARTS` con `mode = 'pen'` y `bobDir = 1`, y `dotsEaten` vuelve a 0. Manual: al morir Pacman los 4 reingresan al pen y la secuencia de liberación arranca de cero.

## Acceptance criteria

- [ ] `node --test` termina con 0 tests fallidos.
- [ ] `src/index.html` carga sin errores en la consola del navegador.
- [ ] `MAZE` conserva 31 filas de 28 columnas y 280 dots.
- [ ] La partida crea exactamente 4 fantasmas con kind `blinky`, `pinky`, `inky` y `clyde`.
- [ ] blinky se mueve a 0.11 celdas/frame; pinky, inky y clyde a 0.1.
- [ ] blinky elige en cada decisión la dirección legal que minimiza la distancia Manhattan a Pacman.
- [ ] pinky apunta 4 celdas por delante de Pacman según su `dir`, a cualquier distancia.
- [ ] inky apunta a `blinky + 2 * (ahead4 - blinky)`.
- [ ] clyde apunta a Pacman cuando la distancia Euclidiana es `> 8` y a `CORNERS.clyde` cuando es `≤ 8`.
- [ ] Ante empate de distancia gana la primera dirección de `['up','left','down','right']`.
- [ ] Ningún fantasma elige la dirección opuesta a la suya, salvo cuando es la única legal.
- [ ] blinky está `active` desde el primer frame; pinky, inky y clyde solo al alcanzar `dotsEaten` 30, 60 y 90 respectivamente.
- [ ] Un fantasma con `mode === 'pen'` oscila entre `homeY - 0.4` y `homeY + 0.4` y no suma puntaje.
- [ ] Un fantasma `active` dentro del pen sale por `(13,12)` o `(14,12)` y no da vueltas indefinidamente dentro.
- [ ] Tras morir Pacman los 4 fantasmas vuelven al pen y `dotsEaten` vuelve a 0.
- [ ] Los 4 fantasmas se dibujan con `#ff0000`, `#00ffff`, `#ffb8ff` y `#ffb852`.
- [ ] Vaciar el laberinto muestra la pantalla de victoria.

## Decisions

- **Yes:** las cuatro personalidades clásicas. Son cuatro estrategias distinguibles de un vistazo y son las que el jugador ya reconoce.
- **No:** inventar cuatro comportamientos propios. Menos fiel y sin referencia para discutir qué es "correcto".
- **Yes:** blinky más rápido (0.11 vs 0.1). La amenaza se percibe sin necesidad de leer nada.
- **No:** aceleración por cercanía. Añade una segunda variable y hace el código de test más difícil.
- **Yes:** umbrales fijos de dots (0/30/60/90). Con 280 dots reparten la salida por todo el nivel.
- **No:** contadores individuales por fantasma estilo original. Requieren consumir dots dentro del pen; no aporta comportamiento observable.
- **Yes:** `kind` con nombres clásicos. La equivalencia con el original facilita verificar el comportamiento.
- **No:** nombres de comportamiento (`ambusher`, `flanker`...). Se lee mejor sin conocer el juego, pero se pierde la referencia.
- **Yes:** `src/js/grid.js` + `src/js/ghost-ai.js` con doble export `window` / `module.exports`. Permite `require` en Node sin crear `package.json` ni migrar a ES modules.
- **No:** migrar el proyecto a ES modules. Toca los cuatro archivos existentes por algo que el spec no necesita.
- **Yes:** sin replicar el bug de Inky (4 arriba y 4 izquierda). El objetivo se documenta como vector, no como caso especial.
- **Yes:** `CORNERS` con las cuatro esquinas aunque solo Clyde las use. Deja el sitio listo para las fases scatter.
- **No:** modo de poder. Necesita timer de *frightened*, inversión de dirección y puntuación nueva: es otro spec.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Que se borre una de las dos líneas de export y los tests dejen de cargar el módulo | Ambas asignaciones van juntas en cada archivo; los tests fallan de inmediato si falta `module.exports`. |
| Invocar `decideGhost` con `dir` desalignado hace elegir dirección desde media celda | Se conserva el paso actual de normalizar con `aligned()` y `Math.round()` antes de decidir. |
| La heurística voraz produce bucles: el fantasma recorre un ciclo sin acercarse | Es el comportamiento esperado del original; el desempate por `DIR_PRIORITY` hace la ruta determinista y por tanto testeable. |
| Los umbrales 30/60/90 asumen ~280 dots; si el laberinto cambia, Clyde podría no salir nunca | Son constantes en `GHOST_STARTS`, no porcentajes: si el total de dots baja de 90, se ajustan en el mismo archivo. |
| Doble carga (`require` en Node, `window` en el navegador) duplica el estado del módulo | `grid.js` no tiene estado mutable, solo funciones y constantes puras. |

## What is **not** in this spec

- Puntos de poder, frutas y fantasmas asustados.
- Fases scatter/chase con timer.
- Regla de inversión de dirección en tiles concretos.
- Frenado de fantasmas dentro del túnel.
- Niveles adicionales, vidas extra, high scores y controles táctiles.

Cada uno, si aterriza, va en su propio spec.