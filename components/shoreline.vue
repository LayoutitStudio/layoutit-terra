<template>
  <div class="shoreline" :style="style"></div>
</template>

<script>
const DIRECTIONS = [
  { name: "north", dx: -1, dy: 0, rot: 270, next: "east" },
  { name: "east", dx: 0, dy: 1, rot: 0, next: "south" },
  { name: "south", dx: 1, dy: 0, rot: 90, next: "west" },
  { name: "west", dx: 0, dy: -1, rot: 180, next: "north" },
];

const DIAGONALS = [
  { dx: -1, dy: 1, pair: ["north", "east"] },
  { dx: 1, dy: 1, pair: ["south", "east"] },
  { dx: 1, dy: -1, pair: ["south", "west"] },
  { dx: -1, dy: -1, pair: ["north", "west"] },
];

const DIRECTION_INDEX = DIRECTIONS.reduce((acc, dir, index) => {
  acc[dir.name] = index;
  return acc;
}, {});

const DOUBLE_ROTATIONS = {
  "west|north": 0,
  "north|east": 90,
  "east|south": 180,
  "south|west": 270,
};

const normalizedDeg = (value) => {
  const deg = Number.isFinite(value) ? value : 0;
  return ((deg % 360) + 360) % 360;
};

const shorelineRotation = (value) => (normalizedDeg(value) + 90) % 360;

const adjacentKey = (a, b) => {
  const idxA = DIRECTION_INDEX[a];
  const idxB = DIRECTION_INDEX[b];
  if (idxA === undefined || idxB === undefined) return null;
  const diff = (idxB - idxA + DIRECTIONS.length) % DIRECTIONS.length;
  if (diff === 1) return `${a}|${b}`;
  if (diff === DIRECTIONS.length - 1) return `${b}|${a}`;
  return null;
};

export default {
  props: ["x", "y", "x2", "y2", "z", "color", "texture", "rot"],
  computed: {
    activeDirections() {
      const voxels = this.$ctx?.voxels || [];
      return DIRECTIONS.filter((dir) => {
        const nx = this.x + dir.dx;
        const ny = this.y + dir.dy;
        const key = `${nx}/${ny}/${nx + 1}/${ny + 1}`;
        let hasLand = false;

        for (const layer of voxels) {
          if (!layer) continue;
          const neighbor = layer[key];
          if (neighbor && neighbor.shape !== "shoreline") {
            hasLand = true;
            break;
          }
        }

        return hasLand;
      });
    },
    baseDirection() {
      const target = normalizedDeg(+this.rot || 0);
      const fromRot = DIRECTIONS.find((dir) => dir.rot === target);
      return fromRot || this.activeDirections[0] || null;
    },
    diagonalPairs() {
      if (!this.$ctx?.voxels) return [];
      return DIAGONALS.filter((diag) => {
        const nx = this.x + diag.dx;
        const ny = this.y + diag.dy;
        const key = `${nx}/${ny}/${nx + 1}/${ny + 1}`;
        for (const layer of this.$ctx.voxels) {
          if (!layer) continue;
          const neighbor = layer[key];
          if (neighbor && neighbor.shape !== "shoreline") return true;
        }
        return false;
      }).map((diag) => diag.pair);
    },
    textureConfig() {
      if (this.activeDirections.length === 2) {
        const [first, second] = this.activeDirections;
        const key = adjacentKey(first.name, second.name);
        if (key && DOUBLE_ROTATIONS[key] !== undefined) {
          return {
            image: "/doubleshore.png",
            rotation: DOUBLE_ROTATIONS[key],
          };
        }
      }

      if (this.activeDirections.length === 0 && this.diagonalPairs.length) {
        const [a, b] = this.diagonalPairs[0];
        const key = adjacentKey(a, b);
        if (key && DOUBLE_ROTATIONS[key] !== undefined) {
          return {
            image: "/shorelinecorner.png",
            rotation: DOUBLE_ROTATIONS[key],
          };
        }
      }

      if (this.baseDirection) {
        return {
          image: "/shore.png",
          rotation: shorelineRotation(this.baseDirection.rot),
        };
      }

      return {
        image: "/shore.png",
        rotation: shorelineRotation(+this.rot || 0),
      };
    },
    style() {
      const { image, rotation } = this.textureConfig;
      return {
        "grid-area": `${this.x} / ${this.y} / ${this.x2} / ${this.y2}`,
        transform: `rotate(${rotation}deg)`,
        backgroundImage: `url(${image})`,
      };
    },
  },
};
</script>

<style lang="scss">
.shoreline {
  position: absolute;
  inset: 0;
  transform-origin: center;
  pointer-events: none;
  z-index: 1;
  background-repeat: no-repeat;
  background-size: 50px 50px;
}
</style>
