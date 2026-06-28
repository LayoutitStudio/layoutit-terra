<template>
  <div class="ribbon-tools">
    <div>
      <brand-logo />
      <div
        class="remenu"
        :class="{ active: $ctx.openMenu }"
        @click="$ctx.openMenu = !$ctx.openMenu"
      >
        <icons-menu />
      </div>
      <button @click="handleRefresh()"><icons-trash />&nbsp;Restart</button>
      <button @click="undo()" :disabled="$ctx.history.length === 0">
        <icons-redo />&nbsp;Undo
      </button>
      <button @click="redo()" :disabled="$ctx.redoStack.length === 0">
        <icons-undo />&nbsp;Redo
      </button>
    </div>

    <div>
      <button @click="handleImport()">Import</button>
      <div class="button complex" @click="generateVOX($ctx.voxels)">
        <icons-download />
        <div>Export Heightmap&nbsp;</div>
        <div class="inner-button" style="display: none">
          <span
            v-for="format in exportFormats"
            :key="format"
            :class="{ active: format === $ctx.activeFormat }"
            @click="$ctx.activeFormat = format"
          >
            {{ format }}
          </span>
        </div>
      </div>

      <button @click="copyEmbed()"><icons-code />&nbsp;Copy Embed</button>
      <button @click="openCodepen()">
        <icons-codepen />&nbsp;Open Codepen
      </button>
      <button style="background: #1a7f37; display: none">
        <icons-github />&nbsp;View on Github
      </button>
      <button style="background: #1a7f37" @click="downloadCode()">
        <icons-folder />&nbsp;Download Code
      </button>

      <button @click="saveToGallery()" class="savebutton">
        <template v-if="$ctx.saving">Saving... </template>
        <template v-else-if="$ctx.saved">Queued for review &hearts;</template>
        <template v-else>Save to Gallery&nbsp;<icons-doublearrow /> </template>
      </button>
    </div>
  </div>
</template>
<script>
import { clampVerticalRotation, verticalRotationLimits } from "~/utils/camera";

export default {
  data() {
    return {
      exportFormats: ["CSS", "VOX", "TXT", "PNG"],
      saving: false, // Indicates if the save operation is in progress
    };
  },
  methods: {
    async downloadCode() {
      // First, generate the HTML/CSS outputs (they'll be stored in this.$ctx)
      this.generateHTML();

      // Dynamically import JSZip
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Generate TXT content and add it to the ZIP
      const txtContent = this.generateTXTContent(this.$ctx.voxels);
      zip.file("model.txt", txtContent);

      // Generate JSON content and add it to the ZIP
      const jsonContent = this.generateJSONContent(this.$ctx.voxels);
      zip.file("model.json", jsonContent);

      // Generate PNG Blob and add it to the ZIP
      const pngBlob = await this.generatePNGBlob();
      if (pngBlob) {
        zip.file("model.png", pngBlob, { binary: true });
      }

      // Add the generated HTML and CSS files to the ZIP
      const htmlContent = this.$ctx.htmlOutput || "";
      const cssContent = this.$ctx.cssOutput || "";
      zip.file("index.html", htmlContent);
      zip.file("styles.css", cssContent);

      // Generate the ZIP file as a Blob and trigger its download.
      zip.generateAsync({ type: "blob" }).then((zipBlob) => {
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "model.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    },

    generateTXTContent(voxels) {
      const result = voxels.flatMap((layer, z) =>
        Object.values(layer).map(({ x, y, color }) => ({
          x,
          y,
          z,
          color:
            typeof color === "string"
              ? color.replace(/^#/, "").toUpperCase()
              : "",
        }))
      );

      // Sort by z, then y, then x
      result.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);

      return [
        "# Layoutit 0.0.1",
        "# One line per voxel",
        "# X Y Z RRGGBB",
        ...result.map(({ x, y, z, color }) => `${x} ${y} ${z} ${color}`),
      ].join("\n");
    },

    generateJSONContent(voxels) {
      const result = [];
      voxels.forEach((layer, z) => {
        if (!layer) return;
        Object.values(layer).forEach(({ x, y, color, shape }) => {
          result.push({
            x,
            y,
            z,
            color:
              typeof color === "string"
                ? color.replace(/^#/, "").toUpperCase()
                : "",
            shape: shape,
          });
        });
      });

      // Sort by z, then y, then x
      result.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);

      return JSON.stringify({ version: "0.0.1", voxels: result }, null, 2);
    },

    async generatePNGBlob(selector = "#sceneRef") {
      // Temporarily adjust scene display.
      this.$ctx.showWalls = false;
      this.$ctx.hideFloor = true;

      const element = document.querySelector(selector);
      if (!element) {
        console.error("Element not found:", selector);
        this.$ctx.showWalls = true;
        this.$ctx.hideFloor = false;
        return null;
      }

      try {
        const domtoimage = (await import("dom-to-image")).default;
        return await domtoimage.toBlob(element);
      } catch (error) {
        console.error("Error capturing screenshot:", error);
        return null;
      } finally {
        this.$ctx.showWalls = true;
        this.$ctx.hideFloor = false;
      }
    },
    generateHTML() {
      const { voxels, offsets, walls, cols, rows } = this.$ctx;

      const visibleFaces = (x, y, z, x2, y2) => {
        return ["t", "b", "bl", "br", "fr", "fl"].filter((face) => {
          const [dx, dy, dz] = offsets[face];
          const neighborZ = z + dz;
          const neighborKey = `${x + dx}/${y + dy}/${x2 + dx}/${y2 + dy}`;
          return (
            (!voxels[neighborZ] || !voxels[neighborZ][neighborKey]) &&
            !(face === "b" && z === 0) &&
            !walls[face]
          );
        });
      };

      let sceneHTML = `<div class="floor">\n`;

      voxels.forEach((layer, layerIndex) => {
        sceneHTML += `  <div class="z" style="transform: translateZ(${
          layerIndex * 50
        }px);">\n`;

        Object.keys(layer).forEach((key) => {
          const voxel = layer[key];
          const { x, y, x2, y2, z, color, shape } = voxel;

          const faces = visibleFaces(x, y, z, x2, y2);

          if (faces.length === 0) return;

          sceneHTML += `    <div class="${shape}" style="color: ${color}; grid-area: ${x} / ${y} / ${x2} / ${y2};">\n`;
          faces.forEach((face) => {
            sceneHTML += `      <div class="face ${face}"></div>\n`;
          });
          sceneHTML += `    </div>\n`;
        });

        sceneHTML += `  </div>\n`;
      });

      sceneHTML += `</div>\n`;

      // Wrap the scene inside a full HTML document with linked CSS.
      const htmlOutput = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voxel Scene</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="scene">
    ${sceneHTML}
  </div>
</body>
</html>`;
      const htmlOutputCodepen = ` 
  <div class="scene">
    ${sceneHTML}
  </div>
 `;
      // Build the dynamic CSS output.
      // The .floor container's width and height are set dynamically.
      let cssOutput = `.scene {
  display: flex;
  justify-content: center;
  align-items: center;
  perspective: 8000px;
  flex: 1;
}

.scene * {
  transform-style: preserve-3d;
  position: absolute;
}

.floor {
  transform: scale(0.6) translateY(240px) translateY(0px) translateX(0px) rotateX(${
    this.$ctx.rotX
  }deg) rotate(${this.$ctx.rotY}deg);
  width: ${cols * 50}px;
  height: ${rows * 50}px;
}

.cube {
	 display: block;
	 position: absolute;
	 inset: 0;
	 transform: translateZ(25px);
}
 .cube .face:after {
	 pointer-events: none;
	 content: "";
	 position: absolute;
	 inset: 0;
}
 .cube .face.t:after {
	 background: rgba(0, 0, 0, 0);
}
 .cube .face.fr:after {
	 background: rgba(0, 0, 0, 0.1);
}
 .cube .face.fl:after {
	 background: rgba(0, 0, 0, 0.15);
}
 .cube .face.bl:after {
	 background: rgba(0, 0, 0, 0.2);
}
 .cube .face.br:after {
	 background: rgba(0, 0, 0, 0.2);
}
 .cube .face {
	 position: absolute;
	 outline: 0.5px solid rgba(0, 0, 0, 0.03);
	 outline-offset: -0.5px;
	 inset: 0;
   background: currentColor;
}
 .cube .face.t {
	 transform: translateZ(25px);
}
 .cube .face.b {
	 transform: translateZ(-25px);
}
 .cube .face.fr {
	 transform: rotateY(90deg) translateZ(25px);
	 width: 50px;
}
 .cube .face.fl {
	 transform: rotateX(90deg) translateZ(-25px);
	 height: 50px;
}
 .cube .face.bl {
	 transform: rotateY(90deg) translateZ(-25px);
	 width: 50px;
}
 .cube .face.br {
	 transform: rotateX(90deg) translateZ(25px);
	 height: 50px;
}
 .cube .face.svg {
	 outline: 0;
}

 .cube .face svg {
	 position: absolute;
	 inset: 0;
	 z-index: -1;
	 pointer-events: none;
}
 
.z {
  display: grid;
  grid-template-columns: repeat(${cols}, 50px);
  grid-template-rows: repeat(${rows}, 50px);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.z > * {
  pointer-events: all;
}
.z:first-of-type {
  pointer-events: all;
}
.z:first-of-type:after {
  content: "";
  position: absolute;
  z-index: 999;
  inset: 0;
  background: radial-gradient(transparent 60%, rgba(0, 0, 0, 0.2));
  pointer-events: none;
}
.z > i {
  pointer-events: all;
  cursor: cell;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  color: transparent;
  background: transparent;
  width: 100%;
  height: 100%;
  outline: 0.5px solid rgba(0, 0, 0, 0.1);
}
.z > i:hover {
  outline: 2px solid #ff073a;
}
.z > i svg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

html {
  box-sizing: border-box;
  font-family: arial, helvetica, sans-serif;
  color: #222;
  background: #010101;
  user-select: none;
  touch-action: none;
}
body {
  min-height: calc(100vh - 12px);
  max-height: calc(100vh - 12px);
  overflow: hidden;
  margin: 0;
  padding: 6px;
  touch-action: none;
  display: flex;
}
*,
*:before,
*:after {
  box-sizing: inherit;
}
`;

      // Store the generated outputs in the context.
      this.$set(this.$ctx, "htmlOutput", htmlOutput.trim());
      this.$set(this.$ctx, "htmlOutputCodepen", htmlOutputCodepen.trim());
      this.$set(this.$ctx, "cssOutput", cssOutput.trim());
    },
    generateVOX(voxels, filename = "model.vox") {
      if (!voxels || !voxels.length) return;

      // ─── STEP 1: DETERMINE GRID SIZE ─────────────────────────────
      const sizeX =
        Math.max(
          ...voxels.flatMap((layer) => Object.values(layer).map((v) => v.x))
        ) + 1;
      const sizeY =
        Math.max(
          ...voxels.flatMap((layer) => Object.values(layer).map((v) => v.y))
        ) + 1;
      const sizeZ = voxels.length; // HEIGHT = number of layers

      let numVoxels = 0;
      voxels.forEach((layer) => {
        if (layer) {
          numVoxels += Object.keys(layer).length;
        }
      });

      // ─── STEP 2: BUILD PALETTE FROM USED COLORS ─────────────────
      const usedColors = new Set();
      voxels.forEach((layer) => {
        if (!layer) return;
        Object.values(layer).forEach(({ color }) => {
          usedColors.add(color.toUpperCase()); // Normalize color format
        });
      });

      const uniqueColors = Array.from(usedColors);
      const palette = [...uniqueColors];

      // Fill up to 256 colors (MagicaVoxel requires a full palette)
      while (palette.length < 256) {
        palette.push("#000000"); // Pad with black if fewer than 256 colors are used
      }

      // ─── STEP 3: CALCULATE BUFFER SIZE ───────────────────────────
      const headerSize = 8;
      const mainChunkHeaderSize = 12;
      const sizeChunkSize = 24; // SIZE chunk (header + content)
      const xyziHeaderSize = 12;
      const xyziContentSize = 4 + 4 * numVoxels;
      const xyziChunkSize = xyziHeaderSize + xyziContentSize;
      const rgbaHeaderSize = 12;
      const rgbaContentSize = 1024;
      const rgbaChunkSize = rgbaHeaderSize + rgbaContentSize;
      const totalSize =
        headerSize +
        mainChunkHeaderSize +
        sizeChunkSize +
        xyziChunkSize +
        rgbaChunkSize;

      // ─── STEP 4: CREATE BUFFER AND WRITE DATA ────────────────────
      const buffer = new ArrayBuffer(totalSize);
      const view = new DataView(buffer);
      let offset = 0;

      function writeString(str) {
        for (let i = 0; i < str.length; i++) {
          view.setUint8(offset++, str.charCodeAt(i));
        }
      }
      function writeInt(value) {
        view.setInt32(offset, value, true);
        offset += 4;
      }

      // ─── STEP 5: WRITE HEADER ────────────────────────────────────
      writeString("VOX ");
      writeInt(150);

      // ─── STEP 6: WRITE MAIN CHUNK ────────────────────────────────
      writeString("MAIN");
      writeInt(0);
      writeInt(sizeChunkSize + xyziChunkSize + rgbaChunkSize);

      // ─── STEP 7: WRITE SIZE CHUNK (GRID SIZE) ────────────────────
      writeString("SIZE");
      writeInt(12);
      writeInt(0);
      writeInt(sizeX);
      writeInt(sizeY);
      writeInt(sizeZ);

      // ─── STEP 8: WRITE XYZI CHUNK (VOXEL DATA) ───────────────────
      writeString("XYZI");
      writeInt(xyziContentSize);
      writeInt(0);
      writeInt(numVoxels);

      voxels.forEach((layer, z) => {
        if (!layer) return;
        Object.values(layer).forEach(({ x, y, color }) => {
          const colorIndex =
            palette.findIndex((c) => c.toUpperCase() === color.toUpperCase()) +
            1;
          view.setUint8(offset++, x);
          view.setUint8(offset++, y);
          view.setUint8(offset++, z);
          view.setUint8(offset++, colorIndex);
        });
      });

      // ─── STEP 9: WRITE RGBA CHUNK (PALETTE) ──────────────────────
      writeString("RGBA");
      writeInt(1024);
      writeInt(0);

      function hexToRGB(hex) {
        hex = hex.replace(/^#/, "");
        return {
          r: parseInt(hex.substring(0, 2), 16),
          g: parseInt(hex.substring(2, 4), 16),
          b: parseInt(hex.substring(4, 6), 16),
        };
      }

      for (let i = 0; i < 256; i++) {
        const hex = palette[i] || "#000000";
        const { r, g, b } = hexToRGB(hex);
        view.setUint8(offset++, r);
        view.setUint8(offset++, g);
        view.setUint8(offset++, b);
        view.setUint8(offset++, 255);
      }

      // ─── STEP 10: TRIGGER FILE DOWNLOAD ──────────────────────────
      const blob = new Blob([buffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    async saveToGallery() {
      const hash = window.location.hash.slice(1);
      console.log(hash);
      if (hash) {
        this.$ctx.saving = true;
        const { error } = await this.$supabase
          .from("gallery")
          .insert([{ url: hash }]);
        this.$ctx.saving = false;
        if (error) {
          console.error("Failed to save to gallery:", error.message);
        } else {
          this.$ctx.saved = true;
          setTimeout(() => (this.$ctx.saved = false), 4000);
        }
      }
    },
    openCodepen() {
      this.generateHTML();
      const payload = {
        title: "Layoutit! Voxels",
        html: this.$ctx.htmlOutputCodepen,
        css: this.$ctx.cssOutput,
        js: "// ♥", // Required field, but left empty
      };

      // Create a form element for submitting to CodePen
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "https://codepen.io/pen/define";
      form.target = "_blank";

      // Hidden input to store the payload
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "data";
      input.value = JSON.stringify(payload);

      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    },
    copyEmbed() {
      // Get the current hash from the URL
      const modelHash = window.location.hash; // Includes the leading `#`

      // Construct the embed URL using the current hash
      const url = `${window.location.origin}/embed${modelHash}&format=${this.$ctx.activeFormat}`;

      // Generate the iframe embed code
      const embedCode = `<iframe src="${url}" width="600" height="400" style="border: none;"></iframe>`;

      // Copy to clipboard
      navigator.clipboard
        .writeText(embedCode)
        .then(() => {
          this.$ctx.showNotification("Embed code copied!", "success");
        })
        .catch(() => {
          this.$ctx.showNotification("Failed to copy embed code", "error");
        });
    },
    undo() {
      console.log(this.$ctx.history);
      if (this.$ctx.history.length !== 0) {
        // Save the current state to the redo stack
        this.$ctx.redoStack.push(JSON.parse(JSON.stringify(this.$ctx.voxels)));

        // Peek at the last item in history
        const lastIndex = this.$ctx.history.length - 1;
        const previousState = this.$ctx.history[lastIndex];

        // Check if it's identical to the current state
        if (
          JSON.stringify(previousState) === JSON.stringify(this.$ctx.voxels)
        ) {
          // If it's a duplicate, pop it
          this.$ctx.history.pop();
        }

        // Now, restore the last state from history (pop again)
        const stateToRestore = this.$ctx.history.pop();
        // Apply the state to voxels
        this.$set(
          this.$ctx,
          "voxels",
          JSON.parse(JSON.stringify(stateToRestore))
        );
      } else {
        // If no history exists, reset to an empty state
        this.$set(
          this.$ctx,
          "voxels",
          Array.from({ length: 12 }, () => ({}))
        );
      }
    },

    redo() {
      if (this.$ctx.redoStack.length !== 0) {
        // Save the current state to the history stack
        this.$ctx.history.push(JSON.parse(JSON.stringify(this.$ctx.voxels)));

        // Restore the last undone state from the redo stack
        const nextState = this.$ctx.redoStack.pop();
        this.$set(this.$ctx, "voxels", JSON.parse(JSON.stringify(nextState)));
      }
    },
    handleRefresh() {
      this.$set(
        this.$ctx,
        "voxels",
        Array.from({ length: 12 }, () => ({}))
      );
      this.$ctx.autoZoomLocked = false;
      this.$ctx.cols = 32;
      this.$ctx.rows = 32;

      const defaultRotX = clampVerticalRotation(60);
      const defaultRotY = 45;

      this.$set(this.$ctx, "rotX", defaultRotX);
      this.$set(this.$ctx, "rotY", defaultRotY);
      this.$set(this.$ctx, "pan", 0);
      this.$set(this.$ctx, "tilt", 0);
      this.$ctx.zoom = 0.5;

      const normalizedRotY = ((defaultRotY % 360) + 360) % 360;
      this.$ctx.walls = {
        ...this.$ctx.walls,
        t: Math.round(defaultRotX) >= verticalRotationLimits.max,
        b: Math.round(defaultRotX) < verticalRotationLimits.max,
        bl: normalizedRotY <= 180,
        fr: normalizedRotY > 180,
        br: normalizedRotY < 90 || normalizedRotY >= 270,
        fl: normalizedRotY >= 90 && normalizedRotY < 270,
      };

      window.history.replaceState(null, "", "/");
      this.$ctx.fitViewportTick += 1;
    },
    handleImport() {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".vox";
      input.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (file) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const parsedData = this.parseVoxFile(arrayBuffer);
            const [maxY, maxX, maxZ] = ["y", "x", "z"].map((k) =>
              Math.max(
                ...parsedData.flatMap((layer) =>
                  Object.values(layer).map((v) => v[k])
                )
              )
            );

            this.$ctx.autoZoomLocked = false;
            this.$ctx.cols = maxY + 1;
            this.$ctx.rows = maxX + 1;
            this.$set(
              this.$ctx,
              "voxels",
              this.filterVisibleVoxels(parsedData)
            );
            this.$ctx.fitViewportTick += 1;
          } catch (error) {
            console.error("Error handling VOX file:", error);
          }
        } else {
          console.log("No file selected.");
        }
      });
      input.click();
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
        parse() {
          const signature = this.readString(4); // "VOX "
          if (signature !== "VOX ") {
            throw new Error("Invalid VOX file");
          }

          const version = this.readInt(); // Version number

          const layers = [];
          const deferredVoxels = [];
          const colors = Array(256).fill("#000000"); // Initialize palette with black

          while (this.offset < this.view.byteLength) {
            const chunkId = this.readString(4); // Chunk ID
            const chunkSize = this.readInt(); // Size of the chunk
            const childChunkSize = this.readInt(); // Size of child chunks

            if (chunkId === "RGBA") {
              console.log("Parsing RGBA Chunk...");
              for (let i = 0; i < 256; i++) {
                const r = this.view.getUint8(this.offset++);
                const g = this.view.getUint8(this.offset++);
                const b = this.view.getUint8(this.offset++);
                const a = this.view.getUint8(this.offset++);
                colors[i] = `#${this.toHex(r)}${this.toHex(g)}${this.toHex(b)}`;
              }
            } else if (chunkId === "XYZI") {
              console.log("Parsing XYZI Chunk...");
              const numVoxels = this.readInt();
              console.log(`Number of Voxels: ${numVoxels}`);
              for (let i = 0; i < numVoxels; i++) {
                const x = this.view.getUint8(this.offset++);
                const y = this.view.getUint8(this.offset++);
                const z = this.view.getUint8(this.offset++);
                const colorIndex = this.view.getUint8(this.offset++);
                deferredVoxels.push({ x, y, z, colorIndex });
              }
            } else {
              this.offset += chunkSize; // Skip other chunks
            }
          }

          // Process deferred voxels after colors are defined
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
              shape: "cube",
            };

            // Ensure the layer array exists
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
    filterVisibleVoxels(voxels) {
      return voxels.map((layer, zIndex) => {
        const filteredLayer = {};

        Object.keys(layer).forEach((key) => {
          const voxel = layer[key];

          // Check which faces are visible for the voxel
          const visibleFaces = ["t", "b", "bl", "br", "fr", "fl"].filter(
            (face) => {
              const [dx, dy, dz] = this.$ctx.offsets[face];
              const neighborZ = voxel.z + dz;
              const neighborKey = `${voxel.x + dx}/${voxel.y + dy}/${
                voxel.x2 + dx
              }/${voxel.y2 + dy}`;

              return (
                // Neighbor must not exist
                (!this.$ctx.voxels[neighborZ] ||
                  !this.$ctx.voxels[neighborZ][neighborKey]) &&
                // Bottom face hidden at floor level
                !(face === "b" && voxel.z === 0)
              );
            }
          );

          // Keep voxel if it has at least one visible face
          if (visibleFaces.length > 0) {
            filteredLayer[key] = voxel;
          }
        });

        return filteredLayer;
      });
    },
  },
};
</script>
<style lang="scss">
.ribbon-tools {
  display: flex;
  justify-content: space-between;
  z-index: 9;
  gap: 6px;
  max-height: 44px;
  min-height: 44px;
  position: absolute;
  left: 6px;
  right: 6px;
  top: 6px;
  > div {
    display: flex;
    gap: 6px;
  }
  > .button,
  > button,
  > div > .button,
  > div > button {
    font-size: 13px;
    text-shadow: none;
    font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
    color: #ddd;
    padding: 10px 15px;
    display: flex;
    align-items: center;
    background: #222;
    border-radius: 6px;
    min-width: max-content;
    &:hover {
      background: #2a2a2a;
    }
  }

  button svg {
    width: 18px;
    height: auto;
  }
  button[disabled] {
    pointer-events: none;
    opacity: 0.6;
  }
}

.button.complex {
  gap: 6px;
  padding-right: 8px !important;
  //padding-left: 10px !important;
  cursor: pointer;
  .inner-button {
    display: flex;
    gap: 4px;
  }
  span {
    display: block;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    color: #888;
    &.active,
    &:hover {
      background: #01579b;
      color: #fff;
    }
  }
}

.remenu {
  cursor: pointer;
  width: 45px;
  display: flex !important
;
  justify-content: center;
  align-items: center;
  position: absolute;
  height: 45px;
  right: 5px;
  border-radius: 6px;
  &.active {
    background: #2a2a2a;
  }
}

.ribbon-tools > div > button.savebutton {
  align-items: center;
  justify-content: center;
  display: flex;
  background: #9e124b;
  min-width: 180px;
  z-index: 99;
}
</style>
