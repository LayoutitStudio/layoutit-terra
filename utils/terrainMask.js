const DIAGONAL_INFO = {
  ne: { dx: -1, dy: 1, sides: ["north", "east"], wedgeRot: 270, spikeRot: 0 },
  se: { dx: 1, dy: 1, sides: ["south", "east"], wedgeRot: 0, spikeRot: 90 },
  sw: { dx: 1, dy: -1, sides: ["south", "west"], wedgeRot: 90, spikeRot: 180 },
  nw: {
    dx: -1,
    dy: -1,
    sides: ["north", "west"],
    wedgeRot: 180,
    spikeRot: 270,
  },
};

const CARDINAL_LOOKUP = {
  0b0000: { kind: "interior" },
  0b0001: { kind: "single", rot: 270 },
  0b0010: { kind: "single", rot: 0 },
  0b0100: { kind: "single", rot: 90 },
  0b1000: { kind: "single", rot: 180 },
  0b0011: { kind: "adjacent", diag: "ne" },
  0b0110: { kind: "adjacent", diag: "se" },
  0b1100: { kind: "adjacent", diag: "sw" },
  0b1001: { kind: "adjacent", diag: "nw" },
  0b0101: { kind: "opposite", options: ["south", "north"] },
  0b1010: { kind: "opposite", options: ["east", "west"] },
  0b0111: { kind: "three" },
  0b1011: { kind: "three" },
  0b1101: { kind: "three" },
  0b1110: { kind: "three" },
  0b1111: { kind: "all" },
};

const PREFER_ROTATION = { north: 270, east: 0, south: 90, west: 180 };
const DIAGONAL_ORDER = ["ne", "se", "sw", "nw"];
const SLOPE_SHAPES = new Set(["ramp", "wedge", "spike"]);
const DISALLOWED_SLOPE_SUPPORTS = new Set(["ramp", "wedge", "spike", "cliff"]);

export const vectorRotation = (dx, dy) =>
  Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 90 : 270) : dy > 0 ? 0 : 180;

export const inTerrainBounds = (x, y, rows, cols) =>
  x >= 1 && x <= rows && y >= 1 && y <= cols;

export const maskHasFilledCell = (mask) =>
  mask.some((row) => row.some((value) => value === 1));

export const buildMaskForLevel = (heights, level) =>
  heights.map((row) => row.map((value) => (value >= level ? 1 : 0)));

const exposures = (mask, x, y, rows, cols) => {
  const water = { north: 0, south: 0, east: 0, west: 0 };
  const get = (nx, ny) =>
    inTerrainBounds(nx, ny, rows, cols) ? mask[nx - 1][ny - 1] : 0;
  water.north = get(x - 1, y) === 0 ? 1 : 0;
  water.south = get(x + 1, y) === 0 ? 1 : 0;
  water.east = get(x, y + 1) === 0 ? 1 : 0;
  water.west = get(x, y - 1) === 0 ? 1 : 0;
  return water;
};

const diagWater = (mask, x, y, dx, dy, rows, cols) => {
  const nx = x + dx;
  const ny = y + dy;
  return !inTerrainBounds(nx, ny, rows, cols) || mask[nx - 1][ny - 1] === 0;
};

export const classifyTerrainMask = (mask) => {
  const rows = mask.length;
  const cols = rows ? mask[0].length : 0;
  const shape = Array.from({ length: rows }, () => Array(cols).fill("flat"));
  const rot = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let x = 1; x <= rows; x += 1) {
    for (let y = 1; y <= cols; y += 1) {
      if (mask[x - 1][y - 1] !== 1) continue;

      const water = exposures(mask, x, y, rows, cols);
      const cardMask =
        (water.north << 0) |
        (water.east << 1) |
        (water.south << 2) |
        (water.west << 3);
      const entry = CARDINAL_LOOKUP[cardMask] || CARDINAL_LOOKUP[0];

      const diagState = {
        ne: diagWater(
          mask,
          x,
          y,
          DIAGONAL_INFO.ne.dx,
          DIAGONAL_INFO.ne.dy,
          rows,
          cols
        ),
        se: diagWater(
          mask,
          x,
          y,
          DIAGONAL_INFO.se.dx,
          DIAGONAL_INFO.se.dy,
          rows,
          cols
        ),
        sw: diagWater(
          mask,
          x,
          y,
          DIAGONAL_INFO.sw.dx,
          DIAGONAL_INFO.sw.dy,
          rows,
          cols
        ),
        nw: diagWater(
          mask,
          x,
          y,
          DIAGONAL_INFO.nw.dx,
          DIAGONAL_INFO.nw.dy,
          rows,
          cols
        ),
      };

      const vdx = (water.south ? 1 : 0) - (water.north ? 1 : 0);
      const vdy = (water.east ? 1 : 0) - (water.west ? 1 : 0);

      let tileShape = "flat";
      let tileRot = 0;

      switch (entry.kind) {
        case "interior": {
          let wedgePlaced = false;
          for (const key of DIAGONAL_ORDER) {
            if (!diagState[key]) continue;
            const diag = DIAGONAL_INFO[key];
            const [sideA, sideB] = diag.sides;
            if (water[sideA] || water[sideB]) continue;
            tileShape = "wedge";
            tileRot = diag.wedgeRot;
            wedgePlaced = true;
            break;
          }
          if (!wedgePlaced) {
            tileShape = "flat";
            tileRot = 0;
          }
          break;
        }
        case "single":
          tileShape = "ramp";
          tileRot = entry.rot;
          break;
        case "adjacent": {
          const diag = DIAGONAL_INFO[entry.diag];
          if (diagState[entry.diag]) {
            tileShape = "spike";
            tileRot = diag.spikeRot;
          } else {
            tileShape = "ramp";
            tileRot = vectorRotation(vdx, vdy);
          }
          break;
        }
        case "opposite": {
          const options = entry.options || [];
          const dirName =
            options.find((name) => water[name]) || options[0] || "south";
          tileShape = "ramp";
          tileRot = PREFER_ROTATION[dirName] ?? 90;
          break;
        }
        case "three":
          tileShape = "spike";
          tileRot = vdx === 0 && vdy === 0 ? 0 : vectorRotation(vdx, vdy);
          break;
        case "all":
          tileShape = "spike";
          tileRot = 0;
          break;
        default:
          tileShape = "flat";
          tileRot = 0;
          break;
      }

      shape[x - 1][y - 1] = tileShape;
      rot[x - 1][y - 1] = tileRot;
    }
  }

  return { shape, rot };
};

export const cleanupStackedSlopes = (voxels, rows, cols, options = {}) => {
  if (!Array.isArray(voxels)) return;
  const rawEdgeBuffer = Number(options.edgeBuffer);
  const maxEdgeBuffer = Math.floor(Math.min(rows || 0, cols || 0) / 2);
  const edgeBuffer = Math.max(
    0,
    Math.min(
      Number.isFinite(rawEdgeBuffer) ? Math.floor(rawEdgeBuffer) : 3,
      maxEdgeBuffer
    )
  );

  for (let layer = 1; layer < voxels.length; layer += 1) {
    const current = voxels[layer];
    const below = voxels[layer - 1];
    if (!current || !below) continue;

    for (const key of Object.keys(current)) {
      const voxel = current[key];
      if (!voxel || !SLOPE_SHAPES.has(voxel.shape)) continue;

      const support = below[key];
      if (!support) continue;

      const supportShape = support.shape || null;
      if (!supportShape || supportShape === "flat") continue;
      if (!DISALLOWED_SLOPE_SUPPORTS.has(supportShape)) continue;

      const parts = key.split("/");
      const x = Number(parts[0]);
      const y = Number(parts[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (
        edgeBuffer > 0 &&
        (x <= edgeBuffer ||
          y <= edgeBuffer ||
          (rows && x > rows - edgeBuffer) ||
          (cols && y > cols - edgeBuffer))
      ) {
        continue;
      }

      const replacedShape = voxel.shape || null;
      const supportVariant = support.cliffVariant ?? supportShape ?? replacedShape;
      const supportBaseShape =
        support.cliffBaseShape ??
        (supportShape === "cliff" ? supportVariant : supportShape);

      current[key] = {
        ...voxel,
        shape: "cliff",
        rot: Number.isFinite(support.rot) ? support.rot : (voxel.rot ?? 0),
        color: support.color ?? voxel.color,
        cliffVariant: supportVariant || replacedShape,
        cliffBaseShape: supportBaseShape || null,
        cliffReplacedShape: replacedShape,
      };
    }
  }
};
