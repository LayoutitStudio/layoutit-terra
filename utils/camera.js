const MIN_ROT_X = 0;
const MAX_ROT_X = 85;

export const verticalRotationLimits = Object.freeze({
  min: MIN_ROT_X,
  max: MAX_ROT_X,
});

export function clampVerticalRotation(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return MIN_ROT_X;
  }
  if (numeric <= MIN_ROT_X) {
    return MIN_ROT_X;
  }
  if (numeric >= MAX_ROT_X) {
    return MAX_ROT_X;
  }
  return numeric;
}
