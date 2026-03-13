<template>
  <div class="auth-bg min-h-screen flex items-center justify-center px-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold text-highlighted">Reset Password</h1>
          <p class="text-sm text-muted mt-1">Enter your email and we'll send you a reset link.</p>
        </div>
      </template>

      <UForm v-if="!success" :state="{ email }" class="space-y-4" @submit="handleReset">
        <UFormField label="Email" name="email">
          <UInput v-model="email" type="email" placeholder="you@example.com" class="w-full" required />
        </UFormField>

        <UButton type="submit" color="primary" block :loading="loading">
          Send Reset Link
        </UButton>
      </UForm>

      <UAlert
        v-else
        color="success"
        variant="soft"
        title="Check your email!"
        :description="`We've sent a password reset link to ${email}.`"
      />

      <UAlert v-if="error" color="error" variant="soft" class="mt-4" :title="error" />

      <template #footer>
        <div class="text-center text-sm">
          <p class="text-muted">
            Remember your password?
            <UButton to="/auth/login" variant="link" color="primary" class="p-0 h-auto font-medium">Sign In</UButton>
          </p>
        </div>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const email = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

const { resetPassword } = useAuth()

// Show error from callback if link expired
onMounted(() => {
  const route = useRoute()
  const errorParam = route.query.error as string | undefined
  if (errorParam) {
    error.value = decodeURIComponent(errorParam)
  }
})

const handleReset = async () => {
  error.value = ''
  loading.value = true

  try {
    await resetPassword(email.value)
    success.value = true
  } catch (err: any) {
    error.value = err.message || 'Failed to send reset link'
  } finally {
    loading.value = false
  }
}
</script>
