<template>
  <header class="site-header">
    <div v-if="route.path !== '/dashboard'" class="header-left">
      <div class="header-ascii-wrap hide-small">
        <VideoAscii videoSrc="/0307.mp4" :width="50" :height="18" />
      </div>
      <UButton color="primary">API Recycler</UButton>
    </div>
    <div class="header-right">
      <UButton v-if="user && route.path !== '/dashboard'" to="/dashboard" color="primary">Dashboard</UButton>
      <UButton v-else-if="route.path !== '/dashboard'" color="primary" to='/auth/login' class="no-hover">Login</UButton>
    </div>
  </header>
</template>

<script setup lang="ts">
const user = useSupabaseUser()
const route = useRoute()
</script>

<style scoped>
.site-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1.25rem;
  background: transparent;
  pointer-events: none;
}

.header-left,
.header-right {
  pointer-events: all;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-ascii-wrap {
  width: 100px;
  height: 60px;
  overflow: hidden;
  flex-shrink: 0;
}

.header-ascii-wrap :deep(.video-ascii-container) {
  border: none !important;
  width: 100px;
  height: 60px;
  overflow: hidden;
}

.header-ascii-wrap :deep(pre) {
  font-size: 0.22rem !important;
  line-height: 1.1 !important;
}

.no-hover {
  cursor: default;
  pointer-events: none;
}

@media (max-width: 480px) {
  .hide-small {
    display: none;
  }
}
</style>
