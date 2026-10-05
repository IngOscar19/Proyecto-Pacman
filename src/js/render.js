// render.js
// Dibujo arcade sobre canvas. Usa game.grid (no MAZE) para reflejar dots comidos.
// Depende de window.GRID (src/js/grid.js) para las direcciones de los ojos.

(function () {
  const isNode = typeof module !== 'undefined' && typeof module.exports !== 'undefined';
  const grid = isNode ? require( './grid.js' ) : window.GRID;
  const maze = isNode ? require( './maze.js' ) : ( window.MAZE_DATA || window );
  const game = isNode ? require( './game.js' ) : window.GAME;
  const { DIRS } = grid;
  const { FRIGHT_FLASH_FRAMES } = maze;
  const { isFrightened } = game;

  const TILE = 20;
  const WALL_COLOR = '#2121ff';
  const DOOR_COLOR = '#ffb8ff';
  const DOT_COLOR = '#ffb897';
  const FLASH_COLOR = '#ffffff';
  const FRIGHT_COLOR = '#2121ff';
  const PELLET_RADIUS = 5;

  function cellCenter( x, y ) {
    return { cx: x * TILE + TILE / 2, cy: y * TILE + TILE / 2 };
  }

  // Paredes estilo arcade: lineas finas redondeadas que conectan los centros
  // de celdas-pared adyacentes. Produce el trazado continuo del original.
  // Cada medio segundo se invierte el estado del parpadeo: sirve tanto para el
  // laberinto como para el blanco de los asustados del final.
  function blink( frame ) {
    return Math.floor( frame / 10 ) % 2 === 1;
  }

  // Mientras queda frightened el laberinto parpadea en blanco y azul, como en el
  // arcade. El blanco se aplica solo a las paredes: Pacman y los fantasmas se
  // mantienen nitidos.
  function wallColor( game, frame ) {
    if ( !isFrightened( game ) ) return WALL_COLOR;
    return blink( frame ) ? FLASH_COLOR : WALL_COLOR;
  }

  function drawWalls( ctx, gGrid, color ) {
    const H = gGrid.length;
    const W = gGrid[ 0 ].length;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for ( let y = 0; y < H; y++ ) {
      for ( let x = 0; x < W; x++ ) {
        if ( gGrid[ y ][ x ] !== 1 ) continue;
        const { cx, cy } = cellCenter( x, y );
        // Conectar solo hacia derecha y abajo evita trazos duplicados.
        if ( x + 1 < W && gGrid[ y ][ x + 1 ] === 1 ) {
          ctx.moveTo( cx, cy );
          ctx.lineTo( cx + TILE, cy );
        }
        if ( y + 1 < H && gGrid[ y + 1 ][ x ] === 1 ) {
          ctx.moveTo( cx, cy );
          ctx.lineTo( cx, cy + TILE );
        }
        // Celda-pared aislada (sin vecino): punto corto para que se vea.
        const lone =
          ( x + 1 >= W || gGrid[ y ][ x + 1 ] !== 1 ) &&
          ( x - 1 < 0 || gGrid[ y ][ x - 1 ] !== 1 ) &&
          ( y + 1 >= H || gGrid[ y + 1 ][ x ] !== 1 ) &&
          ( y - 1 < 0 || gGrid[ y - 1 ][ x ] !== 1 );
        if ( lone ) {
          ctx.moveTo( cx - 3, cy );
          ctx.lineTo( cx + 3, cy );
        }
      }
    }
    ctx.stroke();
  }

  function drawDoor( ctx, gGrid ) {
    const H = gGrid.length;
    const W = gGrid[ 0 ].length;
    ctx.strokeStyle = DOOR_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for ( let y = 0; y < H; y++ ) {
      for ( let x = 0; x < W; x++ ) {
        if ( gGrid[ y ][ x ] !== 3 ) continue;
        const px = x * TILE;
        const py = y * TILE + TILE / 2;
        ctx.moveTo( px, py );
        ctx.lineTo( px + TILE, py );
      }
    }
    ctx.stroke();
  }

  // Las power pellets (tile 4) son el mismo punto de color que los dots pero mas
  // grandes, y parpadean en blanco mientras el laberinto esta tranquilo.
  function drawDots( ctx, gGrid, frame ) {
    const blinkOn = blink( frame );
    for ( let y = 0; y < gGrid.length; y++ ) {
      for ( let x = 0; x < gGrid[ 0 ].length; x++ ) {
        const v = gGrid[ y ][ x ];
        if ( v !== 2 && v !== 4 ) continue;
        const pellet = v === 4;
        ctx.fillStyle = pellet && blinkOn ? FLASH_COLOR : DOT_COLOR;
        const { cx, cy } = cellCenter( x, y );
        ctx.beginPath();
        ctx.arc( cx, cy, pellet ? PELLET_RADIUS : 2.5, 0, Math.PI * 2 );
        ctx.fill();
      }
    }
  }

  function drawPacman( ctx, p, frame ) {
    const { cx, cy } = cellCenter( p.x, p.y );
    let rot = 0;
    if ( p.dir === 'right' ) rot = 0;
    else if ( p.dir === 'down' ) rot = Math.PI / 2;
    else if ( p.dir === 'left' ) rot = Math.PI;
    else if ( p.dir === 'up' ) rot = -Math.PI / 2;

    // Boca animada: abre/cierra con el frame.
    const open = ( Math.sin( frame * 0.3 ) * 0.5 + 0.5 ) * 0.28 + 0.02;

    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.moveTo( cx, cy );
    ctx.arc( cx, cy, TILE / 2 - 1, rot + open * Math.PI, rot - open * Math.PI );
    ctx.closePath();
    ctx.fill();
  }

  // Cuerpo del fantasma: se dibuja con el color que le toque. Un fantasma comido
  // ('eaten') no tiene cuerpo, solo los ojos de camino al pen.
  function drawGhostBody( ctx, cx, cy, r, color ) {
    const bottom = cy + r;
    const left = cx - r;
    const right = cx + r;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc( cx, cy - 1, r, Math.PI, 0, false ); // cabeza
    ctx.lineTo( right, bottom );
    // falda ondulada (3 picos)
    ctx.lineTo( right - r * 0.66, bottom - 4 );
    ctx.lineTo( cx, bottom );
    ctx.lineTo( left + r * 0.66, bottom - 4 );
    ctx.lineTo( left, bottom );
    ctx.closePath();
    ctx.fill();
  }

  // Boca del asustado: el zigzag blanco del original.
  function drawFrightenedMouth( ctx, cx, cy ) {
    ctx.strokeStyle = FLASH_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo( cx - 5, cy + 3 );
    ctx.lineTo( cx - 2.5, cy + 1 );
    ctx.lineTo( cx, cy + 3 );
    ctx.lineTo( cx + 2.5, cy + 1 );
    ctx.lineTo( cx + 5, cy + 3 );
    ctx.stroke();
  }

  function drawGhostEyes( ctx, g, cx, cy ) {
    const dir = DIRS[ g.dir ] || { x: 0, y: 0 };
    const ex = dir.x * 1.6;
    const ey = dir.y * 1.6;
    for ( const off of [ -3.5, 3.5 ] ) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc( cx + off, cy - 1, 3, 0, Math.PI * 2 );
      ctx.fill();
      ctx.fillStyle = '#0000bb';
      ctx.beginPath();
      ctx.arc( cx + off + ex, cy - 1 + ey, 1.5, 0, Math.PI * 2 );
      ctx.fill();
    }
  }

  // Azul mientras queda frightened, blanco parpadeando en los ultimos
  // FRIGHT_FLASH_FRAMES: el aviso de que se acaba.
  function frightColor( game, frame ) {
    const restante = game.frightUntilFrame - game.frames;
    const parpadea = restante <= FRIGHT_FLASH_FRAMES && blink( frame );
    return parpadea ? FLASH_COLOR : FRIGHT_COLOR;
  }

  function drawGhost( ctx, g, color, game, frame ) {
    const { cx, cy } = cellCenter( g.x, g.y );
    const r = TILE / 2 - 1;

    if ( g.mode === 'eaten' ) {
      drawGhostEyes( ctx, g, cx, cy );
      return;
    }

    const asustado = g.mode === 'frightened';
    drawGhostBody( ctx, cx, cy, r, asustado ? frightColor( game, frame ) : color );
    if ( asustado ) drawFrightenedMouth( ctx, cx, cy );
    drawGhostEyes( ctx, g, cx, cy );
  }

  function drawHUD( ctx, game, W ) {
    ctx.fillStyle = '#fff';
    ctx.font = '14px "Courier New", monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText( 'SCORE ' + game.score, 8, 4 );
    ctx.textAlign = 'right';
    ctx.fillText( 'VIDAS ' + game.lives, W * TILE - 8, 4 );
  }

  const GHOST_COLORS = [ '#ff0000', '#00ffff', '#ffb8ff', '#ffb852' ];

  function draw( ctx, game, frame ) {
    const gGrid = game.grid;
    const W = gGrid[ 0 ].length;
    const H = gGrid.length;

    ctx.fillStyle = '#000';
    ctx.fillRect( 0, 0, W * TILE, H * TILE );

    drawWalls( ctx, gGrid, wallColor( game, frame ) );
    drawDoor( ctx, gGrid );
    drawDots( ctx, gGrid, frame );
    drawPacman( ctx, game.pacman, frame );
    game.ghosts.forEach( ( g, i ) => drawGhost( ctx, g, GHOST_COLORS[ i ] || '#ff0000', game, frame ) );
    drawHUD( ctx, game, W );
  }

  if ( typeof window !== 'undefined' ) window.draw = draw;
  if ( isNode ) module.exports = { draw };
})();
