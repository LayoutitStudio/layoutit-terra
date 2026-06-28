<template>
  <div style="display: contents">
    <div
      class="wall wall-backLeft regrilla"
      :style="{
        display: 'grid',
        'grid-template-columns': `repeat(${$ctx.voxels.length}, 50px)`,
        'grid-template-rows': `repeat(${$ctx.rows}, 50px)`,
        height: `${$ctx.rows * 50}px`,
        width: `${$ctx.voxels.length * 50}px`,
        transform: `rotateY(-90deg) translateZ(${
          25 * $ctx.voxels.length
        }px) translateX(${25 * $ctx.voxels.length}px)`,
      }"
      v-if="$ctx.walls['bl'] && $ctx.showWalls"
    ></div>
    <div
      class="wall wall-frontRight regrilla"
      :style="{
        display: 'grid',
        'grid-template-columns': `repeat(${$ctx.voxels.length}, 50px)`,
        'grid-template-rows': `repeat(${$ctx.rows}, 50px)`,
        height: `${$ctx.rows * 50}px`,
        width: `${$ctx.voxels.length * 50}px`,
        transform: `rotateY(-90deg) translateZ(-${
          25 * $ctx.voxels.length
        }px) translateX(${25 * $ctx.voxels.length}px)`,
      }"
      v-if="$ctx.walls['fr'] && $ctx.showWalls"
    ></div>
    <div
      class="wall wall-backRight regrilla"
      :style="{
        display: 'grid',
        'grid-template-columns': `repeat(${$ctx.cols}, 50px)`,
        'grid-template-rows': `repeat(${$ctx.voxels.length},50px)`,
        width: `${$ctx.cols * 50}px`,
        height: `${$ctx.voxels.length * 50}px`,
        transform: `rotateX(90deg) translateZ(${
          25 * $ctx.voxels.length
        }px) translateY(${25 * $ctx.voxels.length}px)`,
      }"
      v-if="$ctx.walls['br'] && $ctx.showWalls"
    ></div>
    <div
      class="wall wall-frontLeft regrilla"
      :style="{
        display: 'grid',
        'grid-template-columns': `repeat(${$ctx.cols}, 50px)`,
        'grid-template-rows': `repeat(${$ctx.voxels.length},50px)`,
        width: `${$ctx.cols * 50}px`,
        height: `${$ctx.voxels.length * 50}px`,

        transform: `rotateX(-90deg) translateZ(${
          25 * (2 * $ctx.rows - $ctx.voxels.length)
        }px) translateY(-${25 * $ctx.voxels.length}px)`,
      }"
      v-if="$ctx.walls['fl'] && $ctx.showWalls"
    ></div>
  </div>
</template>

<style lang="scss">
.wall {
  background: rgba(89, 89, 111, 1);
  background-image: linear-gradient(
      to right,
      rgba(0, 0, 0, 0.1) 1px,
      transparent 1px
    ),
    linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 1px, transparent 1px);
  background-size: 50px 50px;
  pointer-events: none;

  &:after {
    content: "";
    display: block;
    z-index: 9999999;
    position: absolute;
    bottom: 0;
    right: 0;
    top: 0;
    left: 0;
    pointer-events: none;
  }
}

.wall-frontRight {
  right: 0;
  border-top: 0.5px solid #202020;
  border-bottom: 0.5px solid #202020;
  &:after {
    background: rgba(0, 0, 0, 0.25);
  }
}

.wall-backLeft {
  left: 0;
  border-top: 0.5px solid #202020;
  border-bottom: 0.5px solid #202020;

  &:after {
    background: rgba(0, 0, 0, 0.1);
  }
}

.wall-backRight {
  border-left: 0.5px solid #202020;
  border-right: 0.5px solid #202020;

  &:after {
    background: rgba(0, 0, 0, 0.25);
  }
}
.wall-frontLeft {
  border-left: 0.5px solid #202020;
  border-right: 0.5px solid #202020;
  &:after {
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.15), transparent);
  }
}
</style>
