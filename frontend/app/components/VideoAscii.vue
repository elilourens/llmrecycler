<template>
  <div class="video-ascii-container border-2 border-slate-900">
    <video
      ref="videoElement"
      :src="videoSrc"
      autoplay
      muted
      loop
      style="display: none"
    />
    <canvas ref="canvasElement" style="display: none" />
    <pre class="font-mono text-[0.35rem] md:text-[0.35rem] lg:text-[0.45rem] leading-[1.1] whitespace-pre" style="color: #85BB65;">{{ asciiArt }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  videoSrc: {
    type: String,
    required: true
  },
  width: {
    type: Number,
    default: 140
  },
  height: {
    type: Number,
    default: 45
  }
})

const videoElement = ref<HTMLVideoElement | null>(null)
const canvasElement = ref<HTMLCanvasElement | null>(null)
const asciiArt = ref('')

// ASCII characters from darkest to lightest
const ASCII_CHARS = ' .:-=+*#%@'

const getAsciiCharacter = (brightness: number): string => {
  const index = Math.floor((brightness / 255) * (ASCII_CHARS.length - 1))
  return ASCII_CHARS[index]
}

const getPixelBrightness = (r: number, g: number, b: number): number => {
  return r * 0.299 + g * 0.587 + b * 0.114
}

const convertFrameToAscii = () => {
  const video = videoElement.value
  const canvas = canvasElement.value
  if (!video || !canvas) return ''

  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // Set canvas size based on desired ASCII resolution
  canvas.width = props.width
  canvas.height = props.height

  // Draw video frame to canvas
  ctx.drawImage(video, 0, 0, props.width, props.height)

  const imageData = ctx.getImageData(0, 0, props.width, props.height)
  const data = imageData.data

  let ascii = ''

  // Convert pixels to ASCII
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    const brightness = getPixelBrightness(r, g, b)
    const char = getAsciiCharacter(brightness)

    ascii += char

    // Add newline at end of each row
    if ((i / 4 + 1) % props.width === 0) {
      ascii += '\n'
    }
  }

  return ascii
}

let animationId: number | null = null

const animate = () => {
  if (videoElement.value && videoElement.value.readyState >= videoElement.value.HAVE_CURRENT_DATA) {
    asciiArt.value = convertFrameToAscii()
  }
  animationId = requestAnimationFrame(animate)
}

onMounted(() => {
  if (videoElement.value) {
    const video = videoElement.value

    // Ensure video plays
    const playPromise = video.play()
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.log('Autoplay prevented:', error)
        // Retry play on user interaction
        document.addEventListener('click', () => video.play(), { once: true })
      })
    }

    // Start animation when video is ready
    const startAnimation = () => {
      if (!animationId) {
        animate()
      }
    }

    video.addEventListener('loadedmetadata', startAnimation)
    video.addEventListener('play', startAnimation)

    // Fallback: start after a short delay
    setTimeout(() => {
      if (!animationId) {
        animate()
      }
    }, 100)
  }
})

onUnmounted(() => {
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
  }
})
</script>

<style scoped>
.video-ascii-container {
  display: inline-block;
  overflow: hidden;
}

.video-ascii-container pre {
  margin: 0 !important;
}
</style>
