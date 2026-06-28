<template>
  <div style="display: contents">
    <div class="newcodesidebar desktop-gallery" v-if="$ctx.rightPanel">
      <div class="gallery-container">
        <div class="examples-container">
          <template v-if="randomExamples.length > 0">
            <div
              v-for="(example, index) in randomExamples"
              :key="index"
              class="example"
              @click="loadModel(example.url)"
            >
              <img :src="`/examples/${example.name}.jpg`" :alt="example.name" />
            </div>
          </template>
          <template v-else>
            <div
              v-for="fallback in fallbackExamples"
              :key="fallback.src"
              class="example fallback"
            >
              <img :src="fallback.src" :alt="fallback.alt" />
            </div>
          </template>
          <div class="example random" @click="handleRandom()">
            <icons-random />View Random
          </div>
        </div>
        <div
          class="stats random"
          style="margin-top: auto"
          @click="handleRandom()"
        >
          <div class="zoom-control">
            <div class="hoveredArea">{{ $ctx.hoveredArea }}</div>

            <div>voxels: {{ $ctx.voxelLength }}</div>
            <div>facets: {{ $ctx.facets }}</div>
            <div>
              size: ~{{ $ctx.size }}
              KB
            </div>
          </div>
        </div>
      </div>
    </div>
    <div
      class="newcodesidebar toolbar-sidebar mobile-gallery"
      v-if="$ctx.rightPanel && $ctx.openMenu"
    >
      <div class="gallery-container">
        <div class="examples-container">
          <template v-if="randomExamples.length > 0">
            <div
              v-for="(example, index) in randomExamplesMobile"
              :key="index"
              class="example"
              @click="loadModel(example.url)"
            >
              <img :src="`/examples/${example.name}.jpg`" :alt="example.name" />
            </div>
          </template>

          <template v-else>
            <div
              v-for="fallback in fallbackExamples"
              :key="fallback.src"
              class="example fallback"
            >
              <img :src="fallback.src" :alt="fallback.alt" />
            </div>
          </template>
          <div class="example random" @click="handleRandom()">
            <icons-random />View Random
          </div>
        </div>
        <div
          class="stats random"
          style="margin-top: auto"
          @click="handleRandom()"
        >
          <div class="zoom-control">
            <div class="hoveredArea">{{ $ctx.hoveredArea }}</div>

            <div>voxels: {{ $ctx.voxelLength }}</div>
            <div>facets: {{ $ctx.facets }}</div>
            <div>
              size: ~{{ $ctx.size }}
              KB
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import { clampVerticalRotation } from "~/utils/camera";

export default {
  data() {
    return {
      gallery: [], // Stores the fetched gallery data

      retools: ["add", "fill", "paint", "erase"],
      exporttools: ["web", "csv", "json", "about"],
      bottomtools: ["grid", "camera", "config", "about"],
      cubeShapes: ["cube", "slab", "wedge", "spike"],
      examples: [],
      randomExamples: [],
      randomExamplesMobile: [],
      fallbackExamples: [
        { src: "/example1.png", alt: "Example 1 preview" },
        { src: "/example2.png", alt: "Example 2 preview" },
        { src: "/example3.png", alt: "Example 3 preview" },
        { src: "/example4.png", alt: "Example 4 preview" },
      ],
    };
  },
  mounted() {
    this.randomize();
    if (typeof window !== "undefined") {
      this.currentHash = window.location.hash.slice(1);
    }
  },
  methods: {
    handleRandom() {
      if (!this.examples.length) return;
      const randomExample =
        this.examples[(Math.random() * this.examples.length) | 0];
      history.replaceState({}, "", `#${randomExample.url}`);
      location.reload();
    },

    async loadModel(string) {
      if (!string) return;
      history.replaceState({}, "", location.pathname + "#" + string);
      location.reload();
    },
    randomize() {
      if (!this.examples.length) {
        this.randomExamples = [];
        this.randomExamplesMobile = [];
        return;
      }
      this.randomExamples = this.examples
        .filter((e) => !this.randomExamples.includes(e))
        .sort(() => Math.random() - 0.5)
        .slice(0, 4);

      this.randomExamplesMobile = this.examples
        .filter((e) => !this.randomExamples.includes(e))
        .sort(() => Math.random() - 0.5)
        .slice(0, 6);
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
  },
};
</script>
<style lang="scss">
.gallery-container button {
  font-size: 13px;
  text-shadow: none;
  font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
  color: #ddd;
  padding: 10px 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #222;
  border-radius: 6px;
}

.gallery-container {
  background: transparent !important;
  max-height: max-content;
  display: flex;
  gap: 6px;
  flex-direction: column;
  min-width: 152px;
  max-width: 152px;
  .examples-container {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    background: transparent;
    min-height: 140px;

    > div {
      flex: 1;
      background: #000;
      border: 2px solid #222;
      height: 140px;
      min-height: 140px;
      min-width: 152px;
      max-width: 152px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      &.random {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
        color: #888;
        &:hover {
          color: #eee;
          svg {
            fill: #eee;
          }
        }
        svg {
          width: 32px;
          height: auto;
          fill: #888;
        }
      }
      &:hover {
        border: 2px solid #333;
      }
      img {
        width: 100%;
        margin: 0 auto;
        padding: 15px;
      }
      &.fallback {
        cursor: default;
        pointer-events: none;
      }
    }
  }
}
.stats {
  flex: 1;
  background: #111;
  border: 2px solid #222;

  min-width: 152px;
  max-width: 152px;
  border-radius: 6px;
  display: block;

  cursor: pointer;
  position: relative;
  display: flex;
  display: none;

  flex-direction: column;
  padding: 5px 10px 10px;
  gap: 10px;
  font-size: 13px;
  font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
  color: #888;
  position: fixed;
  right: 5px;
  bottom: 5px;
  &:hover {
    color: #eee;
    svg {
      fill: #eee;
    }
  }
  svg {
    width: 32px;
    height: auto;
    fill: #888;
  }
  .zoom-control {
    z-index: 999;
    color: #666;
    display: flex;
    gap: 10px;
    font-size: 12px;
    font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
    height: auto !important;
    gap: 0;
    padding-top: 5px;
    padding-left: 2px;
    align-items: initial !important;
    justify-content: space-between;
    flex-direction: column;
    line-height: 18px;
    z-index: 999;
    input {
      max-width: 80px;
    }

    > div {
      display: flex;
      position: relative;
    }
  }
}

code[class*="language-"],
pre[class*="language-"] {
  text-shadow: none;
  background: transparent;
  color: #ce9178;
  padding: 0;
  font-size: 13px;
  font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
  max-height: 240px;
}

.token.property,
.token.tag,
.token.boolean,
.token.number,
.token.constant,
.token.symbol,
.token.deleted {
  color: #9cdcfe;
}

.token.selector,
.token.attr-name,
.token.string,
.token.char,
.token.builtin,
.token.inserted {
  color: #d7ba7d;
}

.token.function {
  color: #ce9178;
}

span.token.tag {
  color: #569cd6;
}

span.token.attr-name {
  color: #9cdcfe;
}

span.token.attr-value {
  color: #d7ba7d;
}

.token.punctuation {
  color: #ddd;
}

pre[class*="language-"]::-moz-selection,
pre[class*="language-"] ::-moz-selection,
code[class*="language-"]::-moz-selection,
code[class*="language-"] ::-moz-selection {
  text-shadow: none;
  background: #444;
}

pre[class*="language-"]::selection,
pre[class*="language-"] ::selection,
code[class*="language-"]::selection,
code[class*="language-"] ::selection {
  text-shadow: none;
  background: #444;
}

.newcodesidebar {
  z-index: 999;
  color: #eee;
  position: absolute;
  max-width: 152px !important;
  min-width: 152px !important;
  flex: 1;
  overflow: auto;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  top: 55px;
  right: 6px;
  > button {
    max-height: max-content;
    font-size: 13px;
    text-shadow: none;
    font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
    color: #ddd;
    padding: 10px 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #222;
    border-radius: 6px;
    flex-direction: row-reverse;
    gap: 5px;
  }
  .resection {
    flex: 1;
    overflow: auto;
    background: #212121;

    //max-height: 370px;
  }
}

button[disabled] {
  opacity: 0.8;
}
</style>
