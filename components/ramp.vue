<template>
  <div
    class="ramp"
    :style="{
      'grid-area': `${x} / ${y} / ${x2}/ ${y2}`,
      transform: `translateZ(25px) rotate(${rot || 0}deg)`,
      '--tile-texture': `url(${primaryTexture})`,
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
    <div class="walls bl"></div>
    <div class="walls br"></div> -->
  </div>
</template>

<script>
import { lightingForShape, defaultTextureForBiome } from "~/utils/lighting";
import {
  supportsTerrainCardinals,
  tileProps,
  visibleTileFaces,
} from "~/utils/tileFaces";

export default {
  props: ["x", "y", "x2", "y2", "z", "color", "texture", "rot"],
  data() {
    return {
      isHovered: false,
    };
  },
  computed: {
    lighting() {
      const biome = this.$ctx?.biome || "temperate";
      return lightingForShape("ramp", this.rot || 0, biome);
    },
    primaryTexture() {
      const biome = this.$ctx?.biome || "temperate";
      return (
        this.lighting?.[0]?.texture || defaultTextureForBiome(biome, "ramp")
      );
    },
    visibleFaces() {
      return visibleTileFaces(this.$ctx, tileProps(this), ["fl", "bl", "br"]);
    },
    terrainModeSupportsCardinals() {
      return supportsTerrainCardinals(this.$ctx?.terrainMode);
    },
    shouldShowCardinal() {
      return (
        this.isHovered &&
        this.$ctx?.tool === "add" &&
        this.terrainModeSupportsCardinals
      );
    },
  },
  methods: {
    handleEnter() {
      this.isHovered = true;
    },
    handleLeave() {
      this.isHovered = false;
    },
  },
};
</script>

<style lang="scss">
.ramp .walls {
  position: absolute;
  inset: 0;
  background: transparent;
  pointer-events: none;
  display: flex;
  background: #8b4513;
  border: 0.5px solid #5b3a1d;
  &.fl {
    transform: rotateX(90deg) translateZ(-25px);
    transform-origin: bottom;
    clip-path: polygon(0 100%, 100% 0, 0 0);
    height: 25px;
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
    clip-path: polygon(0 100%, 100% 0, 0 0);
  }
}

.ramp {
  display: block;
  position: absolute;
  inset: 0;
  // transform comes inline to include rotation
  z-index: 1;

  &:before {
    content: "";
    display: block;
    background-image: var(--tile-texture, url("/grass1_ramp.png"));
    background-size: 56px 50px;
    position: absolute;
    right: -6px;
    top: 0;
    bottom: 0;
    left: 0;

    z-index: -1;
    transform: rotateY(26.565deg);
    transform-origin: top left;
  }
}
</style> 
