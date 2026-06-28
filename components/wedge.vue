<template>
  <div
    class="wedge"
    :style="{
      'grid-area': `${x} / ${y} / ${x2}/ ${y2}`,
      transform: `translateZ(25px) rotate(${rot || 0}deg)`,
      '--texture-a': `url(${primaryTexture})`,
      '--texture-b': `url(${secondaryTexture})`,
    }"
    @mouseenter="handleEnter"
    @mouseleave="handleLeave"
  >
    <div class="cardinal-container" v-if="shouldShowCardinal">
      <div class="topleft"></div>
      <div class="topright"></div>
      <div class="backleft"></div>
      <div class="backright"></div>
    </div>
    <!--     <div class="walls fl"></div>
    <div class="walls fr"></div> -->
  </div>
</template>

<script>
import { lightingForShape, defaultTextureForBiome } from "~/utils/lighting";

const TRIANGLE_A_FALLBACK = "/grass2_trianglea_wedge.png";
const TRIANGLE_B_FALLBACK = "/grass2_triangleb_wedge.png";

export default {
  props: ["x", "y", "x2", "y2", "z", "color", "texture", "rot"],
  data() {
    return {
      isHovered: false,
    };
  },
  methods: {
    triangleTexture(texture, variant) {
      const source = texture || "";
      const match = source.match(
        /(.+?)(?:_triangle[ab](?:_[a-z]+)?)?(\.[^.]+)$/
      );
      if (!match) {
        return variant === "a" ? TRIANGLE_A_FALLBACK : TRIANGLE_B_FALLBACK;
      }
      const [, base, ext] = match;
      const fileName = base.split("/").pop() || "";
      if (!/grass\d+/i.test(fileName)) {
        return source || (variant === "a" ? TRIANGLE_A_FALLBACK : TRIANGLE_B_FALLBACK);
      }
      return `${base}_triangle${variant}_wedge${ext}`;
    },
    handleEnter() {
      this.isHovered = true;
    },
    handleLeave() {
      this.isHovered = false;
    },
  },
  computed: {
    lighting() {
      const biome = this.$ctx?.biome || "temperate";
      return lightingForShape("wedge", this.rot || 0, biome);
    },
    primaryTexture() {
      const biome = this.$ctx?.biome || "temperate";
      const base = this.lighting?.[0]?.texture || defaultTextureForBiome(biome);
      return this.triangleTexture(base, "b");
    },
    secondaryTexture() {
      const biome = this.$ctx?.biome || "temperate";
      const base =
        this.lighting?.[1]?.texture ||
        this.lighting?.[0]?.texture ||
        defaultTextureForBiome(biome);
      return this.triangleTexture(base, "a");
    },
    visibleFaces() {
      const faces = ["fl", "fr", "bl", "br"];
      return faces.filter((face) => {
        const [dx, dy, dz] = this.$ctx.offsets[face] || [0, 0, 0];
        const neighborZ = this.z + dz;
        const neighborKey = `${this.x + dx}/${this.y + dy}/${this.x2 + dx}/${
          this.y2 + dy
        }`;
        const neighbor = this.$ctx.voxels[neighborZ]?.[neighborKey];
        return !neighbor && !this.$ctx.walls[face];
      });
    },
    terrainModeSupportsCardinals() {
      const mode = this.$ctx?.terrainMode;
      return mode === "raise" || mode === "lower" || mode === "equalize";
    },
    shouldShowCardinal() {
      return (
        this.isHovered &&
        this.$ctx?.tool === "add" &&
        this.terrainModeSupportsCardinals
      );
    },
  },
};
</script>

<style lang="scss">
.wedge .walls {
  position: absolute;
  inset: 0;
  background: transparent;
  pointer-events: none;
  display: flex;
  background: #6c3e1d;
  border: 0.5px solid #00000050;
  backface-visibility: visible;

  &.fl {
    transform: rotateX(90deg) translateZ(-25px);
    transform-origin: bottom;
    clip-path: polygon(0 100%, 100% 0, 0 0);
    height: 25px;
  }
  &.fr {
    transform: rotateY(-90deg) translateZ(-25px);
    transform-origin: right;
    clip-path: polygon(0 100%, 100% 0, 0 0);
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

.wedge {
  display: block;
  position: absolute;
  inset: 0;
  // transform comes inline to include rotation
  z-index: 1;
  transform-style: preserve-3d;
  will-change: transform;
  backface-visibility: hidden;
  &:before {
    content: "";
    display: block;
    background-image: var(--texture-a, url("/grass2_trianglea_wedge.png"));
    background-size: 56px 50px;
    position: absolute;
    right: -6px;
    top: 0;
    bottom: 0;
    left: 0;

    z-index: -1;
    transform: rotateY(26.565deg);
    transform-origin: top left;
    backface-visibility: hidden;
  }
  &:after {
    content: "";
    display: block;
    background-image: var(--texture-a, url("/grass2_triangleb_wedge.png"));
    background-size: 56px 50px;
    position: absolute;
    right: -6px;
    top: 0;
    bottom: 0;
    left: 0;

    z-index: -1;
    transform-origin: top left;
    transform: rotate(-90deg) scaleX(-1) rotateY(26.565deg);
    backface-visibility: hidden;
  }
}
</style> 
