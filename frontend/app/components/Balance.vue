<template>
  <UCard>
    <template #header>
      <div class="-mx-6 -my-4 px-6 py-4 flex items-center justify-between" style="background-color: #85BB65;">
        <h2 class="text-lg font-bold text-highlighted">Balance</h2>
        <UButton
          icon="i-heroicons-arrow-path"
          color="primary"
          variant="ghost"
          size="sm"
          @click="$emit('refresh')"
        />
      </div>
    </template>

    <div class="space-y-4">
      <div>
        <p class="text-xs text-muted uppercase tracking-wide mb-1">Current Balance</p>
        <p class="text-2xl font-bold text-highlighted">{{ formatCurrency(balance) }}</p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <p class="text-xs text-muted mb-1">Earned</p>
          <p class="text-sm font-semibold text-highlighted">+{{ formatCurrency(totalEarned) }}</p>
        </div>

        <div>
          <p class="text-xs text-muted mb-1">Spent</p>
          <p class="text-sm font-semibold text-highlighted">-{{ formatCurrency(totalSpent) }}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <UButton
          label="Add Funds"
          color="primary"
          @click="showAddFundsModal = true"
        />
        <UButton
          label="Withdraw"
          color="primary"
          @click="showWithdrawModal = true"
        />
      </div>
    </div>
  </UCard>

  <UModal v-model:open="showAddFundsModal" title="Add Funds">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">Select an amount to add to your wallet</p>

        <div class="grid grid-cols-2 gap-2">
          <UButton
            v-for="amount in presetAmounts"
            :key="amount"
            :label="`$${amount}`"
            variant="outline"
            :loading="loadingAmount === amount"
            @click="handleAddFunds(amount)"
          />
        </div>

        <UDivider label="or" />

        <div class="space-y-2">
          <label class="text-sm text-muted">Custom amount (USD)</label>
          <div class="flex gap-2">
            <UInput
              v-model.number="customAmount"
              type="number"
              placeholder="10.00"
              step="0.01"
              min="0.01"
            />
            <UButton
              label="Add"
              :loading="loadingAmount !== null && loadingAmount !== 0"
              @click="handleAddFunds(customAmount)"
            />
          </div>
        </div>
      </div>
    </template>
  </UModal>

  <UModal v-model:open="showWithdrawModal" title="Withdraw to PayPal">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">Minimum withdrawal: $2</p>
        <p class="text-xs text-muted">Withdrawals are pending approval</p>

        <div class="space-y-3">
          <div>
            <label class="text-sm text-muted block mb-1">Amount (USD)</label>
            <UInput
              v-model.number="withdrawAmount"
              type="number"
              placeholder="10.00"
              step="0.01"
              min="2"
            />
          </div>

          <div>
            <label class="text-sm text-muted block mb-1">PayPal Email</label>
            <UInput
              v-model="withdrawPaypalEmail"
              type="email"
              placeholder="your@email.com"
            />
          </div>

          <UButton
            label="Request Withdrawal"
            color="primary"
            class="w-full"
            :loading="withdrawLoading"
            @click="handleWithdraw"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from '#ui/composables/useToast'
import { useApi } from '~/composables/useApi'

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

const emit = defineEmits<{
  refresh: []
}>()

const toast = useToast()
const { apiFetch } = useApi()

const showAddFundsModal = ref(false)
const showWithdrawModal = ref(false)
const presetAmounts = [5, 10, 25, 50]
const customAmount = ref<number | null>(null)
const loadingAmount = ref<number | null>(null)
const withdrawAmount = ref<number | null>(null)
const withdrawPaypalEmail = ref('')
const withdrawLoading = ref(false)


const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(amount)
}

const handleAddFunds = async (amount: number | null) => {
  if (!amount || amount <= 0) {
    toast.add({ title: 'Invalid amount', description: 'Amount must be greater than 0', color: 'error' })
    return
  }

  loadingAmount.value = amount

  try {
    const response = await apiFetch('/api/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    })

    if (response.url) {
      // Redirect to Stripe Checkout
      window.location.href = response.url
    } else {
      throw new Error('No checkout URL returned')
    }
  } catch (error) {
    console.error('Error creating checkout session:', error)
    toast.add({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Failed to create checkout session',
      color: 'error',
    })
  } finally {
    loadingAmount.value = null
  }
}

const handleWithdraw = async () => {
  if (!withdrawAmount.value || withdrawAmount.value < 2) {
    toast.add({ title: 'Invalid amount', description: 'Minimum withdrawal is $2', color: 'error' })
    return
  }

  if (!withdrawPaypalEmail.value) {
    toast.add({ title: 'Missing email', description: 'PayPal email is required', color: 'error' })
    return
  }

  if (!withdrawPaypalEmail.value.includes('@')) {
    toast.add({ title: 'Invalid email', description: 'Please enter a valid email', color: 'error' })
    return
  }

  withdrawLoading.value = true

  try {
    await apiFetch('/api/stripe/withdraw', {
      method: 'POST',
      body: JSON.stringify({
        amount: withdrawAmount.value,
        paypalEmail: withdrawPaypalEmail.value,
      }),
    })

    toast.add({
      title: 'Withdrawal requested',
      description: 'Your withdrawal is pending approval. You will receive the funds in your PayPal account once processed.',
      color: 'success',
    })

    showWithdrawModal.value = false
    withdrawAmount.value = null
    withdrawPaypalEmail.value = ''
    emit('refresh')
  } catch (error) {
    console.error('Error requesting withdrawal:', error)
    toast.add({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Failed to request withdrawal',
      color: 'error',
    })
  } finally {
    withdrawLoading.value = false
  }
}
</script>
