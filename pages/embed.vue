<template>
  <div class="blocks-container">
    <div class="scene-container embed">
      <div
        class="scene"
        ref="sceneRef"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @pointerleave="onPointerLeave"
        @contextmenu.prevent
        :style="{
          cursor: $ctx.dragMap ? 'grabbing' : 'grab',
          pointerEvents: $ctx.dragFile ? 'none' : 'auto',
        }"
        :class="{ transparent: $ctx.hideGrid }"
      >
        <div
          class="box"
          v-if="!$ctx.loading"
          :style="{
            transform: `scale(${this.$ctx.zoom}) translateY(${
              $ctx.voxels.length * 20
            }px) translateY(${$ctx.tilt}px) translateX(${
              $ctx.pan
            }px) rotateX(${$ctx.rotX.toFixed()}deg) rotate(${$ctx.rotY.toFixed()}deg)`,
            width: `${$ctx.cols * 50}px`,
            height: `${$ctx.rows * 50}px`,
          }"
        >
          <div class="floor" ref="sceneFloor">
            <layers />
          </div>
        </div>
        <div v-if="$ctx.loading" class="spinner"></div>
        <a href="#" class="powered">Powered by Layoutit!</a>
      </div>
    </div>
  </div>
</template>

<script>
import { clampVerticalRotation } from "~/utils/camera";

export default {
  data() {
    return {
      mX: 0,
      mY: 0,
      rotationFrame: null,
      userInteracted: false, // Flag to track manual interaction
      pendingRotate: null,
      rotationActivationThreshold: 4,
    };
  },
  mounted() {
    this.animateRotation(); // Start rotating on load
  },
  beforeDestroy() {
    cancelAnimationFrame(this.rotationFrame);
  },
  methods: {
    animateRotation() {
      if (this.rotationFrame || this.userInteracted) return; // Stop if user interacted

      const loop = () => {
        if (!this.rotationFrame) return; // Stop if canceled
        this.$ctx.rotY = (this.$ctx.rotY + 0.7) % 360; // Adjust speed here

        // Update walls
        const r = this.$ctx.rotY % 360;
        this.$ctx.walls = {
          bl: r <= 180,
          fr: r > 180,
          br: r < 90 || r >= 270,
          fl: r >= 90 && r < 270,
        };

        this.rotationFrame = requestAnimationFrame(loop);
      };

      this.rotationFrame = requestAnimationFrame(loop);
    },
    stopRotation() {
      cancelAnimationFrame(this.rotationFrame);
      this.rotationFrame = null;
    },
    onPointerDown(event) {
      if (event.button === 2) {
        event.preventDefault();
      }

      const sceneEl = this.$refs.sceneRef;
      const startedOnTerrain =
        !!sceneEl && event.target !== sceneEl && sceneEl.contains(event.target);

      this.pendingRotate = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startedOnTerrain,
        active: !startedOnTerrain,
      };

      [this.mX, this.mY] = [event.clientX, event.clientY];

      if (!startedOnTerrain) {
        this.$ctx.dragMap = true;
      }

      sceneEl?.setPointerCapture?.(event.pointerId);
    },
    activateRotationFromTerrain() {
      if (!this.pendingRotate || this.pendingRotate.active) return;
      if (this.$ctx?.terrainMode !== "move") return;

      this.pendingRotate.active = true;
      this.userInteracted = true;
      this.stopRotation();
      this.$ctx.dragMap = true;
    },
    onPointerMove(event) {
      const { pendingRotate, rotationActivationThreshold, $ctx } = this;

      if (!pendingRotate || event.pointerId !== pendingRotate.id) return;

      if (!$ctx.dragMap && pendingRotate.startedOnTerrain) {
        if ($ctx.terrainMode !== "move") {
          return;
        }
        const dx = event.clientX - pendingRotate.startX;
        const dy = event.clientY - pendingRotate.startY;
        if (Math.hypot(dx, dy) >= rotationActivationThreshold) {
          this.activateRotationFromTerrain();
          [this.mX, this.mY] = [event.clientX, event.clientY];
        } else {
          return;
        }
      }

      if (!$ctx.dragMap) return;

      if (!this.userInteracted) {
        this.userInteracted = true;
        this.stopRotation();
      }

      const [dX, dY] = [
        ((event.clientX - this.mX) * $ctx.invert) / 5,
        ((event.clientY - this.mY) * $ctx.invert) / 5,
      ];

      $ctx.rotY = ($ctx.rotY - dX + 360) % 360;
      $ctx.rotX = clampVerticalRotation($ctx.rotX - dY);

      const r = $ctx.rotY % 360;
      $ctx.walls = {
        bl: r <= 180,
        fr: r > 180,
        br: r < 90 || r >= 270,
        fl: r >= 90 && r < 270,
      };

      [this.mX, this.mY] = [event.clientX, event.clientY];
    },
    onPointerUp(event) {
      const sceneEl = this.$refs.sceneRef;
      if (sceneEl?.hasPointerCapture?.(event.pointerId)) {
        sceneEl.releasePointerCapture(event.pointerId);
      }

      if (this.pendingRotate && event.pointerId === this.pendingRotate.id) {
        this.pendingRotate = null;
      }

      this.cancelRotation();
    },
    onPointerLeave(event) {
      if (event.buttons === 0) {
        this.onPointerUp(event);
      }
    },
    cancelRotation() {
      if (this.$ctx.dragMap) {
        this.$ctx.dragMap = false;
      }
      this.animateRotation();
    },
  },
};
</script>

<style lang="scss">
@import url("https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700&family=VT323&display=swap");

.blocks-container {
  padding: 0px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  > * {
    flex: 1;
  }
}

.scene {
  display: flex;
  justify-content: center;
  align-items: center;
  perspective: 8000px;

  overflow: hidden;
  * {
    transform-style: preserve-3d;
    position: absolute;
  }
}

.floor {
  background: #c2c2f3;
  display: flex;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

button {
  background: transparent;
  border: 0;
  cursor: pointer;
  padding: 0;
}

code {
  font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
  font-size: 13px;
}

pre {
  margin: 0;
}

.scene.transparent {
  .regrilla div,
  .z > i {
    outline: 0.5px solid #555 !important;
  }
  .floor:after {
    display: none;
  }
  .floor,
  .wall-backLeft,
  .wall-backRight,
  .wall-frontLeft,
  .wall-frontRight {
    background: transparent !important;
  }
}

.floor:after {
  content: "";
  display: block;
  top: 0;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  transform: translateZ(-12px);
  border: 0.5px solid #888;
}

.scene-container.embed {
  display: flex;
  gap: 6px;
  padding-bottom: 0;
  max-height: calc(100vh - 0px);
  min-height: calc(100vh - 0px);
  > * {
    flex: 1;
  }
}

button[disabled] {
  pointer-events: none;
  opacity: 0.5;
}

.spinner {
  /* Spinner size and color */
  width: 1.5rem;
  height: 1.5rem;
  border-top-color: #666;
  border-left-color: #666;

  /* Additional spinner styles */
  animation: spinner 600ms linear infinite;
  border-bottom-color: transparent;
  border-right-color: transparent;
  border-style: solid;
  border-width: 2px;
  border-radius: 50%;
  box-sizing: border-box;
  display: inline-block;
  vertical-align: middle;
  width: 5rem;
  height: 5rem;
  border-width: 6px;
}

/* Animation styles */
@keyframes spinner {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.powered {
  position: fixed;
  bottom: 5px;
  left: 2px;
  font-size: 13px;
  text-shadow: none;
  font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
  color: #888;
}
</style>
