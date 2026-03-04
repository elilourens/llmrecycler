<template>
  <UCard>
    <template #header>
      <div class="bg-gray-50 -mx-6 -my-4 px-6 py-4">
        <h2 class="text-lg font-semibold text-highlighted">Balance</h2>
      </div>
    </template>

    <div class="space-y-3">
      <div>
        <p class="text-xs text-muted uppercase tracking-wide mb-1">Current Balance</p>
        <p class="text-2xl font-bold text-highlighted">{{ formatCurrency(balance) }}</p>
      </div>

      <div class="grid grid-cols-2 gap-4 pt-2">
        <div>
          <p class="text-xs text-muted mb-1">Earned</p>
          <p class="text-sm font-semibold text-highlighted">+{{ formatCurrency(totalEarned) }}</p>
        </div>

        <div>
          <p class="text-xs text-muted mb-1">Spent</p>
          <p class="text-sm font-semibold text-highlighted">-{{ formatCurrency(totalSpent) }}</p>
        </div>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
interface Props {
  balance: number
  totalSpent: number
  totalEarned: number
}

withDefaults(defineProps<Props>(), {
  balance: 0,
  totalSpent: 0,
  totalEarned: 0,
})

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(amount)
}
</script>
