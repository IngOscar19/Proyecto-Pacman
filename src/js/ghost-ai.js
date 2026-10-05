// ghost-ai.js
// IA de los cuatro fantasmas. Funciones puras: reciben el contexto y
// devuelven un objetivo o una direccion. La unica excepcion es la eleccion
// asustada, que anota el giro forzado en self.didReverse (regla del original).
//   ctx = { grid, self, pacman, blinky, mode, rng }
// `self` debe venir alineado a una celda entera (lo normaliza decideGhost).
// Dual export como grid.js, para que node --test pueda require('./ghost-ai.js').

(function () {
  const isNode = typeof module !== 'undefined' && typeof module.exports !== 'undefined';
  const grid = isNode ? require( './grid.js' ) : window.GRID;
  const maze = isNode ? require( './maze.js' ) : ( window.MAZE_DATA || window );

  const { DIRS, OPPOSITE, DIR_PRIORITY, canMove } = grid;

  function manhattan( a, b ) {
    return Math.abs( a.x - b.x ) + Math.abs( a.y - b.y );
  }

  // Celda n posiciones por delante de Pacman segun hacia donde mira. No comprueba
  // muros: el objetivo puede caer dentro de una pared y el fantasma simplemente
  // toma la ruta mas corta hacia el, igual que en el original.
  function aheadOf( pacman, n ) {
    const d = DIRS[ pacman.dir ] || { x: 0, y: 0 };
    return {
      x: Math.round( pacman.x ) + d.x * n,
      y: Math.round( pacman.y ) + d.y * n,
    };
  }

  // Pen: lo unico que hay que alcanzar es la puerta mas cercana.
  function nearestPenDoor( self ) {
    let best = maze.PEN_DOORS[ 0 ];
    let bestDist = Infinity;
    for ( const door of maze.PEN_DOORS ) {
      const dist = manhattan( self, door );
      if ( dist < bestDist ) {
        bestDist = dist;
        best = door;
      }
    }
    return best;
  }

  function insidePen( p ) {
    const pen = maze.PEN;
    return p.x >= pen.x0 && p.x <= pen.x1 && p.y >= pen.y0 && p.y <= pen.y1;
  }

  // La boca del pen (las celdas de puerta de la fila 12) tambien cuenta: si un
  // fantasma liberado dejara de apuntar a la puerta al pisarla, su personalidad
  // lo devolveria hacia dentro y volveria a entrar al pen.
  function atPenMouth( p ) {
    return maze.PEN_DOORS.some( ( door ) => door.x === Math.round( p.x ) && door.y === Math.round( p.y ) );
  }

  // Objetivo de cada personalidad. Dentro del pen manda la salida, sea cual sea
  // el kind: primero mientras espera (mode 'pen') y despues ya liberado pero sin
  // haber conseguido salir todavia. Los ojos de un fantasma comido (mode 'eaten')
  // solo tienen un destino: la puerta del pen.
  function computeTarget( kind, ctx ) {
    const { self, pacman, blinky } = ctx;
    if ( ctx.mode === 'eaten' || ctx.mode === 'pen' || insidePen( self ) || atPenMouth( self ) ) {
      return nearestPenDoor( self );
    }

    const pac = { x: Math.round( pacman.x ), y: Math.round( pacman.y ) };
    const ahead4 = aheadOf( pacman, 4 );

    switch ( kind ) {
      // Embosca: se lanza 4 celdas por delante de Pacman, este a donde vaya.
      case 'pinky':
        return ahead4;

      // Vector duplicado: parte de Blinky y apunta al doble del tramo que va
      // de Blinky a la celda 4 celdas por delante de Pacman.
      case 'inky': {
        const b = { x: Math.round( blinky.x ), y: Math.round( blinky.y ) };
        return { x: b.x + 2 * ( ahead4.x - b.x ), y: b.y + 2 * ( ahead4.y - b.y ) };
      }

      // Cobarde: persigue de lejos y se retira a su esquina cuando Pacman se
      // acerca a menos de 8 celdas.
      case 'clyde': {
        const s = { x: Math.round( self.x ), y: Math.round( self.y ) };
        const near = Math.hypot( s.x - pac.x, s.y - pac.y ) <= 8;
        return near ? maze.CORNERS.clyde : pac;
      }

      // Perseguidor puro: va directo a la celda de Pacman.
      case 'blinky':
      default:
        return pac;
    }
  }

  // Direcciones legales del fantasma: las del pasillo, en el orden de preferencia
  // y sin la inversa (giro de 180).
  function legalDirs( ctx ) {
    const { self } = ctx;
    const reverse = OPPOSITE[ self.dir ];
    return DIR_PRIORITY.filter(
      ( dir ) => dir !== reverse && canMove( ctx.grid, self.x, self.y, dir, 'ghost' )
    );
  }

  // Modo asustado: no hay objetivo, se tira los dados entre las legales. Es lo que
  // hace el original y es lo que permite a Pacman cruzarse por delante. Si la
  // unica salida es dar la vuelta, da la vuelta y lo anota en didReverse.
  function chooseFrightenedDirection( ctx ) {
    const { self } = ctx;
    const reverse = OPPOSITE[ self.dir ];
    const legal = legalDirs( ctx );
    if ( !legal.length ) {
      self.didReverse = true;
      return reverse;
    }
    const rng = ctx.rng || Math.random;
    const i = Math.min( legal.length - 1, Math.floor( rng() * legal.length ) );
    return legal[ i ];
  }

  // Direccion legal que mas acerca al objetivo (distancia Manhattan).
  function chooseDirection( ctx ) {
    const { self } = ctx;
    if ( ctx.mode === 'frightened' ) return chooseFrightenedDirection( ctx );

    const target = computeTarget( self.kind, ctx );
    const reverse = OPPOSITE[ self.dir ];

    // Se descarta el giro de 180 salvo que sea la unica salida (callejon).
    const legal = legalDirs( ctx );
    const options = legal.length ? legal : [ reverse ];

    // DIR_PRIORITY fija el orden de las opciones y la comparacion es estricta,
    // asi que en empate gana la primera (arriba, izquierda, abajo, derecha).
    let best = options[ 0 ];
    let bestDist = Infinity;
    for ( const dir of options ) {
      const d = DIRS[ dir ];
      const dist = manhattan( { x: self.x + d.x, y: self.y + d.y }, target );
      if ( dist < bestDist ) {
        bestDist = dist;
        best = dir;
      }
    }
    return best;
  }

  const api = { aheadOf, computeTarget, chooseDirection, insidePen };

  if ( typeof window !== 'undefined' ) window.GHOST_AI = api;
  if ( isNode ) module.exports = api;
})();