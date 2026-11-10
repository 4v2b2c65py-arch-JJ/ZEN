<template>
  <div class="h-screen flex overflow-hidden">
    <aside class="w-72 glass-panel flex flex-col border-r border-slate-800 z-20">
      <div class="p-5 flex items-center gap-3 border-b border-slate-800">
        <div class="w-8 h-8 rounded-lg bg-jcloud-600 flex items-center justify-center">
          <span class="text-white font-bold text-sm">J</span>
        </div>
        <span class="text-lg font-bold text-slate-100">JCloud</span>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-3">Conversations</div>

        <div
          v-for="conv in conversations"
          :key="conv.id"
          class="sidebar-item"
          :class="{ active: activeConversation?.id === conv.id }"
          @click="selectConversation(conv)"
        >
          <span class="text-slate-300">💬</span>
          <span class="text-sm text-slate-200 truncate">{{ conv.title }}</span>
        </div>

        <button
          class="sidebar-item mt-4"
          @click="newConversation"
        >
          <span class="text-jcloud-400">+</span>
          <span class="text-sm text-jcloud-300">New conversation</span>
        </button>
      </div>

      <div class="p-4 border-t border-slate-800">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
            <span class="text-xs font-medium">{{ user?.name?.[0] ?? "U" }}</span>
          </div>
          <div class="flex-1">
            <p class="text-sm font-medium text-slate-100">{{ user?.name ?? "User" }}</p>
            <p class="text-xs text-slate-500">{{ user?.email }}</p>
          </div>
          <button @click="logout" class="text-slate-500 hover:text-rose-400 text-xs">Sign out</button>
        </div>
      </div>
    </aside>

    <main class="flex-1 flex flex-col relative">
      <div class="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center justify-between px-6">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-jcloud-600/20 border border-jcloud-500/30 flex items-center justify-center">
            <span class="text-jcloud-400 text-xs font-medium">🧠</span>
          </div>
          <div>
            <h2 class="text-sm font-medium text-slate-100">{{ activeConversation?.title ?? "New Chat" }}</h2>
            <p class="text-xs text-slate-500">JCloud personal assistant with recall memory</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            class="btn-secondary text-xs px-3 py-2"
            @click="toggleWebSearch"
          >
            <span class="text-slate-300">🔍</span>
            <span class="text-slate-200">Web Search</span>
          </button>
          <button class="text-slate-400 hover:text-slate-200">
            <span class="text-slate-300">⋮</span>
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth" id="chat-container">
        <div v-if="messages.length === 0 && !isLoading" class="text-center pt-20">
          <div class="w-16 h-16 rounded-full bg-jcloud-600/10 flex items-center justify-center mx-auto mb-4">
            <span class="text-jcloud-500 text-2xl">🧠</span>
          </div>
          <h3 class="text-lg font-medium text-slate-200 mb-2">Welcome to JCloud</h3>
          <p class="text-slate-400 max-w-xs mx-auto">
            I'm your personal assistant with recall memory. I can remember our conversations, search the web, control your Mac, and work across your devices.
          </p>
          <div class="mt-6 flex justify-center gap-3">
            <button class="text-xs text-jcloud-400 hover:text-jcloud-300" @click="suggested('What are my recent memories?')">
              Recent memories
            </button>
            <button class="text-xs text-jcloud-400 hover:text-jcloud-300" @click="suggested('Search the web for AI news')">
              Web search
            </button>
            <button class="text-xs text-jcloud-400 hover:text-jcloud-300" @click="suggested('Open a Mac app')">
              Mac automation
            </button>
          </div>
        </div>

        <div
          v-for="msg in messages"
          :key="msg.id"
          class="flex flex-col gap-1"
        >
          <div
            :class="[
              'message-bubble',
              msg.role === 'user' ? 'message-user' : 'message-assistant',
              { 'animate-in': true }
            ]"
          >
            <div v-if="msg.role !== 'user'" class="flex items-center gap-2 mb-1 text-xs text-slate-500">
              <span class="w-1 h-1 rounded-full bg-jcloud-500"></span>
              <span>JCloud Assistant</span>
            </div>
            <div v-html="renderMessage(msg.content)"></div>
            <div v-if="msg.metadata?.recall_count" class="text-xs text-slate-500 mt-1">
              {{ msg.metadata.recall_count }} memory recall(s) used
            </div>
          </div>
        </div>

        <div v-if="isTyping" class="message-bubble message-assistant">
          <div class="typing-dots flex gap-1">
            <span class="w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
            <span class="w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
            <span class="w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
          </div>
        </div>
      </div>

      <div class="border-t border-slate-800 bg-slate-900/80 backdrop-blur p-4">
        <div class="relative">
          <input
            v-model="newMessage"
            type="text"
            placeholder="Message JCloud..."
            class="input-field w-full pr-20"
            @keyup.enter="sendMessage"
            disabled="isLoading"
          />
          <button
            @click="sendMessage"
            :disabled="!newMessage.trim() || isLoading"
            class="absolute right-2 top-2 bg-jcloud-600 hover:bg-jcloud-500 text-white rounded-lg p-2.5 transition-colors disabled:opacity-50"
          >
            <span class="text-slate-100">↑</span>
          </button>
        </div>
        <div v-if="isLoading" class="flex items-center gap-2 mt-2 text-xs text-jcloud-400">
          <span class="w-2 h-2 rounded-full bg-jcloud-500 animate-pulse"></span>
          <span>JCloud is thinking...</span>
        </div>
      </div>
    </main>

    <div v-if="webSearchOpen" class="fixed inset-0 z-50 flex flex-col">
      <div class="glass-panel w-full h-full flex flex-col border-l border-slate-800">
        <div class="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 class="text-sm font-medium text-slate-200">Web Search</h3>
          <button @click="toggleWebSearch" class="text-slate-400 hover:text-slate-200">✕</button>
        </div>
        <div class="p-4 flex-1 flex flex-col">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search the web..."
            class="input-field w-full mb-4"
            @keyup.enter="performWebSearch"
          />
          <div class="flex gap-2 mb-4">
            <span
              v-for="tag in suggestedTags"
              :key="tag"
              class="px-2 py-1 rounded bg-slate-800 text-xs text-slate-300 cursor-pointer hover:bg-jcloud-600/30 hover:text-jcloud-300"
              @click="addSearchTag(tag)"
            >
              #{{ tag }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto space-y-3">
            <div
              v-for="result in searchResults"
              :key="result.url"
              class="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
            >
              <h4 class="text-sm font-medium text-jcloud-400 truncate">{{ result.title }}</h4>
              <p class="text-xs text-slate-400 mt-1 line-clamp-2">{{ result.snippet }}</p>
              <a
                :href="result.url"
                target="_blank"
                class="text-xs text-jcloud-500 hover:text-jcloud-400 mt-2 inline-block"
              >
                Open source ↗
              </a>
            </div>
            <div v-if="searchResults.length === 0 && isSearching" class="text-xs text-slate-500 text-center py-4">
              Searching...
            </div>
          </div>
          <button
            @click="performWebSearch"
            class="btn-primary w-full py-2 text-sm"
            :disabled="isSearching || !searchQuery.trim()"
          >
            {{ isSearching ? "Searching..." : "Search" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from "vue";
import { useChatStore, useAuthStore, useWebSearchStore } from "@/stores";
import { WebSocketClient } from "@/api";

const chat = useChatStore();
const auth = useAuthStore();
const webSearch = useWebSearchStore();

const props = defineProps<{ user: any }>();
const emit = defineEmits(["logout"]);

const conversations = computed(() => chat.conversations);
const activeConversation = computed(() => chat.activeConversation);
const messages = computed(() => chat.messages);
const isLoading = computed(() => chat.isLoading);
const isTyping = computed(() => chat.isTyping);

const newMessage = ref("");
const webSearchOpen = ref(false);
const searchQuery = ref("");
const searchResults = computed(() => webSearch.results);
const isSearching = computed(() => webSearch.isSearching);
const suggestedTags = ["ai", "news", "mac", "productivity", "code", "design"];

let ws: WebSocketClient | null = null;
let scrollTimeout: number;

onMounted(() => {
  const token = localStorage.getItem("jcloud_token") || "";
  ws = new WebSocketClient("ws://localhost:3333", token);
  ws.connect();

  ws.on("chat", (data) => {
    chat.addMessage({
      id: data.id ?? crypto.randomUUID(),
      role: "assistant",
      content: data.content,
      metadata: data.metadata,
      created_at: Date.now(),
    });
    chat.setTyping(false);
    scrollToBottom();
  });

  ws.on("error", (data) => {
    chat.addMessage({
      id: crypto.randomUUID(),
      role: "system",
      content: `Error: ${data.error}`,
      created_at: Date.now(),
    });
    chat.setTyping(false);
  });

  if (activeConversation.value) {
    chat.setActive(activeConversation.value);
  }
});

function scrollToBottom() {
  const container = document.getElementById("chat-container");
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

watch(messages, () => {
  nextTick(() => scrollToBottom());
});

function selectConversation(conv: any) {
  chat.setActive(conv);
}

function newConversation() {
  const conv = {
    id: crypto.randomUUID(),
    title: "New Conversation",
    messages: [],
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  chat.addConversation(conv);
  chat.setActive(conv);
}

async function sendMessage() {
  if (!newMessage.trim() || isLoading.value) return;
  const text = newMessage.trim();
  newMessage.value = "";

  const userMsg = {
    id: crypto.randomUUID(),
    role: "user",
    content: text,
    created_at: Date.now(),
  };
  chat.addMessage(userMsg);
  chat.setTyping(true);
  scrollToBottom();

  try {
    ws?.send("chat", { content: text, conversation_id: activeConversation.value?.id });
  } catch (err) {
    chat.addMessage({
      id: crypto.randomUUID(),
      role: "system",
      content: `Failed to send: ${err}`,
      created_at: Date.now(),
    });
    chat.setTyping(false);
  }
}

function suggested(text: string) {
  newMessage.value = text;
}

function toggleWebSearch() {
  webSearchOpen.value = !webSearchOpen.value;
}

async function performWebSearch() {
  if (!searchQuery.trim() || isSearching.value) return;
  webSearch.isSearching = true;
  try {
    const res = await fetch(`http://localhost:3333/api/web/search?q=${encodeURIComponent(searchQuery.value)}`);
    const data = await res.json();
    webSearch.setResults(data.results ?? []);
  } catch {
    webSearch.setResults([]);
  } finally {
    webSearch.isSearching = false;
  }
}

function addSearchTag(tag: string) {
  webSearch.addTag(tag);
  searchQuery.value = webSearch.query;
}

function logout() {
  auth.logout();
  emit("logout");
}

function renderMessage(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}
</script>

<style scoped>
#chat-container {
  scrollbar-width: thin;
  scrollbar-color: #475569 transparent;
}
</style>
