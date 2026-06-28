<template>
  <a
    href="https://layoutit.com/"
    rel="noopener"
    target="_blank"
    class="brand-logo"
  >
    <div>
      <img
        width="44"
        height="44"
        src="https://grid.layoutit.com/img/icons/icon-44x44.png"
        alt="Layoutit"
      /><icons-logo />
    </div>
    <span>Terrain Generator</span>
  </a>
</template>

<style lang="scss">
.brand-logo {
  display: flex;
  padding-left: 12px;
  -webkit-text-decoration: none;
  text-decoration: none;
  color: #888;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
  padding-right: 10px;
  gap: 22px;
  min-width: 300px;
  display: flex;
  align-items: center;
  background: #2a2a2a;
  border-radius: 6px;
  > * {
    display: block;
  }

  span {
    font-size: 12px;
    font-family: Consolas, Monaco, Andale Mono, Ubuntu Mono, monospace;
    padding-bottom: 3px;
  }

  img {
    margin-right: 8px;
    height: 22px;
    width: 22px;
  }

  svg {
    width: 75px;
    height: auto;
  }
}
</style>
