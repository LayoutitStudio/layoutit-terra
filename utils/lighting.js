const BIOME_TEXTURE_SETS = {
  temperate: [
    "/grass1.png",
    "/grass2.png",
    "/grass3.png",
    "/grass4.png",
  ],
  arctic: [
    "/textures/ice/ice-fl.svg",
    "/textures/ice2/ice2-fl.svg",
    "/textures/ice3/ice3-fl.svg",
    "/textures/ice/ice-fl.svg",
  ],
  desert: [
    "/dirt1.png",
    "/textures/sand/sand-fl.svg",
    "/textures/dirt/dirt-fl.svg",
    "/textures/sand/sand-fl.svg",
  ],
};

const SHAPE_SURFACE_ANGLES = {
  flat: [180],
  ramp: [0],
  wedge: [180, 270],
  spike: [180, 270],
};

const FALLBACK_BIOME = "temperate";
const LIGHT_SOURCE_ANGLE = 180; // West

const normalizeAngle = (angle) => {
  const normalized = Number(angle) % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const angularDifference = (a, b) => {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return diff > 180 ? 360 - diff : diff;
};

const angleToBrightnessLevel = (angle, { allowPeak = false } = {}) => {
  if (allowPeak) return 1;

  const diff = angularDifference(angle, LIGHT_SOURCE_ANGLE);
  if (diff <= 30) return 2; // near-west, well lit but slightly dimmer than flats
  if (diff <= 90) return 3; // side lit
  return 4; // opposite light, darkest
};

const resolveTextureSet = (inputBiome) => {
  const biome =
    typeof inputBiome === "string" && BIOME_TEXTURE_SETS[inputBiome]
      ? inputBiome
      : FALLBACK_BIOME;

  const base = BIOME_TEXTURE_SETS[biome] || BIOME_TEXTURE_SETS[FALLBACK_BIOME];
  if (!Array.isArray(base) || base.length < 4) {
    return [...BIOME_TEXTURE_SETS[FALLBACK_BIOME]];
  }
  return base;
};

const textureForLevel = (level, textures) => {
  const index = Math.max(0, Math.min(textures.length - 1, (Number(level) || 1) - 1));
  return textures[index] || textures[1] || textures[0];
};

export const defaultTextureForBiome = (inputBiome) => {
  const biome =
    typeof inputBiome === "string" && inputBiome.length > 0
      ? inputBiome
      : FALLBACK_BIOME;
  const textures = resolveTextureSet(biome);
  return textureForLevel(2, textures);
};

export const lightingForShape = (
  shape,
  rotation = 0,
  inputBiome
) => {
  const biome =
    typeof inputBiome === "string" && inputBiome.length > 0
      ? inputBiome
      : FALLBACK_BIOME;
  const textures = resolveTextureSet(biome);
  const angles = SHAPE_SURFACE_ANGLES[shape] || SHAPE_SURFACE_ANGLES.flat;
  const allowPeak = shape === "flat";

  return angles.map((baseAngle) => {
    const absoluteAngle = normalizeAngle(rotation + baseAngle);
    const level = angleToBrightnessLevel(absoluteAngle, { allowPeak });
    return {
      angle: absoluteAngle,
      level,
      texture: textureForLevel(level, textures),
    };
  });
};

export { resolveTextureSet };
