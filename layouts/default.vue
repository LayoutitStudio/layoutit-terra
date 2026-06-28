<template>
  <div
    class="drag-container"
    @dragover.prevent="handleDragOver"
    @dragenter.prevent="showOverlay"
    @dragleave.prevent="hideOverlay"
    @drop.prevent="handleDrop"
  >
    <div v-if="$ctx.dragFile" class="drag-overlay">
      <div class="dragoutline">
        <icons-cloud />
        <p>Drop VOX file</p>
      </div>
    </div>
    <template>
      <div :style="{ pointerEvents: $ctx.dragFile ? 'none' : 'auto' }">
        <nuxt />
      </div>
    </template>
  </div>
</template>

<script>
import generateTerrain from "~/utils/generateTerrain";
import { clampVerticalRotation, verticalRotationLimits } from "~/utils/camera";

const cliffShapeToLetter = {
  ramp: "r",
  wedge: "w",
  spike: "s",
  cliff: "c",
  flat: "f",
};

const cliffLetterToShape = Object.entries(cliffShapeToLetter).reduce(
  (acc, [shape, letter]) => {
    acc[letter] = shape;
    return acc;
  },
  { n: null }
);

const encodeCliffMeta = (voxel) => {
  const variant = cliffShapeToLetter[voxel?.cliffVariant] || "n";
  const base = cliffShapeToLetter[voxel?.cliffBaseShape] || "n";
  const source = cliffShapeToLetter[voxel?.cliffReplacedShape] || "n";
  return `${variant}${base}${source}`;
};

const decodeCliffMeta = (meta) => {
  const letters = (meta || "").padEnd(3, "n").slice(0, 3).split("");
  const [variantLetter, baseLetter, sourceLetter] = letters;
  return {
    variant: cliffLetterToShape[variantLetter] || null,
    base: cliffLetterToShape[baseLetter] || null,
    source: cliffLetterToShape[sourceLetter] || null,
  };
};

export default {
  watch: {
    "$ctx.dragMap": async function (v) {
      await this.$nextTick();
      const url = this.encodeURL(this.$ctx.voxels);
      if (url.length > 20) {
        history.replaceState(
          {},
          "",
          location.pathname + "#" + (await this.deflate(url))
        );
      }
    },
    "$ctx.drag": async function (v) {
      if (v) {
        await this.$nextTick();
        const url = this.encodeURL(this.$ctx.voxels);

        if (url.length > 20) {
          history.replaceState(
            {},
            "",
            location.pathname + "#" + (await this.deflate(url))
          );
        }

        this.$ctx.history.push(JSON.parse(JSON.stringify(this.$ctx.voxels)));

        if (this.$ctx.history.length > 20) {
          this.$ctx.history.shift();
        }
        this.redoStack = [];
      } else {
        this.$nextTick(() => {
          this.updateSceneStats();
        });
      }
    },
  },
  async mounted() {
    if (location.hash) {
      const {
        cols,
        rows,
        depth,
        voxelData,
        rotX,
        rotY,
        terrainType,
        terrainSoftness,
        biome,
      } = this.decodeURL(
        await this.inflate(location.hash.slice(1))
      );
      this.$ctx.autoZoomLocked = false;
      this.$set(this.$ctx, "cols", cols);
      this.$set(this.$ctx, "rows", rows);
      this.$set(this.$ctx, "voxels", voxelData);

      const terrainPresets = {
        flat: { mountain: 0.08, softness: 0.96 },
        hilly: { mountain: 0.38, softness: 0.6 },
        mountainous: { mountain: 0.82, softness: 0.22 },
      };
      if (terrainType) {
        const normalizedType = terrainType === "alpinist" ? "mountainous" : terrainType;
        const preset = terrainPresets[normalizedType];
        this.$set(this.$ctx, "terrainType", normalizedType);
        if (preset) {
          this.$set(this.$ctx, "mountainousness", preset.mountain);
          this.$set(this.$ctx, "mountain", preset.mountain);
          if (!Number.isFinite(terrainSoftness)) {
            this.$set(this.$ctx, "terrainSoftness", preset.softness);
          }
        }
      }

      if (Number.isFinite(terrainSoftness)) {
        this.$set(this.$ctx, "terrainSoftness", terrainSoftness);
      }
      if (biome) {
        this.$set(this.$ctx, "biome", biome);
      }

      // Set the rotation values
      this.$set(this.$ctx, "rotX", clampVerticalRotation(rotX));
      this.$set(this.$ctx, "rotY", rotY);
      const r = this.$ctx.rotY % 360;
      this.$ctx.walls = {
        t: this.$ctx.rotX >= verticalRotationLimits.max,
        b: this.$ctx.rotX < verticalRotationLimits.max,
        bl: r <= 180,
        fr: r > 180,
        br: r < 90 || r >= 270,
        fl: r >= 90 && r < 270,
      };
      this.$set(this.$ctx, "loading", false);

      this.$ctx.fitViewportTick += 1;

      this.$nextTick(() => {
        this.updateSceneStats();
      });
    } else {
      generateTerrain(this.$ctx);
      this.$set(this.$ctx, "loading", false);
      this.$ctx.autoZoomLocked = false;
      this.$ctx.fitViewportTick += 1;
      this.$nextTick(() => {
        this.updateSceneStats();
      });
    }
  },
  methods: {
    async deflate(string) {
      const stream = new CompressionStream("deflate");
      const writer = stream.writable.getWriter();
      writer.write(new TextEncoder().encode(string));
      writer.close();

      const reader = stream.readable.getReader();
      const chunks = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(...value);
      }

      return btoa(String.fromCharCode(...new Uint8Array(chunks)))
        .replace(/\+/g, "-")
        .replace(/\//g, "!")
        .replace(/=+$/, "");
    },
    async inflate(string) {
      const deflatedData = Uint8Array.from(
        atob(string.replace(/-/g, "+").replace(/!/g, "/")),
        (c) => c.charCodeAt(0)
      );

      const stream = new DecompressionStream("deflate");
      const writer = stream.writable.getWriter();
      writer.write(deflatedData);
      writer.close();

      const reader = stream.readable.getReader();
      const chunks = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(...value);
      }

      return new TextDecoder().decode(new Uint8Array(chunks.flat()));
    },
    updateSceneStats() {
      this.$set(this.$ctx, "facets", this.countFaces());
      this.$set(
        this.$ctx,
        "size",
        (
          ((this.$ctx.cssOutput || "").length +
            (this.$ctx.htmlOutput || "").length) /
          1024
        ).toFixed(1)
      );
      this.$set(
        this.$ctx,
        "voxelLength",
        Object.values(this.$ctx.voxels).flatMap(Object.keys).length
      );
    },
    decodeURL(url) {
      const letterToShape = {
        f: "flat",
        r: "ramp",
        w: "wedge",
        p: "wedge", // legacy "peak"
        s: "spike",
        c: "spike", // legacy fallback
        v: "wedge", // legacy "stepdo"
        h: "shoreline",
        l: "cliff",
      };

      // Split data from metadata
      const [dataPart, metaPart] = url.split("@");
      if (!dataPart || !metaPart) {
        throw new Error("Malformed: missing data or metadata");
      }

      // Extract dimensions and rotation data using an updated regex.
      // Expecting a string like "x12y34z05rX00rY00"

      const dims = metaPart.match(
        /x(\d+)y(\d+)z(\d+)rX(\d+)rY(\d+)(?:t([A-Z]))?(?:e([A-Z]))?(?:b([A-Z]))?/
      );
      if (!dims)
        throw new Error(
          "Malformed: can't extract dimensions and rotation data"
        );

      const cols = +dims[1];
      const rows = +dims[2];
      const depth = +dims[3];
      const rotX = +dims[4];
      const rotY = +dims[5];

      // Prepare voxelData
      const voxelData = Array.from({ length: depth }, () => ({}));

      // Process layers
      const layers = dataPart.split("|");
      layers.forEach((layer) => {
        const [zStr, layerString] = layer.split("-");
        const z = parseInt(zStr, 10) - 1;
        if (isNaN(z) || z < 0 || z >= depth) {
          console.warn(`Invalid layer: ${layer}`);
          return;
        }
        const colorGroups = layerString.split(";");
        colorGroups.forEach((colorGroup) => {
          const indexOfColon = colorGroup.indexOf(":");
          if (indexOfColon < 0) {
            console.warn(`Skipping invalid colorGroup: ${colorGroup}`);
            return;
          }
          const colorAndShape = colorGroup.slice(0, indexOfColon).trim();
          const xGroupsString = colorGroup.slice(indexOfColon + 1).trim();
          const [colorStr, shapeCode] = colorAndShape.split(",");
          if (!colorStr || !shapeCode) {
            console.warn(`Skipping invalid color,shape: ${colorAndShape}`);
            return;
          }
          const color = `#${colorStr}`;
          const shapeLetter = (shapeCode || "").charAt(0).toLowerCase();
          const shapeSuffix = (shapeCode || "").slice(1);
          const rotDigits = shapeSuffix.match(/^\d+/);
          const rotCode = rotDigits ? parseInt(rotDigits[0], 10) : NaN;
          const metaPart = rotDigits
            ? shapeSuffix.slice(rotDigits[0].length)
            : shapeSuffix;
          const shape = letterToShape[shapeLetter] || "flat";
          if (!shape) {
            console.warn(`Skipping unknown shape letter: ${shapeCode}`);
            return;
          }
          const rot = Number.isFinite(rotCode) ? (rotCode % 4) * 90 : 0;
          const cliffMeta =
            shape === "cliff" ? decodeCliffMeta(metaPart) : { variant: null, base: null, source: null };
          const xGroups = xGroupsString.split(",");
          xGroups.forEach((xGroup) => {
            const [xStr, yyList] = xGroup.split(":");
            const x = parseInt(xStr, 10);
            if (isNaN(x) || !yyList) {
              console.warn(`Skipping invalid x group: ${xGroup}`);
              return;
            }
            for (const yy of yyList) {
              const y = parseInt(yy, 36);
              if (isNaN(y)) {
                console.warn(`Skipping invalid y value: ${yy}`);
                continue;
              }
              const key = `${x}/${y}/${x + 1}/${y + 1}`;
              voxelData[z][key] = {
                x,
                y,
                x2: x + 1,
                y2: y + 1,
                z,
                color,
                shape,
                rot,
                ...(shape === "cliff"
                  ? {
                      cliffVariant: cliffMeta.variant,
                      cliffBaseShape: cliffMeta.base,
                      cliffReplacedShape: cliffMeta.source,
                    }
                  : {}),
              };
            }
          });
        });
      });

      let terrainType = null;
      let terrainSoftness = null;
      let biome = null;
      const letterToTerrain = {
        F: "flat",
        H: "hilly",
        M: "mountainous",
        A: "mountainous", // legacy alpinist
      };
      const letterToSoftness = {
        L: 0.25,
        M: 0.5,
        H: 0.85,
      };
      const letterToBiome = {
        T: "temperate",
        A: "arctic",
        D: "desert",
      };

      if (dims[6]) {
        terrainType = letterToTerrain[dims[6]] || null;
      }
      if (dims[7]) {
        const legacySoft = letterToSoftness[dims[7]];
        if (legacySoft != null) terrainSoftness = legacySoft;
      }
      if (dims[8]) {
        biome = letterToBiome[dims[8]] || null;
      }

      return {
        cols,
        rows,
        depth,
        voxelData,
        rotX,
        rotY,
        terrainType,
        terrainSoftness,
        biome,
      };
    },
    encodeURL(v) {
      const shapeToLetter = {
        flat: "f",
        ramp: "r",
        wedge: "w",
        spike: "s",
        shoreline: "h",
        cliff: "l",
      };

      const compressed = v
        .map((layer, index) => {
          const z = String(index + 1).padStart(2, "0");
          const colorGroups = {};

          Object.keys(layer).forEach((key) => {
            const voxel = layer[key];
            const { x, y, color, shape, rot = 0 } = voxel;
            const yy = y.toString(36);
            const shapeLetter = shapeToLetter[shape] || "f";
            const rotCode = ((Math.round(rot / 90) % 4) + 4) % 4; // 0..3
            let shapeKey = `${shapeLetter}${rotCode}`;
            if (shape === "cliff") {
              shapeKey += encodeCliffMeta(voxel);
            }
            const colorStr = color.replace("#", "");

            if (!colorGroups[colorStr]) {
              colorGroups[colorStr] = {};
            }
            if (!colorGroups[colorStr][shapeKey]) {
              colorGroups[colorStr][shapeKey] = {};
            }
            if (!colorGroups[colorStr][shapeKey][x]) {
              colorGroups[colorStr][shapeKey][x] = [];
            }
            colorGroups[colorStr][shapeKey][x].push(yy);
          });

          if (Object.keys(colorGroups).length === 0) return null;

          const layerString = Object.entries(colorGroups)
            .sort(([colorA], [colorB]) => colorA.localeCompare(colorB))
            .map(([color, shapeMap]) => {
              return Object.entries(shapeMap)
                .sort(([shA], [shB]) => shA.localeCompare(shB))
                .map(([shapeKey, xGroups]) => {
                  const xGroupString = Object.entries(xGroups)
                    .sort(([xA], [xB]) => Number(xA) - Number(xB))
                    .map(([xx, yyList]) => {
                      const xxStr = String(xx).padStart(2, "0");
                      const sortedYY = yyList.sort().join("");
                      return `${xxStr}:${sortedYY}`;
                    })
                    .join(",");
                  return `${color},${shapeKey}:${xGroupString}`;
                })
                .join(";");
            })
            .join(";");

          return `${z}-${layerString}`;
        })
        .filter(Boolean)
        .join("|");

      const terrainToLetter = {
        flat: "F",
        hilly: "H",
        mountainous: "M",
      };
      const biomeToLetter = {
        temperate: "T",
        arctic: "A",
        desert: "D",
      };

      const terrainCode = terrainToLetter[this.$ctx.terrainType] || terrainToLetter.hilly;
      const biomeCode = biomeToLetter[this.$ctx.biome] || biomeToLetter.temperate;

      // Append dimensions, rotation, and terrain metadata
      return (
        `${compressed}@x${String(this.$ctx.cols).padStart(2, "0")}` +
        `y${String(this.$ctx.rows).padStart(2, "0")}` +
        `z${String(this.$ctx.voxels.length).padStart(2, "0")}` +
        `rX${String(Math.round(clampVerticalRotation(this.$ctx.rotX))).padStart(2, "0")}` +
        `rY${String(Math.round(this.$ctx.rotY)).padStart(2, "0")}` +
        `t${terrainCode}` +
        `b${biomeCode}`
      );
    },
    countFaces() {
      if (typeof window === "undefined") return 0;
      return document.querySelectorAll(".face").length;
    },

    handleDragOver(event) {
      event.dataTransfer.dropEffect = "copy";
    },
    showOverlay(event) {
      if (!this.$ctx.dragFile) {
        this.$ctx.dragFile = true;
      }
    },
    hideOverlay(event) {
      if (event.currentTarget === event.target) {
        this.$ctx.dragFile = false;
      }
    },
    async handleDrop(event) {
      this.$ctx.dragFile = false; // Hide the overlay when the file is dropped
      const file = event.dataTransfer.files[0]; // Get the first file
      if (!file) {
        console.error("No file dropped.");
        return;
      }

      try {
        this.$set(this.$ctx, "loading", true);

        const arrayBuffer = await file.arrayBuffer();
        const voxelData = this.parseVoxFile(arrayBuffer);
        const [maxY, maxX, maxZ] = ["y", "x", "z"].map((k) =>
          Math.max(
            ...voxelData.flatMap((layer) =>
              Object.values(layer).map((v) => v[k])
            )
          )
        );

        this.$ctx.autoZoomLocked = false;
        this.$set(this.$ctx, "cols", maxY + 1);
        this.$set(this.$ctx, "rows", maxX + 1);
        this.$set(this.$ctx, "voxels", voxelData);
        this.$set(this.$ctx, "loading", false);
        this.$ctx.fitViewportTick += 1;
        await this.$nextTick();

        const url = this.encodeURL(this.$ctx.voxels);

        if (url.length > 15) {
          history.replaceState(
            {},
            "",
            location.pathname + "#" + (await this.deflate(url))
          );
        }

        // Push the current state to the history
        this.$ctx.history.push(JSON.parse(JSON.stringify(this.$ctx.voxels)));

        // Limit the history stack to 20 states
        if (this.$ctx.history.length > 20) {
          this.$ctx.history.shift();
        }
        // Clear the redo stack since a new action occurred
        this.redoStack = [];
        //this.$set(this.$ctx, "voxels", parsedData);
      } catch (error) {
        console.error("Error handling dropped file:", error);
      }
    },
    parseVoxFile(arrayBuffer) {
      const parser = {
        buffer: arrayBuffer,
        view: new DataView(arrayBuffer),
        offset: 0,
        readString(length) {
          const chars = [];
          for (let i = 0; i < length; i++) {
            chars.push(String.fromCharCode(this.view.getUint8(this.offset++)));
          }
          return chars.join("");
        },
        readInt() {
          const value = this.view.getInt32(this.offset, true); // Little-endian
          this.offset += 4;
          return value;
        },
        toHex(value) {
          return value.toString(16).padStart(2, "0").toUpperCase(); // Convert to 2-digit uppercase hex
        },
        defaultPalette: [
          "#000000",
          "#ffffff",
          "#ffccaa",
          "#dca27d",
          "#c78564",
          "#a86955",
          "#825d4d",
          "#66473b",
          "#f77c7c",
          "#ea5545",
          "#c42d36",
          "#8a1926",
          "#741a1a",
          "#561b1b",
          "#ef8e58",
          "#dc5828",
          "#c23727",
          "#9a3324",
          "#7a2727",
          "#5a1e1e",
          "#ffec80",
          "#fcd828",
          "#f7b32c",
          "#e08e00",
          "#b57400",
          "#845600",
          "#d6f566",
          "#9ce62a",
          "#70d72c",
          "#41a937",
          "#258034",
          "#1a5a2b",
          "#68fc99",
          "#31df77",
          "#20b46a",
          "#148149",
          "#125230",
          "#0b3222",
          "#68fce8",
          "#33d9c3",
          "#28a28d",
          "#1e7464",
          "#175449",
          "#123832",
          "#50b2f6",
          "#3165cb",
          "#1f439e",
          "#202866",
          "#1a1747",
          "#0e1029",
          "#8478f6",
          "#4f49b7",
          "#3b2c96",
          "#261e76",
          "#1b1253",
          "#120e35",
          "#b47af1",
          "#8742d8",
          "#662eb4",
          "#4c248f",
          "#351b6b",
          "#26134a",
          "#ec72ec",
          "#d531b8",
          "#a52c91",
          "#7a246f",
          "#5b1c53",
          "#40143a",
          "#ff7398",
          "#fa2871",
          "#c2265f",
          "#8e1e47",
          "#6a1c3a",
          "#451427",
          "#a7a7a7",
          "#8c8c8c",
          "#767676",
          "#636363",
          "#4c4c4c",
          "#383838",
          "#d5d5d5",
          "#bbbbbb",
          "#a2a2a2",
          "#8b8b8b",
          "#757575",
          "#616161",
          "#ffffff",
          "#dedede",
          "#b3b3b3",
          "#8e8e8e",
          "#6e6e6e",
          "#555555",
          "#2d2d2d",
          "#222222",
          "#181818",
          "#101010",
          "#000000",
          "#ff4444",
          "#ff6200",
          "#ff9c00",
          "#ffd500",
          "#ffff00",
          "#b4e000",
          "#72bc00",
          "#389b00",
          "#008b00",
          "#007200",
          "#005500",
          "#003f00",
          "#00b712",
          "#00d456",
          "#00d488",
          "#00d4b0",
          "#00d4d4",
          "#00b0d4",
          "#0088d4",
          "#005ed4",
          "#003ad4",
          "#5e00d4",
          "#9600d4",
          "#b000d4",
          "#d400d4",
          "#d400b0",
          "#d40088",
          "#d4005e",
          "#d40039",
          "#d40012",
          "#d40000",
          "#ae1919",
          "#8c1e1e",
          "#6e1e1e",
          "#582020",
          "#441f1f",
          "#381717",
          "#2c1515",
          "#250e0e",
          "#200808",
          "#190404",
          "#ffccaa",
          "#dca27d",
          "#c78564",
          "#a86955",
          "#825d4d",
          "#66473b",
          "#f77c7c",
          "#ea5545",
          "#c42d36",
          "#8a1926",
          "#741a1a",
          "#561b1b",
          "#ef8e58",
          "#dc5828",
          "#c23727",
          "#9a3324",
          "#7a2727",
          "#5a1e1e",
          "#ffec80",
          "#fcd828",
          "#f7b32c",
          "#e08e00",
          "#b57400",
          "#845600",
          "#d6f566",
          "#9ce62a",
          "#70d72c",
          "#41a937",
          "#258034",
          "#1a5a2b",
          "#68fc99",
          "#31df77",
          "#20b46a",
          "#148149",
          "#125230",
          "#0b3222",
          "#68fce8",
          "#33d9c3",
          "#28a28d",
          "#1e7464",
          "#175449",
          "#123832",
          "#50b2f6",
          "#3165cb",
          "#1f439e",
          "#202866",
          "#1a1747",
          "#0e1029",
          "#8478f6",
          "#4f49b7",
          "#3b2c96",
          "#261e76",
          "#1b1253",
          "#120e35",
          "#b47af1",
          "#8742d8",
          "#662eb4",
          "#4c248f",
          "#351b6b",
          "#26134a",
          "#ec72ec",
          "#d531b8",
          "#a52c91",
          "#7a246f",
          "#5b1c53",
          "#40143a",
          "#ff7398",
          "#fa2871",
          "#c2265f",
          "#8e1e47",
          "#6a1c3a",
          "#451427",
          "#a7a7a7",
          "#8c8c8c",
          "#767676",
          "#636363",
          "#4c4c4c",
          "#383838",
          "#d5d5d5",
          "#bbbbbb",
          "#a2a2a2",
          "#8b8b8b",
          "#757575",
          "#616161",
          "#ffffff",
          "#dedede",
          "#b3b3b3",
          "#8e8e8e",
          "#6e6e6e",
          "#555555",
          "#2d2d2d",
          "#222222",
          "#181818",
          "#101010",
        ],
        parse() {
          const signature = this.readString(4); // "VOX "
          if (signature !== "VOX ") {
            throw new Error("Invalid VOX file");
          }

          const version = this.readInt(); // Version number
          const layers = [];
          const deferredVoxels = [];
          let colors = Array(256).fill("#000000"); // Default black

          while (this.offset < this.view.byteLength) {
            const chunkId = this.readString(4);
            const chunkSize = this.readInt();
            const childChunkSize = this.readInt();

            if (chunkId === "RGBA") {
              for (let i = 0; i < 256; i++) {
                const r = this.view.getUint8(this.offset++);
                const g = this.view.getUint8(this.offset++);
                const b = this.view.getUint8(this.offset++);
                this.offset++; // Skip alpha value
                colors[i] = `#${this.toHex(r)}${this.toHex(g)}${this.toHex(b)}`;
              }
            } else if (chunkId === "XYZI") {
              const numVoxels = this.readInt();
              for (let i = 0; i < numVoxels; i++) {
                const x = this.view.getUint8(this.offset++);
                const y = this.view.getUint8(this.offset++);
                const z = this.view.getUint8(this.offset++);
                const colorIndex = this.view.getUint8(this.offset++);
                deferredVoxels.push({ x, y, z, colorIndex });
              }
            } else {
              this.offset += chunkSize; // Skip unknown chunks
            }
          }

          // Fallback to the default palette if no RGBA chunk was found
          if (colors.every((c) => c === "#000000")) {
            colors = this.defaultPalette;
          }

          // Process voxels
          deferredVoxels.forEach(({ x, y, z, colorIndex }) => {
            const color = colors[colorIndex - 1] || "#000000";
            x = x + 2;
            y = y + 2;

            const x2 = x + 1;
            const y2 = y + 1;
            const voxel = {
              x,
              x2,
              y,
              y2,
              z,
              color,
              colorIndex,
              shape: "saddle",
            };

            if (!layers[z]) {
              layers[z] = {};
            }

            const key = `${x}/${y}/${x2}/${y2}`;
            layers[z][key] = voxel;
          });

          return layers;
        },
      };

      return parser.parse.call(parser);
    },
  },
};
</script>

<style lang="scss">
html {
  box-sizing: border-box;
  font-family: arial, helvetica, sans-serif;
  color: #222;
  background: #010101;
  user-select: none;
  touch-action: none;
}
body {
  min-height: calc(100vh - 0);
  max-height: calc(100vh - 0);
  overflow: hidden;
  margin: 0;
  padding: 0;
  touch-action: none;
}
*,
*:before,
*:after {
  box-sizing: inherit;
}

button,
input {
  font-size: 13px;
}
input[type="text"] {
  max-width: 30px;
  border: 0;
  padding: 0;
}

.drag-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  color: #ccc;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99999999999;
  svg {
    width: 100px;
    height: auto;
    fill: #ccc;
  }
  .dragoutline {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
    font-size: 24px;
  }
}

p,
ul,
h1,
h2 {
  margin: 0;
}

h1 {
  font-family: "VT323", monospace;
  font-size: 36px;
  font-weight: normal;
  min-width: max-content;
  color: #fff;
}

hr {
  border: 0;
  border-top: 0.5px solid #444;
  width: 100%;
}

button a {
  text-decoration: none;
  color: #eee;
}
</style>
