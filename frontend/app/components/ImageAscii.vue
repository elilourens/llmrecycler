<template>
  <div class="image-ascii-container">
    <img ref="imgEl" :src="src" style="display:none" crossorigin="anonymous" @load="render" />
    <canvas ref="canvasEl" class="ascii-canvas" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps({
  src: { type: String, required: true },
  invert: { type: Boolean, default: true },
  gamma: { type: Number, default: 0.45 },
  threshold: { type: Number, default: 0.18 },
  cols: { type: Number, default: 120 },
  rows: { type: Number, default: 55 },
  bgColor: { type: String, default: '#85BB65' },
  fgColor: { type: String, default: '#111111' },
})

const imgEl = ref<HTMLImageElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

const render = () => {
  const img = imgEl.value
  const canvas = canvasEl.value
  if (!img || !canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const cols = props.cols
  const rows = props.rows
  const cellW = canvas.offsetWidth / cols
  const cellH = canvas.offsetHeight / rows

  canvas.width = canvas.offsetWidth
  canvas.height = canvas.offsetHeight

  // Sample image into cols×rows grid
  const offscreen = document.createElement('canvas')
  offscreen.width = cols
  offscreen.height = rows
  const octx = offscreen.getContext('2d')!
  octx.drawImage(img, 0, 0, cols, rows)
  const { data } = octx.getImageData(0, 0, cols, rows)

  ctx.fillStyle = props.bgColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = (row * cols + col) * 4
      const b = (data[idx]! * 0.299 + data[idx + 1]! * 0.587 + data[idx + 2]! * 0.114)
      let t = props.invert ? 1 - b / 255 : b / 255
      if (t < props.threshold) continue
      t = Math.pow((t - props.threshold) / (1 - props.threshold), props.gamma)
      ctx.globalAlpha = t
      ctx.fillStyle = props.fgColor
      ctx.fillRect(Math.floor(col * cellW), Math.floor(row * cellH), Math.ceil(cellW), Math.ceil(cellH))
    }
  }
  ctx.globalAlpha = 1
}

onMounted(() => {
  if (imgEl.value?.complete) render()
})
</script>

<style scoped>
.image-ascii-container {
  display: flex;
  width: 100%;
  height: 100%;
}

.ascii-canvas {
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: pixelated;
}
</style>
