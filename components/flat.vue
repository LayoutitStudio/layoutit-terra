<template>
  <div
    v-if="!isCovered"
    :class="flatClasses"
    :style="{
      'grid-area': `${x} / ${y} / ${x2}/ ${y2}`,
      transform: `translateZ(25px) rotate(${rot || 0}deg)`,
      '--tile-texture': `url(${primaryTexture})`,
    }"
  >
    <div v-if="treeImage" class="tree-pivot" aria-hidden="true">
      <div class="tree-stack">
        <div class="tree-sprite">
          <img :src="treeImage" :alt="treeClass" draggable="false" />
          <img :src="treeImage" :alt="treeClass" draggable="false" />
        </div>
      </div>
    </div>

    <!--     <div class="walls fl"></div>
    <div class="walls fr"></div>
    <div class="walls bl"></div>
    <div class="walls br"></div> -->
  </div>
</template>

<script>
import { lightingForShape, defaultTextureForBiome } from "~/utils/lighting";
import {
  isCoveredByUpperVoxel,
  tileProps,
  visibleTileFaces,
} from "~/utils/tileFaces";
import Cube from "~/components/cube.vue";

export default {
  components: {
    Cube,
  },
  props: ["x", "y", "x2", "y2", "z", "color", "texture", "rot", "treeClass"],
  computed: {
    flatClasses() {
      return this.treeClass ? ["flat", this.treeClass] : ["flat"];
    },
    treeImage() {
      if (!this.treeClass) return null;
      return `/trees/${this.treeClass}.png`;
    },
    treeCubeStyle() {
      return {};
    },
    treeCubeBaseColor() {
      return "#63c74d";
    },
    treeCubeZ() {
      const base = Number(this.z);
      if (Number.isFinite(base)) return base + 1;
      return 1;
    },
    treeDebugTitle() {
      if (!this.treeClass) return "";
      return `Tree ${this.treeClass} → ${this.treeImage || "(no image)"}`;
    },
    lighting() {
      const biome = this.$ctx?.biome || "temperate";
      return lightingForShape("flat", this.rot || 0, biome);
    },
    primaryTexture() {
      const biome = this.$ctx?.biome || "temperate";
      return (
        this.lighting?.[0]?.texture || defaultTextureForBiome(biome, "flat")
      );
    },
    visibleFaces() {
      return visibleTileFaces(this.$ctx, tileProps(this), [
        "fl",
        "fr",
        "bl",
        "br",
      ]);
    },
    isCovered() {
      return isCoveredByUpperVoxel(this.$ctx, tileProps(this));
    },
  },
};
</script>

<style lang="scss">
.flat .walls {
  position: absolute;
  inset: 0;
  background: transparent;
  pointer-events: none;
  background: #8b4513;
  border: 0.5px solid #5b3a1d;
  &.fl {
    transform: rotateX(90deg) translateZ(-25px);
    transform-origin: bottom;
    height: 25px;
  }
  &.fr {
    transform: rotateY(90deg) translateZ(50px);
    transform-origin: bottom left;
    width: 25px;
  }
  &.bl {
    transform: rotateY(90deg);
    transform-origin: bottom left;
    width: 25px;
  }
  &.br {
    transform: rotateX(90deg) translateZ(25px);
    transform-origin: bottom right;
    height: 25px;
  }
}
.flat {
  display: block;
  position: absolute;
  inset: 0;
  z-index: 1;
  background-image: var(--tile-texture, url("/grass1.png"));
  background-size: 50px;
}
.flat.tree1,
.flat.tree2,
.flat.tree3 {
}
.flat .tree-pivot {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  pointer-events: none;
  perspective: 520px;
}
.flat .tree-stack {
  position: relative;
  width: 50px;
  height: 50px;
  transform: translateZ(0);
  transform-style: preserve-3d;
  pointer-events: none;
  display: flex;
  justify-content: center;
  align-items: center;
}
.flat .tree-cube {
  position: absolute;
  inset: 0;
  width: 50px;
  height: 50px;
  transform: none;
  transform-style: preserve-3d;
  pointer-events: none;
}
.flat .tree-stack::after {
  content: "";

  width: 20px;
  height: 20px;
  background: rgba(0, 0, 0, 0.2);
  filter: blur(6px);
  border-radius: 50%;
}
.flat .tree-cube .face {
  pointer-events: none;
  border-radius: 4px;
  box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.18);
  outline: 0;
}

.flat .tree-sprite {
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  pointer-events: none;
  transform: rotateX(-90deg) translateY(10px) translateZ(-25px);
  transform-origin: bottom;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
}
.flat .tree-sprite img {
  width: 25px;
  height: auto;
  object-fit: contain;
  display: block;
  position: absolute;
}
.flat .tree-sprite img + img {
  transform: rotateY(90deg);
}
.flat .tree-debug-label {
  position: absolute;
  bottom: 2px;
  left: 2px;
  padding: 2px 4px;
  border-radius: 3px;
  background: rgba(255, 0, 0, 0.85);
  color: #fff;
  font-size: 10px;
  line-height: 1;
  font-family: monospace;
  letter-spacing: 0.03em;
  pointer-events: none;
  z-index: 2;
}
</style>
