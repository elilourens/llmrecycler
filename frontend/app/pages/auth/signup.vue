<template>
  <div class="auth-bg min-h-screen flex items-center justify-center px-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="-mx-6 -my-4 px-6 py-4 bg-accent">
          <h1 class="text-2xl font-bold text-center text-highlighted">Create Account</h1>
        </div>
      </template>

      <UForm :state="{ email, password, confirmPassword }" class="space-y-4" @submit="handleSignUp">
        <UFormField label="Email" name="email">
          <UInput v-model="email" type="email" placeholder="you@example.com" class="w-full" required />
        </UFormField>

        <UFormField label="Password" name="password">
          <UInput v-model="password" type="password" placeholder="••••••••" class="w-full" required />
        </UFormField>

        <UFormField label="Confirm Password" name="confirmPassword">
          <UInput v-model="confirmPassword" type="password" placeholder="••••••••" class="w-full" required />
        </UFormField>

        <UButton type="submit" color="primary" block :loading="loading">
          Sign Up
        </UButton>
      </UForm>

      <UAlert v-if="error" color="error" variant="soft" class="mt-4" :title="error" />
      <UAlert v-if="success" color="success" variant="soft" class="mt-4" title="Check your email to confirm your account!" />

      <template #footer>
        <div class="text-center text-sm">
          <p class="text-muted">
            Already have an account?
            <UButton to="/auth/login" variant="link" color="primary" class="p-0 h-auto font-medium">Sign In</UButton>
          </p>
        </div>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

const { signUp } = useAuth()

const handleSignUp = async () => {
  error.value = ''
  success.value = false

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }

  loading.value = true

  try {
    await signUp(email.value, password.value)
    success.value = true
    email.value = ''
    password.value = ''
    confirmPassword.value = ''
  } catch (err: any) {
    error.value = err.message || 'Failed to create account'
  } finally {
    loading.value = false
  }
}
</script>
