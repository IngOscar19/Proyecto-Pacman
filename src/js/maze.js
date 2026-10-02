// maze.js
// Laberinto 28x31 fiel a la geometria del nivel 1 de Pac-Man.
// Se escribe como 31 strings de 28 chars (legible) y se parsea a numeros.
//   '#' pared(1) · '.' dot(2) · ' ' vacio transitable(0) · '-' puerta pen(3)
// Coordenadas: celda (x,y), origen arriba-izquierda. x in [0,27], y in [0,30].
// Simetrico respecto al eje vertical central (entre cols 13 y 14).

const MAZE_STR = [
  '############################', // 0  borde
  '#............##............#', // 1
  '#.####.#####.##.#####.####.#', // 2
  '#.####.#####.##.#####.####.#', // 3
  '#.####.#####.##.#####.####.#', // 4
  '#..........................#', // 5
  '#.####.##.########.##.####.#', // 6
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
  '#......##....##....##......#', // 26
  '#.##########.##.##########.#', // 27
  '#.##########.##.##########.#', // 28
  '#..........................#', // 29
  '############################', // 30  borde
];

function parseTile( ch ) {
  if ( ch === '#' ) return 1;
  if ( ch === '.' ) return 2;
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

// Posicion inicial de cada fantasma. releaseAtDots = cuantos dots deben
// haberse comido para que salga del pen.
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'blinky', releaseAtDots: 0 },
  { x: 14, y: 14, kind: 'pinky', releaseAtDots: 30 },
  { x: 15, y: 14, kind: 'inky', releaseAtDots: 60 },
  { x: 12, y: 14, kind: 'clyde', releaseAtDots: 90 },
];

// Esquinas de dispersion. En este spec solo clyde consulta la suya.
const CORNERS = {
  blinky: { x: 25, y: 0 },
  pinky: { x: 2, y: 0 },
  inky: { x: 27, y: 35 },
  clyde: { x: 0, y: 35 },
};

const api = { MAZE, TUNNEL_ROW, PACMAN_START, PEN, PEN_DOORS, GHOST_STARTS, CORNERS };

// Dual export: cada clave queda como global en el navegador y en module.exports
// para que node --test pueda require('./maze.js').
if ( typeof window !== 'undefined' ) for ( const k in api ) window[ k ] = api[ k ];
if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
  module.exports = api;
}
