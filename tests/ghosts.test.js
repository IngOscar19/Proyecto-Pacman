// tests/ghosts.test.js
// IA de los fantasmas (src/js/ghost-ai.js) y logica del pen (src/js/game.js)
// contra el laberinto real. Ejecutar con: node --test

const test = require( 'node:test' );
const assert = require( 'node:assert' );

// game.js expone sus globals en window, asi que hay que fingirlo un navegador.
global.window = globalThis;

const maze = require( '../src/js/maze.js' );
require( '../src/js/grid.js' );
require( '../src/js/ghost-ai.js' );
require( '../src/js/game.js' );
const ai = window.GHOST_AI;

const { MAZE, CORNERS, PEN_DOORS, GHOST_STARTS, PEN } = maze;
const { aheadOf, computeTarget, chooseDirection } = ai;

// Fantasma alineado a celda. dir 'up' deja disponibles las demas direcciones.
function ghost( kind, x, y, dir = 'up' ) {
  return { x, y, dir, kind, mode: 'active', speed: 0.1, releaseAtDots: 0, bobDir: 1 };
}
function pacman( x, y, dir = 'left' ) {
  return { x, y, dir, mode: 'active', speed: 0.125 };
}
function ctxOf( self, pac, mode = self.mode, blinky ) {
  return { grid: MAZE, self, pacman: pac, blinky: blinky || self, mode };
}
function manhattan( a, b ) {
  return Math.abs( a.x - b.x ) + Math.abs( a.y - b.y );
}
function same( actual, expected, msg ) {
  assert.deepStrictEqual( { x: actual.x, y: actual.y }, { x: expected.x, y: expected.y }, msg );
}

test( 'GHOST_STARTS: los cuatro fantasmas con los umbrales del spec', () => {
  assert.deepStrictEqual(
    GHOST_STARTS.map( ( g ) => g.kind ),
    [ 'blinky', 'pinky', 'inky', 'clyde' ]
  );
  assert.deepStrictEqual( GHOST_STARTS.map( ( g ) => g.releaseAtDots ), [ 0, 30, 60, 90 ] );
  // Los cuatro arrancan dentro del pen y sobre celdas transptables.
  for ( const g of GHOST_STARTS ) {
    assert.ok( g.x >= 11 && g.x <= 16 && g.y >= 13 && g.y <= 15, g.kind + ' dentro del pen' );
    assert.strictEqual( MAZE[ g.y ][ g.x ], 0, g.kind + ' sobre celda vacia' );
  }
} );

test( 'aheadOf: n celdas en la direccion de Pacman', () => {
  const p = pacman( 13, 11 );
  assert.deepStrictEqual( aheadOf( { ...p, dir: 'right' }, 4 ), { x: 17, y: 11 } );
  assert.deepStrictEqual( aheadOf( { ...p, dir: 'left' }, 4 ), { x: 9, y: 11 } );
  assert.deepStrictEqual( aheadOf( { ...p, dir: 'up' }, 4 ), { x: 13, y: 7 } );
  assert.deepStrictEqual( aheadOf( { ...p, dir: 'down' }, 4 ), { x: 13, y: 15 } );
  // Sin direccion definida no se mueve del sitio.
  assert.deepStrictEqual( aheadOf( { ...p, dir: null }, 4 ), { x: 13, y: 11 } );
} );

test( 'blinky: objetivo = celda de Pacman', () => {
  const self = ghost( 'blinky', 21, 5 );
  const pac = pacman( 6, 29 );
  same( computeTarget( 'blinky', ctxOf( self, pac ) ), { x: 6, y: 29 }, 'blinky va a Pacman' );
} );

test( 'pinky: objetivo = 4 celdas por delante de Pacman', () => {
  const self = ghost( 'pinky', 21, 5 );
  same( computeTarget( 'pinky', ctxOf( self, pacman( 13, 11, 'right' ) ) ), { x: 17, y: 11 }, 'hacia derecha' );
  same( computeTarget( 'pinky', ctxOf( self, pacman( 13, 11, 'left' ) ) ), { x: 9, y: 11 }, 'hacia izquierda' );
  same( computeTarget( 'pinky', ctxOf( self, pacman( 13, 11, 'up' ) ) ), { x: 13, y: 7 }, 'hacia arriba' );
  same( computeTarget( 'pinky', ctxOf( self, pacman( 13, 11, 'down' ) ) ), { x: 13, y: 15 }, 'hacia abajo' );
} );

test( 'inky: objetivo = Blinky + 2 * (4 delante de Pacman - Blinky)', () => {
  const self = ghost( 'inky', 21, 5 );
  const blinky = ghost( 'blinky', 10, 11 );
  const pac = pacman( 13, 11, 'right' ); // ahead4 = (17,11)
  // (10,11) + 2 * ((17,11) - (10,11)) = (24,11)
  same( computeTarget( 'inky', ctxOf( self, pac, 'active', blinky ) ), { x: 24, y: 11 }, 'vector duplicado' );
  // Pacman hacia arriba: 4 arriba y nada a la izquierda (no replicamos el bug).
  const pacUp = pacman( 13, 11, 'up' ); // ahead4 = (13,7)
  // (13,11) + 2 * ((13,7) - (13,11)) = (13,3)
  same(
    computeTarget( 'inky', ctxOf( self, pacUp, 'active', ghost( 'blinky', 13, 11 ) ) ),
    { x: 13, y: 3 },
    'sin el bug del original'
  );
} );

test( 'clyde: persigue de lejos y se retira a su esquina de cerca', () => {
  const self = ghost( 'clyde', 13, 5 );
  // Euclidiana 18 -> persigue.
  same( computeTarget( 'clyde', ctxOf( self, pacman( 13, 23 ) ) ), { x: 13, y: 23 }, 'lejos: persigue' );
  // Euclidiana 4 -> esquina.
  same(
    computeTarget( 'clyde', ctxOf( ghost( 'clyde', 9, 11 ), pacman( 13, 11 ) ) ),
    CORNERS.clyde,
    'cerca: se retira'
  );
  // Justo en el umbral (8) ya se retira.
  same(
    computeTarget( 'clyde', ctxOf( ghost( 'clyde', 13, 11 ), pacman( 21, 11 ) ) ),
    CORNERS.clyde,
    'distancia 8 exacta: se retira'
  );
  // Y una por encima (8.25) todavia persigue.
  same(
    computeTarget( 'clyde', ctxOf( ghost( 'clyde', 13, 11 ), pacman( 21, 12 ) ) ),
    { x: 21, y: 12 },
    'distancia 8.25: persigue'
  );
} );

test( 'cualquier fantasma en el pen apunta a la puerta mas cercana', () => {
  for ( const kind of [ 'blinky', 'pinky', 'inky', 'clyde' ] ) {
    // (11,14) esta a 4 de (13,12) y a 5 de (14,12).
    same(
      computeTarget( kind, ctxOf( ghost( kind, 11, 14 ), pacman( 13, 23 ), 'pen' ) ),
      PEN_DOORS[ 0 ],
      kind + ' desde (11,14) -> puerta izquierda'
    );
    // (16,14) esta a 5 de (13,12) y a 4 de (14,12).
    same(
      computeTarget( kind, ctxOf( ghost( kind, 16, 14 ), pacman( 13, 23 ), 'pen' ) ),
      PEN_DOORS[ 1 ],
      kind + ' desde (16,14) -> puerta derecha'
    );
  }
} );

test( 'blinky elige la direccion legal mas cercana a Pacman', () => {
  // (13,11) mirando a la izquierda: 'right' es el giro de 180 y queda fuera.
  assert.strictEqual(
    chooseDirection( ctxOf( ghost( 'blinky', 13, 11, 'left' ), pacman( 9, 11, 'left' ) ) ),
    'left'
  );
  // (9,11) mirando a la derecha: baja el corredor o sube a la fila 10.
  assert.strictEqual(
    chooseDirection( ctxOf( ghost( 'blinky', 9, 11, 'right' ), pacman( 17, 11, 'right' ) ) ),
    'right'
  );
  // (13,23) mirando arriba huye del tunel hacia la fila 17.
  assert.strictEqual(
    chooseDirection( ctxOf( ghost( 'blinky', 13, 23, 'up' ), pacman( 21, 20, 'right' ) ) ),
    'right'
  );
} );

test( 'blinky minimiza Manhattan frente a fuerza bruta', () => {
  const { DIRS, OPPOSITE, DIR_PRIORITY, canMove } = require( '../src/js/grid.js' );
  const casos = [
    [ [ 1, 1 ], [ 26, 29 ] ],
    [ [ 6, 1 ], [ 21, 1 ] ],
    [ [ 12, 5 ], [ 15, 5 ] ],
    [ [ 21, 8 ], [ 6, 8 ] ],
    [ [ 26, 20 ], [ 1, 20 ] ],
    [ [ 9, 26 ], [ 18, 26 ] ],
    [ [ 15, 23 ], [ 12, 26 ] ],
    [ [ 1, 29 ], [ 26, 29 ] ],
    [ [ 13, 17 ], [ 13, 5 ] ],
    [ [ 6, 29 ], [ 6, 1 ] ],
  ];
  for ( const dir of DIR_PRIORITY ) {
    for ( const [ from, to ] of casos ) {
      for ( const d of DIR_PRIORITY ) {
        const self = ghost( 'blinky', from[ 0 ], from[ 1 ], d );
        const ctx = ctxOf( self, pacman( to[ 0 ], to[ 1 ] ) );
        const target = computeTarget( 'blinky', ctx );
        const esperado = DIR_PRIORITY.filter(
          ( dir ) => dir !== OPPOSITE[ d ] && canMove( MAZE, from[ 0 ], from[ 1 ], dir, 'ghost' )
        );
        let mejor = esperado.length ? esperado[ 0 ] : OPPOSITE[ d ];
        let mejorDist = Infinity;
        for ( const dir of esperado ) {
          const dist = manhattan( { x: from[ 0 ] + DIRS[ dir ].x, y: from[ 1 ] + DIRS[ dir ].y }, target );
          if ( dist < mejorDist ) {
            mejorDist = dist;
            mejor = dir;
          }
        }
        assert.strictEqual(
          chooseDirection( ctx ),
          mejor,
          'blinky en (' + from + ') mirando ' + d
        );
      }
    }
  }
} );

test( 'empate: gana la primera en el orden arriba, izquierda, abajo, derecha', () => {
  // Desde (12,14) dentro del pen, con objetivo en (13,12): 'up' y 'right' empatan
  // a 2 celdas, 'down' queda a 4. 'left' es el giro de 180 y queda excluido.
  const self = ghost( 'blinky', 12, 14, 'right' );
  const ctx = ctxOf( self, pacman( 13, 23 ), 'pen' );
  same( computeTarget( 'blinky', ctx ), PEN_DOORS[ 0 ], 'puerta objetivo' );
  assert.strictEqual( chooseDirection( ctx ), 'up', 'gana arriba sobre derecha' );

  // Mismo empate con objetivo a la derecha: 'up' gana a 'right' tambien.
  const ctx2 = ctxOf( ghost( 'blinky', 12, 11, 'right' ), pacman( 9, 11, 'left' ) );
  assert.strictEqual( chooseDirection( ctx2 ), 'up', 'empate up/right fuera del pen' );
} );

test( 'nunca elige el giro de 180 salvo callejon sin salida', () => {
  const { OPPOSITE } = require( '../src/js/grid.js' );
  const casos = [
    [ [ 12, 11 ], 'right' ], // 'left' es el giro de 180 y seria el mas corto
    [ [ 13, 11 ], 'left' ],
    [ [ 9, 26 ], 'up' ],
    [ [ 26, 29 ], 'right' ],
  ];
  for ( const [ from, dir ] of casos ) {
    for ( const destino of [ [ 1, 1 ], [ 26, 29 ], [ 6, 20 ], [ 21, 8 ] ] ) {
      const self = ghost( 'blinky', from[ 0 ], from[ 1 ], dir );
      const elegido = chooseDirection( ctxOf( self, pacman( destino[ 0 ], destino[ 1 ] ) ) );
      assert.notStrictEqual( elegido, OPPOSITE[ dir ], 'no gira 180 desde (' + from + ')' );
    }
  }
  // Callejon: este laberinto no tiene ninguno (es completamente ciclico), asi
  // que la rama de giro de 180 se comprueba con un grid sintético cerrado.
  const cerrado = [
    [ 1, 1, 1 ],
    [ 1, 0, 1 ],
    [ 1, 1, 1 ],
  ];
  const atrapado = { x: 1, y: 1, dir: 'left', kind: 'blinky', mode: 'active' };
  assert.strictEqual(
    chooseDirection( { grid: cerrado, self: atrapado, pacman: { x: 9, y: 9, dir: 'left' }, blinky: atrapado, mode: 'active' } ),
    'right',
    'callejon: gira 180 porque es lo unico'
  );
  // Mismo grid pero con una salida: ya no puede girar 180.
  const conSalida = [
    [ 1, 1, 1 ],
    [ 1, 0, 0 ],
    [ 1, 1, 1 ],
  ];
  assert.strictEqual(
    chooseDirection( { grid: conSalida, self: { ...atrapado }, pacman: { x: 2, y: 1, dir: 'right' }, blinky: atrapado, mode: 'active' } ),
    'right',
    'con salida, right es legal y no cuenta como giro de 180'
  );
} );

test( 'pinky e inky no persiguen igual que blinky en la misma posicion', () => {
  const pac = pacman( 13, 11, 'right' );
  const blinky = ghost( 'blinky', 21, 5 );
  const pinky = ghost( 'pinky', 21, 5 );
  const inky = ghost( 'inky', 21, 5 );
  const tBlinky = computeTarget( 'blinky', ctxOf( blinky, pac, 'active', blinky ) );
  const tPinky = computeTarget( 'pinky', ctxOf( pinky, pac, 'active', blinky ) );
  const tInky = computeTarget( 'inky', ctxOf( inky, pac, 'active', blinky ) );
  assert.notDeepStrictEqual( tBlinky, tPinky, 'pinky no apunta a Pacman' );
  assert.notDeepStrictEqual( tBlinky, tInky, 'inky no apunta a Pacman' );
  same( tPinky, { x: 17, y: 11 }, 'pinky 4 delante' );
} );

test( 'las cuatro IAs son deterministas', () => {
  const pac = pacman( 13, 11, 'down' );
  for ( const g of GHOST_STARTS ) {
    const self = ghost( g.kind, g.x, g.y, 'up' );
    const ctx = ctxOf( self, pac, 'active', ghost( 'blinky', 13, 14, 'up' ) );
    const primera = chooseDirection( ctx );
    for ( let i = 0; i < 5; i++ ) assert.strictEqual( chooseDirection( ctx ), primera, g.kind );
  }
} );
// --- logica del pen (game.js) ---

function newGame() {
  return window.createGame();
}

test( 'blinky sale en el primer frame y los demas esperan su umbral', () => {
  const game = newGame();
  for ( const g of game.ghosts ) assert.strictEqual( g.mode, 'pen', g.kind + ' arranca en el pen' );
  window.update( game );
  assert.deepStrictEqual(
    game.ghosts.filter( ( g ) => g.mode === 'active' ).map( ( g ) => g.kind ),
    [ 'blinky' ],
    'solo blinky (umbral 0) queda activo tras el primer update'
  );
} );

test( 'cada fantasma se libera exactamente en su umbral de dots', () => {
  const game = newGame();
  // dotsEaten solo crece y mode nunca revierte, asi que basta un mismo juego.
  const tabla = [
    [ 0, 'blinky' ],
    [ 29, 'blinky' ], // aun solo blinky
    [ 30, 'blinky,pinky' ],
    [ 59, 'blinky,pinky' ], // aun sin inky
    [ 60, 'blinky,pinky,inky' ],
    [ 89, 'blinky,pinky,inky' ], // aun sin clyde
    [ 90, 'blinky,pinky,inky,clyde' ],
  ];
  for ( const [ dots, esperado ] of tabla ) {
    game.dotsEaten = dots;
    window.update( game );
    const activos = game.ghosts.filter( ( g ) => g.mode === 'active' ).map( ( g ) => g.kind ).join( ',' );
    assert.strictEqual( activos, esperado, 'activos con ' + dots + ' dots' );
  }
} );

test( 'el bobbing del pen se mantiene dentro de homeY +- 0.4 y no come dots', () => {
  const game = newGame();
  // Pacman quieto: si no, el cambio de dots seria suyo y no del fantasma.
  game.pacman.speed = 0;
  const pinky = game.ghosts.find( ( g ) => g.kind === 'pinky' );
  const homeY = GHOST_STARTS.find( ( s ) => s.kind === 'pinky' ).y;
  const dotsIniciales = game.dotsRemaining;
  const scoreInicial = game.score;
  for ( let f = 0; f < 200; f++ ) {
    window.update( game );
    assert.strictEqual( pinky.mode, 'pen', 'sigue esperando en el frame ' + f );
    assert.ok(
      pinky.y >= homeY - 0.4 - 1e-9 && pinky.y <= homeY + 0.4 + 1e-9,
      'fuera de rango en el frame ' + f + ': y=' + pinky.y
    );
  }
  assert.strictEqual( game.dotsRemaining, dotsIniciales, 'no comio dots' );
  assert.strictEqual( game.score, scoreInicial, 'no sumo puntos' );
} );

test( 'un fantasma liberado sale por la puerta y no vuelve a entrar al pen', () => {
  for ( const kind of [ 'blinky', 'pinky', 'inky', 'clyde' ] ) {
    const game = newGame();
    for ( const g of game.ghosts ) g.releaseAtDots = 0; // todos fuera ya
    game.dotsEaten = 0;
    const g = game.ghosts.find( ( x ) => x.kind === kind );
    const columnas = new Set();
    let salio = null;
    for ( let f = 1; f <= 300 && !salio; f++ ) {
      window.update( game );
      if ( Math.round( g.y ) === 12 && g.x >= 12 && g.x <= 15 ) columnas.add( Math.round( g.x ) );
      if ( g.y < 12 ) salio = f;
    }
    assert.ok( salio, kind + ' llego a salir del pen' );
    // Solo puede salir por una celda de puerta, y en pocos frames.
    assert.ok( columnas.size > 0, kind + ' piso alguna puerta' );
    for ( const col of columnas ) {
      assert.ok( col === 13 || col === 14, kind + ' uso una columna valida de puerta: ' + col );
    }
    assert.ok( salio <= 60, kind + ' tardo ' + salio + ' frames en salir (demasiado)' );
  }
} );

test( 'la boca del pen sigue apuntando a la puerta, no a la personalidad', () => {
  // En la celda de puerta (14,12), ya fuera del rectangulo PEN, el objetivo
  // tiene que seguir siendo una puerta; si no, el fantasma se da la vuelta y
  // vuelve a entrar (bug corregido durante la implementacion).
  for ( const puerta of PEN_DOORS ) {
    const self = ghost( 'pinky', puerta.x, puerta.y, 'up' );
    const target = computeTarget( 'pinky', ctxOf( self, pacman( 13, 23 ), 'active' ) );
    assert.deepStrictEqual( target, puerta, 'sobre la puerta ' + puerta.x + ',' + puerta.y );
  }
} );
