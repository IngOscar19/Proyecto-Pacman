// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, PACMAN_START,
// GHOST_STARTS, y de window.GRID (src/js/grid.js): DIRS, aligned, canMove,
// wrapTunnel, y de window.GHOST_AI (src/js/ghost-ai.js): chooseDirection.

const { DIRS, aligned, canMove, wrapTunnel } = window.GRID;
const { chooseDirection } = window.GHOST_AI;

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame
const BLINKY_SPEED = 0.11;  // un poco mas rapido: es el perseguidor
const BOB = 0.4;            // amplitud de la oscilacion dentro del pen

function ghostSpeed( kind ) {
  return kind === 'blinky' ? BLINKY_SPEED : GHOST_SPEED;
}

// Fila del pen que le corresponde a cada fantasma (todos arrancan en la 14).
function homeRow( g ) {
  return GHOST_STARTS.find( ( s ) => s.kind === g.kind ).y;
}

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    dotsEaten: 0,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: ghostSpeed( g.kind ),
      kind: g.kind,
      // Todos arrancan en el pen. blinky tiene umbral 0, asi que updateGhost
      // lo libera en el primer frame.
      mode: 'pen',
      releaseAtDots: g.releaseAtDots,
      bobDir: 1,
    } ) ),
  };
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
      game.dotsEaten++;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Elige la direccion del fantasma segun su personalidad. La IA vive en
// ghost-ai.js; aqui solo se le pasa el contexto y se normaliza a celda entera.
function decideGhost( game, g ) {
  const blinky = game.ghosts.find( ( other ) => other.kind === 'blinky' );
  g.dir = chooseDirection( {
    grid: game.grid,
    self: g,
    pacman: game.pacman,
    blinky: blinky || g,
    mode: g.mode,
  } );
}

// Espera en el pen: oscila sobre su fila sin puntuar ni comer nada, hasta que
// se hayan comido los dots que le tocan.
function bobGhost( g ) {
  const home = homeRow( g );
  const min = home - BOB;
  const max = home + BOB;
  let y = g.y + g.bobDir * g.speed;
  // Se ancla al extremo en vez de pasarse, para no salir de [min,max].
  if ( y >= max ) {
    y = max;
    g.bobDir = -1;
  } else if ( y <= min ) {
    y = min;
    g.bobDir = 1;
  }
  g.y = y;
}

// Se cumple su umbral de dots: sale del pen. Se ancla a su fila y arranca hacia
// arriba; mientras siga dentro del pen su objetivo es la puerta mas cercana.
function releaseGhost( g ) {
  g.mode = 'active';
  g.y = homeRow( g );
  g.dir = 'up';
}

function updateGhost( game, g ) {
  if ( g.mode === 'pen' ) {
    if ( game.dotsEaten >= g.releaseAtDots ) releaseGhost( g );
    else {
      bobGhost( g );
      return;
    }
  }
  moveGhost( game, g );
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    // Todos vuelven al pen a esperar: la secuencia de liberacion (y por tanto
    // el ritmo del nivel) arranca de cero otra vez.
    g.mode = 'pen';
    g.bobDir = 1;
  } );
  game.dotsEaten = 0;
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghosts.forEach( ( g ) => updateGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
