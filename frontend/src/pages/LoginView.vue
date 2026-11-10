<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-950">
    <div class="glass-panel w-full max-w-md p-8">
      <div class="text-center mb-8">
        <div class="inline-flex items-center gap-2 mb-4">
          <div class="w-3 h-3 rounded-full bg-jcloud-500 animate-pulse" />
          <div class="w-3 h-3 rounded-full bg-jcloud-500 animate-pulse" style="animation-delay: 0.2s" />
          <div class="w-3 h-3 rounded-full bg-jcloud-500 animate-pulse" style="animation-delay: 0.4s" />
        </div>
        <h1 class="text-2xl font-bold text-slate-100">JCloud</h1>
        <p class="text-slate-400 text-sm">Personal LLM over recall memory</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">Username</label>
          <input
            v-model="credentials.username"
            type="text"
            class="input-field w-full"
            placeholder="Enter your username"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">Password</label>
          <input
            v-model="credentials.password"
            type="password"
            class="input-field w-full"
            placeholder="Enter your password"
          />
        </div>
        <button type="submit" class="btn-primary w-full" :disabled="loading">
          {{ loading ? "Signing in..." : "Sign in to JCloud" }}
        </button>
      </form>

      <div v-if="error" class="text-xs text-rose-400 text-center mt-4">{{ error }}</div>

      <div class="mt-8 text-center text-slate-500 text-sm">
        New to JCloud? <a href="#" class="text-jcloud-400 hover:text-jcloud-300">Create account</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useAuthStore } from "@/stores";
import { useRouter } from "vue-router";

const auth = useAuthStore();
const router = useRouter();
const credentials = ref({ username: "", password: "" });
const loading = ref(false);
const error = ref("");

async function handleLogin() {
  loading.value = true;
  error.value = "";
  try {
    const res = await fetch("http://localhost:3333/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials.value),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    const data = await res.json();
    auth.setAuth(data.token, data.user);
    router.push("/chat");
  } catch (err: any) {
    error.value = err.message || "Login failed";
  } finally {
    loading.value = false;
  }
}
</script>
