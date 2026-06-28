export const tileKey = (x, y, x2, y2) => `${x}/${y}/${x2}/${y2}`;

export const tileProps = (component) => ({
  x: component.x,
  y: component.y,
  x2: component.x2,
  y2: component.y2,
  z: component.z,
});

export const getTileNeighbor = (ctx, tile, face) => {
  const [dx, dy, dz] = ctx?.offsets?.[face] || [0, 0, 0];
  const neighborZ = tile.z + dz;
  const neighborKey = tileKey(
    tile.x + dx,
    tile.y + dy,
    tile.x2 + dx,
    tile.y2 + dy
  );
  const neighborLayer = ctx?.voxels?.[neighborZ];
  return neighborLayer ? neighborLayer[neighborKey] : null;
};

export const visibleTileFaces = (
  ctx,
  tile,
  faces,
  { respectWalls = true, sameShape = null, hideBottomAtFloor = false } = {}
) =>
  faces.filter((face) => {
    const neighbor = getTileNeighbor(ctx, tile, face);
    const neighborBlocks = sameShape
      ? neighbor && neighbor.shape === sameShape
      : Boolean(neighbor);

    return (
      !neighborBlocks &&
      !(hideBottomAtFloor && face === "b" && tile.z === 0) &&
      !(respectWalls && ctx?.walls?.[face])
    );
  });

export const isCoveredByUpperVoxel = (ctx, tile) => {
  const key = tileKey(tile.x, tile.y, tile.x2, tile.y2);
  const aboveLayer = ctx?.voxels?.[tile.z + 1];
  if (!aboveLayer || Object.keys(aboveLayer).length === 0) return false;
  const aboveVoxel = aboveLayer[key];
  if (!aboveVoxel) return false;
  return aboveVoxel.shape && aboveVoxel.shape !== "shoreline";
};

export const supportsTerrainCardinals = (mode) =>
  mode === "raise" || mode === "lower" || mode === "equalize";

export const variantTriangleTexture = (texture, variant, shape, fallbacks) => {
  const source = texture || "";
  const match = source.match(/(.+?)(?:_triangle[ab](?:_[a-z]+)?)?(\.[^.]+)$/);
  if (!match) return variant === "a" ? fallbacks.a : fallbacks.b;

  const [, base, ext] = match;
  const fileName = base.split("/").pop() || "";
  if (!/grass\d+/i.test(fileName)) {
    return source || (variant === "a" ? fallbacks.a : fallbacks.b);
  }
  return `${base}_triangle${variant}_${shape}${ext}`;
};
