// Level definitions. The layouts live in maps.js (verbatim from 2011); this file explains what
// each character means in each level and which family assets it uses.
//
// Entity types:
//   treat  – collectible, adds score
//   music  – collectible that also toggles the drum track in the music (as in the original)
//   enemy  – walks (or flies) and catches Lola; stomping it from above defeats it
//   goal   – the family member waiting at the end of the level
//
// Speeds are in pixels per second (the original used pixels per millisecond: 0.05 -> 50).

const IMG = 'assets/img/';

function frames(base, indexes, ms) {
  const times = Array.isArray(ms) ? ms : indexes.map(() => ms);
  return indexes.map((i, k) => [`${IMG}${base}${i}.png`, times[k]]);
}

function tileset(dir, chars) {
  const map = {};
  [...chars].forEach((ch, i) => { map[ch] = `${IMG}${dir}/tile_${String.fromCharCode(65 + i)}.png`; });
  return map;
}

const treat = (name, fr, score, box) => ({ type: 'treat', name, frames: fr, score, box: box || { ox: 8, oy: 8, w: 67, h: 67 } });
const music = (name, fr, score) => ({ type: 'music', name, frames: fr, score, box: { ox: 8, oy: 8, w: 67, h: 67 } });
const enemy = (name, fr, opts) => Object.assign({ type: 'enemy', name, frames: fr, speed: 50, flying: false, turnAtEdges: false }, opts);
const goal = (name, fr, box) => ({ type: 'goal', name, frames: fr, box });

const LEVELS = [
  {
    id: 'home',
    name: { en: 'Home Sweet Home', pt: 'Lar Doce Lar' },
    subtitle: { en: 'Treats are hidden all over the kitchen', pt: 'Tem petisco escondido pela cozinha toda' },
    found: 'foundHome',
    bgColor: '#d9d3c7',
    background: IMG + 'home/bg.png',
    foreground: null,
    tiles: tileset('home', 'ABCDEFGHI'),
    rows: MAPS.home,
    spawn: { col: 3 },
    legend: {
      'o': treat('bone', frames('home/bone', [1, 2], 100), 100),
      '!': music('bonbon', frames('home/bonbon', [1, 2], 150), 250),
      '1': enemy('walker', frames('home/walker', [1, 2, 3], 250), { speed: 50, box: { ox: 26, oy: 10, w: 91, h: 184 } }),
      '2': enemy('shampoo', frames('home/shampoo', [1, 2, 3, 2], 50), { speed: 200, flying: true, box: { ox: 4, oy: 4, w: 60, h: 82 } }),
      '-': goal('goal', frames('home/goal', [1, 2, 3, 2], 150), { ox: 10, oy: 70, w: 88, h: 111 }),
    },
    final: frames('home/final', [1, 2, 3, 2], 450),
  },
  {
    id: 'praca',
    name: { en: 'A Day at the Praça', pt: 'Um Dia na Praça' },
    subtitle: { en: 'Watch out for the other pets', pt: 'Cuidado com os outros bichos' },
    found: 'foundPraca',
    bgColor: '#33d6f5',
    background: IMG + 'praca/bg.png',
    foreground: IMG + 'praca/fg.png',
    tiles: tileset('praca', 'JKLMNOPQR'),
    rows: MAPS.praca,
    spawn: { col: 3 },
    // The cat sprite existed in the 2011 assets but was never placed on the map; it patrols two platforms here.
    extras: [{ ch: '(', col: 22, row: 5 }, { ch: '(', col: 44, row: 6 }],
    legend: {
      'o': treat('bone', frames('home/bone', [1, 2], 100), 100),
      '!': music('bonbon', frames('home/bonbon', [1, 2], 150), 250),
      '@': treat('poop', frames('praca/poop', [1, 2, 3], 100), 50, { ox: 12, oy: 20, w: 59, h: 55 }),
      '$': enemy('dog', frames('praca/dog', [1, 2, 3], [150, 250, 100]), { speed: 100, box: { ox: 14, oy: 34, w: 123, h: 140 } }),
      '(': enemy('cat', frames('praca/cat', [1, 2, 3, 1, 2], [150, 250, 100, 500, 500]), { speed: 50, turnAtEdges: true, box: { ox: 18, oy: 16, w: 162, h: 112 } }),
      '2': enemy('shampoo', frames('home/shampoo', [1, 2, 3, 2], 50), { speed: 200, flying: true, box: { ox: 4, oy: 4, w: 60, h: 82 } }),
      '*': goal('goal', frames('praca/goal', [1, 2, 3], [100, 250, 250]), { ox: 8, oy: 8, w: 69, h: 224 }),
    },
    final: frames('praca/final', [1, 2, 3, 2], 450),
  },
  {
    id: 'titia',
    name: { en: "Rafaela's bedroom", pt: 'Quarto da Rafaela' },
    subtitle: { en: 'Sweets, sweets everywhere', pt: 'Doce, doce por todo lado' },
    found: 'foundTitia',
    bgColor: '#f7b3d0',
    background: IMG + 'titia/bg.png',
    foreground: IMG + 'titia/fg.png',
    // W and X are deliberately out of alphabetical order. The 2011 game drew tiles from a
    // flat images/Ltile_<char>.png set, and when the Rafaela art was copied into it the E/F
    // pair was swapped: Rtile_E became Ltile_X and Rtile_F became Ltile_W. So the map's W is
    // the top-right corner (tile_F) and its X is the top-left one (tile_E).
    tiles: tileset('titia', 'STUVXWYZ['),
    rows: MAPS.titia,
    spawn: { col: 3 },
    legend: {
      '.': music('heartchoc', frames('titia/heartchoc', [1, 2, 1, 2], [100, 250, 150, 350]), 250),
      ',': treat('donut', frames('titia/donut', [1, 2], [100, 250]), 100),
      '<': treat('muffin', frames('titia/muffin', [1, 2], [100, 250]), 100),
      '>': treat('lollipop', frames('titia/lollipop', [1, 2], [100, 250]), 100),
      '^': goal('goal', frames('titia/goal', [1, 2, 3], [100, 250, 250]), { ox: 12, oy: 10, w: 104, h: 232 }),
    },
    final: frames('titia/final', [1, 2], 500),
  },
];

// Lola herself: three photos, used for running, idling (the original's little "breathing" loop) and jumping.
const PLAYER = {
  run: frames('lola/run', [1, 2, 1, 2, 3, 2], [100, 150, 150, 150, 150, 150]),
  idle: frames('lola/run', [2, 3, 2, 3, 2, 3], [650, 150, 450, 200, 950, 100]),
  jump: frames('lola/run', [1], 100),
  box: { ox: 16, oy: 14, w: 104, h: 95 },
};

const UI_IMAGES = [
  IMG + 'ui/splash-title.png',
  IMG + 'ui/splash-loading.png',
  IMG + 'ui/splash-end.png',
];
