<template>
  <div class="page">
    <!-- Hero image -->
    <div class="hero-wrap">
      <div class="hero-bg"></div>
      <AppHeader />
      <div class="hero-squares">
        <div class="hero-square">
          <div class="hero-square-text">Recycle API Credits<br>for <span class="accent">Cash.</span></div>
          <button class="hero-btn" @click="navigateTo('/auth/signup')">Start Selling →</button>
        </div>
        <div class="hero-square">
          <div class="hero-square-text">Buy API Inference<br>for <span class="accent">Half Price.</span></div>
          <button class="hero-btn" @click="navigateTo('/auth/signup')">Start Buying →</button>
        </div>
      </div>
    </div>

    <!-- Ticker -->
    <div class="ticker-row">
      <div class="ticker-track">
        <div class="ticker-content">
          <span v-for="i in 8" :key="i" class="ticker-item">PRICING <span class="ticker-sep">//</span></span>
        </div>
        <div class="ticker-content" aria-hidden="true">
          <span v-for="i in 8" :key="'b' + i" class="ticker-item">PRICING <span class="ticker-sep">//</span></span>
        </div>
      </div>
    </div>

    <!-- Pricing section -->
    <div class="pricing-section">
      <div class="pricing-card">
        <span class="pricing-tag">FOR SELLERS</span>
        <div class="pricing-amount">40<span class="pricing-unit">%</span></div>
        <p class="pricing-desc">of face value back on unused credits</p>
        <ul class="pricing-list">
          <li>Major AI API providers supported</li>
          <li>Withdrawal to PayPal — no lock-in</li>
          <li>Instantly start selling, no approval needed</li>
        </ul>
      </div>
      <div class="pricing-divider">//</div>
      <div class="pricing-card">
        <span class="pricing-tag">FOR BUYERS</span>
        <div class="pricing-amount">50<span class="pricing-unit">%</span></div>
        <p class="pricing-desc">off retail price on all API credits</p>
        <ul class="pricing-list">
          <li>Same models, same limits</li>
          <li>Drop-in API compatible</li>
          <li>Pay only for what you use</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'LLM Recycler' })
</script>

<style scoped>
:global(body) {
  background: #111;
}

.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #111;
}

.accent {
  color: var(--color-accent);
}

.hero-wrap {
  position: relative;
  width: 100%;
  height: 90vh;
}

.hero-bg {
  width: 100%;
  height: 100%;
  background: url('/eye_plants.jpg') center center / cover no-repeat;
}

.hero-squares {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 2rem;
}

.hero-square {
  width: clamp(380px, 38vw, 620px);
  height: clamp(260px, 22vw, 360px);
  background: #1a1a1a;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 2rem 2.25rem;
  transition: transform 0.15s ease;
}

.hero-square:hover {
  transform: scale(1.04);
}

.hero-square-text {
  font-family: Arial Black, Impact, sans-serif;
  font-size: clamp(2rem, 3vw, 2.6rem);
  font-weight: 900;
  color: #e8e8e8;
  text-transform: uppercase;
  line-height: 1.0;
  letter-spacing: -0.02em;
}

.hero-btn {
  align-self: flex-start;
  margin-top: 0.5rem;
  background: #fff;
  color: #111;
  border: none;
  padding: 0.65rem 1.5rem;
  font-family: Arial Black, Impact, sans-serif;
  font-size: 0.85rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: background 0.1s;
}

.hero-btn:hover {
  background: var(--color-accent);
  color: #111;
}


/* Ticker */
.ticker-row {
  background: var(--color-accent);
  border-top: 2px solid #6a9a50;
  border-bottom: 2px solid #6a9a50;
  overflow: hidden;
  white-space: nowrap;
  padding: 0.5rem 0;
}

.ticker-track {
  display: flex;
  width: max-content;
  animation: ticker 18s linear infinite;
}

.ticker-content {
  display: flex;
  flex-shrink: 0;
}

.ticker-item {
  font-family: Arial Black, Impact, sans-serif;
  font-size: 1.1rem;
  font-weight: 900;
  color: #111;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0 1.5rem;
}

.ticker-sep {
  color: #3d6b30;
  margin-left: 1.5rem;
}

@keyframes ticker {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

/* Pricing section */
.pricing-section {
  background: #111;
  padding: 4rem 3rem;
  display: flex;
  align-items: flex-start;
  gap: 2rem;
  max-width: 1800px;
  margin: 0 auto;
  width: 100%;
}

.pricing-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pricing-tag {
  font-family: 'Courier New', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.25em;
  color: var(--color-accent);
  font-weight: bold;
  text-transform: uppercase;
}

.pricing-amount {
  font-family: Arial Black, Impact, sans-serif;
  font-size: clamp(4rem, 10vw, 8rem);
  font-weight: 900;
  color: #fff;
  line-height: 0.9;
  letter-spacing: -0.03em;
}

.pricing-unit {
  font-size: 0.5em;
  color: var(--color-accent);
}

.pricing-desc {
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  color: #888;
  margin: 0;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border-top: 1px solid #222;
  padding-top: 0.75rem;
}

.pricing-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.pricing-list li {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  color: #aaa;
  letter-spacing: 0.05em;
}

.pricing-list li::before {
  content: '→ ';
  color: var(--color-accent);
}

.pricing-divider {
  font-family: Arial Black, sans-serif;
  font-size: 2rem;
  font-weight: 900;
  color: #222;
  align-self: center;
  padding: 0 1rem;
}

@media (max-width: 900px) {
  .hero-squares {
    flex-direction: column;
    align-items: center;
  }

  .hero-square {
    width: clamp(220px, 60vw, 380px);
    height: auto;
    min-height: clamp(160px, 25vh, 240px);
  }

  .hero-square-text {
    font-size: clamp(1.4rem, 5vw, 2rem);
  }
}

@media (max-width: 768px) {
  .pricing-section {
    flex-direction: column;
    padding: 2.5rem 1.5rem;
  }

  .pricing-divider {
    align-self: flex-start;
    padding: 0;
  }
}

</style>
