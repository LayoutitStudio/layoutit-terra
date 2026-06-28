<template>
  <div class="rescene">
    <div
      class="recube"
      :style="{
        transform: `translateZ(-5200px) rotateX(${$ctx.rotX}deg) rotate(${$ctx.rotY}deg)`,
      }"
    >
      <div class="recube__face recube__face--front"></div>
      <div class="recube__face recube__face--back"></div>
      <div class="recube__face recube__face--right"></div>
      <div class="recube__face recube__face--left"></div>
      <div class="recube__face recube__face--top"></div>
      <div class="recube__face recube__face--bottom"></div>
    </div>
  </div>
</template>

<style lang="scss">
.rescene {
  width: 160px;
  height: 160px;
  perspective: 10000px;
  position: fixed;
  right: 0;
  bottom: 5px;
  display: flex;
  justify-content: center;
  z-index: 99999;
  background: transparent !important;
}

.recube {
  width: 140px;
  height: 140px;
  position: relative;
  transform-style: preserve-3d;
}

.recube__face {
  position: absolute;
  width: 140px;
  height: 140px;
  border: 0.5px solid black;
  color: white;
  text-align: center;
}

.recube__face--front {
  background: hsla(0, 100%, 50%, 0.7);
}

.recube__face--right {
  background: hsla(60, 100%, 50%, 0.7);
}

.recube__face--back {
  background: hsla(120, 100%, 50%, 0.7);
}

.recube__face--left {
  background: hsla(180, 100%, 50%, 0.7);
}

.recube__face--top {
  background: hsla(240, 100%, 50%, 0.7);
}

.recube__face--bottom {
  background: hsla(300, 100%, 50%, 0.7);
}

.recube__face--front {
  transform: rotateY(0deg) translateZ(70px);
}

.recube__face--right {
  transform: rotateY(90deg) translateZ(70px);
}

.recube__face--back {
  transform: rotateY(180deg) translateZ(70px);
}

.recube__face--left {
  transform: rotateY(-90deg) translateZ(70px);
}

.recube__face--top {
  transform: rotateX(90deg) translateZ(70px);
}

.recube__face--bottom {
  transform: rotateX(-90deg) translateZ(70px);
}
</style>
