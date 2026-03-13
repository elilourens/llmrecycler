<template>
  <div class="page">
    <!-- Top: text left, video right -->
    <div class="top-section">
      <div class="hero-text">
        <span class="hero-label">RESELL YOUR</span>
        <div class="big-lines">
          <span class="line-xl">API</span>
          <span class="line-xl offset">CREDITS</span>
          <span class="line-xl overlap">FOR CASH.</span>
        </div>
        <div class="hero-ctas">
          <a href="/auth/signup">
            <UButton color="primary" size="lg">Start Selling Now</UButton>
          </a>
          <a href="/auth/login">
            <UButton color="neutral" variant="outline" size="lg">Sign In</UButton>
          </a>
        </div>
      </div>
      <div class="ascii-wrap">
        <VideoAscii video-src="/0307.mp4" :width="90" :height="48" />
      </div>
      <div class="or-column">
        <div class="or-box ghost"><span>OR</span></div>
        <div class="or-box outline"><span>OR</span></div>
        <div class="or-box faded"><span>OR</span></div>
        <div class="or-box green"><span>OR</span></div>
        <div class="or-box solid"><span>OR</span></div>
      </div>
    </div>

    <!-- Bottom: lime section -->
    <div class="bottom-section">
      <div class="bottom-inner">
        <div class="bottom-ascii">
          <ImageAscii
            src="/plant.jpg"
            :invert="true"
            :gamma="0.45"
            :threshold="0.18"
            :cols="150"
            :rows="55"
          />
        </div>
        <div class="bottom-left">
          <div class="marquee-text">
            <span class="line-fill">BUY API</span>
            <span class="line-fill">CREDITS AT</span>
            <span class="line-fill">HALF PRICE.</span>
          </div>
          <div class="bottom-ctas">
            <a href="/auth/signup">
              <UButton color="primary" size="lg">Start Buying Now</UButton>
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Ticker divider -->
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
* { box-sizing: border-box; }

:global(body) {
  background: #111;
}

.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #111;
  overflow: hidden;
}

.hero-ctas {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-top: 0.5rem;
}

.top-section {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  min-height: 0;
  position: relative;
  max-width: 1800px;
  margin: 0 auto;
  width: 100%;
}

.ascii-wrap {
  flex: 0 0 55%;
  overflow: hidden;
  line-height: 0;
  display: flex;
  align-items: center;
  position: relative;
}

.or-column {
  position: absolute;
  top: 0;
  bottom: -6vw;
  right: 2rem;
  width: 18vw;
  display: flex;
  flex-direction: column;
  z-index: 10;
}

.or-box {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.or-box span {
  font-family: Arial Black, Impact, sans-serif;
  font-size: 4.5vw;
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.04em;
}

.or-box.ghost {
  opacity: 0.12;
}
.or-box.ghost span { color: #fff; }

.or-box.outline {
  border: 1px solid #2a2a2a;
  opacity: 0.35;
}
.or-box.outline span {
  color: transparent;
  -webkit-text-stroke: 1px #fff;
}

.or-box.faded {
  background: #161616;
  opacity: 0.6;
}
.or-box.faded span { color: #444; }

.or-box.green {
  background: #0d1a0d;
  opacity: 0.85;
}
.or-box.green span { color: var(--color-accent); }

.or-box.solid {
  background: #111;
}
.or-box.solid span { color: #fff; }

.ascii-wrap :deep(.video-ascii-container) {
  border: none !important;
  width: 100%;
}

.ascii-wrap :deep(pre) {
  font-size: clamp(0.28rem, 0.75vw, 0.48rem) !important;
}


.hero-text {
  flex: 0 0 45%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 3rem 2rem 3rem 2.5rem;
}

.hero-label {
  font-family: 'Courier New', monospace;
  font-size: clamp(0.6rem, 1.2vw, 0.8rem);
  letter-spacing: 0.2em;
  color: #fff;
  font-weight: bold;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
  display: block;
}

.big-lines {
  display: flex;
  flex-direction: column;
  line-height: 0.85;
  margin-bottom: 0.75rem;
}

.line-xl {
  font-family: Arial Black, Impact, sans-serif;
  font-size: clamp(3rem, 7.5vw, 6rem);
  font-weight: 900;
  color: #fff;
  letter-spacing: -0.03em;
  display: block;
  text-transform: uppercase;
}

.line-xl.offset {
  margin-left: clamp(1rem, 3vw, 2.5rem);
}

.line-xl.overlap {
  margin-left: clamp(2rem, 6vw, 5rem);
}

/* Bottom lime section */
.bottom-section {
  flex: 0 0 auto;
  background: var(--color-accent);
  overflow: hidden;
}

.bottom-inner {
  max-width: 1800px;
  margin: 0 auto;
  width: 100%;
  padding: 1rem 0 0 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
}

.bottom-left {
  flex: 0 0 45%;
  display: flex;
  flex-direction: column;
}

.bottom-ascii {
  flex: 0 0 auto;
  overflow: hidden;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  align-self: stretch;
  line-height: 0;
  width: clamp(160px, 18vw, 280px);
}

.marquee-text {
  display: flex;
  flex-direction: column;
  line-height: 0.88;
  padding: 0 0.5rem;
}

.line-fill {
  font-family: Arial Black, Impact, sans-serif;
  font-size: 8.5vw;
  font-weight: 900;
  color: #111;
  text-transform: uppercase;
  letter-spacing: -0.03em;
  white-space: nowrap;
  display: block;
}

.bottom-ctas {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 1.25rem 1.5rem;
}


/* Ticker divider */
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
  flex-direction: row;
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
  color: #666;
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
  color: #444;
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

@media (max-width: 640px) {
  .top-section {
    flex-direction: column;
  }

  .hero-text {
    flex: 0 0 auto;
    padding: 2rem 1.25rem 1rem;
  }

  .ascii-wrap {
    flex: 0 0 auto;
    width: 100%;
    justify-content: center;
  }

  .ascii-wrap :deep(pre) {
    font-size: clamp(0.18rem, 1.6vw, 0.28rem) !important;
  }

  .or-column {
    position: static;
    width: 100%;
    flex-direction: row;
    height: 2.5rem;
  }

  .or-box span {
    font-size: 5vw;
  }

  .bottom-inner {
    flex-direction: column-reverse;
  }

  .bottom-ascii {
    width: 100%;
    justify-content: center;
  }


  .bottom-left {
    flex: 0 0 auto;
    width: 100%;
  }

  .line-fill {
    font-size: 13vw;
  }
}
</style>
