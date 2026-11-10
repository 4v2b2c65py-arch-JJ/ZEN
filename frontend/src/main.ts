import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import LoginView from "./pages/LoginView.vue";
import ChatView from "./pages/ChatView.vue";
import "./assets/css/main.css";

const pinia = createPinia();

const routes = [
  { path: "/", redirect: "/chat" },
  { path: "/login", component: LoginView },
  { path: "/chat", component: ChatView, meta: { requiresAuth: true } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem("jcloud_token");
  if (to.meta.requiresAuth && !token) {
    next("/login");
  } else {
    next();
  }
});

const app = createApp(App);
app.use(pinia);
app.use(router);
app.mount("#app");
