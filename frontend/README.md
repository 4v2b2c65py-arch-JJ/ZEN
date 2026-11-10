# JCloud — Vue Frontend

ChatGPT-like frontend for jj-model personal LLM over recall memory, built with Vue 3, Tailwind CSS, Pinia, and Vite.

## Features

- **Login / user base** — JWT auth, user profile, sign out
- **Chat interface** — real-time WebSocket chat with message history
- **Recall memory** — memory count shown per assistant message
- **Web search** — side panel with search results, tags, source links
- **Grok bot features** — thinking indicator, suggested prompts, real-time typing
- **Responsive design** — glassmorphism sidebar, dark theme, scrollbar styling

## Tech Stack

- Vue 3 (Composition API)
- Pinia (state management)
- Vue Router
- Tailwind CSS
- Vite
- Axios + native WebSocket

## Run

```bash
cd frontend
npm install
npm run dev
```

Connects to:
- Main API: `ws://localhost:3333`
- Model proxy: `ws://localhost:3334`

## Design

- Dark slate-950 theme with jcloud accent (sky blue)
- Glassmorphism panels with backdrop-blur
- Message bubbles: user (jcloud-600 right), assistant (slate-800 left)
- Sidebar with conversation list and user profile
- Web search panel slides in from right
