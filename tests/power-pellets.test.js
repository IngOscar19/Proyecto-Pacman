// tests/power-pellets.test.js
// Power pellets y modo asustado (src/js/maze.js, src/js/game.js, src/js/ghost-ai.js).
// Ejecutar con: node --test

const test = require( 'node:test' );
const assert = require( 'node:assert' );

// game.js expone sus globals en window, asi que hay que fingirlo un navegador.
global.window = globalThis;

const maze = require( '../src/js/maze.js' );
require( '../src/js/grid.js' );
require( '../src/js/ghost-ai.js' );
require( '../src/js/game.js' );

const { MAZE, PEN, POWER_PELLETS, FRIGHT_FRAMES, FRIGHT_FLASH_FRAMES, FRIGHT_CHAIN, FPS } = maze;

function newGame() {
  return window.createGame();
}

// Coloca a Pacman encima de una celda del laberinto sin dot ni pellet, para que
// comer sea algo que el test provoke y no una consecuencia del movimiento.
function teleport( game, x, y ) {
  game.pacman.x = x;
  game.pacman.y = y;
  game.pacman.nextDir = null;
}

function pelletAt( game, x, y ) {
  teleport( game, x, y );
  window.GAME.movePacman( game );
}

// --- Paso 1: la pellet vive en el laberinto ---

test( 'el laberinto sigue siendo de 31x28 con 276 dots y 4 power pellets', () => {
  assert.strictEqual( MAZE.length, 31, '31 filas' );
  assert.strictEqual( MAZE[ 0 ].length, 28, '28 columnas' );

  let dots = 0;
  let pellets = 0;
  for ( const row of MAZE ) {
    assert.strictEqual( row.length, 28, 'toda fila tiene 28 columnas' );
    for ( const v of row ) {
      if ( v === 2 ) dots++;
      if ( v === 4 ) pellets++;
    }
  }
  // Las 4 pellets salen de 4 dots de SPEC 01: 280 celdas comibles en total.
  assert.strictEqual( dots, 276, 'los dots de tipo 2 son 276' );
  assert.strictEqual( pellets, 4, 'hay 4 power pellets' );
  assert.strictEqual( dots + pellets, 280, '280 celdas comibles, igual que en SPEC 01' );
} );

test( 'las cuatro power pellets estan donde dice POWER_PELLETS', () => {
  assert.deepStrictEqual( POWER_PELLETS, [
    { x: 1, y: 6 },
    { x: 26, y: 6 },
    { x: 1, y: 26 },
    { x: 26, y: 26 },
  ] );
  for ( const p of POWER_PELLETS ) {
    assert.strictEqual( MAZE[ p.y ][ p.x ], 4, 'tipo 4 en ' + p.x + ',' + p.y );
  }
  // Y no hay ningun tile 4 fuera de la lista.
  for ( let y = 0; y < MAZE.length; y++ ) {
    for ( let x = 0; x < MAZE[ 0 ].length; x++ ) {
      if ( MAZE[ y ][ x ] !== 4 ) continue;
      assert.ok(
        POWER_PELLETS.some( ( p ) => p.x === x && p.y === y ),
        'tile 4 sin entrada en POWER_PELLETS: ' + x + ',' + y
      );
    }
  }
  // Simetria vertical del laberinto: se han puesto por pares.
  assert.strictEqual( POWER_PELLETS.length % 2, 0, 'van en parejas' );
} );

test( 'las constantes del frightened tienen los valores del original', () => {
  assert.strictEqual( FRIGHT_FRAMES, 6 * FPS, '6 segundos asustado' );
  assert.strictEqual( FRIGHT_FLASH_FRAMES, 2 * FPS, 'los ultimos 2s parpadean' );
  assert.deepStrictEqual( FRIGHT_CHAIN, [ 200, 400, 800, 1600 ], 'cadena de puntos' );
} );

test( 'las power pellets estan sobre celdas transitables y no en el pen', () => {
  for ( const p of POWER_PELLETS ) {
    assert.notStrictEqual( MAZE[ p.y ][ p.x ], 1, 'no es pared' );
    assert.notStrictEqual( MAZE[ p.y ][ p.x ], 3, 'no es puerta del pen' );
    const dentro = p.x >= PEN.x0 && p.x <= PEN.x1 && p.y >= PEN.y0 && p.y <= PEN.y1;
    assert.ok( !dentro, 'no esta dentro del pen' );
    // Transitable de verdad: se puede llegar andando desde algun lado. En las
    // filas 6 y 26 solo se sale en vertical, asi que vale cualquiera.
    const { DIRS, canMove } = window.GRID;
    const salidas = Object.keys( DIRS ).filter( ( dir ) => canMove( MAZE, p.x, p.y, dir, 'pacman' ) );
    assert.ok( salidas.length > 0, 'hay pasillo en ' + p.x + ',' + p.y );
  }
} );