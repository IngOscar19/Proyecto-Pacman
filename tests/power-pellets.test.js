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
require( '../src/js/render.js' );
const ai = window.GHOST_AI;

const { MAZE, PEN, PEN_DOORS, POWER_PELLETS, FRIGHT_FRAMES, FRIGHT_FLASH_FRAMES, FRIGHT_CHAIN, FPS } = maze;
const { chooseDirection, computeTarget, insidePen } = ai;
const { DIRS, OPPOSITE, canMove } = window.GRID;

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
// --- Paso 4: el asustado se mueve al azar ---

// Sorteo fijo: siempre el mismo numero, para que el test sea reproducible.
const rngFijo = ( valor ) => () => valor;
const rngCero = rngFijo( 0 );

function asustado( x, y, dir = 'up', extra ) {
  return { x, y, dir, kind: 'blinky', mode: 'frightened', didReverse: false, ...extra };
}
function ctxAsustado( self, rng ) {
  return { grid: MAZE, self, pacman: { x: 13, y: 23, dir: 'left' }, blinky: self, mode: 'frightened', rng };
}

test( 'el asustado elige una direccion legal y nunca la inversa', () => {
  for ( const valor of [ 0, 0.24, 0.25, 0.49, 0.5, 0.74, 0.75, 0.99 ] ) {
    for ( const dir of [ 'up', 'left', 'down', 'right' ] ) {
      const self = asustado( 13, 11, dir );
      const elegida = chooseDirection( ctxAsustado( self, rngFijo( valor ) ) );
      assert.ok(
        canMove( MAZE, self.x, self.y, elegida, 'ghost' ),
        'eligio una pared desde (13,11) mirando ' + dir + ': ' + elegida
      );
      assert.notStrictEqual(
        elegida,
        OPPOSITE[ dir ],
        'se dio la vuelta desde (13,11) mirando ' + dir + ' con rng ' + valor
      );
    }
  }
} );

test( 'el sorteado elige entre todas las legales segun el rng', () => {
  // En (13,11) mirando a la izquierda la inversa es 'right', que queda fuera.
  // Arriba hay pared, asi que las legales son las que se calculan aqui.
  const legales = [ 'up', 'left', 'down' ].filter( ( d ) => canMove( MAZE, 13, 11, d, 'ghost' ) );
  assert.deepStrictEqual( legales, [ 'left', 'down' ], 'las legales de (13,11) mirando izquierda' );
  const vistos = new Set();
  for ( let i = 0; i < 60; i++ ) {
    const v = i / 60;
    vistos.add( chooseDirection( ctxAsustado( asustado( 13, 11, 'left' ), rngSecuencial( v ) ) ) );
  }
  for ( const dir of legales ) assert.ok( vistos.has( dir ), 'el rng pudo elegir ' + dir );
  assert.ok( !vistos.has( 'right' ), 'nunca elige la inversa' );
  // Con rng = 0 siempre elige la primera legal del orden de preferencia.
  for ( let i = 0; i < 5; i++ ) {
    assert.strictEqual( chooseDirection( ctxAsustado( asustado( 13, 11, 'left' ), rngCero ) ), legales[ 0 ] );
  }
} );

// rng que siempre devuelve el valor i.
function rngSecuencial( v ) {
  return () => v;
}

test( 'el asustado es reproducible con el mismo rng', () => {
  const primera = chooseDirection( ctxAsustado( asustado( 9, 17, 'right' ), rngFijo( 0.7 ) ) );
  for ( let i = 0; i < 5; i++ ) {
    assert.strictEqual(
      chooseDirection( ctxAsustado( asustado( 9, 17, 'right' ), rngFijo( 0.7 ) ) ),
      primera,
      'mismo rng, misma direccion'
    );
  }
} );

test( 'el asustado solo se invierte cuando no hay ninguna otra salida', () => {
  // Callejon: un grid sintetico donde solo se puede retroceder.
  const cerrado = [
    [ 1, 1, 1 ],
    [ 1, 0, 1 ],
    [ 1, 1, 1 ],
  ];
  const self = asustado( 1, 1, 'left', { didReverse: false } );
  const ctx = { grid: cerrado, self, pacman: { x: 9, y: 9, dir: 'left' }, blinky: self, mode: 'frightened', rng: rngCero };
  assert.strictEqual( chooseDirection( ctx ), 'right', 'sin salida solo puede darse la vuelta' );
  assert.strictEqual( self.didReverse, true, 'y lo anota' );

  // Con salidas que no son la inversa elige entre ellas y no marca el flag.
  const conSalida = [
    [ 1, 0, 1 ],
    [ 0, 0, 1 ],
    [ 1, 1, 1 ],
  ];
  const self2 = asustado( 1, 1, 'left', { didReverse: false } );
  const ctx2 = { grid: conSalida, self: self2, pacman: { x: 9, y: 9, dir: 'left' }, blinky: self2, mode: 'frightened', rng: rngCero };
  assert.strictEqual( chooseDirection( ctx2 ), 'up', 'arriba es legal y no es la inversa' );
  assert.strictEqual( self2.didReverse, false, 'no marca giro forzado' );
} );

test( 'didReverse se limpia al comer una pellet nueva y al expirar', () => {
  const game = newGame();
  freeGhosts( game );
  const blinky = game.ghosts[ 0 ];
  blinky.didReverse = true;

  pelletAt( game, POWER_PELLETS[ 0 ].x, POWER_PELLETS[ 0 ].y );
  assert.strictEqual( blinky.didReverse, false, 'comer una pellet limpia el flag' );
  blinky.didReverse = true;
  runFrames( game, FRIGHT_FRAMES );
  assert.strictEqual( blinky.didReverse, false, 'y expirar el frightened tambien' );
} );

test( 'el objetivo de un eaten es la celda de dentro de la puerta del pen', () => {
  // Lejos del pen, el destino es la entrada de la puerta mas cercana. No la
  // puerta en si: al pisarla el fantasma daria media vuelta y no bajaria nunca.
  const self = asustado( 6, 20, 'up', { mode: 'eaten' } );
  const ctx = { grid: MAZE, self, pacman: { x: 13, y: 23, dir: 'left' }, blinky: self, mode: 'eaten' };
  assert.deepStrictEqual( computeTarget( 'blinky', ctx ), { x: 13, y: 13 }, 'desde (6,20) entra por la izquierda' );

  const derecha = asustado( 21, 20, 'up', { mode: 'eaten' } );
  assert.deepStrictEqual(
    computeTarget( 'blinky', { ...ctx, self: derecha } ),
    { x: 14, y: 13 },
    'desde (21,20) entra por la derecha'
  );

  // La celda de dentro pertenece al pen: al pisarla el fantasma deja de ser ojos.
  for ( const puerta of PEN_DOORS ) {
    assert.ok(
      insidePen( { x: puerta.x, y: puerta.y + 1 } ),
      'la entrada ' + puerta.x + ',' + ( puerta.y + 1 ) + ' esta dentro del pen'
    );
  }
  assert.ok( insidePen( { x: 13, y: 14 } ), 'dentro' );
  assert.ok( !insidePen( { x: 13, y: 12 } ), 'la boca no esta dentro' );
} );

test( 'el rng de la partida lo usan solo los asustados', () => {
  const game = newGame();
  let llamadas = 0;
  game.rng = () => { llamadas++; return 0; };
  freeGhosts( game );

  // Normales: no deben tocar el rng.
  for ( const g of game.ghosts ) g.mode = 'active';
  for ( let f = 0; f < 20; f++ ) {
    for ( const g of game.ghosts ) window.GAME.moveGhost( game, g );
  }
  assert.strictEqual( llamadas, 0, 'las cuatro IAs no sortean' );

  // Asustado: ahora si.
  game.ghosts[ 0 ].mode = 'frightened';
  window.GAME.moveGhost( game, game.ghosts[ 0 ] );
  assert.ok( llamadas > 0, 'el asustado sortea direccion' );
} );

// --- Paso 5: comer fantasmas asustados ---

// Coloca a Pacman encima del fantasma y avanza un frame. Limpia antes el dot que
// hubiera en esa celda: aqui se mide la cadena de puntos, no los 10 del dot.
function come( game, g ) {
  const cx = Math.round( g.x );
  const cy = Math.round( g.y );
  if ( game.grid[ cy ][ cx ] === 2 ) {
    game.grid[ cy ][ cx ] = 0;
    game.dotsRemaining--;
  }
  teleport( game, g.x, g.y );
  window.update( game );
}

// Una partida con todos los fantasmas sueltos y asustados.
function asustados( game ) {
  freeGhosts( game );
  pelletAt( game, POWER_PELLETS[ 0 ].x, POWER_PELLETS[ 0 ].y );
  return game;
}

test( 'el primero vale 200 y el segundo 400', () => {
  const game = asustados( newGame() );
  const antes = game.score;

  come( game, game.ghosts[ 0 ] );
  assert.strictEqual( game.score, antes + FRIGHT_CHAIN[ 0 ], 'el primero: 200' );
  assert.strictEqual( game.frightScore, FRIGHT_CHAIN[ 1 ], 'el siguiente valdra 400' );
  assert.strictEqual( game.ghosts[ 0 ].mode, 'eaten', 'el primero queda en ojos' );

  come( game, game.ghosts[ 1 ] );
  assert.strictEqual( game.score, antes + FRIGHT_CHAIN[ 0 ] + FRIGHT_CHAIN[ 1 ], 'el segundo: 400' );
  assert.strictEqual( game.frightScore, FRIGHT_CHAIN[ 2 ], 'el siguiente valdra 800' );
} );

test( 'la cadena completa es 200, 400, 800, 1600 y se queda en 1600', () => {
  const game = asustados( newGame() );
  const pellets = game.score;
  const esperado = [ 200, 400, 800, 1600, 1600, 1600 ];

  // Los cuatro可以被 comidos y despues ya solo hay ojos que no puntuan: para
  // seguir probando la cadena se vuelven a asustar a mano.
  for ( let i = 0; i < esperado.length; i++ ) {
    const g = game.ghosts[ i % game.ghosts.length ];
    g.mode = 'frightened';
    g.x = 6 + i;
    g.y = 29;
    const puntos = game.score;
    come( game, g );
    assert.strictEqual( game.score - puntos, esperado[ i ], 'fantasma ' + ( i + 1 ) + ': ' + esperado[ i ] );
  }
  assert.strictEqual( game.frightScore, FRIGHT_CHAIN[ 3 ], 'la cadena se queda en 1600' );
  assert.strictEqual( pellets, 50, 'la partida arranco con los 50 de la pellet' );
} );

test( 'un fantasma comido no hace dano a Pacman', () => {
  const game = asustados( newGame() );
  const g = game.ghosts[ 0 ];
  come( game, g );
  assert.strictEqual( g.mode, 'eaten', 'quedo en ojos' );

  // Choca otra vez con el, con las vidas intactas.
  const vidas = game.lives;
  for ( let i = 0; i < 20; i++ ) {
    teleport( game, g.x, g.y );
    window.update( game );
  }
  assert.strictEqual( game.lives, vidas, 'los ojos no quitan vidas' );
  assert.strictEqual( g.mode, 'eaten', 'y sigue siendo un par de ojos' );
} );

test( 'un fantasma normal sigue quitando una vida', () => {
  const game = newGame();
  freeGhosts( game );
  const g = game.ghosts[ 0 ];
  assert.strictEqual( g.mode, 'active', 'no esta asustado' );
  come( game, g );
  assert.strictEqual( game.lives, 2, 'una vida menos' );
  assert.strictEqual( g.mode, 'pen', 'y vuelve al pen' );
} );

test( 'los ojos se mueven a 0.16', () => {
  const game = asustados( newGame() );
  const g = game.ghosts[ 0 ];
  assert.strictEqual( window.GAME.speedOf( g ), 0.05, 'asustado va a 0.05' );
  g.mode = 'eaten';
  assert.strictEqual( window.GAME.speedOf( g ), 0.16, 'mas rapido que un fantasma normal' );
  g.mode = 'active';
  assert.strictEqual( window.GAME.speedOf( g ), 0.11, 'y un activo vuelve a lo suyo' );
} );

test( 'los ojos llegan al pen y vuelven a salir', () => {
  const game = asustados( newGame() );
  const g = game.ghosts[ 0 ];
  come( game, g );
  assert.strictEqual( g.mode, 'eaten', 'arranca como ojos' );

  let entro = -1;
  let salio = -1;
  for ( let f = 1; f <= 600 && salio === -1; f++ ) {
    window.GAME.updateGhost( game, g );
    if ( entro === -1 && g.mode === 'pen' ) entro = f;
    // Ha vuelto a ser un fantasma de verdad y ha salido del pen.
    if ( entro !== -1 && g.mode === 'active' && g.y <= 13 ) salio = f;
  }
  assert.ok( entro > 0, 'los ojos entraron en el pen en el frame ' + entro );
  assert.ok( salio > 0, 'y volvieron a salir como fantasma en el frame ' + salio );
  assert.ok( window.GAME.isFrightened( game ), 'el resto del frightened sigue vivo' );
  // Y ya vuelve a ser un fantasma normal: ni asustado ni ojos.
  assert.strictEqual( g.mode, 'active', 'blinky vuelve a la normalidad' );
} );

test( 'comerse fantasmas no gasta el frightened ni renueva el reloj', () => {
  const game = asustados( newGame() );
  runFrames( game, 10 );
  const reloj = game.frightUntilFrame;
  const frames = game.frames;

  come( game, game.ghosts[ 0 ] );

  assert.strictEqual( game.frightUntilFrame, reloj, 'el reloj sigue donde estaba' );
  assert.strictEqual( game.frames, frames + 1, 'solo gasto el frame del update' );
  assert.ok( window.GAME.isFrightened( game ), 'los demas siguen asustados' );
  for ( let i = 1; i < 4; i++ ) {
    assert.strictEqual( game.ghosts[ i ].mode, 'frightened', game.ghosts[ i ].kind + ' sigue asustado' );
  }
} );

// --- Paso 6: el frightened se ve ---

// Contexto de canvas falso: guarda los colores con los que se pinta cada figura.
function render( game, frame ) {
  const ops = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    canvas: { width: 560, height: 620 },
    fillRect() {},
    fillText() {},
  };
  for ( const name of [ 'beginPath', 'arc', 'fill', 'stroke', 'moveTo', 'lineTo', 'closePath' ] ) {
    ctx[ name ] = () => ops.push( { name, fillStyle: ctx.fillStyle, strokeStyle: ctx.strokeStyle } );
  }
  window.draw( ctx, game, frame );
  return ops;
}

// atajo legible: algo en la lista cumple el predicado
function usa( ops, pred ) {
  return ops.some( pred );
}

// Quita dots y pellets del laberinto: se pintan con colores propios (las pellets
// ademas parpadean en blanco) y se confunden con lo que dibuja el fantasma.
function limpiaComibles( game ) {
  for ( let y = 0; y < game.grid.length; y++ ) {
    for ( let x = 0; x < game.grid[ 0 ].length; x++ ) {
      if ( game.grid[ y ][ x ] === 2 || game.grid[ y ][ x ] === 4 ) game.grid[ y ][ x ] = 0;
    }
  }
}

function soloUnFantasma( game, mode ) {
  game.ghosts = [ game.ghosts[ 0 ] ];
  game.ghosts[ 0 ].mode = mode;
  game.ghosts[ 0 ].x = 13;
  game.ghosts[ 0 ].y = 11;
  limpiaComibles( game );
}

test( 'el laberinto parpadea en blanco mientras hay frightened', () => {
  const game = asustados( newGame() );

  // Con frightened: un frame de cada dos las paredes salen blancas.
  assert.ok( usa( render( game, 10 ), ( o ) => o.name === 'stroke' && o.strokeStyle === '#ffffff' ), 'parpadeo blanco' );
  assert.ok( usa( render( game, 0 ), ( o ) => o.name === 'stroke' && o.strokeStyle === '#2121ff' ), 'y azul' );

  // Sin frightened las paredes nunca parpadean.
  const limpio = newGame();
  for ( let f = 0; f < 40; f += 10 ) {
    assert.ok( !usa( render( limpio, f ), ( o ) => o.name === 'stroke' && o.strokeStyle === '#ffffff' ), 'tranquilo en el frame ' + f );
  }
} );

test( 'el asustado se pinta azul y con la boca abierta', () => {
  const game = asustados( newGame() );
  soloUnFantasma( game, 'frightened' );
  const ops = render( game, 0 );

  assert.ok( usa( ops, ( o ) => o.name === 'fill' && o.fillStyle === '#2121ff' ), 'cuerpo azul' );
  assert.ok( usa( ops, ( o ) => o.name === 'stroke' && o.strokeStyle === '#ffffff' ), 'boca abierta en zigzag' );
} );

test( 'los asustados se vuelven blancos en los ultimos 2 segundos', () => {
  const game = asustados( newGame() );
  soloUnFantasma( game, 'frightened' );

  // A mitad del frightened sigue azul, no blanco.
  game.frightUntilFrame = game.frames + FRIGHT_FRAMES;
  assert.ok( !usa( render( game, 10 ), ( o ) => o.name === 'fill' && o.fillStyle === '#ffffff' ), 'a mitad no parpadea en blanco' );

  // En el ultimo segundo y medio, uno de cada dos frames va blanco.
  game.frightUntilFrame = game.frames + FRIGHT_FLASH_FRAMES - 1;
  assert.ok( usa( render( game, 10 ), ( o ) => o.name === 'fill' && o.fillStyle === '#ffffff' ), 'blanco en el frame parpadeante' );
  assert.ok( !usa( render( game, 0 ), ( o ) => o.name === 'fill' && o.fillStyle === '#ffffff' ), 'y azul en el otro' );
} );

test( 'un fantasma comido se dibuja solo con los ojos', () => {
  const game = asustados( newGame() );
  soloUnFantasma( game, 'eaten' );
  const ops = render( game, 0 );

  // Solo los dos ojos (blancos con pupila azul) y el Pacman de siempre: ni
  // cuerpo ni boca.
  const pintadas = ops.filter( ( o ) => o.name === 'fill' );
  assert.ok( pintadas.length > 0, 'dibujo algo' );
  for ( const o of pintadas ) {
    assert.ok(
      o.fillStyle === '#fff' || o.fillStyle === '#0000bb' || o.fillStyle === '#ffff00',
      'pinto algo que no son ojos: ' + o.fillStyle
    );
  }
  assert.ok( !usa( ops, ( o ) => o.name === 'fill' && o.fillStyle === '#ff0000' ), 'ni cuerpo de su color' );
  assert.ok( !usa( ops, ( o ) => o.name === 'fill' && o.fillStyle === '#2121ff' ), 'ni cuerpo de asustado' );
  // Exactamente dos ojos blancos con su pupila azul, y nada mas.
  const blancos = ops.filter( ( o ) => o.name === 'fill' && o.fillStyle === '#fff' );
  const pupilas = ops.filter( ( o ) => o.name === 'fill' && o.fillStyle === '#0000bb' );
  assert.strictEqual( blancos.length, 2, 'dos ojos' );
  assert.strictEqual( pupilas.length, 2, 'dos pupilas' );
} );

test( 'sin frightened los cuatro fantasmas siguen con su color', () => {
  const game = newGame();
  limpiaComibles( game );
  const ops = render( game, 10 );
  for ( const color of [ '#ff0000', '#00ffff', '#ffb8ff', '#ffb852' ] ) {
    assert.ok( usa( ops, ( o ) => o.name === 'fill' && o.fillStyle === color ), 'falta el color ' + color );
  }
} );
