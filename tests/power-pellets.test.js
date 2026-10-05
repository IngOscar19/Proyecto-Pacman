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

// --- Paso 3: comer la pellet activa el frightened ---

// Suelta a todos los fantasmas: fuera del pen y lejos de Pacman.
function freeGhosts( game ) {
  for ( const g of game.ghosts ) {
    g.mode = 'active';
    g.x = 21;
    g.y = 5;
  }
  game.pacman.x = 6;
  game.pacman.y = 29;
}

// Avanza n frames dejando a los fantasmas aparcados en la esquina lejana. Hace
// falta porque un asustado todavia hace dano en este paso: si se cruzaran con
// Pacman, el update lo mataria, resetPositions limpiaria el frightened y el test
// mediria otra cosa. Asi lo que se mide es el reloj.
function runFrames( game, n ) {
  game.pacman.speed = 0;
  for ( let f = 0; f < n; f++ ) {
    for ( const g of game.ghosts ) {
      g.x = 21;
      g.y = 5;
    }
    window.update( game );
  }
}

test( 'una partida nueva no tiene frightened activo', () => {
  const game = newGame();
  assert.strictEqual( game.frightUntilFrame, 0, 'sin reloj de frightened' );
  assert.strictEqual( game.frightScore, FRIGHT_CHAIN[ 0 ], 'la cadena empieza en 200' );
  for ( const g of game.ghosts ) {
    assert.strictEqual( g.mode, 'pen', g.kind + ' arranca en el pen' );
    assert.strictEqual( g.didReverse, false, g.kind + ' sin invertir' );
  }
  for ( let f = 0; f < 10; f++ ) {
    window.update( game );
    assert.strictEqual( game.frightUntilFrame, 0, 'nadie se asusta sin pellet' );
  }
} );

test( 'comer una pellet suma 50, la borra del laberinto y asusta a los sueltos', () => {
  const game = newGame();
  freeGhosts( game );
  const pellet = POWER_PELLETS[ 0 ];
  const score = game.score;

  pelletAt( game, pellet.x, pellet.y );

  assert.strictEqual( game.score, score + 50, '50 puntos por la pellet' );
  assert.strictEqual( game.grid[ pellet.y ][ pellet.x ], 0, 'la celda queda vacia' );
  // dotsRemaining no baja: al empezar son 275, no 276, porque la celda de
  // inicio de Pacman ya estaba vacia (276 tiles de tipo 2 en el laberinto).
  assert.strictEqual( game.dotsRemaining, 275, 'la pellet no cuenta como dot' );
  assert.strictEqual( game.frightUntilFrame, game.frames + FRIGHT_FRAMES, 'el reloj corre 6s' );
  for ( const g of game.ghosts ) {
    assert.strictEqual( g.mode, 'frightened', g.kind + ' asustado' );
    assert.strictEqual( g.didReverse, false, g.kind + ' puede invertir' );
  }
} );

test( 'comer una pellet no asusta a los fantasmas que siguen en el pen', () => {
  const game = newGame();
  // Un update: blinky sale del pen (releaseAtFrame 0) y los otros tres siguen.
  game.pacman.speed = 0;
  window.update( game );
  assert.deepStrictEqual(
    game.ghosts.map( ( g ) => g.mode ),
    [ 'active', 'pen', 'pen', 'pen' ],
    'solo blinky esta suelto'
  );

  pelletAt( game, POWER_PELLETS[ 1 ].x, POWER_PELLETS[ 1 ].y );

  assert.deepStrictEqual(
    game.ghosts.map( ( g ) => g.mode ),
    [ 'frightened', 'pen', 'pen', 'pen' ],
    'los del pen se libran del frightened'
  );
  assert.ok( window.GAME.isFrightened( game ), 'el reloj corre igualmente' );
} );

test( 'el frightened expira y devuelve la velocidad y la cadena', () => {
  const game = newGame();
  freeGhosts( game );
  pelletAt( game, POWER_PELLETS[ 0 ].x, POWER_PELLETS[ 0 ].y );
  game.frightScore = FRIGHT_CHAIN[ 2 ]; // como si ya hubiera comido dos fantasmas

  runFrames( game, FRIGHT_FRAMES - 1 );
  assert.ok( window.GAME.isFrightened( game ), 'aun queda frightened' );
  for ( const g of game.ghosts ) assert.strictEqual( g.mode, 'frightened', g.kind + ' sigue asustado' );

  window.update( game );

  assert.strictEqual( game.frightUntilFrame, 0, 'el reloj se apaga' );
  assert.ok( !window.GAME.isFrightened( game ), 'ya no hay frightened' );
  assert.strictEqual( game.frightScore, FRIGHT_CHAIN[ 0 ], 'la cadena vuelve a 200' );
  for ( const g of game.ghosts ) {
    assert.strictEqual( g.mode, 'active', g.kind + ' vuelve a su normalidad' );
    assert.strictEqual( window.GAME.speedOf( g ), g.kind === 'blinky' ? 0.11 : 0.1, g.kind + ' a su velocidad' );
  }
} );

test( 'la velocidad sale del mode: asustado 0.05, normal 0.1 o 0.11', () => {
  const game = newGame();
  const blinky = game.ghosts[ 0 ];
  assert.strictEqual( window.GAME.speedOf( blinky ), 0.11, 'blinky 0.11' );
  blinky.mode = 'frightened';
  assert.strictEqual( window.GAME.speedOf( blinky ), 0.05, 'asustado 0.05' );
  blinky.mode = 'active';
  assert.strictEqual( window.GAME.speedOf( blinky ), 0.11, 'y vuelve a 0.11 sin tocar g.speed' );
  assert.strictEqual( blinky.speed, 0.11, 'g.speed nunca se muta' );
} );

test( 'un fantasma asustado recorre menos celdas que uno normal en el mismo tiempo', () => {
  const distancia = ( mode ) => {
    const game = newGame();
    freeGhosts( game );
    game.pacman.speed = 0;
    const g = game.ghosts[ 0 ];
    g.mode = mode;
    const inicio = { x: g.x, y: g.y };
    for ( let f = 0; f < 120; f++ ) window.GAME.moveGhost( game, g );
    return Math.hypot( g.x - inicio.x, g.y - inicio.y );
  };
  const asustado = distancia( 'frightened' );
  const normal = distancia( 'active' );
  assert.ok( asustado > 0, 'el asustado se movio' );
  assert.ok( asustado < normal, 'el asustado recorre menos: ' + asustado + ' < ' + normal );
} );

test( 'comer otra pellet renueva el reloj y reinicia la cadena', () => {
  const game = newGame();
  freeGhosts( game );
  pelletAt( game, POWER_PELLETS[ 0 ].x, POWER_PELLETS[ 0 ].y );
  game.frightScore = FRIGHT_CHAIN[ 3 ];

  // Casi se acaba el primer periodo...
  runFrames( game, FRIGHT_FRAMES - 1 );
  assert.ok( window.GAME.isFrightened( game ), 'todavia asustados' );

  // ...y entonces comes la segunda pellet.
  pelletAt( game, POWER_PELLETS[ 2 ].x, POWER_PELLETS[ 2 ].y );
  assert.strictEqual( game.frightScore, FRIGHT_CHAIN[ 0 ], 'la cadena vuelve a 200' );
  assert.ok( window.GAME.isFrightened( game ), 'el frightened sigue vivo' );

  // Y el nuevo periodo dura otros 6s completos desde su propio frame.
  runFrames( game, FRIGHT_FRAMES - 1 );
  assert.ok( window.GAME.isFrightened( game ), 'no se acabo antes de tiempo' );
  runFrames( game, 1 );
  assert.ok( !window.GAME.isFrightened( game ), 'y expira justo en el frame previsto' );
} );

test( 'morir limpia el frightened y la cadena', () => {
  const game = newGame();
  freeGhosts( game );
  pelletAt( game, POWER_PELLETS[ 0 ].x, POWER_PELLETS[ 0 ].y );
  game.frightScore = FRIGHT_CHAIN[ 2 ];

  // Muerte forzada: un fantasma normal encima de Pacman.
  game.pacman.x = 6;
  game.pacman.y = 29;
  const killer = game.ghosts[ 0 ];
  killer.mode = 'active';
  killer.x = game.pacman.x;
  killer.y = game.pacman.y;
  window.update( game );

  assert.strictEqual( game.lives, 2, 'perdio una vida' );
  assert.strictEqual( game.frightUntilFrame, 0, 'nadie queda asustado' );
  assert.strictEqual( game.frightScore, FRIGHT_CHAIN[ 0 ], 'la cadena vuelve a empezar' );
  assert.ok( !window.GAME.isFrightened( game ), 'el modo asustado se apaga' );
  for ( const g of game.ghosts ) assert.strictEqual( g.mode, 'pen', g.kind + ' vuelve al pen' );
} );