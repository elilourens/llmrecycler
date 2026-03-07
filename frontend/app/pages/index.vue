<template>
  <div class="min-h-screen bg-gradient-to-br from-white to-slate-50 flex items-center justify-center px-4">
    <div class="max-w-4xl w-full text-center overflow-hidden">
      <h1 class="text-5xl md:text-6xl font-bold text-primary mb-8">API Recycler</h1>
      <div class="mb-8">
        <VideoAscii video-src="/0307.mp4" :width="60" :height="30" />
      </div>

      <div class="max-w-2xl mx-auto mb-8">
        <p class="text-lg md:text-xl font-medium text-slate-900 mb-2">Resell your API credits for cash.</p>
        <p class="text-slate-400 mb-3">or</p>
        <p class="text-lg md:text-xl font-medium text-slate-900">Buy API credits for half price.</p>
      </div>
      <div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <a href="/auth/login">
          <UButton
            color="primary"
            size="lg"
          >
            Sign In
          </UButton>
        </a>
        <a href="/auth/signup">
          <UButton
            color="primary"
            variant="soft"
            size="lg"
          >
            Create Account
          </UButton>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'LLM Recycler'
})
</script>
