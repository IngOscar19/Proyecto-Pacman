// maze.js
// Laberinto 28x31 fiel a la geometria del nivel 1 de Pac-Man.
// Se escribe como 31 strings de 28 chars (legible) y se parsea a numeros.
//   '#' pared(1) · '.' dot(2) · 'o' power pellet(4) · ' ' vacio transitable(0) · '-' puerta pen(3)
// Coordenadas: celda (x,y), origen arriba-izquierda. x in [0,27], y in [0,30].
// Simetrico respecto al eje vertical central (entre cols 13 y 14).

(function () {
  const MAZE_STR = [
    '############################', // 0  borde
    '#............##............#', // 1
    '#.####.#####.##.#####.####.#', // 2
    '#.####.#####.##.#####.####.#', // 3
    '#.####.#####.##.#####.####.#', // 4
    '#..........................#', // 5
    '#o####.##.########.##.####o#', // 6  power pellets en (1,6) y (26,6)
    '#.####.##.########.##.####.#', // 7
    '#......##....##....##......#', // 8
    '######.#####.##.#####.######', // 9
    '######.#####.##.#####.######', // 10
    '######.##..........##.######', // 11
    '######.##.###--###.##.######', // 12  puerta pen cols 13-14
    '######.##.#      #.##.######', // 13  interior pen
    '          #      #          ', // 14  tunel (extremos abiertos) + pen
    '######.##.#      #.##.######', // 15  interior pen
    '######.##.########.##.######', // 16  fondo pen
    '######.##..........##.######', // 17
    '######.#####.##.#####.######', // 18
    '######.#####.##.#####.######', // 19
    '#............##............#', // 20
    '#.####.#####.##.#####.####.#', // 21
    '#.####.#####.##.#####.####.#', // 22
    '#...##................##...#', // 23  fila inicio Pacman (13,23)
    '###.##.##.########.##.##.###', // 24
    '###.##.##.########.##.##.###', // 25
    '#o.....##....##....##.....o#', // 26  power pellets en (1,26) y (26,26)
    '#.##########.##.##########.#', // 27
    '#.##########.##.##########.#', // 28
    '#..........................#', // 29
    '############################', // 30  borde
  ];

  function parseTile( ch ) {
    if ( ch === '#' ) return 1;
    if ( ch === '.' ) return 2;
    if ( ch === 'o' ) return 4;
    if ( ch === '-' ) return 3;
    return 0; // espacio = vacio transitable
  }

  // Matriz numerica pristina (no se muta; cada partida copia esto).
  const MAZE = MAZE_STR.map( ( row ) => row.split( '' ).map( parseTile ) );

  const TUNNEL_ROW = 14;
  const PACMAN_START = { x: 13, y: 23 };

  // Pen: interior transitable donde los fantasmas esperan su turno. La unica
  // salida son las dos celdas de puerta (3) de la fila 12.
  const PEN = { x0: 11, y0: 13, x1: 16, y1: 15 };
  const PEN_DOORS = [
    { x: 13, y: 12 },
    { x: 14, y: 12 },
  ];

// Frames por segundo que asume el bucle. El juego avanza en celdas/frame, asi
// que la temporizacion del pen tambien se cuenta en frames.
const FPS = 60;
// Un fantasma sale del pen cada 2 segundos: el primero al instante, el
// siguiente 2s despues, y asi sucesivamente (0s / 2s / 4s / 6s).
const RELEASE_FRAMES = 2 * FPS;

// Posicion inicial de cada fantasma y en que frame sale del pen.
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'blinky', releaseAtFrame: 0 },
  { x: 14, y: 14, kind: 'pinky', releaseAtFrame: RELEASE_FRAMES },
  { x: 15, y: 14, kind: 'inky', releaseAtFrame: 2 * RELEASE_FRAMES },
  { x: 12, y: 14, kind: 'clyde', releaseAtFrame: 3 * RELEASE_FRAMES },
];

  // Esquinas de dispersion. En este spec solo clyde consulta la suya.
  const CORNERS = {
    blinky: { x: 25, y: 0 },
    pinky: { x: 2, y: 0 },
    inky: { x: 27, y: 35 },
    clyde: { x: 0, y: 35 },
  };

  // Power pellets: los cuatro puntos de poder en las esquinas del recorrido
  // exterior. Son las unicas celdas de tipo 4 del laberinto, asi que la lista no
  // puede desincronizarse de la matriz.
  const POWER_PELLETS = [
    { x: 1, y: 6 },
    { x: 26, y: 6 },
    { x: 1, y: 26 },
    { x: 26, y: 26 },
  ];

  // Cuanto dura el modo asustado tras comer una pellet, y cuanto parpadean en
  // blanco los fantasmas al final (el aviso de que se acaba).
  const FRIGHT_FRAMES = 6 * FPS;
  const FRIGHT_FLASH_FRAMES = 2 * FPS;

  // Puntos del 1er, 2º, 3er y 4º fantasma comido en la misma fase. El quinto y
  // siguientes siguen en el ultimo valor.
  const FRIGHT_CHAIN = [ 200, 400, 800, 1600 ];

  const api = { MAZE, TUNNEL_ROW, PACMAN_START, PEN, PEN_DOORS, GHOST_STARTS, CORNERS, POWER_PELLETS, FRIGHT_FRAMES, FRIGHT_FLASH_FRAMES, FRIGHT_CHAIN, FPS, RELEASE_FRAMES };

  if ( typeof window !== 'undefined' ) {
    for ( const k in api ) window[ k ] = api[ k ];
    window.MAZE_DATA = api;
  }
  if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
    module.exports = api;
  }
})();
