import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useAuthStore = defineStore("auth", () => {
  const token = ref(localStorage.getItem("jcloud_token") || "");
  const user = ref<any>(null);
  const isAuthenticated = computed(() => !!token.value);

  function setAuth(t: string, u: any) {
    token.value = t;
    user.value = u;
    localStorage.setItem("jcloud_token", t);
  }

  function logout() {
    token.value = "";
    user.value = null;
    localStorage.removeItem("jcloud_token");
  }

  return { token, user, isAuthenticated, setAuth, logout };
});

export const useChatStore = defineStore("chat", () => {
  const conversations = ref<any[]>([]);
  const activeConversation = ref<any>(null);
  const messages = ref<any[]>([]);
  const isLoading = ref(false);
  const isTyping = ref(false);

  function setActive(conv: any) {
    activeConversation.value = conv;
    messages.value = conv.messages ?? [];
  }

  function addMessage(msg: any) {
    messages.value.push(msg);
    if (activeConversation.value) {
      activeConversation.value.messages = messages.value;
      activeConversation.value.updated_at = Date.now();
    }
  }

  function setTyping(v: boolean) {
    isTyping.value = v;
  }

  function addConversation(conv: any) {
    conversations.value.unshift(conv);
  }

  return { conversations, activeConversation, messages, isLoading, isTyping, setActive, addMessage, setTyping, addConversation };
});

export const useWebSearchStore = defineStore("webSearch", () => {
  const results = ref<any[]>([]);
  const isSearching = ref(false);
  const query = ref("");

  function setResults(res: any[]) {
    results.value = res;
  }

  function addTag(tag: string) {
    if (!query.value.includes(tag)) {
      query.value = query.value ? `${query.value} ${tag}` : tag;
    }
  }

  return { results, isSearching, query, setResults, addTag };
});
