<template>
  <div class="auth-bg min-h-screen flex items-center justify-center px-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-2xl font-bold text-center text-highlighted">Set New Password</h1>
      </template>

      <UForm :state="{ password, confirmPassword }" class="space-y-4" @submit="handleReset">
        <UFormField label="New Password" name="password">
          <UInput v-model="password" type="password" placeholder="••••••••" class="w-full" required />
        </UFormField>

        <UFormField label="Confirm Password" name="confirmPassword">
          <UInput v-model="confirmPassword" type="password" placeholder="••••••••" class="w-full" required />
        </UFormField>

        <UButton type="submit" color="primary" block :loading="loading">
          Update Password
        </UButton>
      </UForm>

      <UAlert v-if="error" color="error" variant="soft" class="mt-4" :title="error" />
    </UCard>
  </div>
</template>

<script setup lang="ts">
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')

const { updatePassword } = useAuth()

const handleReset = async () => {
  error.value = ''

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }

  loading.value = true

  try {
    await updatePassword(password.value)
    await navigateTo('/dashboard')
  } catch (err: any) {
    error.value = err.message || 'Failed to update password'
  } finally {
    loading.value = false
  }
}
</script>
