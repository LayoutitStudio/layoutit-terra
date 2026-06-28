<template>
  <div
    :class="cliffClasses"
    v-if="!isCovered"
    :style="{
      'grid-area': `${x} / ${y} / ${x2}/ ${y2}`,
      transform: `translateZ(25px) rotate(${rot || 0}deg)`,
      '--tile-texture': `url(${primaryTexture})`,
    }"
    :data-cliff-variant="cliffVariant || null"
    :data-cliff-base="cliffBase || null"
    :data-cliff-source="cliffSource || null"
    :data-cliff-touch="touchingShape"
    :data-cliff-touch-direction="touchingDirection"
    :data-cliff-touch-a="touchingShape"
    :data-cliff-touch-direction-a="touchingDirection"
    :data-cliff-touch-b="touchingShapeB"
    :data-cliff-touch-direction-b="touchingDirectionB"
    :data-cliff-adjacent-cliff="touchesCliff ? 'yes' : null"
    :data-cliff-adjacent-cliff-direction="touchingCliffDirection"
    :data-cliff-adjacent-cliff-shape="touchingCliffShape"
  >
    <div class="walls fl"></div>
    <div class="walls bl"></div>
  </div>
</template>

<script>
import { lightingForShape, defaultTextureForBiome } from "~/utils/lighting";

const cleanName = (value) => {
  if (!value || typeof value !== "string") return null;
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || null
  );
};

const shortSignature = (value) => {
  if (!value) return "0";
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0; // convert to 32-bit int
  }
  const result = Math.abs(hash).toString(36);
  return result || "0";
};

export default {
  props: [
    "x",
    "y",
    "x2",
    "y2",
    "z",
    "color",
    "texture",
    "rot",
    "cliffVariant",
    "cliffBase",
    "cliffSource",
  ],
  computed: {
    lighting() {
      const biome = this.$ctx?.biome || "temperate";
      return lightingForShape("flat", this.rot || 0, biome);
    },
    primaryTexture() {
      const biome = this.$ctx?.biome || "temperate";
      return this.lighting?.[0]?.texture || defaultTextureForBiome(biome);
    },
    cliffClasses() {
      const variant = cleanName(this.cliffVariant) || "none";

      const edgeSignatures = [];

      this.touchingNeighbors.forEach((neighbor, index) => {
        const shapeName = cleanName(neighbor.shape) || "none";
        const direction = cleanName(neighbor.direction) || `edge-${index}`;
        edgeSignatures.push(`${direction}-${shapeName}`);
      });

      this.touchingCliffNeighbors.forEach((neighbor, index) => {
        const direction = cleanName(neighbor.direction) || `edge-${index}`;
        edgeSignatures.push(`${direction}-cliff`);
      });

      const uniqueEdges = Array.from(new Set(edgeSignatures)).sort();
      const edgeClass = uniqueEdges.length > 0 ? uniqueEdges.join("|") : "none";

      const seed = `v:${variant}|e:${edgeClass}`;
      const signature = shortSignature(seed);

      return ["cliff", `c-${signature}`];
    },
    touchingShape() {
      const neighbor = this.touchingNeighborA;
      return neighbor && neighbor.shape ? cleanName(neighbor.shape) : null;
    },
    touchingDirection() {
      const neighbor = this.touchingNeighborA;
      return neighbor && neighbor.direction ? neighbor.direction : null;
    },
    touchingShapeB() {
      const neighbor = this.touchingNeighborB;
      return neighbor && neighbor.shape ? cleanName(neighbor.shape) : null;
    },
    touchingDirectionB() {
      const neighbor = this.touchingNeighborB;
      return neighbor && neighbor.direction ? neighbor.direction : null;
    },
    touchingNeighborA() {
      const neighbors = this.touchingNeighbors;
      return neighbors.length > 0 ? neighbors[0] : null;
    },
    touchingNeighborB() {
      const neighbors = this.touchingNeighbors;
      return neighbors.length > 1 ? neighbors[1] : null;
    },
    touchingCliffDirection() {
      const neighbor =
        this.touchingCliffNeighbors.length > 0
          ? this.touchingCliffNeighbors[0]
          : null;
      return neighbor && neighbor.direction ? neighbor.direction : null;
    },
    touchingCliffShape() {
      const neighbor =
        this.touchingCliffNeighbors.length > 0
          ? this.touchingCliffNeighbors[0]
          : null;
      return neighbor && neighbor.shape ? cleanName(neighbor.shape) : null;
    },
    touchesCliff() {
      return this.touchingCliffNeighbors.length > 0;
    },
    touchingCliffNeighbors() {
      return this.neighborAnalysis.cliff;
    },
    touchingNeighbors() {
      return this.neighborAnalysis.nonCliff;
    },
    neighborAnalysis() {
      const faces = ["fr", "fl", "bl", "br"];
      const nonCliff = [];
      const cliff = [];
      for (const face of faces) {
        const offset = this.$ctx.offsets[face] || [0, 0, 0];
        const dx = offset[0];
        const dy = offset[1];
        const dz = offset[2];
        const neighborZ = this.z + dz;
        const neighborKey = `${this.x + dx}/${this.y + dy}/${this.x2 + dx}/${
          this.y2 + dy
        }`;
        const neighborLayer = this.$ctx.voxels[neighborZ];
        const neighbor = neighborLayer ? neighborLayer[neighborKey] : null;
        if (!neighbor) continue;
        const info = { shape: neighbor.shape, direction: face };
        if (neighbor.shape === "cliff") {
          cliff.push(info);
        } else if (nonCliff.length < 2) {
          nonCliff.push(info);
        }
      }
      return { nonCliff, cliff };
    },
    visibleFaces() {
      const faces = ["fl", "fr", "bl", "br"];
      return faces.filter((face) => {
        const [dx, dy, dz] = this.$ctx.offsets[face] || [0, 0, 0];
        const neighborZ = this.z + dz;
        const neighborKey = `${this.x + dx}/${this.y + dy}/${this.x2 + dx}/${
          this.y2 + dy
        }`;
        const neighborLayer = this.$ctx.voxels[neighborZ];
        const neighbor = neighborLayer ? neighborLayer[neighborKey] : null;

        return !neighbor;
      });
    },
    isCovered() {
      const key = `${this.x}/${this.y}/${this.x2}/${this.y2}`;
      const aboveLayer = this.$ctx.voxels[this.z + 1];
      if (!aboveLayer || Object.keys(aboveLayer).length === 0) return false;
      const aboveVoxel = aboveLayer[key];
      if (!aboveVoxel) return false;
      return aboveVoxel.shape && aboveVoxel.shape !== "shoreline";
    },
  },
};
</script>

<style lang="scss">
.cliff .walls {
  position: absolute;
  inset: 0;
  background: transparent;
  pointer-events: none;
  &.fl {
    transform: rotateX(90deg) translateZ(25px);
    transform-origin: bottom left;
    height: 25px;
    background: url("/cliff_fl.png");
    background-size: contain;
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
    background: url("/cliff_fr.png");
    background-size: contain;
  }
  &.br {
    transform: rotateX(90deg) translateZ(25px);
    transform-origin: bottom right;
    height: 25px;
  }
}
.cliff {
  display: block;
  position: absolute;
  inset: 0;
  z-index: 1;
}
.cliff.c-go45pv .walls.fl,
.cliff.c-n1kkqn .walls.fl,
.cliff.c-esjnp9 .walls.fl,
.cliff.c-6rsbi2 .walls.fl,
.cliff.c-vbicn3 .walls.fl,
.cliff.c-tfxumh .walls.fl,
.cliff.c-zf0y6i .walls.fl,
.cliff.c-itxt37 .walls.fl,
.cliff.c-8e6dtf .walls.fl,
.cliff.c-yj61u8 .walls.fl,
.cliff.c-xqils0 .walls.fl,
.cliff.c-46jm5z .walls.fl,
.cliff.c-obp5b2 .walls.fl,
.cliff.c-rdfdx .walls.fl,
.cliff.c-lnjc4v .walls.fl,
.cliff.c-hvetwj .walls.bl,
.cliff.c-rzhmaj .walls.fl,
.cliff.c-3ybpfz .walls.bl,
.cliff.c-jrn175 .walls.fl,
.cliff.c-ifanwf .walls.fl,
.cliff.c-5k6x5v .walls.fl,
.cliff.c-2iv71z,
.cliff.c-bd35l3,
.cliff.c-gwzfa1,
.cliff.c-3vi2tv,
.cliff.c-4efp2l,
.cliff.c-v3m9qh,
.cliff.c-5688 .walls.fl,
.cliff.c-fzubvx .walls.bl,
.cliff.c-93oua3 .walls.fl,
.cliff.c-fzubvx .walls.bl,
.cliff.c-kbwodh .walls.fl,
.cliff.c-fzubvx .walls.bl,
.cliff.c-zaclsp .walls.fl,
.cliff.c-gn96ut .walls.fl,
.cliff.c-jj7ra5 .walls.bl,
.cliff.c-ytbm4r .walls.fl,
.cliff.c-8zo8xr .walls.bl,
.cliff.c-o9s3sd .walls.fl,
.cliff.c-i4fcmj .walls.bl,
.cliff.c-fkpozx .walls.fl,
.cliff.c-jj7ra5 .walls.bl,
.cliff.c-o9s3sd .walls.fl,
.cliff.c-9yinfp .walls.bl,
.cliff.c-qed4iz .walls.fl,
.cliff.c-txcot7 .walls.bl,
.cliff.c-91oskd .walls.fl,
.cliff.c-eab5jp .walls.fl,
.cliff.c-r0n7sl .walls.fl,
.cliff.c-w2itmd .walls.fl,
.cliff.c-b8x6vx .walls.fl,
.cliff.c-9qyqrb .walls.fl,
.cliff.c-6gns1j .walls.fl,
.cliff.c-y214b7 .walls.fl,
.cliff.c-vt1uaz .walls.fl,
.cliff.c-ps3cer .walls.fl,
.cliff.c-7mkc01 .walls.fl,
.cliff.c-eqjlzj .walls.fl,
.cliff.c-gm4405 .walls.fl,
.cliff.c-ivxusx .walls.fl,
.cliff.c-ih8hqx .walls.fl,
.cliff.c-8c6c3p .walls.fl,
.cliff.c-xoe1c9 .walls.fl,
.cliff.c-rnnufd .walls.fl {
  display: none;
}
.cliff.c-esjnp9 .walls.bl,
.cliff.c-vbicn3 .walls.bl,
.cliff.c-8e6dtf .walls.bl,
.cliff.c-46jm5z .walls.bl,
.cliff.c-rzhmaj .walls.bl,
.cliff.c-r0n7sl .walls.bl,
.cliff.c-b8x6vx .walls.bl,
.cliff.c-9qyqrb .walls.bl,
.cliff.c-vt1uaz .walls.bl,
.cliff.c-ps3cer .walls.bl,
.cliff.c-eqjlzj .walls.bl,
.cliff.c-8c6c3p .walls.bl {
  transform: rotateY(90deg) rotateX(180deg);
  transform-origin: left;
}

.cliff.c-hvetwj .walls.fl {
  transform: rotateX(90deg) translateZ(25px) rotateY(180deg);
  transform-origin: bottom;
}

.cliff.c-qg5446 .walls.fl,
.cliff.c-3ybpfz .walls.fl,
.cliff.c-hevhm9 .walls.fl,
.cliff.c-ppv09x .walls.fl,
.cliff.c-zfw4wj .walls.fl,
.cliff.c-vt4l03 .walls.fl,
.cliff.c-j0qpc5 .walls.fl,
.cliff.c-lco0uz .walls.fl,
.cliff.c-2zdgqn .walls.fl,
.cliff.c-x82aux .walls.fl {
  background: url("/dirt1_complete_alt.png");
  background-size: contain;
}
.cliff.c-5688 .walls.bl,
.cliff.c-6rsbi2 .walls.bl,
.cliff.c-zf0y6i .walls.bl,
.cliff.c-yj61u8 .walls.bl,
.cliff.c-xqils0 .walls.bl,
.cliff.c-obp5b2 .walls.bl,
.cliff.c-lnjc4v .walls.bl,
.cliff.c-qg5446 .walls.bl,
.cliff.c-5v28fr .walls.bl,
.cliff.c-icotoa .walls.bl,
.cliff.c-ovtz3n .walls.bl,
.cliff.c-8cuyp3 .walls.bl,
.cliff.c-5k6x5v .walls.bl,
.cliff.c-zaclsp .walls.bl,
.cliff.c-22ywd9 .walls.bl,
.cliff.c-lkovlr .walls.bl,
.cliff.c-pe2vxr .walls.bl,
.cliff.c-l1jfjx .walls.bl,
.cliff.c-3u1i1p .walls.bl,
.cliff.c-w2itmd .walls.bl,
.cliff.c-6gns1j .walls.bl,
.cliff.c-7mkc01 .walls.bl,
.cliff.c-cba70l .walls.bl,
.cliff.c-xoe1c9 .walls.bl {
  background: url("/dirt1_complete.png");
  background-size: contain;
}
</style>
