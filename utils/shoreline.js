const DIRECTIONS = [
  { name: "south", dx: 1, dy: 0, rot: 90 },
  { name: "north", dx: -1, dy: 0, rot: 270 },
  { name: "east", dx: 0, dy: 1, rot: 0 },
  { name: "west", dx: 0, dy: -1, rot: 180 },
];

const DIAGONALS = [
  { name: "north-east", dx: -1, dy: 1, pair: ["north", "east"] },
  { name: "south-east", dx: 1, dy: 1, pair: ["south", "east"] },
  { name: "south-west", dx: 1, dy: -1, pair: ["south", "west"] },
  { name: "north-west", dx: -1, dy: -1, pair: ["north", "west"] },
];

const DIRECTION_INDEX = DIRECTIONS.reduce((acc, dir, idx) => {
  acc[dir.name] = idx;
  return acc;
}, {});

const DOUBLE_ROTATIONS = {
  "west|north": 0,
  "north|east": 90,
  "east|south": 180,
  "south|west": 270,
};

const defaultShoreColor = "#2c6db0";

const vectorRotation = (dx, dy) => {
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 90 : 270;
  return dy > 0 ? 0 : 180;
};

const adjacentKey = (a, b) => {
  const idxA = DIRECTION_INDEX[a];
  const idxB = DIRECTION_INDEX[b];
  if (idxA === undefined || idxB === undefined) return null;
  const diff = (idxB - idxA + DIRECTIONS.length) % DIRECTIONS.length;
  if (diff === 1) return `${a}|${b}`;
  if (diff === DIRECTIONS.length - 1) return `${b}|${a}`;
  return null;
};

export function ensureShorelineTiles({ rows, cols, voxels, shorelineColor }) {
  if (!rows || !cols || !Array.isArray(voxels)) return;
  const baseLayer = voxels[0] || (voxels[0] = {});

  const color = shorelineColor || defaultShoreColor;

  const landMask = Array.from({ length: rows }, () => Array(cols).fill(0));
  voxels.forEach((layer) => {
    if (!layer) return;
    Object.values(layer).forEach((voxel) => {
      if (!voxel) return;
      if (voxel.shape && voxel.shape !== "shoreline") {
        const lx = voxel.x - 1;
        const ly = voxel.y - 1;
        if (lx >= 0 && lx < rows && ly >= 0 && ly < cols) {
          landMask[lx][ly] = 1;
        }
      }
    });
  });

  const keyFor = (x, y) => `${x}/${y}/${x + 1}/${y + 1}`;

  for (let x = 1; x <= rows; x++) {
    for (let y = 1; y <= cols; y++) {
      if (landMask[x - 1][y - 1] === 1) continue; // land cell
      const key = keyFor(x, y);
      if (baseLayer[key]) continue; // already has shoreline

      let vecDx = 0;
      let vecDy = 0;
      let exposure = 0;
      const diagonalTouches = [];

      DIRECTIONS.forEach((dir) => {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        if (nx < 1 || nx > rows || ny < 1 || ny > cols) return;
        if (landMask[nx - 1][ny - 1] === 1) {
          exposure++;
          vecDx += dir.dx;
          vecDy += dir.dy;
        }
      });

      if (exposure === 0) {
        DIAGONALS.forEach((diag) => {
          const nx = x + diag.dx;
          const ny = y + diag.dy;
          if (nx < 1 || nx > rows || ny < 1 || ny > cols) return;
          if (landMask[nx - 1][ny - 1] === 1) {
            diagonalTouches.push(diag);
          }
        });
        if (diagonalTouches.length === 0) continue;
      }

      let rot = 0;
      if (exposure === 0 && diagonalTouches.length > 0) {
        const { pair } = diagonalTouches[0];
        const rotKey = adjacentKey(pair[0], pair[1]);
        rot = DOUBLE_ROTATIONS[rotKey] ?? 0;
      } else if (vecDx === 0 && vecDy === 0) {
        const primary = DIRECTIONS.find((dir) => {
          const nx = x + dir.dx;
          const ny = y + dir.dy;
          if (nx < 1 || nx > rows || ny < 1 || ny > cols) return false;
          return landMask[nx - 1][ny - 1] === 1;
        });
        rot = primary ? primary.rot : 0;
      } else {
        rot = vectorRotation(vecDx, vecDy);
      }

      baseLayer[key] = {
        x,
        y,
        x2: x + 1,
        y2: y + 1,
        z: 0,
        color,
        shape: "shoreline",
        rot,
      };
    }
  }

  return voxels;
}
