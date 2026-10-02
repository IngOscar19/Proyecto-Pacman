// grid.js
// Primitivas de navegacion del laberinto: direcciones, colisiones y tunel.
// Las usan game.js y ghost-ai.js. Dual export para que node --test pueda
// require() este archivo: window.GRID en el navegador, module.exports en Node.

(function () {
  const isNode = typeof module !== 'undefined' && typeof module.exports !== 'undefined';
  const maze = isNode ? require( './maze.js' ) : ( window.MAZE_DATA || window );

  const DIRS = {
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
  };
  const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

  // Orden de preferencia cuando dos direcciones empatan en distancia.
  const DIR_PRIORITY = [ 'up', 'left', 'down', 'right' ];

  function aligned( v ) {
    return Math.abs( v - Math.round( v ) ) < 1e-3;
  }

  // Una celda es muro para el actor dado?
  //   pacman: bloqueado por pared (1) y puerta (3)
  //   ghost:  bloqueado solo por pared (1)
  function isWall( grid, x, y, actor ) {
    if ( y < 0 || y >= grid.length ) return true;
    if ( x < 0 || x >= grid[ 0 ].length ) return true;
    const v = grid[ y ][ x ];
    if ( v === 1 ) return true;
    if ( v === 3 && actor === 'pacman' ) return true;
    return false;
  }

  // Puede el actor avanzar desde (x,y) en la direccion dir?
  function canMove( grid, x, y, dir, actor ) {
    const d = DIRS[ dir ];
    if ( !d ) return false;
    const tx = x + d.x;
    const ty = y + d.y;
    // Tunel: salir por un borde en la fila del tunel siempre es valido.
    if ( ty === maze.TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
    return !isWall( grid, tx, ty, actor );
  }

// El tunel de la fila TUNNEL_ROW es ciclico: al salir por un borde se
// reaparece por el opuesto.
function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === maze.TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

// Centro de la celda siguiente en la direccion dir. Si el actor esta justo en
// un centro, es el centro de al lado; si esta a medias de celda, es el mismo
// centro del que esta saliendo.
function nextCenter( a, dir ) {
  const d = DIRS[ dir ];
  return {
    x: d.x > 0 ? Math.floor( a.x ) + 1 : d.x < 0 ? Math.ceil( a.x ) - 1 : a.x,
    y: d.y > 0 ? Math.floor( a.y ) + 1 : d.y < 0 ? Math.ceil( a.y ) - 1 : a.y,
  };
}

// Avanza `speed` celdas en la direccion actual sin pasarse nunca del centro de
// la celda siguiente: si el paso no llega, se queda a `speed`; si llega o se
// pasa, se ancla al centro exacto.
//
// Sin este recorte, actor.x += dir.x * speed deriva: con una velocidad que no
// divide 1 (0.11) el actor nunca vuelve a caer alineado con la rejilla, deja de
// comprobar muros y se sale del laberinto. Anclar al centro en cada cruce hace
// la alineacion exacta e independiente de la velocidad.
function step( a, speed ) {
  const next = nextCenter( a, a.dir );
  const rest = Math.abs( next.x - a.x ) + Math.abs( next.y - a.y );
  if ( rest <= speed ) {
    a.x = next.x;
    a.y = next.y;
    return true; // ha cambiado de celda
  }
  const d = DIRS[ a.dir ];
  a.x += d.x * speed;
  a.y += d.y * speed;
  return false;
}

const api = { DIRS, OPPOSITE, DIR_PRIORITY, aligned, isWall, canMove, wrapTunnel, step };

  if ( typeof window !== 'undefined' ) window.GRID = api;
  if ( isNode ) module.exports = api;
})();