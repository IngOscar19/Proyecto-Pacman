// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, PACMAN_START,
// GHOST_STARTS, y de window.GRID (src/js/grid.js): DIRS, aligned, canMove,
// wrapTunnel, y de window.GHOST_AI (src/js/ghost-ai.js): chooseDirection.

(function () {
  const isNode = typeof module !== 'undefined' && typeof module.exports !== 'undefined';
  const grid = isNode ? require( './grid.js' ) : window.GRID;
  const ghostAi = isNode ? require( './ghost-ai.js' ) : window.GHOST_AI;
  const maze = isNode ? require( './maze.js' ) : ( window.MAZE_DATA || window );

  const { aligned, canMove, wrapTunnel, step } = grid;
  const { chooseDirection } = ghostAi;
  const { MAZE, PACMAN_START, GHOST_STARTS, FRIGHT_FRAMES, FRIGHT_CHAIN } = maze;

  const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
  const GHOST_SPEED = 0.1;    // 1/10 celda/frame
  const BLINKY_SPEED = 0.11;  // un poco mas rapido: es el perseguidor
  const FRIGHT_SPEED = 0.05;  // asustado: la mitad de velocidad
  const BOB = 0.4;            // amplitud de la oscilacion dentro del pen

  function ghostSpeed( kind ) {
    return kind === 'blinky' ? BLINKY_SPEED : GHOST_SPEED;
  }

  // La velocidad depende solo del modo, nunca se guarda en el fantasma: asi no
  // puede quedar desincronizada cuando el frightened expira.
  function speedOf( g ) {
    return g.mode === 'frightened' ? FRIGHT_SPEED : ghostSpeed( g.kind );
  }

  // Fila del pen que le corresponde a cada fantasma (todos arrancan en la 14).
  function homeRow( g ) {
    return GHOST_STARTS.find( ( s ) => s.kind === g.kind ).y;
  }

  // Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
  // dots sin destruir el original, y reiniciar.
  function createGame() {
    const gameGrid = MAZE.map( ( row ) => row.slice() );
    // La celda de inicio de Pacman arranca sin dot.
    gameGrid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

    let dots = 0;
    for ( const row of gameGrid ) for ( const v of row ) if ( v === 2 ) dots++;

    return {
      state: 'start',
      score: 0,
      lives: 3,
      dotsRemaining: dots,
      dotsEaten: 0,
      // Frames jugados desde el ultimo reset. Es el reloj que decide cuando
      // sale cada fantasma del pen.
      frames: 0,
      // frightened: hasta que frame se acaba? 0 = nadie asustado. Se renueva
      // cada vez que Pacman come una power pellet.
      frightUntilFrame: 0,
      // Puntos que vale el siguiente fantasma comido (200, 400, 800, 1600).
      frightScore: FRIGHT_CHAIN[ 0 ],
      grid: gameGrid,
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
        // Todos arrancan en el pen. blinky tiene releaseAtFrame 0, asi que
        // updateGhost lo libera en el primer frame.
        mode: 'pen',
        releaseAtFrame: g.releaseAtFrame,
        bobDir: 1,
        // frightened puede invertir su direccion una sola vez por periodo.
        didReverse: false,
      } ) ),
    };
  }

  // Quedan fantasmas asustados ahora mismo? Lo lee tambien render.js, para el
// parpadeo del laberinto.
function isFrightened( game ) {
  return game.frightUntilFrame > game.frames;
}

// Comer una power pellet: renueva el reloj del frightened, reinicia la cadena de
// puntos y asusta a los fantasmas que ya estan sueltos. Los del pen no se
// asustan (alli dentro son un refugio) y salen despues ya normales.
function eatPellet( game ) {
    game.frightUntilFrame = game.frames + FRIGHT_FRAMES;
    game.frightScore = FRIGHT_CHAIN[ 0 ];
    for ( const g of game.ghosts ) {
      if ( g.mode !== 'active' ) continue;
      g.mode = 'frightened';
      g.didReverse = false;
    }
  }

  // El frightened se acaba: todos los asustados vuelven a su ritmo normal y la
  // cadena de puntos empieza otra vez desde 200.
  function expireFright( game ) {
    if ( isFrightened( game ) || game.frightUntilFrame === 0 ) return;
    game.frightUntilFrame = 0;
    game.frightScore = FRIGHT_CHAIN[ 0 ];
    for ( const g of game.ghosts ) {
      if ( g.mode !== 'frightened' ) continue;
      g.mode = 'active';
      g.didReverse = false;
    }
  }

  function movePacman( game ) {
    const p = game.pacman;
    const gGrid = game.grid;
    const width = gGrid[ 0 ].length;

    if ( aligned( p.x ) && aligned( p.y ) ) {
      p.x = Math.round( p.x );
      p.y = Math.round( p.y );

      // Aplicar giro pendiente si es posible.
      if ( p.nextDir && canMove( gGrid, p.x, p.y, p.nextDir, 'pacman' ) ) {
        p.dir = p.nextDir;
        p.nextDir = null;
      }
      // Comer dot.
      if ( gGrid[ p.y ][ p.x ] === 2 ) {
        gGrid[ p.y ][ p.x ] = 0;
        game.score += 10;
        game.dotsRemaining--;
        game.dotsEaten++;
      }
      // Comer power pellet: 50 puntos y todos los fantasmas sueltos se asustan.
      // No cuenta como dot: dotsRemaining solo baja con los tiles de tipo 2.
      if ( gGrid[ p.y ][ p.x ] === 4 ) {
        gGrid[ p.y ][ p.x ] = 0;
        game.score += 50;
        eatPellet( game );
      }
      // Si no puede seguir, se detiene en la celda.
      if ( !canMove( gGrid, p.x, p.y, p.dir, 'pacman' ) ) return;
    }

    step( p, p.speed );
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
// le toque su turno de salida.
function bobGhost( g ) {
    const home = homeRow( g );
    const min = home - BOB;
    const max = home + BOB;
    let y = g.y + g.bobDir * speedOf( g );
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

// Llega su turno (game.frames >= releaseAtFrame): sale del pen. Se ancla a su
// fila y arranca hacia arriba; mientras siga dentro del pen su objetivo es la
// puerta mas cercana.
function releaseGhost( g ) {
  g.mode = 'active';
  g.y = homeRow( g );
  g.dir = 'up';
}

function updateGhost( game, g ) {
  if ( g.mode === 'pen' ) {
    if ( game.frames >= g.releaseAtFrame ) releaseGhost( g );
      else {
        bobGhost( g );
        return;
      }
    }
    moveGhost( game, g );
  }

  function moveGhost( game, g ) {
    const gGrid = game.grid;
    const width = gGrid[ 0 ].length;

    if ( aligned( g.x ) && aligned( g.y ) ) {
      g.x = Math.round( g.x );
      g.y = Math.round( g.y );
      decideGhost( game, g );
      if ( !canMove( gGrid, g.x, g.y, g.dir, 'ghost' ) ) return;
    }

    step( g, speedOf( g ) );
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
      g.didReverse = false;
    } );
    game.frames = 0;
    // Morir limpia el frightened: a la vida siguiente nadie sale asustado.
    game.frightUntilFrame = 0;
    game.frightScore = FRIGHT_CHAIN[ 0 ];
  }

  function collides( a, b ) {
    return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
  }

  function update( game ) {
    // El reloj del pen corre solo mientras se juega: si Pacman muere y se
    // reinician las posiciones, resetPositions lo vuelve a poner a 0.
    game.frames++;
    expireFright( game );
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

  const api = { createGame, update, resetPositions, movePacman, updateGhost, moveGhost, decideGhost, bobGhost, releaseGhost, collides, isFrightened, speedOf };

  if ( typeof window !== 'undefined' ) {
    window.createGame = createGame;
    window.update = update;
    window.GAME = api;
  }
  if ( isNode ) module.exports = api;
})();
