<template>
  <UCard :ui="{ root: 'rounded-lg overflow-hidden flex flex-col h-full', body: 'p-4 sm:p-6 flex flex-col flex-1' }">
    <template #header>
      <div class="-mx-6 -my-4 px-6 py-4 flex justify-between items-center bg-accent">
        <h2 class="text-lg font-bold text-highlighted">Info</h2>
      </div>
    </template>

    <div class="mt-auto grid grid-cols-2 gap-3">
      <UModal v-model:open="isPricingOpen" title="Pricing" :ui="{ content: 'max-w-4xl' }">
        <UButton color="primary" block @click="isPricingOpen = true">Pricing</UButton>
        <template #body>
          <UTabs :items="pricingTabs" class="w-full">
            <template #buying>
              <div class="mt-4">
                <div v-if="loadingPricing" class="flex justify-center py-8">
                  <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl text-muted" />
                </div>
                <div v-else-if="pricingError" class="text-error text-sm py-4 text-center">
                  Failed to load pricing data.
                </div>
                <div v-else class="overflow-auto max-h-[60vh] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="border-b border-default">
                        <th class="text-left py-2 px-3 font-semibold text-muted">Provider</th>
                        <th class="text-left py-2 px-3 font-semibold text-muted">Model</th>
                        <th class="text-right py-2 px-3 font-semibold text-muted">Input / 1M tokens</th>
                        <th class="text-right py-2 px-3 font-semibold text-muted">Output / 1M tokens</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in pricing"
                        :key="`${row.provider}-${row.model}`"
                        class="border-b border-default last:border-0 hover:bg-elevated/50"
                      >
                        <td class="py-2 px-3 capitalize">{{ row.provider }}</td>
                        <td class="py-2 px-3 font-mono text-xs">{{ row.model }}</td>
                        <td class="py-2 px-3 text-right">
                          <span class="line-through text-muted mr-1">${{ row.inputUpstream.toFixed(4) }}</span>
                          <span class="font-semibold text-accent">${{ row.inputBuyer.toFixed(4) }}</span>
                        </td>
                        <td class="py-2 px-3 text-right">
                          <span class="line-through text-muted mr-1">${{ row.outputUpstream.toFixed(4) }}</span>
                          <span class="font-semibold text-accent">${{ row.outputBuyer.toFixed(4) }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>
            <template #selling>
              <div class="mt-4">
                <div v-if="loadingPricing" class="flex justify-center py-8">
                  <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl text-muted" />
                </div>
                <div v-else-if="pricingError" class="text-error text-sm py-4 text-center">
                  Failed to load pricing data.
                </div>
                <div v-else class="overflow-auto max-h-[60vh] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="border-b border-default">
                        <th class="text-left py-2 px-3 font-semibold text-muted">Provider</th>
                        <th class="text-left py-2 px-3 font-semibold text-muted">Model</th>
                        <th class="text-right py-2 px-3 font-semibold text-muted">Input / 1M tokens</th>
                        <th class="text-right py-2 px-3 font-semibold text-muted">Output / 1M tokens</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in pricing"
                        :key="`${row.provider}-${row.model}`"
                        class="border-b border-default last:border-0 hover:bg-elevated/50"
                      >
                        <td class="py-2 px-3 capitalize">{{ row.provider }}</td>
                        <td class="py-2 px-3 font-mono text-xs">{{ row.model }}</td>
                        <td class="py-2 px-3 text-right">
                          <span class="font-semibold text-accent">${{ row.inputSeller.toFixed(4) }}</span>
                        </td>
                        <td class="py-2 px-3 text-right">
                          <span class="font-semibold text-accent">${{ row.outputSeller.toFixed(4) }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>
          </UTabs>
        </template>
      </UModal>

      <UModal v-model:open="isHowToUseOpen" title="How to use" :ui="{ content: 'max-w-4xl' }">
        <UButton color="primary" block @click="isHowToUseOpen = true">How to use</UButton>
        <template #body>
          <UTabs :items="howToUseTabs" class="w-full">
            <template v-for="tab in howToUseTabs" #[tab.slot] :key="tab.slot">
              <div v-if="codeExamples[tab.slot]" class="mt-4 space-y-4 overflow-auto max-h-[65vh] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div v-for="(block, idx) in [
                  { label: 'Before', code: codeExamples[tab.slot]!.before, highlight: false },
                  { label: 'After', code: codeExamples[tab.slot]!.after, highlight: true },
                ]" :key="idx">
                  <div class="flex items-center justify-between px-3 py-1.5 rounded-t-lg" :class="block.highlight ? 'bg-neutral-200' : 'bg-neutral-100'">
                    <span class="text-xs font-semibold" :class="block.highlight ? 'text-accent' : 'text-neutral-400'">{{ block.label }}</span>
                    <button
                      class="text-xs text-neutral-500 hover:text-neutral-900 transition-colors px-2 py-0.5 rounded"
                      @click="copyCode(block.code)"
                    >Copy</button>
                  </div>
                  <pre class="bg-neutral-100 text-neutral-800 p-4 rounded-b-lg text-xs font-mono overflow-x-auto leading-relaxed [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">{{ block.code }}</pre>
                </div>
              </div>
            </template>
          </UTabs>
        </template>
      </UModal>

      <UModal v-model:open="isSupportOpen" title="Support">
        <UButton color="primary" block @click="isSupportOpen = true">Support</UButton>
        <template #body>
          <div class="py-4 text-center space-y-2">
            <p class="text-sm text-muted">For help, email us at:</p>
            <p class="font-mono font-semibold">support@apirecycler.com</p>
          </div>
        </template>
      </UModal>
      <UModal v-model:open="isActiveKeysOpen" title="Active Seller Keys">
        <UButton color="primary" block @click="isActiveKeysOpen = true">Active Keys</UButton>
        <template #body>
          <div class="py-4">
            <div v-if="loadingActiveKeys" class="flex justify-center py-8">
              <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl text-muted" />
            </div>
            <div v-else-if="activeKeysError" class="text-error text-sm py-4 text-center">
              Failed to load active keys.
            </div>
            <div v-else-if="activeKeyEntries.length === 0" class="text-sm text-muted text-center py-4">
              No active seller keys.
            </div>
            <div v-else class="space-y-3 py-2">
              <div
                v-for="[provider, count] in activeKeyEntries"
                :key="provider"
                class="flex items-center gap-3"
              >
                <span class="w-24 text-sm capitalize shrink-0">{{ provider }}</span>
                <div class="flex-1 bg-neutral-100 h-6 relative">
                  <div
                    class="h-full bg-accent transition-all duration-500"
                    :style="{ width: `${(count / activeKeysMax) * 100}%` }"
                  />
                </div>
                <span class="w-6 text-sm font-semibold text-right shrink-0">{{ count }}</span>
              </div>
            </div>
          </div>
        </template>
      </UModal>
    </div>
  </UCard>
</template>

<script setup lang="ts">
const isSupportOpen = ref(false)

const isActiveKeysOpen = ref(false)
const loadingActiveKeys = ref(false)
const activeKeysError = ref(false)
const activeKeys = ref<Record<string, number>>({})
const activeKeyEntries = computed(() => Object.entries(activeKeys.value))
const activeKeysMax = computed(() => Math.max(...Object.values(activeKeys.value), 1))

const fetchActiveKeys = async () => {
  loadingActiveKeys.value = true
  activeKeysError.value = false
  try {
    const data = await apiFetch('/api/keys/stats')
    activeKeys.value = data.activeKeys || {}
  } catch {
    activeKeysError.value = true
  } finally {
    loadingActiveKeys.value = false
  }
}

watch(isActiveKeysOpen, (open) => {
  if (open) fetchActiveKeys()
})

const { apiFetch } = useApi()
const config = useRuntimeConfig()
const proxyUrl = `${config.public.apiUrl}/api/proxy`

// --- Pricing ---
const isPricingOpen = ref(false)
const loadingPricing = ref(false)
const pricingError = ref(false)
const pricing = ref<Array<{
  provider: string
  model: string
  inputUpstream: number
  outputUpstream: number
  inputBuyer: number
  outputBuyer: number
  inputSeller: number
  outputSeller: number
}>>([])

const pricingTabs = [
  { label: 'Buying Prices', slot: 'buying', value: 'buying' },
  { label: 'Selling Prices', slot: 'selling', value: 'selling' },
]

const fetchPricing = async () => {
  if (pricing.value.length > 0) return
  loadingPricing.value = true
  pricingError.value = false
  try {
    const data = await apiFetch('/api/pricing')
    pricing.value = data.pricing || []
  } catch {
    pricingError.value = true
  } finally {
    loadingPricing.value = false
  }
}

watch(isPricingOpen, (open) => {
  if (open) fetchPricing()
})

// --- How to use ---
const isHowToUseOpen = ref(false)

const toast = useToast()

const copyCode = (code: string) => {
  navigator.clipboard.writeText(code)
  toast.add({ title: 'Copied to clipboard', color: 'success' })
}

const howToUseTabs = [
  { label: 'OpenAI', slot: 'openai', value: 'openai' },
  { label: 'Claude', slot: 'claude', value: 'claude' },
  { label: 'Gemini', slot: 'gemini', value: 'gemini' },
  { label: 'DeepSeek', slot: 'deepseek', value: 'deepseek' },
  { label: 'Grok', slot: 'grok', value: 'grok' },
]

const codeExamples: Record<string, { before: string; after: string }> = {
  openai: {
    before: `from openai import OpenAI

client = OpenAI(api_key="sk-...")

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`,
    after: `from openai import OpenAI

client = OpenAI(
    api_key="<your-buyer-key>",
    base_url="${proxyUrl}/v1"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`,
  },
  claude: {
    before: `import anthropic

client = anthropic.Anthropic(api_key="sk-ant-...")

message = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}]
)
print(message.content[0].text)`,
    after: `import anthropic

client = anthropic.Anthropic(
    api_key="<your-buyer-key>",
    base_url="${proxyUrl}"
)

message = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}]
)
print(message.content[0].text)`,
  },
  gemini: {
    before: `from openai import OpenAI

client = OpenAI(
    api_key="AIza...",
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)

response = client.chat.completions.create(
    model="gemini-2.0-flash",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`,
    after: `from openai import OpenAI

client = OpenAI(
    api_key="<your-buyer-key>",
    base_url="${proxyUrl}/v1"
)

response = client.chat.completions.create(
    model="gemini-2.0-flash",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`,
  },
  deepseek: {
    before: `from openai import OpenAI

client = OpenAI(
    api_key="sk-...",
    base_url="https://api.deepseek.com"
)

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`,
    after: `from openai import OpenAI

client = OpenAI(
    api_key="<your-buyer-key>",
    base_url="${proxyUrl}"
)

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`,
  },
  grok: {
    before: `from openai import OpenAI

client = OpenAI(
    api_key="xai-...",
    base_url="https://api.x.ai/v1"
)

response = client.chat.completions.create(
    model="grok-3",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`,
    after: `from openai import OpenAI

client = OpenAI(
    api_key="<your-buyer-key>",
    base_url="${proxyUrl}"
)

response = client.chat.completions.create(
    model="grok-3",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`,
  },
}
</script>
