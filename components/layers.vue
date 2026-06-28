<template>
  <div style="display: contents">
    <div
      class="z"
      v-for="(layer, i) in $ctx.voxels"
      :key="`layer-${i}`"
      :style="{
        gridTemplateColumns: `repeat(${$ctx.cols}, 50px)`,
        gridTemplateRows: `repeat(${$ctx.rows}, 50px)`,
        transform: `translateZ(${i * 25}px)`,
      }"
    >
      <!-- Voxels -->
      <component
        v-for="v in layer"
        :is="v.shape"
        :key="`${v.x}-${v.y}-${v.x2}-${v.y2}-${v.z}`"
        :x="+v.x"
        :x2="+v.x2"
        :y="+v.y"
        :y2="+v.y2"
        :z="+v.z"
        :color="v.color"
        :texture="v.texture"
        :rot="+(v.rot || 0)"
        :tree-class="v.shape === 'flat' ? v.treeClass : undefined"
        :cliff-variant="v.shape === 'cliff' ? v.cliffVariant : undefined"
        :cliff-base="v.shape === 'cliff' ? v.cliffBaseShape : undefined"
        :cliff-source="v.shape === 'cliff' ? v.cliffReplacedShape : undefined"
        :data-x="v.x"
        :data-y="v.y"
        :data-x2="v.x2"
        :data-y2="v.y2"
        :data-z="v.z"
        @mousedown="onVoxelMouseDown(v, i, $event)"
        @mouseover="act($event)"
        @mouseup="$ctx.drag = false"
      />
      <!-- Grid cells -->
      <template v-if="i === 0">
        <i
          v-for="cellIndex in $ctx.cols * $ctx.rows"
          :key="`cell-${cellIndex}`"
          :test="cellIndex % $ctx.cols || $ctx.cols"
          v-bind="{
            'data-y': cellIndex % $ctx.cols || $ctx.cols,
            'data-y2': (cellIndex % $ctx.cols) + 1 || $ctx.cols + 1,
            'data-x': Math.ceil(cellIndex / $ctx.cols),
            'data-x2': Math.ceil(cellIndex / $ctx.cols) + 1,
            'data-z': 0,
          }"
          @mousedown="handleCellMouseDown(cellIndex, $event)"
          @mouseover="handleCellMouseOver(cellIndex, $event)"
          @mousemove="handleCellMouseMove(cellIndex, $event)"
          @mouseleave="handleCellMouseLeave()"
          @mouseup="($ctx.drag = false), updateOutputs()"
        >
          <div
            class="cardinal-container"
            v-if="hoveredCell === cellIndex && isTerrainModificationMode()"
          >
            <div class="topleft"></div>
            <div class="topright"></div>
            <div class="backleft"></div>
            <div class="backright"></div>
          </div>
        </i>
      </template>
    </div>
  </div>
</template>

<script>
import { ensureShorelineTiles } from "~/utils/shoreline";
import {
  buildMaskForLevel,
  classifyTerrainMask,
  cleanupStackedSlopes,
  maskHasFilledCell,
} from "~/utils/terrainMask";

export default {
  name: "layers",
  data() {
    return {
      hoveredCell: null,
    };
  },
  watch: {
    "$ctx.drag"(v) {
      this.$ctx.cache = v
        ? new Set(
            this.$ctx.voxels.flatMap((l, z) =>
              Object.keys(l).map((k) => `${z}/${k}`)
            )
          )
        : null;
    },
    "$ctx.voxels"() {
      this.$nextTick(() => {
        this.decorateCurrentTerrain();
      });
    },
  },

  mounted() {
    this.$nextTick(() => {
      this.decorateCurrentTerrain();
    });
  },

  methods: {
    updateOutputs() {
      this.$ctx.hoveredArea = "";
    },
    isValid(x, y, x2, y2, z) {
      return (
        y >= 1 &&
        y <= this.$ctx.cols &&
        x >= 1 &&
        x <= this.$ctx.rows &&
        !this.$ctx.voxels[z][`${x}/${y}/${x2}/${y2}`]
      );
    },
    isWithinBounds(x, y, x2, y2) {
      return y >= 1 && y <= this.$ctx.cols && x >= 1 && x <= this.$ctx.rows;
    },
    metaKey(level, x, y) {
      return `${level}|${x}|${y}`;
    },
    resolveCellPosition(index) {
      const cols = Number(this.$ctx.cols) || 0;
      if (!cols) return { row: 0, col: 0 };
      const row = Math.ceil(index / cols);
      const col = index % cols || cols;
      return { row, col };
    },
    resolveCornerFromEvent(event) {
      const corners = ["topleft", "topright", "backleft", "backright"];
      const target = event?.target;
      if (!target) return null;
      for (const corner of corners) {
        if (target.classList?.contains(corner)) return corner;
        if (
          typeof target.closest === "function" &&
          target.closest(`.${corner}`)
        ) {
          return corner;
        }
      }
      return null;
    },
    collectIntersectionTargets(row, col, corner) {
      const offsets = {
        topleft: [
          [0, 0],
          [-1, 0],
          [0, -1],
          [-1, -1],
        ],
        topright: [
          [0, 0],
          [-1, 0],
          [0, 1],
          [-1, 1],
        ],
        backleft: [
          [0, 0],
          [1, 0],
          [0, -1],
          [1, -1],
        ],
        backright: [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ],
      };
      const deltas = offsets[corner] || [[0, 0]];
      return deltas.map(([dx, dy]) => [row + dx, col + dy]);
    },
    mutateRaise(state, row, col) {
      const { heights, metadata, rows, cols } = state;
      if (row < 1 || col < 1 || row > rows || col > cols) return false;
      const xi = row - 1;
      const yi = col - 1;
      const currentHeight = heights[xi][yi];
      const newHeight = currentHeight + 1;
      heights[xi][yi] = newHeight;
      if (currentHeight < 0) {
        this.setMetadata(metadata, 0, row, col, {
          color: this.$ctx.activeColor,
        });
      }
      const inherited =
        currentHeight >= 0
          ? this.getMetadata(metadata, currentHeight, row, col)
          : null;
      this.setMetadata(metadata, newHeight, row, col, {
        color: this.$ctx.activeColor,
        texture: inherited?.texture,
      });
      return true;
    },
    mutateLower(state, row, col) {
      const { heights, metadata, rows, cols } = state;
      if (row < 1 || col < 1 || row > rows || col > cols) return false;
      const xi = row - 1;
      const yi = col - 1;
      const currentHeight = heights[xi][yi];
      if (currentHeight < 0) return false;
      const newHeight = currentHeight - 1;
      heights[xi][yi] = newHeight;
      for (let level = currentHeight; level > newHeight; level--) {
        if (level < 0) break;
        this.deleteMetadata(metadata, level, row, col);
      }
      if (newHeight < 0) {
        this.deleteMetadata(metadata, 0, row, col);
      }
      return true;
    },
    mutateEqualize(state, row, col) {
      const { heights, metadata, rows, cols } = state;
      if (row < 1 || col < 1 || row > rows || col > cols) return false;
      const xi = row - 1;
      const yi = col - 1;
      const currentHeight = heights[xi][yi];
      const fallback =
        currentHeight >= 0
          ? this.getMetadata(metadata, currentHeight, row, col)
          : null;
      const targetHeight = 0;
      heights[xi][yi] = targetHeight;
      if (currentHeight > targetHeight) {
        for (let level = currentHeight; level > targetHeight; level--) {
          this.deleteMetadata(metadata, level, row, col);
        }
      }
      const baseMeta = this.getMetadata(metadata, 0, row, col);
      const baseColor =
        baseMeta?.color ?? fallback?.color ?? this.$ctx.activeColor;
      const baseTexture = baseMeta?.texture ?? fallback?.texture;
      this.setMetadata(metadata, 0, row, col, {
        color: baseColor,
        texture: baseTexture,
      });
      return true;
    },
    buildTerrainState() {
      const rows = Number(this.$ctx.rows) || 0;
      const cols = Number(this.$ctx.cols) || 0;
      const heights = Array.from({ length: rows }, () => Array(cols).fill(-1));
      const metadata = new Map();
      const voxels = this.$ctx.voxels || [];
      voxels.forEach((layer, z) => {
        if (!layer) return;
        Object.values(layer).forEach((voxel) => {
          if (!voxel || voxel.shape === "shoreline") return;
          const { x, y } = voxel;
          if (!x || !y) return;
          const xi = x - 1;
          const yi = y - 1;
          if (xi < 0 || yi < 0 || xi >= rows || yi >= cols) return;
          heights[xi][yi] = Math.max(heights[xi][yi], z);
          metadata.set(this.metaKey(z, x, y), {
            color: voxel.color,
            texture: voxel.texture,
          });
        });
      });
      return { heights, metadata, rows, cols };
    },
    recordTerrainHistory() {
      if (!Array.isArray(this.$ctx.history)) return;
      const snapshot = JSON.parse(JSON.stringify(this.$ctx.voxels));
      this.$ctx.history.push(snapshot);
      if (this.$ctx.history.length > 20) {
        this.$ctx.history.shift();
      }
      if (Array.isArray(this.$ctx.redoStack)) {
        this.$ctx.redoStack = [];
      }
    },
    getMetadata(metadata, level, x, y) {
      return metadata.get(this.metaKey(level, x, y));
    },
    setMetadata(metadata, level, x, y, value) {
      metadata.set(this.metaKey(level, x, y), value);
    },
    deleteMetadata(metadata, level, x, y) {
      metadata.delete(this.metaKey(level, x, y));
    },
    rebuildTerrainFromState(state) {
      const { heights, metadata, rows, cols } = state;
      if (!rows || !cols) {
        const fallbackLength = Math.max(this.$ctx.voxels.length || 0, 1);
        const empty = Array.from({ length: fallbackLength }, () => ({}));
        this.$set(this.$ctx, "voxels", empty);
        this.$ctx.renderNonce += 1;
        return -1;
      }
      const maxHeight = heights.reduce(
        (highest, row) => Math.max(highest, ...row),
        -1
      );

      const ensureLength = Math.max(
        maxHeight + 2,
        this.$ctx.voxels.length || 0,
        1
      );
      const newVoxels = Array.from({ length: ensureLength }, () => ({}));

      if (maxHeight < 0) {
        this.$set(this.$ctx, "voxels", newVoxels);
        this.$ctx.renderNonce += 1;
        return maxHeight;
      }

      for (let level = 0; level <= maxHeight; level++) {
        const mask = buildMaskForLevel(heights, level);
        if (!maskHasFilledCell(mask)) continue;
        const { shape, rot } = classifyTerrainMask(mask);
        for (let x = 1; x <= rows; x++) {
          for (let y = 1; y <= cols; y++) {
            if (mask[x - 1][y - 1] !== 1) continue;
            const key = `${x}/${y}/${x + 1}/${y + 1}`;
            const meta = this.getMetadata(metadata, level, x, y);
            const voxel = this.createVoxel(x, y, x + 1, y + 1, level, {
              color: meta?.color ?? this.$ctx.activeColor,
              shape: shape[x - 1][y - 1],
              rot: rot[x - 1][y - 1],
              texture: meta?.texture,
            });
            newVoxels[level][key] = voxel;
          }
        }
      }

      for (let idx = newVoxels.length - 1; idx >= 0; idx--) {
        if (Object.keys(newVoxels[idx]).length === 0 && idx > maxHeight + 1) {
          newVoxels.pop();
        } else {
          break;
        }
      }

      ensureShorelineTiles({
        rows,
        cols,
        voxels: newVoxels,
        shorelineColor: this.$ctx.shorelineColor,
      });

      cleanupStackedSlopes(newVoxels, rows, cols, {
        edgeBuffer: this.$ctx.cliffEdgeBuffer,
      });

      this.decorateTerrainWithTrees(newVoxels, heights, rows, cols);

      this.$set(this.$ctx, "voxels", newVoxels);
      this.$ctx.renderNonce += 1;
      return maxHeight;
    },
    decorateCurrentTerrain() {
      const voxels = this.$ctx?.voxels;
      if (!Array.isArray(voxels) || voxels.length === 0) return;
      const state = this.buildTerrainState();
      if (!state) return;
      const { heights, rows, cols } = state;
      this.decorateTerrainWithTrees(voxels, heights, rows, cols);
    },
    createVoxel(x, y, x2, y2, z, options = {}) {
      const voxel = {
        x,
        y,
        x2,
        y2,
        z,
        color: options.color ?? this.$ctx.activeColor,
        shape: options.shape ?? this.$ctx.activeShape,
        rot: options.rot ?? 0,
        treeClass: options.treeClass ?? null,
      };
      if (
        Object.prototype.hasOwnProperty.call(options, "texture") &&
        options.texture
      ) {
        voxel.texture = options.texture;
      }
      return voxel;
    },
    decorateTerrainWithTrees(voxels, heights, rows, cols) {
      if (!Array.isArray(voxels) || !Array.isArray(heights)) return;
      if (!Number.isFinite(rows) || !Number.isFinite(cols)) return;
      if (rows <= 0 || cols <= 0) return;

      const treeClasses = ["tree1", "tree2", "tree3"];
      if (!treeClasses.length) return;

      const randomFromCoords = (x, y, offset = 0) => {
        const seed = x * 374761393 + y * 668265263 + offset * 31;
        const value = Math.sin(seed) * 10000;
        return value - Math.floor(value);
      };

      const candidates = [];
      for (let x = 1; x <= rows; x++) {
        for (let y = 1; y <= cols; y++) {
          const height = heights?.[x - 1]?.[y - 1];
          if (!Number.isFinite(height) || height < 0) continue;
          const layer = voxels[height];
          if (!layer) continue;
          const key = `${x}/${y}/${x + 1}/${y + 1}`;
          const voxel = layer[key];
          if (!voxel || voxel.shape !== "flat") {
            if (voxel) {
              this.$set(voxel, "treeClass", null);
            }
            continue;
          }
          this.$set(voxel, "treeClass", null);
          candidates.push({
            x,
            y,
            z: height,
            key,
            voxel,
            random: randomFromCoords(x, y),
          });
        }
      }

      if (!candidates.length) {
        return;
      }

      const density = 0.06;
      const maxTrees = Math.max(1, Math.floor(rows * cols * 0.1));
      const desired = Math.max(1, Math.round(candidates.length * density));
      const targetCount = Math.min(candidates.length, desired, maxTrees);

      candidates.sort((a, b) => a.random - b.random);

      for (let index = 0; index < targetCount; index++) {
        const candidate = candidates[index];
        const randomValue = randomFromCoords(candidate.x, candidate.y, 1);
        const treeIndex = Math.floor(randomValue * treeClasses.length) % treeClasses.length;
        this.$set(candidate.voxel, "treeClass", treeClasses[treeIndex]);
      }

    },
    handleCellMouseDown(cellIndex, event) {
      if (event && event.button !== undefined && event.button !== 0) return;
      this.hoveredCell = cellIndex;
      if (this.$ctx.tool === "add") {
        const { row, col } = this.resolveCellPosition(cellIndex);
        if (row && col) {
          this.$ctx.hoveredArea = `[${row}, ${col}, 0]`;
        }
        if (!this.isTerrainModificationMode()) {
          return;
        }
        event?.preventDefault?.();
        const corner = this.resolveCornerFromEvent(event);
        const targets = corner
          ? this.collectIntersectionTargets(row, col, corner)
          : [[row, col]];
        this.applyTerrainModeToCells(targets);
        this.updateOutputs();
        return;
      }
      this.$ctx.drag = true;
      this.act(event);
    },
    handleCellMouseOver(cellIndex, event) {
      this.hoveredCell = cellIndex;
      if (this.$ctx.tool === "add") {
        const { row, col } = this.resolveCellPosition(cellIndex);
        if (row && col) {
          this.$ctx.hoveredArea = `[${row}, ${col}, 0]`;
        }
        return;
      }
      this.act(event);
    },
    handleCellMouseMove(cellIndex, event) {
      if (this.hoveredCell !== cellIndex) {
        this.hoveredCell = cellIndex;
      }
      if (this.$ctx.tool === "add") {
        const { row, col } = this.resolveCellPosition(cellIndex);
        if (row && col) {
          this.$ctx.hoveredArea = `[${row}, ${col}, 0]`;
        }
        return;
      }
      if (this.$ctx.drag) {
        this.act(event);
      }
    },
    handleCellMouseLeave() {
      this.hoveredCell = null;
      this.$ctx.hoveredArea = "◆";
    },
    onVoxelMouseDown(voxel, z, event) {
      if (event.button !== 0) return;
      if (this.$ctx.tool === "add") {
        const dataset = event?.currentTarget?.dataset || {};
        const row = Number(voxel?.x ?? dataset.x);
        const col = Number(voxel?.y ?? dataset.y);
        if (row && col) {
          this.$ctx.hoveredArea = `[${row}, ${col}, ${z}]`;
        }
        if (!this.isTerrainModificationMode()) {
          return;
        }
        event?.preventDefault?.();
        if (row && col) {
          const corner = this.resolveCornerFromEvent(event);
          const targets = corner
            ? this.collectIntersectionTargets(row, col, corner)
            : [[row, col]];
          this.applyTerrainModeToCells(targets);
          this.updateOutputs();
        }
        return;
      }
      this.$ctx.drag = true;
      this.act(event);
    },
    act(e) {
      const dataset = e?.currentTarget?.dataset || e?.target?.dataset || {};
      let { x, y, x2, y2, z = 0 } = dataset;
      x = Number(x);
      y = Number(y);
      x2 = Number(x2);
      y2 = Number(y2);
      z = Number(z);
      if ([x, y, x2, y2].some((n) => Number.isNaN(n))) return;
      this.$ctx.hoveredArea = `[${x}, ${y}, ${z}]`;

      this.$nextTick(() => {
        if (!this.$ctx.drag) return;
        const rangeKey = `${z}/${x}/${y}/${x2}/${y2}`;
        if (Object.keys(dataset).length || this.$ctx.cache.has(rangeKey)) {
          this[this.$ctx.tool](x, y, x2, y2, z, e.face || "f");
        }
      });
    },
    fill(x, y, x2, y2, z, face) {
      const processed = new Set();
      const offsets = this.$ctx.offsets;

      const directions =
        face === "f"
          ? ["fr", "fl", "bl", "br"].map((key) => offsets[key])
          : Object.values(offsets);

      const [dx, dy, dz] = offsets[face];

      const dfs = (cx, cy, cz) => {
        const [nx, ny, nx2, ny2, nz] = [
            cx + dx,
            cy + dy,
            cx + dx + 1,
            cy + dy + 1,
            cz + dz,
          ],
          nextCoords = [nz, nx, ny, nx2, ny2].join("/"),
          currCoords = [cz, cx, cy, cx + 1, cy + 1].join("/"),
          targetVoxel =
            this.$ctx.voxels[cz]?.[`${cx}/${cy}/${cx + 1}/${cy + 1}`],
          nextVoxel = this.$ctx.voxels[nz]?.[`${nx}/${ny}/${nx2}/${ny2}`];
        if (
          processed.has(currCoords) ||
          (face !== "f" && (!targetVoxel || nextVoxel)) ||
          !this.isValid(nx, ny, nx2, ny2, nz)
        )
          return;
        this.add(nx, ny, nx2, ny2, nz, face, true),
          processed.add(nextCoords, currCoords);
        for (const [ddx, ddy, ddz] of directions)
          dfs(cx + ddx, cy + ddy, cz + ddz);
      };

      dfs(x, y, z);
    },
    add(x, y, x2, y2, z, face, fill) {
      if (!fill) {
        [x, y, z] = [x, y, z].map(
          (v, i) => v + (this.$ctx.offsets[face]?.[i] || 0)
        );
        x2 = x + 1;
        y2 = y + 1;
      }

      if (!this.isWithinBounds(x, y, x2, y2)) return;

      const mode = this.$ctx.terrainMode;
      if (mode === "raise") {
        this.raiseTerrain(x, y);
        return;
      }
      if (mode === "lower") {
        this.lowerTerrain(x, y);
        return;
      }
      if (mode === "equalize") {
        this.equalizeTerrain(x, y);
        return;
      }

      if (this.isValid(x, y, x2, y2, z)) {
        const key = `${x}/${y}/${x2}/${y2}`;
        const voxel = {
          x,
          y,
          x2,
          y2,
          z,
          color: this.$ctx.activeColor,
          shape: this.$ctx.activeShape,
          rot: this.$ctx.activeRotation || 0,
        };
        this.$set(this.$ctx.voxels[z], key, voxel);
      }
    },
    isTerrainModificationMode(mode = this.$ctx.terrainMode) {
      return mode === "raise" || mode === "lower" || mode === "equalize";
    },
    applyTerrainModeToCells(cells, mode = this.$ctx.terrainMode) {
      if (!this.isTerrainModificationMode(mode)) return;
      if (!Array.isArray(cells) || cells.length === 0) return;
      const state = this.buildTerrainState();
      const { rows, cols } = state;
      if (!rows || !cols) return;
      const seen = new Set();
      const mutated = [];
      for (const [row, col] of cells) {
        if (row < 1 || col < 1 || row > rows || col > cols) continue;
        const key = `${row}|${col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        let changed = false;
        switch (mode) {
          case "raise":
            changed = this.mutateRaise(state, row, col);
            break;
          case "lower":
            changed = this.mutateLower(state, row, col);
            break;
          case "equalize":
            changed = this.mutateEqualize(state, row, col);
            break;
          default:
            break;
        }
        if (changed) {
          mutated.push([row, col]);
        }
      }
      if (!mutated.length) return;
      this.recordTerrainHistory();
      this.rebuildTerrainFromState(state);
    },
    raiseTerrain(x, y) {
      this.applyTerrainModeToCells([[x, y]], "raise");
    },
    equalizeTerrain(x, y) {
      this.applyTerrainModeToCells([[x, y]], "equalize");
    },
    lowerTerrain(x, y) {
      this.applyTerrainModeToCells([[x, y]], "lower");
    },
    erase(x, y, x2, y2, z) {
      if (this._erasing) return;
      const key = `${x}/${y}/${x2}/${y2}`;
      this.$delete(this.$ctx.voxels[z], key);
      this._erasing = setTimeout(() => (this._erasing = false), 25);
    },
    paint(x, y, x2, y2, z) {
      this.$set(this.$ctx.voxels[z], `${x}/${y}/${x2}/${y2}`, {
        ...this.$ctx.voxels[z][`${x}/${y}/${x2}/${y2}`],
        color: this.$ctx.activeColor,
      });
    },
  },
};
</script>

<style lang="scss">
.z-container {
  margin: 0 auto;
  position: relative;
  display: flex;
  flex: 1;
}

.z {
  display: grid;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;

  > * {
    pointer-events: all;
  }

  &:first-of-type {
    pointer-events: all;
  }

  > i {
    pointer-events: all;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    cursor: crosshair !important;
    color: transparent;
    background: transparent;
    width: 100%;
    height: 100%;
    transform: translateZ(0.5px);
    will-change: transform;
    outline: 0.5px solid rgba(0, 0, 0, 0.1);
    flex-wrap: wrap;
    transform-style: preserve-3d;
    overflow: visible;
    .point {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;

      &:after {
        content: "";
        --d: 12.5px;
        width: var(--d);
        height: var(--d);
        background: #eaeaea;
        border-radius: 50%;
        display: block;
        box-shadow: inset calc(var(--d) * 0.15) calc(var(--d) * -0.1)
          calc(var(--d) * 0.3) 0 #5b5b5b;
      }
    }
    svg {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
    }
  }
}

.cardinal-container {
  position: absolute;
  inset: 0;
  z-index: 999;
  display: flex;
  flex-wrap: wrap;
  > * {
    flex: 1;
    min-width: 25px;
    max-width: 25px;
    height: 25px;
    cursor: pointer;
    &:after {
      content: "";
      --d: 16px;
      width: var(--d);
      height: var(--d);
      background: #eaeaea;
      border-radius: 50%;
      display: none;
      box-shadow: inset calc(var(--d) * 0.15) calc(var(--d) * -0.1)
        calc(var(--d) * 0.3) 0 #5b5b5b;
      position: absolute;
      pointer-events: none;
    }
    &.topleft:after {
      top: -8px;
      left: -8px;
    }
    &.topright:after {
      top: -8px;
      right: -8px;
    }
    &.backleft:after {
      bottom: -8px;
      left: -8px;
    }
    &.backright:after {
      bottom: -8px;
      right: -8px;
    }
    &:hover {
      &::after {
        display: block;
      }
    }
  }
}
</style>
