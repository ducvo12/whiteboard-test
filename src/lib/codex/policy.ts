// Explicit policy for the local subscription-backed text adapter.
// These switches reduce Codex capabilities; they are not a raw-model API mode.
export const CODEX_POLICY_VERSION = 2;

const disabledFeatures = [
  "shell_tool", "unified_exec", "shell_snapshot", "code_mode", "code_mode_host",
  "apps", "plugins", "remote_plugin", "browser_use", "browser_use_external",
  "computer_use", "in_app_browser", "image_generation", "view_image",
  "multi_agent", "multi_agent_v2", "memories", "chronicle", "hooks",
  "goals", "sleep_tool", "skill_search", "skill_mcp_dependency_install",
  "tool_suggest", "request_permissions_tool", "workspace_dependencies",
  "in_app_local_automation", "realtime_conversation",
];

export const CODEX_CONFIG_ARGS = [
  ...disabledFeatures.map((feature) => `features.${feature}=false`),
  "features.skip_host_skill_discovery=true",
  'forced_login_method="chatgpt"', 'cli_auth_credentials_store="file"',
  'model_provider="openai"', 'web_search="disabled"',
  "tools.view_image=false", "tools.web_search=false", "agents.enabled=false",
  "apps._default.enabled=false", "project_doc_max_bytes=0",
  'personality="none"', 'approval_policy="never"',
  'default_permissions="text_only"',
  'permissions.text_only.filesystem={":minimal"="read"}',
  "permissions.text_only.network.enabled=false",
  'shell_environment_policy.inherit="none"',
  "analytics.enabled=false", 'otel.exporter="none"',
  'otel.trace_exporter="none"', 'otel.metrics_exporter="none"',
].flatMap((value) => ["-c", value]);
