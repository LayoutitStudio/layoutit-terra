<template>
  <div class="toolbar-sidebar" v-if="$ctx.leftPanel">
    <div style="display: flex; gap: 6px; background: transparent">
      <div>
        <div class="reribbon-tools remagic tool-selector">
          <button
            v-for="mode in terrainModes"
            @click="selectTerrainMode(mode.value)"
            :class="{ active: mode.value === $ctx.terrainMode }"
            :style="{ display: 'flex', flexDirection: 'column' }"
            :key="`terrain-${mode.value}`"
          >
            <component v-if="mode.icon" :is="`icons-${mode.icon}`" />
            <img
              v-else-if="mode.iconSrc"
              :src="mode.iconSrc"
              :alt="`${mode.label} icon`"
            />
            <span>{{ mode.label }}</span>
          </button>
        </div>
      </div>
      <div>
        <div class="code-sidebar">
          <template>
            <div class="magic-controller" v-if="$ctx.activeConfig === 'grid'">
              <div class="control-group">
                <label>map size</label>
                <div class="grid-inputs" style="display: flex">
                  <input
                    type="number"
                    v-model.number="$ctx.cols"
                    min="4"
                    max="32"
                    step="1"
                    @input="handleGridSizeInput"
                  />
                  <b>✕</b>

                  <input
                    type="number"
                    v-model.number="$ctx.rows"
                    min="4"
                    max="32"
                    step="1"
                    @input="handleGridSizeInput"
                  />
                </div>
              </div>

              <div class="control-row">
                <div class="control-group">
                  <label>islands</label>
                  <select
                    v-model="$ctx.islandCount"
                    @change="handleIslandCountChange"
                  >
                    <option
                      v-for="option in islandCountOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </div>
                <div class="control-group" style="flex: 2">
                  <label>landmass</label>
                  <select
                    v-model="$ctx.islandSize"
                    @change="handleIslandSizeInput"
                  >
                    <option
                      v-for="option in islandOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="control-group">
                <label>biome</label>
                <div class="biome-selector">
                  <button
                    v-for="option in biomeOptions"
                    :key="option.value"
                    type="button"
                    class="biome-option"
                    :class="{ active: option.value === $ctx.biome }"
                    :aria-pressed="option.value === $ctx.biome"
                    @click="selectBiome(option.value)"
                  >
                    <img
                      :src="resolveBiomeImage(option.value)"
                      :alt="`${option.label} biome preview`"
                    />
                    <span>{{ option.label }}</span>
                  </button>
                </div>
              </div>
              <div class="control-group">
                <label>terrain</label>
                <!-- select: Flat, Hilly, Montanious, Alpinist -->
                <select
                  v-model="$ctx.terrainType"
                  @change="handleTerrainTypeChange"
                >
                  <option
                    v-for="option in terrainOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </div>
              <div class="control-group">
                <label>features</label>
                <div class="feature-checkboxes">
                  <label
                    v-for="option in terrainFeatureOptions"
                    :key="option.key"
                    class="feature-checkbox"
                  >
                    <input
                      type="checkbox"
                      v-model="terrainFeatures[option.key]"
                    />
                    {{ option.label }}
                  </label>
                </div>
              </div>
              <div class="button-row">
                <button
                  type="button"
                  class="regen-button"
                  @click="handleRegenerateClick"
                >
                  Regenerate
                </button>
              </div>
            </div>
            <div
              class="magic-controller camera"
              v-if="$ctx.activeConfig === 'camera'"
            >
              <div class="control-group">
                <label>pan & tilt</label>
                <div class="halfrange">
                  <input
                    type="range"
                    id="panRange"
                    min="-500"
                    max="500"
                    step="10"
                    v-model="$ctx.pan"
                  />
                  <input
                    type="range"
                    id="tiltRange"
                    min="-500"
                    max="500"
                    step="10"
                    v-model="$ctx.tilt"
                  />
                </div>
              </div>

              <div class="button-row">
                <button class="regen-button" @click="resetCamera()">
                  Reset Camera
                </button>
              </div>
            </div>
            <div class="magic-controller" v-if="$ctx.activeConfig === 'config'">
              <div class="checkboxers">
                <div>
                  <label
                    ><input type="checkbox" v-model="$ctx.hideGrid" />
                    transparent grid</label
                  >
                </div>

                <div>
                  <label
                    ><input type="checkbox" v-model="$ctx.showWalls" /> show
                    walls</label
                  >
                </div>
                <div>
                  <label>
                    <input
                      type="checkbox"
                      v-model="$ctx.invert"
                      :true-value="-1"
                      :false-value="1"
                    />
                    invert controls</label
                  >
                </div>
                <div>
                  <label
                    title="Coming soon!"
                    style="
                      pointer-events: none;
                      opacity: 0.4;
                      cursor: not-allowed !important;
                    "
                    ><input type="checkbox" /> merge cells</label
                  >
                </div>
              </div>
            </div>
            <div
              class="magic-controller"
              v-if="$ctx.activeConfig === 'about'"
            ></div>
            <div class="magic-controller" v-if="$ctx.activeConfig === 'about'">
              <p style="padding-bottom: 10px">
                Layoutit Voxel editor leverages Vue.js, HTML and CSS 3D
                transforms as a rendering engine.
              </p>

              <p>
                contact:
                <a href="mailto:minotopo@gmail.com">minotopo@gmail.com</a>
              </p>
              <p>
                code:
                <a href="https://github.com/LayoutitStudio"
                  >github.com/LayoutitStudio</a
                >
              </p>
            </div>
          </template>
        </div>
      </div>
    </div>
    <div v-if="$ctx.activeConfig === 'camera'" class="camera-rotation">
      <label for="cameraRotateRange">Rotation</label>
      <input
        type="range"
        id="cameraRotateRange"
        min="0"
        max="360"
        step="5"
        v-model.number="$ctx.rotY"
      />
    </div>
    <div
      class="minimap"
      :class="{ 'minimap--camera': $ctx.activeConfig === 'camera' }"
    >
      <canvas ref="minimapCanvas" class="minimap__canvas"></canvas>
    </div>
  </div>
</template>
<script>
import generateTerrain from "~/utils/generateTerrain";
import { clampVerticalRotation } from "~/utils/camera";

export default {
  data() {
    return {
      retools: ["add", "fill", "paint", "erase"],
      exporttools: ["web", "csv", "json", "export"],
      bottomtools: ["grid", "camera", "config", "about"],
      terrainModes: [
        { value: "move", label: "move", iconSrc: "/move.png" },
        { value: "raise", label: "raise", iconSrc: "/raise.png" },
        { value: "lower", label: "lower", iconSrc: "/lower.png" },
        { value: "equalize", label: "equal", iconSrc: "/equalize.png" },
      ],
      terrainOptions: [
        { value: "flat", label: "flatlands" },
        { value: "hilly", label: "hills" },
        { value: "mountainous", label: "mountains" },
      ],
      islandOptions: [
        { value: "small", label: "small" },
        { value: "medium", label: "medium" },
        { value: "large", label: "large" },
      ],
      biomeOptions: [
        { value: "temperate", label: "temperate" },
        { value: "arctic", label: "arctic" },
        { value: "desert", label: "desert" },
      ],
      terrainFeatureOptions: [
        { key: "rivers", label: "include rivers" },
        { key: "lakes", label: "include lakes" },
        { key: "forests", label: "add forests" },
        { key: "snowcaps", label: "enable snowcaps" },
        { key: "ruins", label: "scatter ruins" },
      ],
      terrainFeatures: {
        rivers: true,
        lakes: true,
        forests: false,
        snowcaps: false,
        ruins: false,
      },
      islandCountOptions: [
        { value: "one", label: "one" },
        { value: "two", label: "two" },
        { value: "many", label: "many" },
      ],
      adScriptLoaded: false,
      minimapFrame: null,
      lastCols: null,
      lastRows: null,
      lastIslandSize: null,
    };
  },
  watch: {
    "$ctx.voxels": {
      handler() {
        this.scheduleMinimapRender();
      },
      deep: true,
    },
    "$ctx.cols"(value) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        this.lastCols = numeric;
      }
      this.scheduleMinimapRender();
    },
    "$ctx.rows"(value) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        this.lastRows = numeric;
      }
      this.scheduleMinimapRender();
    },
    "$ctx.islandSize"(value) {
      if (!value) return;
      const numeric = this.resolveIslandValue(value);
      this.lastIslandSize = value;
      if (Number.isFinite(numeric) && this.$ctx.radiusFactor !== numeric) {
        this.$set(this.$ctx, "radiusFactor", numeric);
      }
    },
    "$ctx.rotY"() {
      this.scheduleMinimapRender();
    },
    "$ctx.zoom"() {
      this.scheduleMinimapRender();
    },
  },
  mounted() {
    if (
      process.env.NODE_ENV === "production" &&
      typeof window !== "undefined"
    ) {
      const script = document.createElement("script");
      script.async = true;
      script.type = "text/javascript";
      script.src =
        "//cdn.carbonads.com/carbon.js?serve=CW7IT5QY&placement=layoutitcom&format=responsive";
      script.id = "_carbonads_js";

      script.onload = () => {
        this.adScriptLoaded = true;
      };

      this.$refs.carbonAds.appendChild(script);
    }

    this.scheduleMinimapRender();
    this.lastCols = Number(this.$ctx.cols) || 32;
    this.lastRows = Number(this.$ctx.rows) || 32;
    const defaultIslandKey = this.$ctx.islandSize || "medium";
    const normalizedIsland = this.resolveIslandValue(defaultIslandKey);
    this.lastIslandSize = defaultIslandKey;
    this.$set(this.$ctx, "islandSize", defaultIslandKey);
    if (Number.isFinite(normalizedIsland)) {
      this.$set(this.$ctx, "radiusFactor", normalizedIsland);
    }
    if (!this.$ctx.islandCount) {
      this.$set(this.$ctx, "islandCount", "one");
    }
    if (!this.$ctx.biome) {
      this.$set(this.$ctx, "biome", "temperate");
    }
  },
  beforeDestroy() {
    if (this.minimapFrame) {
      cancelAnimationFrame(this.minimapFrame);
      this.minimapFrame = null;
    }
  },

  methods: {
    resolveIslandValue(key) {
      const lookup = {
        small: 0.24,
        medium: 0.54,
        large: 0.72,
      };
      if (key && lookup[key] != null) return lookup[key];
      return lookup.medium;
    },
    normalizeDimension(value, fallback) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        return Number.isFinite(fallback) ? fallback : 16;
      }
      const clamped = Math.min(32, Math.max(4, Math.round(parsed)));
      return clamped;
    },
    handleIslandSizeInput() {
      const key = this.$ctx.islandSize || "medium";
      const radius = this.resolveIslandValue(key);
      this.lastIslandSize = key;
      this.$set(this.$ctx, "islandSize", key);
      this.$set(this.$ctx, "radiusFactor", radius);
      this.regenerateTerrain();
    },
    handleIslandCountChange() {
      const validValues = this.islandCountOptions.map((option) => option.value);
      if (!validValues.includes(this.$ctx.islandCount)) {
        this.$set(this.$ctx, "islandCount", "one");
      }
      this.regenerateTerrain();
    },
    handleGridSizeInput() {
      const nextCols = this.normalizeDimension(this.$ctx.cols, this.lastCols);
      const nextRows = this.normalizeDimension(this.$ctx.rows, this.lastRows);
      const hasDiff = nextCols !== this.lastCols || nextRows !== this.lastRows;
      if (!hasDiff) return;
      this.$set(this.$ctx, "cols", nextCols);
      this.$set(this.$ctx, "rows", nextRows);
      this.lastCols = nextCols;
      this.lastRows = nextRows;
      this.regenerateTerrain();
    },
    applyTerrainPreset(type, { regenerate = true } = {}) {
      const normalizedType = type === "alpinist" ? "mountainous" : type;
      const presets = {
        flat: { mountain: 0.08, softness: 0.96 },
        hilly: { mountain: 0.38, softness: 0.6 },
        mountainous: { mountain: 0.82, softness: 0.22 },
      };
      const preset = presets[normalizedType] ?? presets.hilly;
      this.$ctx.terrainType = normalizedType;
      this.$ctx.mountainousness = preset.mountain;
      this.$ctx.mountain = preset.mountain;
      this.$ctx.terrainSoftness = preset.softness;
      if (regenerate) {
        this.regenerateTerrain();
      }
    },
    handleTerrainTypeChange() {
      this.applyTerrainPreset(this.$ctx.terrainType);
    },
    handleBiomeChange() {
      const validValues = this.biomeOptions.map((option) => option.value);
      if (!validValues.includes(this.$ctx.biome)) {
        this.$set(this.$ctx, "biome", "temperate");
      }
      this.$ctx.renderNonce += 1;
    },
    selectBiome(value) {
      if (!value || value === this.$ctx.biome) return;
      this.$set(this.$ctx, "biome", value);
      this.handleBiomeChange();
    },
    resolveBiomeImage(value) {
      const lookup = {
        temperate: "/temperate.png",
        arctic: "/arctic.png",
        desert: "/desert.png",
      };
      return lookup[value] || lookup.temperate;
    },
    selectTerrainMode(mode) {
      this.$ctx.terrainMode = mode;
    },
    handleRegenerateClick() {
      this.regenerateTerrain();
      this.resetCamera();
    },
    regenerateTerrain() {
      generateTerrain(this.$ctx);
      this.$ctx.renderNonce += 1;
      this.$ctx.fitViewportTick += 1;
      this.$ctx.autoZoomLocked = false;
      this.scheduleMinimapRender();
    },
    resetCamera() {
      this.$ctx.zoom = 0.5;
      this.$ctx.rotX = clampVerticalRotation(60);
      this.$ctx.rotY = 45;
      this.$ctx.pan = 0;
      this.$ctx.tilt = 0;
      this.$ctx.autoZoomLocked = false;
      this.$ctx.fitViewportTick += 1;
    },
    scheduleMinimapRender() {
      if (this.minimapFrame && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this.minimapFrame);
      }

      if (typeof requestAnimationFrame !== "function") {
        this.drawMinimap();
        return;
      }

      this.minimapFrame = requestAnimationFrame(() => {
        this.minimapFrame = null;
        this.drawMinimap();
      });
    },
    drawMinimap() {
      const canvas = this.$refs.minimapCanvas;
      if (!canvas) return;

      const rows = Number(this.$ctx.rows) || 0;
      const cols = Number(this.$ctx.cols) || 0;
      if (!rows || !cols) return;

      const targetSize = 240;
      const basePadding = 3;
      const waterPadding = basePadding;
      const diagonal = Math.ceil(Math.sqrt(rows * rows + cols * cols));
      const frameCols = Math.max(cols, diagonal) + waterPadding * 1;
      const frameRows = Math.max(rows, diagonal) + waterPadding * 1;
      const frameMax = Math.max(frameCols, frameRows);
      const cellSize = Math.max(2, Math.floor(targetSize / (frameMax || 1)));
      const width = Math.max(1, frameCols * cellSize);
      const height = Math.max(1, frameRows * cellSize);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#2c6db0";
      ctx.fillRect(0, 0, width, height);

      const { topCells, heightMap, maxHeight } = this.computeTopCells(
        rows,
        cols
      );

      const offsetX = (width - cols * cellSize) / 2;
      const offsetY = (height - rows * cellSize) / 2;

      const angleDeg = Number(this.$ctx.rotY) || 0;
      const angleRad = (angleDeg * Math.PI) / 180;
      ctx.save();
      ctx.translate(width / 2, height / 2);
      //ctx.scale(zoomScale, zoomScale);
      ctx.rotate(angleRad);
      ctx.translate(-width / 2, -height / 2);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const voxel = topCells[row][col];
          if (!voxel) continue;

          const x = offsetX + col * cellSize;
          const y = offsetY + row * cellSize;
          const color = this.resolveVoxelColor(voxel);
          const shade = this.computeShade(heightMap[row][col], maxHeight);

          ctx.fillStyle = color;
          ctx.fillRect(x, y, cellSize, cellSize);
          if (shade) {
            ctx.fillStyle = shade;
            ctx.fillRect(x, y, cellSize, cellSize);
          }
        }
      }

      ctx.restore();

      const zoomMin = 0.25;
      const zoomMax = 10;
      const clampZoom = (value) =>
        Math.min(zoomMax, Math.max(zoomMin, Number(value) || zoomMin));
      const zoomValue = clampZoom(this.$ctx.zoom);
      const zoomRatio = 1 - (zoomValue - zoomMin) / (zoomMax - zoomMin);
      const easedRatio = Math.max(0.1, Math.min(1, Math.pow(zoomRatio, 5)));

      ctx.save();

      const innerWidth = width * easedRatio;
      const innerHeight = height * easedRatio;
      const innerX = (width - innerWidth) / 2;
      const innerY = (height - innerHeight) / 2;

      ctx.fillStyle = "rgba(76, 142, 247, 0.15)";
      ctx.fillRect(innerX, innerY, innerWidth, innerHeight);
      ctx.strokeStyle = "rgba(76, 142, 247, 0.9)";
      ctx.lineWidth = 1.4;
      ctx.strokeRect(innerX, innerY, innerWidth, innerHeight);

      ctx.restore();
    },
    computeTopCells(rows, cols) {
      const topCells = Array.from({ length: rows }, () =>
        Array(cols).fill(null)
      );
      const heightMap = Array.from({ length: rows }, () =>
        Array(cols).fill(-1)
      );
      let maxHeight = 0;

      const layers = this.$ctx.voxels || [];
      layers.forEach((layer, layerIndex) => {
        if (!layer) return;
        Object.values(layer).forEach((voxel) => {
          if (!voxel) return;
          const xStart = Math.max(1, Number(voxel.x) || 0);
          const yStart = Math.max(1, Number(voxel.y) || 0);
          const xEnd = Math.max(xStart, Number(voxel.x2) || xStart + 1);
          const yEnd = Math.max(yStart, Number(voxel.y2) || yStart + 1);

          for (let x = xStart; x < xEnd; x++) {
            if (x < 1 || x > rows) continue;
            for (let y = yStart; y < yEnd; y++) {
              if (y < 1 || y > cols) continue;
              if (layerIndex >= heightMap[x - 1][y - 1]) {
                heightMap[x - 1][y - 1] = layerIndex;
                topCells[x - 1][y - 1] = voxel;
              }
              if (layerIndex > maxHeight) maxHeight = layerIndex;
            }
          }
        });
      });

      return { topCells, heightMap, maxHeight };
    },
    resolveVoxelColor(voxel) {
      if (!voxel) return "#2f4b77";
      if (voxel.shape === "shoreline") return "#FFDA66";
      const hash = Math.abs((voxel.x * 73856093) ^ (voxel.y * 19349663));
      const variation = (hash % 20) - 10; // -10..9
      const adjust = (value) => Math.max(0, Math.min(255, value + variation));
      const r = adjust(0x4c);
      const g = adjust(0x8a);
      const b = adjust(0x3a);
      return `#${[r, g, b]
        .map((component) => component.toString(16).padStart(2, "0"))
        .join("")}`;
    },
    computeShade(layerIndex, maxHeight) {
      if (!(layerIndex > 0 && maxHeight > 0)) return "";
      const ratio = layerIndex / maxHeight;
      const eased = Math.pow(ratio, 0.85);
      const shadow = 0.08 + eased * 0.18;
      return `rgba(0, 0, 0, ${Math.min(0.28, shadow)})`;
    },
    updateVoxelLayers(newDepth) {
      newDepth = parseInt(newDepth, 10);
      const currentDepth = this.$ctx.voxels.length;

      if (newDepth > currentDepth) {
        for (let i = currentDepth; i < newDepth; i++) {
          this.$ctx.voxels.push({});
        }
      } else if (newDepth < currentDepth) {
        this.$ctx.voxels.splice(newDepth);
      }
    },
    handleRefresh() {
      this.$set(this.$ctx, "voxels", {});
      this.scale = 0.8;
      this.$ctx.walls.bl = true;
      this.$ctx.walls.br = true;
      this.$ctx.walls.fl = false;
      this.$ctx.walls.fr = false;
      this.$ctx.rotX = clampVerticalRotation(65);
      this.$ctx.rotY = 45;
      window.history.replaceState(null, "", "/");
      this.$ctx.autoZoomLocked = false;
      this.$ctx.fitViewportTick += 1;
    },
    handleColor(color, i) {
      this.$ctx.activeColor = color;
    },
    handleTexture(texture, i) {
      this.$ctx.activeColor = texture;
    },
    rotateSelected() {
      const next = (this.$ctx.activeRotation + 90) % 360;
      this.$ctx.activeRotation = next;
    },
  },
};
</script>
<style lang="scss">
.toolbar-sidebar {
  max-width: 300px;
  min-width: 300px;
  flex: 1;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 6px;
  overflow: hidden;
  position: absolute;
  top: 55px;
  left: 6px;
  bottom: 6px;
  pointer-events: none;
  > * {
    //flex: 1;
    display: flex;
    flex-direction: column;
    background: #222222;
    border-radius: 6px;
    pointer-events: all;
  }
}

.activepanel {
  color: #ccc;
  background: #222;
  border-radius: 6px;
  display: flex;
  gap: 6px;
  flex-direction: column;
  font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
  font-size: 13px;
  z-index: 9999;
  padding-bottom: 5px;
  border-top-right-radius: 0;
  border-top-left-radius: 0;

  > div {
    display: flex;
    gap: 6px;
    flex-direction: column;
  }

  input[type="number"] {
    background: transparent;
    border: 0.5px solid #888;
    max-width: 40px;
    color: #ddd;
    font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
    font-size: 13px;
  }
}

.shapeshifter {
  margin-top: 3px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  div {
    flex: 1;

    padding: 4px 6px;
    border-radius: 4px;
    color: #aaa;
    cursor: pointer;
    text-align: center;
    &:first-child {
      margin: 0;
      color: #ccc;
      padding: 4px 0;
      margin-right: 4px;
      &:hover {
        background: transparent;
        color: #ccc;
      }
    }
    &:hover {
      background: #333;
      color: #eee;
    }
    &.active {
      background: #01579b;
      color: #eee;
    }
  }
}

.reribbon-tools {
  display: flex;

  background: #2a2a2a;
  border-radius: 6px;

  padding: 0;
  align-items: center;
  height: 60px;
  button {
    min-width: 75px;
  }
  &.remagic {
    flex-direction: row;
    top: 55px;
    width: auto;
    button {
      min-width: 75px;
    }
  }
  &.newribbontools {
    background: #222;
    border-radius: 6px;
    border-bottom-right-radius: 0;
    border-bottom-left-radius: 0;
    display: flex;
    button {
      min-width: 80px;
    }
  }
  div {
    color: #666;
  }

  button {
    color: #aaa;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    position: relative;
    font-size: 12px;
    font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
    gap: 2px;
    flex-direction: column;
    svg,
    span,
    img {
      z-index: 9;
    }
    img {
      width: 24px;
      height: 24px;
      object-fit: contain;
      margin-bottom: 3px;
      opacity: 0.6;
    }
    &:hover,
    &.active {
      color: #fff;
      img {
        opacity: 1;
      }
    }
    &:hover svg,
    &.active svg {
      fill: #fff;
    }
    &:hover img,
    &.active img {
      filter: brightness(1.1);
    }
    &:hover:before {
      content: "";
      background: #222;
      position: absolute;
      inset: 5px;
      left: 3px;
      right: 3px;

      border-radius: 6px;
    }

    &.active:before {
      content: "";
      background: #01579b;
      position: absolute;
      inset: 5px;
      left: 3px;
      right: 3px;

      border-radius: 6px;
    }

    &.deleterefresh:hover:before {
      content: "";
      background: #c2185b;
      position: absolute;
      inset: 5px;

      border-radius: 6px;
    }
  }

  svg {
    width: 18px;
    fill: #aaa;
  }
}

.rotation-compact {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}
.rotation-compact .rot-btn {
  color: #ddd;
  background: #2a2a2a;
  border-radius: 6px;
  padding: 8px 12px;
  font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
  font-size: 12px;
  border: 1px solid #333;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.rotation-compact .rot-btn:hover {
  background: #333;
}

.color-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  max-height: 135px;
  overflow: auto;
  .color-box {
    position: relative;
    background-size: cover;
    img {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: -1;
    }
  }
  img,
  svg,
  div {
    width: 30px;
    height: 30px;
    border: 0.5px solid #555;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0.8;
    &.active,
    &:hover {
      border: 0.5px solid #555;
      opacity: 1;
    }

    &.active:after {
      content: "✓";
      font-size: 20px;
      text-shadow: 0px 0px 1px #000;
      color: #fff;
      outline: 2px solid #212121;
      outline-offset: -2px;
      position: absolute;
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      display: flex;
      justify-content: center;
    }
    &[data-color="c0cbdc"].active:after,
    &[data-color="ead4aa"].active:after,
    &[data-color="fee761"].active:after,
    &[data-color="ffffff"].active:after {
      color: #222;
    }
  }
  img,
  svg {
    border: 0;
  }
}

select {
  background-color: transparent;
  color: #aaa;
  cursor: pointer;
  font-size: 13px;
  text-shadow: none;
  font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
  border: 0.5px solid #555;
}

.code-sidebar {
  z-index: 99;
  padding: 10px;
  padding-top: 8px;
  color: #ddd;
  background: #222;
  border-radius: 6px;

  overflow: auto;
}

.magic-controller .control-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.magic-controller .control-row {
  display: flex;
  gap: 10px;
  margin-bottom: 8px;
}

.magic-controller .control-row .control-group {
  flex: 1;
  margin-bottom: 0;
}

.magic-controller .control-group select,
.magic-controller .control-group input[type="number"],
.magic-controller .control-group input[type="range"] {
  background-color: #1b1b1b;
  border: 1px solid #333;
  color: #e0e0e0;
  border-radius: 4px;
  padding: 4px 6px;
  font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
  font-size: 12px;
}

.magic-controller .control-group .biome-selector {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}

.magic-controller .control-group .feature-checkboxes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 6px;
}

.magic-controller .control-group .feature-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #c0c0c0;
  font-size: 12px;
  text-transform: none;
}

.magic-controller .control-group .feature-checkbox input[type="checkbox"] {
  accent-color: #4a90e2;
}

.magic-controller .control-group .biome-option {
  background-color: #1b1b1b;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 10px 2px;
  color: #c8c8c8;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
  font-size: 12px;

  flex: 1;
}

.magic-controller .control-group .biome-option img {
  border-radius: 4px;
  background: #121212;
  opacity: 0.6;
}

.magic-controller .control-group .biome-option:hover {
  border-color: #888;
  color: #f0f0f0;
}

.magic-controller .control-group .biome-option:focus-visible {
  outline: 2px solid #888;
}

.magic-controller .control-group .biome-option.active {
  border-color: #888;
  color: #fff;
  img {
    opacity: 1;
  }
}

.magic-controller .control-group input[type="range"] {
  padding: 0;
  height: 4px;
}

.magic-controller .control-group .grid-inputs {
  display: flex;
  gap: 10px;
  max-width: 75%;
  justify-content: center;
  align-items: center;
  > * {
    flex: 5;
  }
  b {
    color: #888;
    font-size: 11px;
    text-align: center;
    flex: 1;
  }
}

.magic-controller .halfrange {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.button-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 2px;
}

.regen-button {
  background: #1a7f37;
  border: none;
  border-radius: 6px;
  padding: 10px 15px;
  font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
  font-size: 13px;
  color: #fff;
  cursor: pointer;
  transition: background-color 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: max-content;
}

.regen-button:hover {
  background: #186e31;
}

.magic-controller {
  z-index: 999;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  position: relative;
  margin-top: 0;
  gap: 8px;
  a {
    color: #888;
    &:hover {
      color: #eee;
    }
  }
  hr {
    margin: 8px 0;
  }
  > p {
    color: #888;
    font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
    font-size: 13px;
    margin: 0;
    line-height: 19px;
    padding-right: 10px;
  }

  label[for=""] {
    display: inline-block;
  }
}

label {
  color: #888;
  font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
  font-size: 13px;
}

.magic-controller > div.checkboxers {
  flex-direction: column;
  height: auto;
  align-items: initial;
  padding-top: 5px;
  label {
    display: flex;
    cursor: pointer;
    gap: 6px;
    align-items: center;
  }
}

#carbon-responsive {
  gap: 0 !important;
}
#carbon-responsive .carbon-responsive-wrap {
  background: none !important;
  border: 0 !important;
  gap: 6px !important;
  padding: 10px 12px 0 8px !important;
  a {
    color: #bbb !important;
    font-size: 12px !important;
    font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace !important;
    position: relative !important;
    overflow: auto !important;
    max-height: 120px !important;
    display: block !important;
  }
  .carbon-text {
    line-height: 18px !important;
    text-overflow: ellipsis !important;
    padding-top: 4px !important;
  }
  .carbon-img {
    max-width: 110px !important;
    height: auto !important;
    border-radius: 6px !important;
  }

  img {
    border-radius: 6px !important;
    max-width: 105px !important;
    width: 100% !important;
    height: auto !important;
    padding-left: 1px !important;
    padding-right: 1px !important;
    flex: 0 !important;
  }
}
a.carbon-poweredby {
  color: #ddd !important;
  text-align: left !important;
  padding-left: 12px !important;
  position: absolute !important;
  bottom: 5px;
}

.halfrange {
  input[type="range"] {
    min-width: auto !important;
    max-width: 92px !important;
  }
}

.camera-rotation {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #aeb5bd;
}

.camera-rotation input[type="range"] {
  flex: 1;
  min-width: 0;
}

.minimap {
  max-height: 220px;
  max-width: 220px;
  flex: 1;
  border: 2px solid #222;
  background: #1f2330;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 2px;
  border-radius: 6px;
  position: relative;
  overflow: hidden;
}

.minimap__canvas {
  width: 100%;
  height: auto;
  display: block;
  image-rendering: pixelated;
  border-radius: 4px;
}
</style>
