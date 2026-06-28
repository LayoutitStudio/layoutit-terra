<template>
  <div class="blocks-container">
    <ribbonTools />
    <div class="scene-container">
      <toolbarSidebar />

      <div
        class="scene"
        ref="sceneRef"
        id="sceneRef"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @pointerleave="onPointerLeave"
        :style="{
          cursor: $ctx.dragMap ? 'grabbing' : 'grab',
          pointerEvents: $ctx.dragFile ? 'none' : 'auto',
        }"
        :class="{ transparent: $ctx.hideGrid }"
      >
        <div
          class="box"
          ref="boxRef"
          v-if="!$ctx.loading"
          @mouseleave="$ctx.drag = false"
          :style="{
            transform: `  scale(${$ctx.zoom})
            translateY(-4%)
  translateX(${$ctx.pan}px)
  translateY(${$ctx.tilt}px)
  rotateX(${$ctx.rotX.toFixed()}deg)
  rotate(${$ctx.rotY.toFixed()}deg)`,

            width: `${$ctx.cols * 50}px`,
            height: `${$ctx.rows * 50}px`,
          }"
        >
          <div class="floor" ref="sceneFloor">
            <layers :key="$ctx.renderNonce" />
          </div>
        </div>
        <div v-if="$ctx.loading" class="spinner"></div>
      </div>
      <codeSidebar />
    </div>
  </div>
</template>

<script>
import { clampVerticalRotation, verticalRotationLimits } from "~/utils/camera";

export default {
  data() {
    return {
      mX: 0,
      mY: 0,
      pendingRotate: null,
      rotationActivationThreshold: 4,
      autoZooming: false,
      fitFrame: null,
      rotationFrame: null,
      pendingRotationDelta: 0,
    };
  },
  watch: {
    "$ctx.loading"(loading) {
      if (!loading) {
        this.scheduleFit(true);
      }
    },
    "$ctx.cols"() {
      this.scheduleFit();
    },
    "$ctx.rows"() {
      this.scheduleFit();
    },
    "$ctx.fitViewportTick"() {
      this.scheduleFit(true);
    },
    "$ctx.zoom"(newVal, oldVal) {
      if (newVal === oldVal) return;
      if (!this.autoZooming) {
        this.$ctx.autoZoomLocked = true;
      }
    },
  },
  mounted() {
    this.$refs.sceneRef.addEventListener("wheel", this.onWheel, {
      passive: false,
    });
    window.addEventListener("keydown", this.smoothPan);
    if (typeof window !== "undefined") {
      window.addEventListener("resize", this.onResize);
    }
    this.scheduleFit();
  },
  beforeDestroy() {
    this.$refs.sceneRef.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("keydown", this.smoothPan);
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.onResize);
    }
    if (this.fitFrame) {
      cancelAnimationFrame(this.fitFrame);
      this.fitFrame = null;
    }
    if (this.rotationFrame) {
      cancelAnimationFrame(this.rotationFrame);
      this.rotationFrame = null;
    }
  },
  methods: {
    onResize() {
      if (!this.$ctx.autoZoomLocked) {
        this.scheduleFit();
      }
    },
    scheduleFit(force = false) {
      if (this.$ctx.loading) return;
      if (this.$ctx.autoZoomLocked && !force) return;

      if (this.fitFrame) {
        cancelAnimationFrame(this.fitFrame);
        this.fitFrame = null;
      }

      this.$nextTick(() => {
        if (this.$ctx.loading) return;
        if (this.$ctx.autoZoomLocked && !force) return;

        this.fitFrame = requestAnimationFrame(() => {
          this.fitFrame = null;
          this.applyAutoZoom();
        });
      });
    },
    applyAutoZoom() {
      const scene = this.$refs.sceneRef;
      const box = this.$refs.boxRef;

      if (!scene || !box) return;

      const sceneRect = scene.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();

      if (
        sceneRect.width <= 0 ||
        sceneRect.height <= 0 ||
        boxRect.width <= 0 ||
        boxRect.height <= 0
      ) {
        return;
      }

      const currentZoom = Number(this.$ctx.zoom) || 1;
      const baseWidth = boxRect.width / currentZoom;
      const baseHeight = boxRect.height / currentZoom;

      if (!baseWidth || !baseHeight) return;

      const margin = (() => {
        const raw = Number(this.$ctx.autoZoomMargin);
        if (!Number.isFinite(raw)) return 0.85;
        return Math.min(0.98, Math.max(0.5, raw));
      })();
      const desiredZoom = Math.min(
        (sceneRect.width * margin) / baseWidth,
        (sceneRect.height * margin) / baseHeight
      );

      const clampZoom = (value) => Math.min(10, Math.max(0.25, value));
      const finalZoom = clampZoom(desiredZoom);

      if (!Number.isFinite(finalZoom)) return;
      if (Math.abs(finalZoom - currentZoom) < 0.001) return;

      this.autoZooming = true;
      this.$ctx.zoom = Number(finalZoom.toFixed(3));
      this.$nextTick(() => {
        this.autoZooming = false;
      });
    },
    smoothPan(e) {
      if (e.defaultPrevented) return;

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target;
      const active =
        typeof document !== "undefined" ? document.activeElement : null;
      const isEditable = (node) => {
        if (!node || node === document.body) return false;
        if (node.isContentEditable) return true;
        const tag = node.tagName;
        return ["INPUT", "TEXTAREA", "SELECT"].includes(tag);
      };

      if (isEditable(target) || isEditable(active)) return;

      const { pan, tilt } = this.$ctx;
      const speed = 25;

      switch (e.key) {
        case "ArrowUp":
          this.$ctx.tilt = tilt - speed;
          break;
        case "ArrowDown":
          this.$ctx.tilt = tilt + speed;
          break;
        case "ArrowLeft":
          this.$ctx.pan = pan - speed;
          break;
        case "ArrowRight":
          this.$ctx.pan = pan + speed;
          break;
      }
    },
    onWheel(e) {
      const clampZoom = (value) => Math.min(10, Math.max(0.25, value));
      const lineMode =
        typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_LINE : 1;

      // Trackpad pinch gesture (reported with ctrl/meta pressed)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        const zoomFactor = 0.03;
        const newZoom = this.$ctx.zoom - e.deltaY * zoomFactor;
        this.$ctx.autoZoomLocked = true;
        this.$ctx.zoom = clampZoom(newZoom);
        return;
      }

      const isLineScroll = e.deltaMode === lineMode;
      const isMouseWheel =
        isLineScroll || (Math.abs(e.deltaX) < 1 && Math.abs(e.deltaY) >= 40);

      if (isMouseWheel) {
        e.preventDefault();
        const zoomFactor = isLineScroll ? 0.1 : 0.0025;
        const newZoom = this.$ctx.zoom - e.deltaY * zoomFactor;
        this.$ctx.autoZoomLocked = true;
        this.$ctx.zoom = clampZoom(newZoom);
        return;
      }

      // Trackpad two-finger pan/tilt gesture
      if (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0) {
        e.preventDefault();

        const panFactor = 1.15;
        this.$ctx.pan -= e.deltaX * panFactor;
        this.$ctx.tilt -= e.deltaY * panFactor;
      }
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
      sceneEl?.classList.add("is-rotating");
    },
    activateRotationFromTerrain() {
      if (!this.pendingRotate || this.pendingRotate.active) return;
      if (this.$ctx?.terrainMode !== "move") return;

      this.pendingRotate.active = true;
      this.$ctx.dragMap = true;
      this.$ctx.drag = false;
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
      const [dX, dY] = [event.clientX - this.mX, event.clientY - this.mY].map(
        (d) => (d * $ctx.invert) / 5
      );
      this.pendingRotationDelta += dX;

      $ctx.rotY = ($ctx.rotY - dX + 360) % 360;
      $ctx.rotX = clampVerticalRotation($ctx.rotX - dY);

      const r = $ctx.rotY % 360;
      $ctx.walls = {
        t: Math.round($ctx.rotX) >= verticalRotationLimits.max,
        b: Math.round($ctx.rotX) < verticalRotationLimits.max,
        //bl: r <= 180,
        fr: r > 180,
        br: r < 90 || r >= 270,
        fl: r >= 90 && r < 270,
      };
      [this.mX, this.mY] = [event.clientX, event.clientY];
      this.scheduleRotationCommit();
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
      this.$ctx.drag = false;
      if (event.buttons === 0) {
        this.onPointerUp(event);
      }
    },
    cancelRotation() {
      const sceneEl = this.$refs.sceneRef;
      if (sceneEl) {
        sceneEl.classList.remove("is-rotating");
      }
      if (this.$ctx.dragMap) {
        this.$ctx.dragMap = false;
      }
      if (this.rotationFrame) {
        cancelAnimationFrame(this.rotationFrame);
        this.rotationFrame = null;
      }
      this.commitRotationDelta();
    },
    scheduleRotationCommit() {
      if (this.rotationFrame) return;
      this.rotationFrame = requestAnimationFrame(() => {
        this.rotationFrame = null;
        this.commitRotationDelta();
      });
    },
    commitRotationDelta() {
      if (!this.pendingRotationDelta) return;
      this.$ctx.rotY = (this.$ctx.rotY - this.pendingRotationDelta + 360) % 360;
      this.pendingRotationDelta = 0;
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
  touch-action: none;
  overflow: hidden;
  * {
    transform-style: preserve-3d;
  }
  --space: hsl(0 0% 0%); /* deep navy; change if needed */
  --d: 0.35; /* overall intensity (0–.04). Lower = more subtle */

  background-color: var(--space);
  background-image: radial-gradient(
      1px 1px at 23px 19px,
      hsl(210 20% 98% / var(--d)) 99%,
      transparent
    ),
    radial-gradient(
      1px 1px at 110px 77px,
      hsl(210 20% 98% / calc(var(--d) * 0.9)) 99%,
      transparent
    ),
    radial-gradient(
      1px 1px at 170px 30px,
      hsl(210 20% 98% / calc(var(--d) * 0.75)) 99%,
      transparent
    ),
    radial-gradient(
      1px 1px at 229px 139px,
      hsl(210 20% 98% / calc(var(--d) * 0.9)) 99%,
      transparent
    ),
    radial-gradient(
      1px 1px at 16px 123px,
      hsl(210 20% 98% / calc(var(--d) * 0.65)) 99%,
      transparent
    ),
    radial-gradient(
      1px 1px at 74px 210px,
      hsl(210 20% 98% / calc(var(--d) * 0.8)) 99%,
      transparent
    ),
    radial-gradient(
      0.8px 0.8px at 199px 243px,
      hsl(210 20% 98% / calc(var(--d) * 0.55)) 99%,
      transparent
    );
  background-repeat: repeat;

  /* Prime-ish tile sizes to kill visible tiling */
  background-size: 311px 271px, 379px 331px, 449px 293px, 557px 367px,
    487px 409px, 613px 353px, 503px 463px;
}

.ramp,
.spike,
.wedge,
.flat,
.box,
.floor,
.z {
  transform-style: preserve-3d;
  position: absolute;
}

.floor {
  display: flex;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  &:after {
    border: 1px solid #444;
    bottom: 0;
    content: "";
    display: block;
    left: 0;
    position: absolute;
    right: 0;
    top: 0;
    background: #151515;
    transform: translateZ(-12px);
  }
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

.scene-container {
  display: flex;
  gap: 6px;
  padding-bottom: 0;
  max-height: calc(100vh - 0px);
  min-height: calc(100vh - 0px);
  > * {
    flex: 1;
  }
}
.newcodesidebar.toolbar-sidebar.mobile-gallery,
.remenu {
  display: none !important;
}
@media screen and (max-width: 992px) {
  .scene * {
    pointer-events: none !important;
  }
  .brand-logo {
    background: #010101 !important;
  }
  .scene-container {
    flex-direction: column !important;
  }
  .newcodesidebar.toolbar-sidebar.mobile-gallery,
  .remenu {
    display: flex !important;
  }
  .newcodesidebar.toolbar-sidebar.desktop-gallery,
  .ribbon-tools > div button,
  .ribbon-tools > div + div,
  .gallery-container .examples-container > div.random,
  .stats,
  .toolbar-sidebar {
    display: none !important;
  }

  .newcodesidebar.toolbar-sidebar {
    display: flex !important;
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    min-width: 100% !important;
    max-width: 100% !important;
    top: 60px;
    background: #101010;

    .gallery-container {
      flex-direction: column;
      min-width: 100%;
      max-width: 100%;
    }
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
</style>
