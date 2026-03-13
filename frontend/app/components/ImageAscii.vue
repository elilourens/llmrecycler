<template>
  <div class="image-ascii-container">
    <img ref="imgEl" :src="src" style="display:none" crossorigin="anonymous" @load="render" />
    <canvas ref="canvasEl" style="display:none" />
    <div class="ascii-segments">
      <pre
        v-for="(text, i) in segTexts"
        :key="i"
        class="ascii-seg"
        :style="{ fontSize: bands[i]!.fontSize }"
      >{{ text }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Band {
  /** number of characters across this band's width */
  cols: number
  fontSize: string
  /** rows for this band — should be inversely proportional to fontSize to keep same visual height */
  rows?: number
}

const props = defineProps({
  src: { type: String, required: true },
  invert: { type: Boolean, default: true },
  gamma: { type: Number, default: 0.45 },
  threshold: { type: Number, default: 0.2 },
  /** char width / line-height ratio — monospace chars are ~0.5 wide relative to their line height */
  charAspect: { type: Number, default: 0.5 },
  bands: {
    type: Array as () => Band[],
    default: (): Band[] => [
      { cols: 100, fontSize: '0.26rem' },
    ],
  },
})

const imgEl = ref<HTMLImageElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const segTexts = ref<string[]>([])

// light → dark: ASCII chars for mid-tones, blocks for dark areas
const CHARS = ' .;+#▒▒▓▓███'

const renderBand = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  bandIdx: number,
): string => {
  const band = props.bands[bandIdx]!
  const cols = band.cols
  const rows = band.rows ?? Math.round(cols * (img.naturalHeight / img.naturalWidth) * props.charAspect)
  const n = props.bands.length
  const srcX = Math.floor((bandIdx / n) * img.naturalWidth)
  const srcW = Math.ceil((1 / n) * img.naturalWidth)

  canvas.width = cols
  canvas.height = rows
  ctx.drawImage(img, srcX, 0, srcW, img.naturalHeight, 0, 0, cols, rows)

  const { data } = ctx.getImageData(0, 0, cols, rows)
  let out = ''
  for (let i = 0; i < data.length; i += 4) {
    const b = (data[i] ?? 0) * 0.299 + (data[i + 1] ?? 0) * 0.587 + (data[i + 2] ?? 0) * 0.114
    let t = props.invert ? 1 - b / 255 : b / 255
    if (t < props.threshold) t = 0
    else t = Math.pow((t - props.threshold) / (1 - props.threshold), props.gamma)
    out += CHARS[Math.round(t * (CHARS.length - 1))]
    if ((i / 4 + 1) % cols === 0) out += '\n'
  }
  return out
}

const render = () => {
  const img = imgEl.value
  const canvas = canvasEl.value
  if (!img || !canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  segTexts.value = props.bands.map((_, i) => renderBand(ctx, canvas, img, i))
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

.ascii-segments {
  display: flex;
  align-items: flex-end;
  width: 100%;
}

.ascii-seg {
  flex: 0 0 auto;
  margin: 0;
  white-space: pre;
  font-family: monospace;
  line-height: 1.15;
  font-weight: bold;
  overflow: hidden;
}
</style>
