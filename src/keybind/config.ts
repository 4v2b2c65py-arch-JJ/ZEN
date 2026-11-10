export interface KeyBindConfig {
  bindings: Array<{
    key: string;
    modifiers: string[];
    action: string;
    payload: any;
    description: string;
    enabled: boolean;
  }>;
  thought_bindings: Array<{
    thought: string;
    key_binding_id: string;
    context: string;
  }>;
  hotkey_listener: {
    enabled: boolean;
    key: string;
    modifiers: string[];
    target_url: string;
  };
  weight_class: string;
}

export const DEFAULT_KEYBIND_CONFIG: KeyBindConfig = {
  bindings: [
    {
      key: "t",
      modifiers: ["cmd", "alt"],
      action: "thought",
      payload: { thought: "Quick thought captured via hotkey" },
      description: "Capture a thought to memory",
      enabled: true,
    },
    {
      key: "r",
      modifiers: ["cmd", "alt"],
      action: "memory_recall",
      payload: { query: "recent", top_k: 5 },
      description: "Recall recent memories",
      enabled: true,
    },
    {
      key: "n",
      modifiers: ["cmd", "alt"],
      action: "mac_action",
      payload: { script: 'display notification "jj-model hotkey triggered" with title "KeyBind"' },
      description: "Show macOS notification",
      enabled: true,
    },
    {
      key: "c",
      modifiers: ["cmd", "alt"],
      action: "cross_send",
      payload: { action: "ping", payload: {} },
      description: "Ping cross-device peers",
      enabled: true,
    },
  ],
  thought_bindings: [
    {
      thought: "Captured via Cmd+Alt+T",
      key_binding_id: "",
      context: "global",
    },
  ],
  hotkey_listener: {
    enabled: false,
    key: "t",
    modifiers: ["cmd", "alt"],
    target_url: "ws://localhost:3334",
  },
  weight_class: "daemond",
};
