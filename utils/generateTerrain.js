import { makeNoise2D } from "fast-simplex-noise";
import {
  buildMaskForLevel,
  classifyTerrainMask,
  cleanupStackedSlopes,
  maskHasFilledCell,
  vectorRotation,
} from "./terrainMask";

function pseudoRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return function () {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

const clamp = (value, min = 0, max = 1) => (value < min ? min : (value > max ? max : value));

export default function generateTerrain(ctx) {
  if (!ctx) return;

  // --- basics ---
  const rows = ctx.rows || 16;
  const cols = ctx.cols || 16;
  const maxLayers = ctx.voxels?.length || 12;
  const colors = ctx.colors || ["#63c74d", "#b86f50", "#0088d4"];
  const shorelineColor = ctx.shorelineColor || "#2c6db0";
  const totalLevels = Math.min(ctx.totalLevels ?? 9, maxLayers);

  // --- mountainousness knob (0..1) ---
  const mountainousness = Math.max(0, Math.min(1, ctx.mountain ?? ctx.mountainousness ?? 0.5));

  // --- randomness knobs ---
  const seed = (ctx.seed ?? Date.now()) >>> 0;
  const rnd = pseudoRandom(seed);
  const islandPresets = {
    small: { radius: 0.24, falloffBias: 0.22, waterShift: 0.12 },
    medium: { radius: 0.54, falloffBias: 0.02, waterShift: 0.02 },
    large: { radius: 0.72, falloffBias: -0.06, waterShift: -0.08 },
  };
  const radiusBounds = { min: 0.18, max: 0.92 };
  const sliderKey = ctx.islandSize;
  const preset = typeof sliderKey === "string" ? islandPresets[sliderKey] ?? null : null;
  const explicitRadius = Number(ctx.radiusFactor);
  const randomRadius = 0.28 + rnd() * 0.32;
  const radiusSource = Number.isFinite(explicitRadius)
    ? explicitRadius
    : (preset?.radius ?? randomRadius);
  const radiusFactor = clamp(radiusSource, radiusBounds.min, radiusBounds.max);
  const islandScale = clamp((radiusFactor - radiusBounds.min) / Math.max(1e-5, radiusBounds.max - radiusBounds.min), 0, 1);
  const presetFalloffBias = preset?.falloffBias ?? (0.35 - islandScale) * 0.5;
  const waterShift = preset?.waterShift ?? (0.3 - islandScale) * 0.22;
  const terrainSoftness = clamp(
    ctx.terrainSoftness ?? ((1 - mountainousness) * 0.7 + (1 - islandScale) * 0.35),
    0,
    1,
  );
  const explicitWaterMargin = Number(ctx.waterMargin);
  const centerJitter = ctx.centerJitter ?? Math.min(rows, cols) * 0.05;
  const waterMargin = Math.max(1, Math.min(4, Number.isFinite(explicitWaterMargin)
    ? explicitWaterMargin
    : Math.round(0.8 + terrainSoftness * 1.8 + (1 - islandScale) * 1.4)));
  const falloffExponent = clamp(
    ctx.falloffExponent ?? (0.88 + mountainousness * 0.6 + presetFalloffBias),
    0.55,
    1.65,
  );
  const waterLevel = clamp(
    ctx.waterLevel ?? (0.28 + (1 - mountainousness) * 0.14 + waterShift),
    0.04,
    0.72,
  );
  const falloffPower = clamp(1.05 + presetFalloffBias * 0.9, 0.65, 1.75);
  const shoreEdgeDamp = clamp(0.55 + islandScale * 0.35, 0.55, 0.92);
  const normScale = 1 / Math.max(rows, cols);
  const baseFrequency = ctx.baseFrequency ?? ((ctx.noiseScale ? 1 / Math.max(0.0001, ctx.noiseScale) : 1) * 1.35 * normScale);
  const detailFrequency = ctx.detailFrequency ?? baseFrequency * 2.7;
  const ridgeFrequency = ctx.ridgeFrequency ?? baseFrequency * 0.75;
  const warpFrequency = ctx.warpFrequency ?? baseFrequency * 0.9;
  const warpBase = ctx.warpStrength ?? ctx.warpAmp ?? (Math.min(rows, cols) * (0.035 + mountainousness * 0.05));
  const warpStrength = warpBase * (0.82 + (1 - mountainousness) * 0.18 + terrainSoftness * 0.22);
  const plateauBase = ctx.plateauStrength ?? (0.18 + mountainousness * 5);
  const plateauStrength = clamp(plateauBase + (0.5 - terrainSoftness) * 0.18, 0, 1);
  const ridgeStrengthBase = 0.12 + mountainousness * 0.12;
  const mountainHeightGain = 1 + mountainousness * 0.35;
  const mountainHeightBias = mountainousness * 0.045;
  const rawEdgeFadeRatio = Number(ctx.edgeFadeRatio);
  const edgeFadeRatio = clamp(Number.isFinite(rawEdgeFadeRatio) ? rawEdgeFadeRatio : 0, 0, 0.45);
  const edgeFadeFloor = clamp(ctx.edgeFadeFloor ?? 0.25, 0, 0.7);
  const edgeFadeSpan = edgeFadeRatio > 0 ? Math.max(1, Math.round(Math.min(rows, cols) * edgeFadeRatio)) : 0;

  // --- helpers ---
  const inBounds = (x, y) => x >= 1 && x <= rows && y >= 1 && y <= cols;

  const octaveNoise = (offset, { octaves = 1, persistence = 0.5, lacunarity = 2 }) => {
    const randomFn = pseudoRandom((seed + offset) >>> 0);
    const simplex = makeNoise2D(randomFn);
    return (x, y, baseFrequency = 1) => {
      let amplitude = 1;
      let frequency = baseFrequency;
      let sum = 0;
      let weight = 0;
      for (let octave = 0; octave < octaves; octave++) {
        sum += simplex(x * frequency, y * frequency) * amplitude;
        weight += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
      }
      return weight > 0 ? sum / weight : 0;
    };
  };

  const largeNoise = octaveNoise(0x9e3779b9, { octaves: 4, persistence: 0.55, lacunarity: 2.05 });
  const detailNoise = octaveNoise(0x7f4a7c15, { octaves: 3, persistence: 0.6, lacunarity: 2.4 });
  const ridgeNoise = octaveNoise(0xd1b54a32, { octaves: 5, persistence: 0.52, lacunarity: 2.0 });
  const warpNoise = octaveNoise(0x94d049bb, { octaves: 2, persistence: 0.5, lacunarity: 2.15 });
  const sampleNoise = (noiseFn, freq, x, y) => noiseFn(x, y, freq);

  // --- world base ---
  const newVoxels = Array.from({ length: maxLayers }, () => ({}));
  const maxEdgeBuffer = Math.floor(Math.min(rows, cols) / 2);
  const rawEdgeBuffer = Number(ctx.cliffEdgeBuffer);
  const cliffEdgeBuffer = Math.max(
    0,
    Math.min(Number.isFinite(rawEdgeBuffer) ? Math.floor(rawEdgeBuffer) : 3, maxEdgeBuffer),
  );
  const baseCenterX = (rows + 1) / 2 + (rnd() * 2 - 1) * centerJitter;
  const baseCenterY = (cols + 1) / 2 + (rnd() * 2 - 1) * centerJitter;
  ctx.radiusFactor = radiusFactor;
  ctx.terrainSoftness = terrainSoftness;
  const islandCountKey = typeof ctx.islandCount === "string" ? ctx.islandCount : "one";
  const centerCount = islandCountKey === "two" ? 2 : islandCountKey === "many" ? 4 : 1;
  ctx.islandCount = islandCountKey;

  const islandRadius = Math.min(rows, cols) * radiusFactor;

  const ellipseAngle = ctx.ellipseAngle ?? rnd() * Math.PI * 2;
  const axisX = ctx.axisX ?? (0.75 + rnd() * 0.5);
  const axisY = ctx.axisY ?? (0.75 + rnd() * 0.5);
  const cosT = Math.cos(ellipseAngle);
  const sinT = Math.sin(ellipseAngle);
  const lobeA = ctx.lobeA ?? (0.12 + rnd() * 0.22);
  const lobeB = ctx.lobeB ?? (0.05 + rnd() * 0.15);
  const lobeCountA = ctx.lobeCountA ?? (2 + Math.floor(rnd() * 3));
  const lobeCountB = ctx.lobeCountB ?? (1 + Math.floor(rnd() * 4));
  const lobePhaseA = ctx.lobePhaseA ?? rnd() * Math.PI * 2;
  const lobePhaseB = ctx.lobePhaseB ?? rnd() * Math.PI * 2;

  const clampCoord = (value, min, max) => (value < min ? min : (value > max ? max : value));
  const createCenter = (cx, cy, axisScale = 1, radiusScale = 1, phaseOffset = 0) => ({
    cx: clampCoord(cx, 1, rows),
    cy: clampCoord(cy, 1, cols),
    axisX: Math.max(0.3, axisX * axisScale),
    axisY: Math.max(0.3, axisY * axisScale),
    cosT,
    sinT,
    lobePhaseA: lobePhaseA + phaseOffset,
    lobePhaseB: lobePhaseB + phaseOffset * 0.6,
    radius: Math.max(0.2, islandRadius * radiusScale),
  });

  const islandCenters = [];
  const baseAxisScale = centerCount === 1 ? 1 : centerCount === 2 ? 0.9 : 0.78;
  const baseRadiusScale = centerCount === 1 ? 1 : centerCount === 2 ? 0.85 : 0.7;
  islandCenters.push(createCenter(baseCenterX, baseCenterY, baseAxisScale, baseRadiusScale, 0));

  if (centerCount > 1) {
    const angleStep = (Math.PI * 2) / centerCount;
    const angleOffset = rnd() * Math.PI * 2;
    const minDistance = Math.min(rows, cols) * 0.18;
    const maxDistance = Math.min(rows, cols) * (centerCount === 2 ? 0.45 : 0.38);
    const baseDistance = clamp(islandRadius * (centerCount === 2 ? 1.7 : 1.4), minDistance, maxDistance);

    for (let idx = 1; idx < centerCount; idx++) {
      const angle = angleOffset + angleStep * idx;
      const distance = clamp(baseDistance * (0.9 + rnd() * 0.2), minDistance, maxDistance);
      const cx = baseCenterX + Math.cos(angle) * distance;
      const cy = baseCenterY + Math.sin(angle) * distance;
      const axisScale = centerCount === 2 ? 0.8 + rnd() * 0.12 : 0.68 + rnd() * 0.18;
      const radiusScale = centerCount === 2 ? 0.75 + rnd() * 0.1 : 0.55 + rnd() * 0.12;
      const phaseOffset = rnd() * Math.PI * 2;
      islandCenters.push(createCenter(cx, cy, axisScale, radiusScale, phaseOffset));
    }
  }

  const heightField = Array.from({ length: rows }, () => Array(cols).fill(0));
  const falloffMask = Array.from({ length: rows }, () => Array(cols).fill(0));
  const heightLevels = Array.from({ length: rows }, () => Array(cols).fill(-1));
  let maxHeightSample = -Infinity;

  for (let ix = 0; ix < rows; ix++) for (let iy = 0; iy < cols; iy++) {
    const x = ix + 1;
    const y = iy + 1;

    let falloff = 0;
    for (const center of islandCenters) {
      const dx0 = x - center.cx;
      const dy0 = y - center.cy;
      const rx = (center.cosT * dx0 - center.sinT * dy0) / center.axisX;
      const ry = (center.sinT * dx0 + center.cosT * dy0) / center.axisY;
      const theta = Math.atan2(ry, rx);
      const radial = Math.hypot(rx, ry);
      const radialMod = 1 + lobeA * Math.cos(lobeCountA * theta + center.lobePhaseA) + lobeB * Math.cos(lobeCountB * theta + center.lobePhaseB);
      const targetRadius = Math.max(0.001, center.radius * radialMod);
      const normalizedRadius = radial / targetRadius;
      const localFalloff = clamp(1 - Math.pow(normalizedRadius, falloffExponent), 0, 1);
      if (localFalloff > falloff) falloff = localFalloff;
    }

    const warpX = sampleNoise(warpNoise, warpFrequency, x, y);
    const warpY = sampleNoise(warpNoise, warpFrequency, x + 913, y - 913);
    const warpedX = x + warpX * warpStrength;
    const warpedY = y + warpY * warpStrength;

    const baseN = sampleNoise(largeNoise, baseFrequency, warpedX, warpedY);
    const detailN = sampleNoise(detailNoise, detailFrequency, warpedX, warpedY);
    const ridgeRaw = sampleNoise(ridgeNoise, ridgeFrequency, warpedX, warpedY);
    const ridge = 1 - Math.abs(ridgeRaw);

    const blended = (baseN * 0.6) + (detailN * 0.3) + ((ridge - 0.5) * (0.35 * mountainousness));
    const baseHeight = clamp((blended * 0.5 + 0.5) * falloff, 0, 1);
    const ridgeAttenuation = clamp(0.45 + (1 - mountainousness) * 0.28 + terrainSoftness * 0.25, 0.35, 1.2);
    let combinedEdgeFactor = 1;
    let finalFalloff = falloff;
    if (edgeFadeSpan > 0) {
      const edgeDistance = Math.min(x - 1, rows - x, y - 1, cols - y);
      const edgeNorm = clamp(edgeDistance / edgeFadeSpan, 0, 1);
      const edgeFactor = edgeNorm * edgeNorm * (3 - 2 * edgeNorm); // smoothstep
      combinedEdgeFactor = edgeFadeFloor + (1 - edgeFadeFloor) * edgeFactor;
      finalFalloff = Math.min(falloff, combinedEdgeFactor);
    }
    let ridgeBoost = ridge * ridgeStrengthBase * mountainousness * finalFalloff * ridgeAttenuation * combinedEdgeFactor;
    const heightCurve = clamp(1.1 - mountainousness * 0.4, 0.55, 1.35);

    let height = clamp(baseHeight + ridgeBoost, 0, 1);
    height = Math.pow(height, heightCurve);
    height = clamp(height + plateauStrength * Math.max(0, height - 0.6), 0, 1);
    height = clamp(height * mountainHeightGain + mountainHeightBias * finalFalloff, 0, 1);
    if (combinedEdgeFactor !== 1) height *= combinedEdgeFactor;

    heightField[ix][iy] = height;
    falloffMask[ix][iy] = finalFalloff;
    if (height > maxHeightSample) maxHeightSample = height;
  }

  const smoothHeightField = (field, iterations, blend, diagWeight = 0.5) => {
    if (!field.length || !iterations || blend <= 0) return;
    const rLen = field.length;
    const cLen = field[0].length;
    const scratch = Array.from({ length: rLen }, () => Array(cLen).fill(0));
    let source = field;
    let target = scratch;

    const lerp = (a, b, t) => a + (b - a) * t;

    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < rLen; i++) {
        for (let j = 0; j < cLen; j++) {
          let sum = source[i][j];
          let weight = 1;

          if (i > 0) { sum += source[i - 1][j]; weight += 1; }
          if (i < rLen - 1) { sum += source[i + 1][j]; weight += 1; }
          if (j > 0) { sum += source[i][j - 1]; weight += 1; }
          if (j < cLen - 1) { sum += source[i][j + 1]; weight += 1; }

          if (diagWeight > 0) {
            const dW = diagWeight;
            if (i > 0 && j > 0) { sum += source[i - 1][j - 1] * dW; weight += dW; }
            if (i > 0 && j < cLen - 1) { sum += source[i - 1][j + 1] * dW; weight += dW; }
            if (i < rLen - 1 && j > 0) { sum += source[i + 1][j - 1] * dW; weight += dW; }
            if (i < rLen - 1 && j < cLen - 1) { sum += source[i + 1][j + 1] * dW; weight += dW; }
          }

          const average = sum / weight;
          target[i][j] = lerp(source[i][j], average, blend);
        }
      }
      [source, target] = [target, source];
    }

    if (source !== field) {
      for (let i = 0; i < rLen; i++) {
        for (let j = 0; j < cLen; j++) {
          field[i][j] = source[i][j];
        }
      }
    }
  };

  const flattenBias = clamp(
    terrainSoftness * 0.85 + (1 - mountainousness) * 0.35 + (1 - islandScale) * 0.2,
    0.25,
    0.95,
  );
  const smoothIterations = Math.max(2, Math.round(2 + flattenBias * 4 + (1 - islandScale) * 2));
  const smoothBlend = clamp(0.32 + flattenBias * 0.45 + (1 - islandScale) * 0.1, 0.25, 0.85);
  const smoothDiag = clamp(0.3 + flattenBias * 0.4 + (1 - islandScale) * 0.12, 0.25, 0.92);
  const extraPasses = 1 + Math.floor(flattenBias * 2 + (1 - islandScale) * 2);
  const extraBlend = clamp(smoothBlend * 0.55, 0.18, 0.6);
  const extraDiag = clamp(smoothDiag * 0.72, 0.28, 0.88);

  smoothHeightField(heightField, smoothIterations, smoothBlend, smoothDiag);
  smoothHeightField(heightField, extraPasses, extraBlend, extraDiag);

  for (let ix = 0; ix < rows; ix++) for (let iy = 0; iy < cols; iy++) {
    const fall = clamp(Math.pow(falloffMask[ix][iy], falloffPower), 0, 1);
    heightField[ix][iy] = clamp(Math.min(heightField[ix][iy], fall), 0, 1);
    if (fall < 0.18) heightField[ix][iy] *= fall * shoreEdgeDamp;
  }

  maxHeightSample = -Infinity;
  for (let ix = 0; ix < rows; ix++) for (let iy = 0; iy < cols; iy++) {
    const h = heightField[ix][iy];
    if (h > maxHeightSample) maxHeightSample = h;
  }

  const assignLevels = (threshold) => {
    let hasLand = false;
    for (let ix = 0; ix < rows; ix++) for (let iy = 0; iy < cols; iy++) {
      const h = heightField[ix][iy];
      if (h <= threshold) {
        heightLevels[ix][iy] = -1;
        continue;
      }
      const scaled = (h - threshold) / Math.max(1e-5, 1 - threshold);
      const level = Math.min(totalLevels - 1, Math.floor(scaled * totalLevels));
      heightLevels[ix][iy] = level;
      hasLand = true;
    }
    return hasLand;
  };

  let effectiveWaterLevel = waterLevel;
  if (!assignLevels(effectiveWaterLevel) && maxHeightSample > 0) {
    effectiveWaterLevel = Math.max(0, maxHeightSample - 0.05);
    if (!assignLevels(effectiveWaterLevel)) {
      effectiveWaterLevel = Math.max(0, maxHeightSample - 0.01);
      assignLevels(effectiveWaterLevel);
    }
  }

  const smoothHeightLevels = () => {
    const maxIterations = rows * cols;
    let changed = false;
    for (let iter = 0; iter < maxIterations; iter++) {
      changed = false;
      for (let ix = 0; ix < rows; ix++) for (let iy = 0; iy < cols; iy++) {
        const current = heightLevels[ix][iy];
        if (current <= 0) continue;
        const neighbors = [];
        if (ix > 0) neighbors.push(heightLevels[ix - 1][iy]);
        if (ix < rows - 1) neighbors.push(heightLevels[ix + 1][iy]);
        if (iy > 0) neighbors.push(heightLevels[ix][iy - 1]);
        if (iy < cols - 1) neighbors.push(heightLevels[ix][iy + 1]);
        for (const level of neighbors) {
          if (level < 0) continue;
          if (current > level + 1) {
            heightLevels[ix][iy] = level + 1;
            changed = true;
            break;
          }
        }
      }
      if (!changed) break;
    }
  };

  smoothHeightLevels();
  smoothHeightLevels();
  smoothHeightLevels();
  smoothHeightLevels();

  let mask0 = heightLevels.map((row) => row.map((value) => (value >= 0 ? 1 : 0)));

  const smooth = (map) => {
    const R = map.length, C = map[0].length;
    const out = map.map((r) => r.slice());
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
      if (map[i][j] === 1) continue;
      let n = 0;
      if (i > 0 && map[i - 1][j] === 1) n++;
      if (i < R - 1 && map[i + 1][j] === 1) n++;
      if (j > 0 && map[i][j - 1] === 1) n++;
      if (j < C - 1 && map[i][j + 1] === 1) n++;
      if (n >= 3) out[i][j] = 1;
    }
    return out;
  };

  const prune = (map) => {
    const R = map.length, C = map[0].length;
    const m = map.map((r) => r.slice());
    while (true) {
      const zeroes = [];
      for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
        if (m[i][j] !== 1) continue;
        let n = 0;
        if (i > 0 && m[i - 1][j] === 1) n++;
        if (i < R - 1 && m[i + 1][j] === 1) n++;
        if (j > 0 && m[i][j - 1] === 1) n++;
        if (j < C - 1 && m[i][j + 1] === 1) n++;
        if (n <= 1) zeroes.push([i, j]);
      }
      if (!zeroes.length) break;
      for (const [i, j] of zeroes) m[i][j] = 0;
    }
    return m;
  };

  const borderWater = (map, margin) => {
    const R = map.length, C = map[0].length;
    const out = map.map((r) => r.slice());
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
      if (i < margin || i >= R - margin || j < margin || j >= C - margin) out[i][j] = 0;
    }
    return out;
  };

  // Fewer smooth passes when mountainousness is high
  const basePasses = (mountainousness < 0.35) ? 2 : (mountainousness < 0.7 ? 1 : 0);
  const softnessPasses = Math.round(terrainSoftness * 2);
  const totalSmoothingPasses = Math.min(3, basePasses + softnessPasses);
  for (let p = 0; p < totalSmoothingPasses; p++) mask0 = smooth(mask0);
  mask0 = prune(mask0);
  // Temporarily skip forcing a water border on the land mask.
  // mask0 = borderWater(mask0, waterMargin);

  let highestLevel = -1;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    if (mask0[i][j] === 1) {
      if (heightLevels[i][j] < 0) heightLevels[i][j] = 0;
      if (heightLevels[i][j] > highestLevel) highestLevel = heightLevels[i][j];
    } else {
      heightLevels[i][j] = -1;
    }
  }

  if (highestLevel < 0) {
    const midX = Math.floor(rows / 2);
    const midY = Math.floor(cols / 2);
    mask0[midX][midY] = 1;
    heightLevels[midX][midY] = 0;
    highestLevel = 0;
  }

  // --- shape classification ---
  const dirMap = [
    { name: "south", dx: 1, dy: 0, rot: 90 },
    { name: "north", dx: -1, dy: 0, rot: 270 },
    { name: "east", dx: 0, dy: 1, rot: 0 },
    { name: "west", dx: 0, dy: -1, rot: 180 },
  ];

  const writeLayer = (layerIndex, mask, shape, rot) => {
    for (let x = 1; x <= rows; x++) for (let y = 1; y <= cols; y++) {
      if (mask[x - 1][y - 1] !== 1) continue;
      const key = `${x}/${y}/${x + 1}/${y + 1}`;
      newVoxels[layerIndex][key] = {
        x, y, x2: x + 1, y2: y + 1, z: layerIndex,
        color: colors[Math.floor(rnd() * Math.min(colors.length, 6))],
        shape: shape[x - 1][y - 1],
        rot: rot[x - 1][y - 1],
      };
    }
  };

  // --- level 0 ---
  const baseShapes = classifyTerrainMask(mask0);
  writeLayer(0, mask0, baseShapes.shape, baseShapes.rot);

  const maxUsableLevel = Math.min(totalLevels - 1, highestLevel);
  for (let level = 1; level <= maxUsableLevel; level++) {
    let levelMask = buildMaskForLevel(heightLevels, level);
    if (!maskHasFilledCell(levelMask)) continue;
    levelMask = prune(levelMask);
    if (!maskHasFilledCell(levelMask)) continue;
    const shapes = classifyTerrainMask(levelMask);
    writeLayer(level, levelMask, shapes.shape, shapes.rot);
  }

  // --- shoreline (with diagonal corners) ---
  const diagonalShoreMap = [
    { name: "north-east", dx: -1, dy: 1, pair: ["north", "east"] },
    { name: "south-east", dx: 1, dy: 1, pair: ["east", "south"] },
    { name: "south-west", dx: 1, dy: -1, pair: ["south", "west"] },
    { name: "north-west", dx: -1, dy: -1, pair: ["west", "north"] },
  ];
  const shorelineDoubleRotation = {
    "west|north": 0, "north|east": 90, "east|south": 180, "south|west": 270,
  };

  const addShorelineWithCorners = (mask) => {
    for (let x = 1; x <= rows; x++) for (let y = 1; y <= cols; y++) {
      if (mask[x - 1][y - 1] !== 0) continue;

      let vecDx = 0, vecDy = 0, touch = 0;
      for (const d of dirMap) {
        const nx = x + d.dx, ny = y + d.dy;
        if (!inBounds(nx, ny)) continue;
        if (mask[nx - 1][ny - 1] > 0) { touch++; vecDx += d.dx; vecDy += d.dy; }
      }

      let rot = 0;
      if (touch > 0) {
        rot = vectorRotation(vecDx, vecDy);
      } else {
        const diag = diagonalShoreMap.find((dg) => {
          const nx = x + dg.dx, ny = y + dg.dy;
          return inBounds(nx, ny) && mask[nx - 1][ny - 1] > 0;
        });
        if (!diag) continue;
        const key = `${diag.pair[0]}|${diag.pair[1]}`;
        rot = shorelineDoubleRotation[key] ?? 0;
      }

      const key = `${x}/${y}/${x + 1}/${y + 1}`;
      if (newVoxels[0][key]) continue;
      newVoxels[0][key] = {
        x, y, x2: x + 1, y2: y + 1, z: 0,
        color: shorelineColor,
        shape: "shoreline",
        rot,
      };
    }
  };

  addShorelineWithCorners(mask0);

  cleanupStackedSlopes(newVoxels, rows, cols, { edgeBuffer: cliffEdgeBuffer });

  // commit
  ctx.voxels = newVoxels;
  ctx.history = [];
  ctx.redoStack = [];
}
