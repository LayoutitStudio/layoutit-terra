<template>
  <div
    class="cube"
    :style="{ 'grid-area': `${x} / ${y} / ${x2}/ ${y2}` }"
    v-if="visibleFaces.length > 0"
    :class="[
      !isHexColor(color) ? 'svg' : color.replace('#', ''),
      {
        add: $ctx.tool === 'add',
        fill: $ctx.tool === 'fill',
        sub: $ctx.tool === 'erase',
      },
    ]"
  >
    <div
      v-for="face in visibleFaces"
      :key="face"
      :class="['face', face]"
      :style="faceStyles(face)"
      @mousedown="$emit('mousedown', { face, x, y, x2, y2, z })"
      @mouseup="$emit('mouseup', { face, x, y, x2, y2, z })"
      @mouseover="$emit('mouseover', { face, x, y, x2, y2, z })"
    ></div>
  </div>
</template>

<script>
export default {
  props: ["x", "y", "x2", "y2", "z", "color", "texture"],
  computed: {
    faceStyles() {
      return (face) => {
        const baseStyles = this.isHexColor(this.color)
          ? { backgroundColor: this.adjustColor(this.color, face) }
          : {
              backgroundSize: "cover",
              backgroundImage: `url(textures/${this.color.replace(
                "#",
                ""
              )}/${this.color.replace("#", "")}-${face}.svg)`,
            };

        if (face === "fr") {
          const difference = Math.abs(this.y2 - this.y);
          return {
            ...baseStyles,
            transform: `rotateY(90deg) translateZ(${50 * difference - 25}px)`,
          };
        }
        if (face === "fl") {
          const difference = Math.abs(this.x2 - this.x);
          return {
            ...baseStyles,
            transform: `rotateX(90deg) translateZ(-${50 * difference - 25}px)`,
          };
        }
        return baseStyles; // Default for other faces
      };
    },

    visibleFaces() {
      return ["t", "b", "bl", "br", "fr", "fl"].filter((face) => {
        const [dx, dy, dz] = this.$ctx.offsets[face];

        const neighborZ = this.z + dz;
        const neighborKey = `${this.x + dx}/${this.y + dy}/${this.x2 + dx}/${
          this.y2 + dy
        }`;
        const neighborVoxel = this.$ctx.voxels[neighborZ]?.[neighborKey];

        return (
          // Ensure the layer exists and check if the neighbor voxel is absent or not a cube
          (!neighborVoxel || neighborVoxel.shape !== "cube") &&
          // Bottom face hidden at floor level
          !(face === "b" && this.z === 0) &&
          // Not hidden by rotation
          !this.$ctx.walls[face]
        );
      });
    },
  },
  methods: {
    isHexColor(color) {
      return /^#[0-9A-F]{6}$/i.test(color);
    },
    adjustColor(color, face) {
      // Convert the color to RGB
      const rgb = color.match(/\w\w/g).map((x) => parseInt(x, 16));

      // Determine the adjustment factor for each face
      let adjustment = 0;
      if (face === "fr") adjustment = -15; // Darken slightly
      if (face === "fl") adjustment = -25; // Darken more
      if (face === "bl" || face === "br") adjustment = -35; // Darkest faces

      // Apply the adjustment
      const adjusted = rgb.map((channel) =>
        Math.min(255, Math.max(0, channel + adjustment))
      );

      // Convert back to hex
      return `rgb(${adjusted[0]}, ${adjusted[1]}, ${adjusted[2]})`;
    },
  },
};
</script>

<style lang="scss">
.cube {
  display: block;
  position: absolute;
  inset: 0;
  transform: translateZ(25px);
  &.light {
    transform: translateZ(50px);
    background: red;
    &:after {
      content: "";
      background: blue;
      height: 50px;
      width: 50px;
      display: block;
      transform: rotateX(90deg) translateY(-25px) translateZ(-25px);
      position: absolute;
      inset: 0;
    }
    &:before {
      content: "";
      background: green;
      height: 50px;
      width: 50px;
      display: block;
      transform: rotateY(-90deg) translateX(-25px) translateZ(-25px);
      position: absolute;
      inset: 0;
    }
    .face {
      display: none;
    }
  }
  &.svg {
    .face {
      &:after {
        pointer-events: none;
        content: "";
        position: absolute;
        inset: 0;
      }
      &.t:after {
        background: rgba(0, 0, 0, 0);
      }

      &.fr:after {
        background: rgba(0, 0, 0, 0.1);
      }

      &.fl:after {
        background: rgba(0, 0, 0, 0.15);
      }

      &.bl:after {
        background: rgba(0, 0, 0, 0.2);
      }

      &.br:after {
        background: rgba(0, 0, 0, 0.2);
      }
    }
  }
  .face {
    position: absolute;
    outline: 1px solid rgba(0, 0, 0, 0.03);
    outline-offset: -1px;
    inset: 0;
    &.t {
      transform: translateZ(25px);
      background: var(--color);
    }
    &.b {
      transform: translateZ(-25px);
    }
    &.fr {
      transform: rotateY(90deg) translateZ(25px);
      width: 50px;
    }
    &.fl {
      transform: rotateX(90deg) translateZ(-25px);
      height: 50px;
    }
    &.bl {
      transform: rotateY(90deg) translateZ(-25px);
      width: 50px;
    }
    &.br {
      transform: rotateX(90deg) translateZ(25px);
      height: 50px;
    }
    &.svg {
      outline: 0;
    }
    &.c262b44,
    &.c3a4466,
    &.c3e2731,
    &.c193c3e,
    &.c68386c,
    &.c181425 {
      outline: 1px solid rgba(255, 255, 255, 0.05);
    }

    svg {
      position: absolute;
      inset: 0;
      z-index: -1;
      pointer-events: none;
    }
  }

  &.selected .face,
  &.select:hover .face {
    outline: 1.5px solid red;
    outline-offset: -1.5px;
    cursor: pointer;
  }

  &.sub:hover .face {
    outline: 1.5px solid red;
    outline-offset: -1.5px;
    cursor: pointer;

    &:before {
      content: "";
      position: absolute;
      inset: 0;
      background: rgba(255, 0, 0, 0.5);
      z-index: 9999;
    }
  }

  &.fill .face:hover,
  &.add .face:hover {
    outline: 1.5px solid red;
    outline-offset: -1.5px;
    cursor: pointer;
  }
}
</style> 