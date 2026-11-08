# DevTerminal / Motor 4105 — traspaso de arquitectura a Claude Code

> Guía generada desde el workspace actual de Replit. Los archivos del checkout siguen siendo la fuente de verdad. No contiene valores de Secrets, archivos .env, datos de runtime ni información de la base de datos activa.

## Resumen para el siguiente agente

Monorepo pnpm/TypeScript con tres artefactos Replit: frontend DevTerminal (React + Vite), API (Express 5 + PostgreSQL/Drizzle) y Canvas/mockup sandbox. Bibliotecas compartidas para contrato OpenAPI, cliente React Query, esquemas Zod e integración de IA. También existe un bot Python de paper trading separado del motor sintético; el endpoint del panel de trading solo lee su estado. No ejecutar el bot ni enviar órdenes en una migración.

Antes de cambiar código: lee replit.md y docs/*.md; mantén pnpm-lock.yaml; no edites código generado a mano; inspecciona las rutas de ejecución/herramientas con especial cuidado. Los documentos de la Ley 4105 son requerimientos/contexto aportado, no telemetría ni pruebas de que 72 agentes, hardware ESP32, 20 Hz o Coinbase CDP estén activos.

## 1. Estructura completa de archivos versionados

Árbol según git ls-files, omitiendo vendor/dependencias, builds, cachés, adjuntos, estados/datos JSON runtime, respaldo SQL de datos, .env y artefactos generados. Incluye rutas y pruebas de producto versionadas.

```text
.agents/agent_assets_metadata.toml
.agents/memory/MEMORY.md
.agents/memory/agent-omega-quality.md
.agents/memory/autonomous-write-notices.md
.agents/memory/cortex-agent-orchestration.md
.agents/memory/jsx-test-runtime.md
.agents/memory/node-test-db-imports.md
.agents/memory/replit-app-storage.md
.agents/memory/runner-omega-evidence.md
.agents/memory/stale-workspace-declarations.md
.agents/memory/trading-monitor-scope.md
.gitignore
.npmrc
.replit
.replitignore
artifacts/api-server/.replit-artifact/artifact.toml
artifacts/api-server/build.mjs
artifacts/api-server/package.json
artifacts/api-server/src/app.ts
artifacts/api-server/src/index.ts
artifacts/api-server/src/lib/.gitkeep
artifacts/api-server/src/lib/agent-circuit-breaker.ts
artifacts/api-server/src/lib/coherence_simulator.ts
artifacts/api-server/src/lib/logger.ts
artifacts/api-server/src/lib/runtime-diagnostics.ts
artifacts/api-server/src/middlewares/.gitkeep
artifacts/api-server/src/routes/agent-circuit-breaker.md
artifacts/api-server/src/routes/agent-circuit-breaker.test.ts
artifacts/api-server/src/routes/agent-circuit-breaker.ts
artifacts/api-server/src/routes/agent-evaluation.test.ts
artifacts/api-server/src/routes/agent-evaluation.ts
artifacts/api-server/src/routes/agent-message-persistence.test.ts
artifacts/api-server/src/routes/agent-message-persistence.ts
artifacts/api-server/src/routes/agent-safety-validation.test.ts
artifacts/api-server/src/routes/agent-safety-validation.ts
artifacts/api-server/src/routes/agent-swarm-circuit.ts
artifacts/api-server/src/routes/agent-task-outcomes.test.ts
artifacts/api-server/src/routes/agent-task-outcomes.ts
artifacts/api-server/src/routes/agent-telemetry-initialization.ts
artifacts/api-server/src/routes/agents-simulation.test.ts
artifacts/api-server/src/routes/agents-simulation.ts
artifacts/api-server/src/routes/ai-autonomous-write.integration.test.ts
artifacts/api-server/src/routes/ai-code-chat.ts
artifacts/api-server/src/routes/ai.ts
artifacts/api-server/src/routes/autorun.ts
artifacts/api-server/src/routes/coherence-simulation.test.ts
artifacts/api-server/src/routes/coherence-simulation.ts
artifacts/api-server/src/routes/cortex-context.ts
artifacts/api-server/src/routes/cortex.test.ts
artifacts/api-server/src/routes/cortex.ts
artifacts/api-server/src/routes/deepseek-context-read.ts
artifacts/api-server/src/routes/deepseek-integrations.test.ts
artifacts/api-server/src/routes/deepseek-integrations.ts
artifacts/api-server/src/routes/deepseek-latency.test.ts
artifacts/api-server/src/routes/deepseek-latency.ts
artifacts/api-server/src/routes/deepseek-mock-stream.test.ts
artifacts/api-server/src/routes/deepseek-mock-stream.ts
artifacts/api-server/src/routes/deepseek-prompt.ts
artifacts/api-server/src/routes/deepseek-serialization.test.ts
artifacts/api-server/src/routes/deepseek-serialization.ts
artifacts/api-server/src/routes/deepseek-stream.integration.test.ts
artifacts/api-server/src/routes/deepseek-tool-safety.ts
artifacts/api-server/src/routes/deepseek-tools-notification.test.ts
artifacts/api-server/src/routes/deepseek-tools.test.ts
artifacts/api-server/src/routes/deepseek-tools.ts
artifacts/api-server/src/routes/deepseek.test.ts
artifacts/api-server/src/routes/deepseek.ts
artifacts/api-server/src/routes/diagnostics.ts
artifacts/api-server/src/routes/execute.ts
artifacts/api-server/src/routes/gemini.test.ts
artifacts/api-server/src/routes/gemini.ts
artifacts/api-server/src/routes/health.ts
artifacts/api-server/src/routes/index.ts
artifacts/api-server/src/routes/messages.ts
artifacts/api-server/src/routes/motor-telemetry.md
artifacts/api-server/src/routes/motor-telemetry.test.ts
artifacts/api-server/src/routes/motor-telemetry.ts
artifacts/api-server/src/routes/neural-event-bus.test.ts
artifacts/api-server/src/routes/neural-event-bus.ts
artifacts/api-server/src/routes/neural-event-hub.test.ts
artifacts/api-server/src/routes/neural-event-hub.ts
artifacts/api-server/src/routes/neural-event-postgres.test.ts
artifacts/api-server/src/routes/neural-event-postgres.ts
artifacts/api-server/src/routes/neural-events-stream.test.ts
artifacts/api-server/src/routes/neural-events-stream.ts
artifacts/api-server/src/routes/neural-events.ts
artifacts/api-server/src/routes/openai.test.ts
artifacts/api-server/src/routes/openai.ts
artifacts/api-server/src/routes/snippet-execution.test.ts
artifacts/api-server/src/routes/snippet-execution.ts
artifacts/api-server/src/routes/snippets.ts
artifacts/api-server/src/routes/telemetry-cache.test.ts
artifacts/api-server/src/routes/telemetry-cache.ts
artifacts/api-server/src/routes/terminal.ts
artifacts/api-server/src/routes/trading-python-contract.test.ts
artifacts/api-server/src/routes/trading-status.test.ts
artifacts/api-server/src/routes/trading-status.ts
artifacts/api-server/src/routes/weather-probe.test.ts
artifacts/api-server/src/routes/weather-probe.ts
artifacts/api-server/tsconfig.json
artifacts/devterminal/.replit-artifact/artifact.toml
artifacts/devterminal/components.json
artifacts/devterminal/index.html
artifacts/devterminal/package.json
artifacts/devterminal/public/favicon.svg
artifacts/devterminal/public/opengraph.jpg
artifacts/devterminal/src/App.tsx
artifacts/devterminal/src/components/layout.tsx
artifacts/devterminal/src/components/neural-net.tsx
artifacts/devterminal/src/components/ui/accordion.tsx
artifacts/devterminal/src/components/ui/alert-dialog.tsx
artifacts/devterminal/src/components/ui/alert.tsx
artifacts/devterminal/src/components/ui/aspect-ratio.tsx
artifacts/devterminal/src/components/ui/avatar.tsx
artifacts/devterminal/src/components/ui/badge.tsx
artifacts/devterminal/src/components/ui/breadcrumb.tsx
artifacts/devterminal/src/components/ui/button-group.tsx
artifacts/devterminal/src/components/ui/button.tsx
artifacts/devterminal/src/components/ui/calendar.tsx
artifacts/devterminal/src/components/ui/card.tsx
artifacts/devterminal/src/components/ui/carousel.tsx
artifacts/devterminal/src/components/ui/chart.tsx
artifacts/devterminal/src/components/ui/checkbox.tsx
artifacts/devterminal/src/components/ui/collapsible.tsx
artifacts/devterminal/src/components/ui/command.tsx
artifacts/devterminal/src/components/ui/context-menu.tsx
artifacts/devterminal/src/components/ui/dialog.tsx
artifacts/devterminal/src/components/ui/drawer.tsx
artifacts/devterminal/src/components/ui/dropdown-menu.tsx
artifacts/devterminal/src/components/ui/empty.tsx
artifacts/devterminal/src/components/ui/field.tsx
artifacts/devterminal/src/components/ui/form.tsx
artifacts/devterminal/src/components/ui/hover-card.tsx
artifacts/devterminal/src/components/ui/input-group.tsx
artifacts/devterminal/src/components/ui/input-otp.tsx
artifacts/devterminal/src/components/ui/input.tsx
artifacts/devterminal/src/components/ui/item.tsx
artifacts/devterminal/src/components/ui/kbd.tsx
artifacts/devterminal/src/components/ui/label.tsx
artifacts/devterminal/src/components/ui/menubar.tsx
artifacts/devterminal/src/components/ui/navigation-menu.tsx
artifacts/devterminal/src/components/ui/pagination.tsx
artifacts/devterminal/src/components/ui/popover.tsx
artifacts/devterminal/src/components/ui/progress.tsx
artifacts/devterminal/src/components/ui/radio-group.tsx
artifacts/devterminal/src/components/ui/resizable.tsx
artifacts/devterminal/src/components/ui/scroll-area.tsx
artifacts/devterminal/src/components/ui/select.tsx
artifacts/devterminal/src/components/ui/separator.tsx
artifacts/devterminal/src/components/ui/sheet.tsx
artifacts/devterminal/src/components/ui/sidebar.tsx
artifacts/devterminal/src/components/ui/skeleton.tsx
artifacts/devterminal/src/components/ui/slider.tsx
artifacts/devterminal/src/components/ui/sonner.tsx
artifacts/devterminal/src/components/ui/spinner.tsx
artifacts/devterminal/src/components/ui/switch.tsx
artifacts/devterminal/src/components/ui/table.tsx
artifacts/devterminal/src/components/ui/tabs.tsx
artifacts/devterminal/src/components/ui/textarea.tsx
artifacts/devterminal/src/components/ui/toast.tsx
artifacts/devterminal/src/components/ui/toaster.tsx
artifacts/devterminal/src/components/ui/toggle-group.tsx
artifacts/devterminal/src/components/ui/toggle.tsx
artifacts/devterminal/src/components/ui/tooltip.tsx
artifacts/devterminal/src/hooks/use-mobile.tsx
artifacts/devterminal/src/hooks/use-toast.ts
artifacts/devterminal/src/index.css
artifacts/devterminal/src/lib/agent-run-lock.test.ts
artifacts/devterminal/src/lib/agent-run-lock.ts
artifacts/devterminal/src/lib/app-context.tsx
artifacts/devterminal/src/lib/cortex-event-delivery.test.ts
artifacts/devterminal/src/lib/cortex-event-delivery.ts
artifacts/devterminal/src/lib/deepseek-stream.test.ts
artifacts/devterminal/src/lib/deepseek-stream.ts
artifacts/devterminal/src/lib/neural-context.tsx
artifacts/devterminal/src/lib/terminal-autonomous-events.test.ts
artifacts/devterminal/src/lib/terminal-autonomous-events.ts
artifacts/devterminal/src/lib/utils.ts
artifacts/devterminal/src/main.tsx
artifacts/devterminal/src/pages/agents.tsx
artifacts/devterminal/src/pages/ai.tsx
artifacts/devterminal/src/pages/coherence-simulator.tsx
artifacts/devterminal/src/pages/cortex-order-outcome.test.ts
artifacts/devterminal/src/pages/cortex-order-outcome.tsx
artifacts/devterminal/src/pages/cortex.tsx
artifacts/devterminal/src/pages/creator.tsx
artifacts/devterminal/src/pages/history-pagination-state.ts
artifacts/devterminal/src/pages/history-pagination.test.ts
artifacts/devterminal/src/pages/history-pagination.tsx
artifacts/devterminal/src/pages/history-request-feedback.tsx
artifacts/devterminal/src/pages/home.tsx
artifacts/devterminal/src/pages/neural.tsx
artifacts/devterminal/src/pages/not-found.tsx
artifacts/devterminal/src/pages/runner.tsx
artifacts/devterminal/src/pages/snippets.tsx
artifacts/devterminal/src/pages/terminal.tsx
artifacts/devterminal/src/pages/tools.tsx
artifacts/devterminal/src/pages/trading.test.ts
artifacts/devterminal/src/pages/trading.tsx
artifacts/devterminal/tsconfig.json
artifacts/devterminal/vite.config.ts
artifacts/mockup-sandbox/.replit-artifact/artifact.toml
artifacts/mockup-sandbox/components.json
artifacts/mockup-sandbox/index.html
artifacts/mockup-sandbox/mockupPreviewPlugin.ts
artifacts/mockup-sandbox/package.json
artifacts/mockup-sandbox/src/.generated/mockup-components.ts
artifacts/mockup-sandbox/src/App.tsx
artifacts/mockup-sandbox/src/components/ui/accordion.tsx
artifacts/mockup-sandbox/src/components/ui/alert-dialog.tsx
artifacts/mockup-sandbox/src/components/ui/alert.tsx
artifacts/mockup-sandbox/src/components/ui/aspect-ratio.tsx
artifacts/mockup-sandbox/src/components/ui/avatar.tsx
artifacts/mockup-sandbox/src/components/ui/badge.tsx
artifacts/mockup-sandbox/src/components/ui/breadcrumb.tsx
artifacts/mockup-sandbox/src/components/ui/button-group.tsx
artifacts/mockup-sandbox/src/components/ui/button.tsx
artifacts/mockup-sandbox/src/components/ui/calendar.tsx
artifacts/mockup-sandbox/src/components/ui/card.tsx
artifacts/mockup-sandbox/src/components/ui/carousel.tsx
artifacts/mockup-sandbox/src/components/ui/chart.tsx
artifacts/mockup-sandbox/src/components/ui/checkbox.tsx
artifacts/mockup-sandbox/src/components/ui/collapsible.tsx
artifacts/mockup-sandbox/src/components/ui/command.tsx
artifacts/mockup-sandbox/src/components/ui/context-menu.tsx
artifacts/mockup-sandbox/src/components/ui/dialog.tsx
artifacts/mockup-sandbox/src/components/ui/drawer.tsx
artifacts/mockup-sandbox/src/components/ui/dropdown-menu.tsx
artifacts/mockup-sandbox/src/components/ui/empty.tsx
artifacts/mockup-sandbox/src/components/ui/field.tsx
artifacts/mockup-sandbox/src/components/ui/form.tsx
artifacts/mockup-sandbox/src/components/ui/hover-card.tsx
artifacts/mockup-sandbox/src/components/ui/input-group.tsx
artifacts/mockup-sandbox/src/components/ui/input-otp.tsx
artifacts/mockup-sandbox/src/components/ui/input.tsx
artifacts/mockup-sandbox/src/components/ui/item.tsx
artifacts/mockup-sandbox/src/components/ui/kbd.tsx
artifacts/mockup-sandbox/src/components/ui/label.tsx
artifacts/mockup-sandbox/src/components/ui/menubar.tsx
artifacts/mockup-sandbox/src/components/ui/navigation-menu.tsx
artifacts/mockup-sandbox/src/components/ui/pagination.tsx
artifacts/mockup-sandbox/src/components/ui/popover.tsx
artifacts/mockup-sandbox/src/components/ui/progress.tsx
artifacts/mockup-sandbox/src/components/ui/radio-group.tsx
artifacts/mockup-sandbox/src/components/ui/resizable.tsx
artifacts/mockup-sandbox/src/components/ui/scroll-area.tsx
artifacts/mockup-sandbox/src/components/ui/select.tsx
artifacts/mockup-sandbox/src/components/ui/separator.tsx
artifacts/mockup-sandbox/src/components/ui/sheet.tsx
artifacts/mockup-sandbox/src/components/ui/sidebar.tsx
artifacts/mockup-sandbox/src/components/ui/skeleton.tsx
artifacts/mockup-sandbox/src/components/ui/slider.tsx
artifacts/mockup-sandbox/src/components/ui/sonner.tsx
artifacts/mockup-sandbox/src/components/ui/spinner.tsx
artifacts/mockup-sandbox/src/components/ui/switch.tsx
artifacts/mockup-sandbox/src/components/ui/table.tsx
artifacts/mockup-sandbox/src/components/ui/tabs.tsx
artifacts/mockup-sandbox/src/components/ui/textarea.tsx
artifacts/mockup-sandbox/src/components/ui/toast.tsx
artifacts/mockup-sandbox/src/components/ui/toaster.tsx
artifacts/mockup-sandbox/src/components/ui/toggle-group.tsx
artifacts/mockup-sandbox/src/components/ui/toggle.tsx
artifacts/mockup-sandbox/src/components/ui/tooltip.tsx
artifacts/mockup-sandbox/src/hooks/use-mobile.tsx
artifacts/mockup-sandbox/src/hooks/use-toast.ts
artifacts/mockup-sandbox/src/index.css
artifacts/mockup-sandbox/src/lib/utils.ts
artifacts/mockup-sandbox/src/main.tsx
artifacts/mockup-sandbox/tsconfig.json
artifacts/mockup-sandbox/vite.config.ts
docs/maquina-4105.md
docs/motor-4105-orquestador-system-prompt.md
exports/devterminal-source.zip
lib/api-client-react/package.json
lib/api-client-react/src/custom-fetch.ts
lib/api-client-react/src/generated/api.schemas.ts
lib/api-client-react/src/generated/api.ts
lib/api-client-react/src/index.ts
lib/api-client-react/tsconfig.json
lib/api-spec/openapi.yaml
lib/api-spec/orval.config.ts
lib/api-spec/package.json
lib/api-zod/package.json
lib/api-zod/src/generated/api.ts
lib/api-zod/src/generated/types/agentPayloadMetrics.ts
lib/api-zod/src/generated/types/agentPayloadMetricsStatus.ts
lib/api-zod/src/generated/types/agentProgress.ts
lib/api-zod/src/generated/types/agentProgressStatus.ts
lib/api-zod/src/generated/types/aiChatRequest.ts
lib/api-zod/src/generated/types/aiChatResponse.ts
lib/api-zod/src/generated/types/aiChatResponseAnalysisStatus.ts
lib/api-zod/src/generated/types/aiChatResponseStatus.ts
lib/api-zod/src/generated/types/aiCodeResponse.ts
lib/api-zod/src/generated/types/aiExplainRequest.ts
lib/api-zod/src/generated/types/aiImproveRequest.ts
lib/api-zod/src/generated/types/aiMessage.ts
lib/api-zod/src/generated/types/aiMessageRole.ts
lib/api-zod/src/generated/types/clearTerminalMessagesConversationId.ts
lib/api-zod/src/generated/types/clearTerminalMessagesParams.ts
lib/api-zod/src/generated/types/clearTerminalMessagesResponse.ts
lib/api-zod/src/generated/types/coherenceSimulationLog.ts
lib/api-zod/src/generated/types/coherenceSimulationLogOffsetPage.ts
lib/api-zod/src/generated/types/coherenceSimulationLogPage.ts
lib/api-zod/src/generated/types/coherenceSimulationSample.ts
lib/api-zod/src/generated/types/coherenceSimulationStatus.ts
lib/api-zod/src/generated/types/createSnippetBody.ts
lib/api-zod/src/generated/types/deepSeekChatInput.ts
lib/api-zod/src/generated/types/executeRequest.ts
lib/api-zod/src/generated/types/executeRequestLanguage.ts
lib/api-zod/src/generated/types/executeResult.ts
lib/api-zod/src/generated/types/getTerminalMessagesConversationId.ts
lib/api-zod/src/generated/types/getTerminalMessagesParams.ts
lib/api-zod/src/generated/types/healthStatus.ts
lib/api-zod/src/generated/types/imageGenerationInput.ts
lib/api-zod/src/generated/types/imageGenerationResult.ts
lib/api-zod/src/generated/types/index.ts
lib/api-zod/src/generated/types/language.ts
lib/api-zod/src/generated/types/languageList.ts
lib/api-zod/src/generated/types/listCoherenceSimulationLogPagesParams.ts
lib/api-zod/src/generated/types/listCoherenceSimulationLogsParams.ts
lib/api-zod/src/generated/types/neuralEvent.ts
lib/api-zod/src/generated/types/neuralEventInput.ts
lib/api-zod/src/generated/types/neuralEventInputOrigin.ts
lib/api-zod/src/generated/types/neuralEventOrigin.ts
lib/api-zod/src/generated/types/simulatedAgentAnalysisInput.ts
lib/api-zod/src/generated/types/simulatedAgentAnalysisInputAgentId.ts
lib/api-zod/src/generated/types/simulatedAgentAnalysisResult.ts
lib/api-zod/src/generated/types/simulatedAgentAnalysisResultStatus.ts
lib/api-zod/src/generated/types/snippet.ts
lib/api-zod/src/generated/types/snippetExecutionResult.ts
lib/api-zod/src/generated/types/snippetExecutionResultOutput.ts
lib/api-zod/src/generated/types/terminalMessage.ts
lib/api-zod/src/generated/types/terminalMessageInput.ts
lib/api-zod/src/generated/types/terminalMessageInputConversationId.ts
lib/api-zod/src/generated/types/terminalMessageInputRole.ts
lib/api-zod/src/generated/types/terminalMessageRole.ts
lib/api-zod/src/generated/types/tradingStatus.ts
lib/api-zod/src/generated/types/tradingStatusPosition.ts
lib/api-zod/src/generated/types/updateSnippetBody.ts
lib/api-zod/src/index.ts
lib/api-zod/tsconfig.json
lib/db/drizzle.config.ts
lib/db/package.json
lib/db/src/index.ts
lib/db/src/schema/agents.ts
lib/db/src/schema/conversations.ts
lib/db/src/schema/index.ts
lib/db/src/schema/messages.ts
lib/db/src/schema/neural-events.ts
lib/db/src/schema/prompts.ts
lib/db/src/schema/relations.ts
lib/db/src/schema/simulation-logs.ts
lib/db/src/schema/snippets.ts
lib/db/tsconfig.json
lib/integrations-openai-ai-react/package.json
lib/integrations-openai-ai-react/src/audio/audio-playback-worklet.js
lib/integrations-openai-ai-react/src/audio/audio-utils.ts
lib/integrations-openai-ai-react/src/audio/index.ts
lib/integrations-openai-ai-react/src/audio/useAudioPlayback.ts
lib/integrations-openai-ai-react/src/audio/useVoiceRecorder.ts
lib/integrations-openai-ai-react/src/audio/useVoiceStream.ts
lib/integrations-openai-ai-react/src/index.ts
lib/integrations-openai-ai-react/tsconfig.json
lib/integrations-openai-ai-server/package.json
lib/integrations-openai-ai-server/src/audio/client.ts
lib/integrations-openai-ai-server/src/audio/index.ts
lib/integrations-openai-ai-server/src/batch/index.ts
lib/integrations-openai-ai-server/src/batch/utils.ts
lib/integrations-openai-ai-server/src/client.ts
lib/integrations-openai-ai-server/src/image/client.ts
lib/integrations-openai-ai-server/src/image/index.ts
lib/integrations-openai-ai-server/src/index.ts
lib/integrations-openai-ai-server/tsconfig.json
lib/integrations/openai_ai_integrations/src/client/audio/audio-playback-worklet.js
lib/integrations/openai_ai_integrations/src/client/audio/audio-utils.ts
lib/integrations/openai_ai_integrations/src/client/audio/index.ts
lib/integrations/openai_ai_integrations/src/client/audio/useAudioPlayback.ts
lib/integrations/openai_ai_integrations/src/client/audio/useVoiceRecorder.ts
lib/integrations/openai_ai_integrations/src/server/audio/client.ts
lib/integrations/openai_ai_integrations/src/server/audio/index.ts
lib/integrations/openai_ai_integrations/src/server/batch/index.ts
lib/integrations/openai_ai_integrations/src/server/batch/utils.ts
lib/integrations/openai_ai_integrations/src/server/image/client.ts
lib/integrations/openai_ai_integrations/src/server/image/index.ts
maquina_4105_state.py
maquina_4105_v32.py
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
replit.md
requirements-trading.txt
scripts/agent-task-outcomes-migration.sql
scripts/build_runner_snippet.py
scripts/cleanup-duplicate-messages.sql
scripts/dev.mjs
scripts/package.json
scripts/post-merge.sh
scripts/runner_python.md
scripts/runner_python.py
scripts/runner_python_core.py
scripts/src/hello.ts
scripts/test_maquina_4105_state.py
scripts/test_runner_python.py
scripts/tsconfig.json
tsconfig.base.json
tsconfig.json
```

## 2. Dependencias: manifiestos package.json exactos

Los rangos catalog: se resuelven desde pnpm-workspace.yaml. Para reproducción exacta conserva el lockfile y usa pnpm install --frozen-lockfile.

### package.json

```json
{
  "name": "workspace",
  "version": "0.0.0",
  "license": "MIT",
  "scripts": {
    "preinstall": "sh -c 'rm -f package-lock.json yarn.lock; case \"$npm_config_user_agent\" in pnpm/*) ;; *) echo \"Use pnpm instead\" >&2; exit 1 ;; esac'",
    "dev": "node scripts/dev.mjs",
    "build": "pnpm run typecheck && pnpm -r --if-present run build",
    "typecheck:libs": "tsc --build",
    "typecheck": "pnpm run typecheck:libs && pnpm -r --filter \"./artifacts/**\" --filter \"./scripts\" --if-present run typecheck"
  },
  "private": true,
  "devDependencies": {
    "typescript": "~5.9.2",
    "prettier": "^3.8.1"
  }
}

```

### artifacts/api-server/package.json

```json
{
  "name": "@workspace/api-server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "NODE_ENV=development pnpm run build && exec node --enable-source-maps ./dist/index.mjs",
    "build": "node ./build.mjs",
    "start": "node --enable-source-maps ./dist/index.mjs",
    "test": "node --test src/routes/*.test.ts",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@google-cloud/storage": "^8.4.0",
    "@replit/object-storage": "^1.0.0",
    "@workspace/api-zod": "workspace:*",
    "@workspace/db": "workspace:*",
    "@workspace/integrations-openai-ai-server": "workspace:*",
    "cookie-parser": "^1.4.7",
    "cors": "^2",
    "drizzle-orm": "catalog:",
    "express": "^5",
    "node-pty": "^1.1.0",
    "openai": "^6.35.0",
    "pino": "^9",
    "pino-http": "^10",
    "ws": "^8.20.0"
  },
  "devDependencies": {
    "@types/cookie-parser": "^1.4.10",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "@types/node": "catalog:",
    "@types/pg": "^8.18.0",
    "@types/ws": "^8.18.2",
    "esbuild": "^0.27.3",
    "esbuild-plugin-pino": "^2.3.3",
    "pg": "^8.20.0",
    "pino-pretty": "^13",
    "thread-stream": "3.1.0"
  }
}

```

### artifacts/devterminal/package.json

```json
{
  "name": "@workspace/devterminal",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "exec vite --config vite.config.ts --host 0.0.0.0",
    "build": "vite build --config vite.config.ts",
    "serve": "vite preview --config vite.config.ts --host 0.0.0.0",
    "test": "tsx --test src/lib/*.test.ts src/pages/*.test.ts",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@monaco-editor/react": "^4.7.0",
    "@radix-ui/react-accordion": "^1.2.4",
    "@radix-ui/react-alert-dialog": "^1.1.7",
    "@radix-ui/react-aspect-ratio": "^1.1.3",
    "@radix-ui/react-avatar": "^1.1.4",
    "@radix-ui/react-checkbox": "^1.1.5",
    "@radix-ui/react-collapsible": "^1.1.4",
    "@radix-ui/react-context-menu": "^2.2.7",
    "@radix-ui/react-dialog": "^1.1.7",
    "@radix-ui/react-dropdown-menu": "^2.1.7",
    "@radix-ui/react-hover-card": "^1.1.7",
    "@radix-ui/react-label": "^2.1.3",
    "@radix-ui/react-menubar": "^1.1.7",
    "@radix-ui/react-navigation-menu": "^1.2.6",
    "@radix-ui/react-popover": "^1.1.7",
    "@radix-ui/react-progress": "^1.1.3",
    "@radix-ui/react-radio-group": "^1.2.4",
    "@radix-ui/react-scroll-area": "^1.2.4",
    "@radix-ui/react-select": "^2.1.7",
    "@radix-ui/react-separator": "^1.1.3",
    "@radix-ui/react-slider": "^1.2.4",
    "@radix-ui/react-slot": "^1.2.0",
    "@radix-ui/react-switch": "^1.1.4",
    "@radix-ui/react-tabs": "^1.1.4",
    "@radix-ui/react-toast": "^1.2.7",
    "@radix-ui/react-toggle": "^1.1.3",
    "@radix-ui/react-toggle-group": "^1.1.3",
    "@radix-ui/react-tooltip": "^1.2.0",
    "@replit/vite-plugin-cartographer": "catalog:",
    "@replit/vite-plugin-dev-banner": "catalog:",
    "@replit/vite-plugin-runtime-error-modal": "catalog:",
    "@tailwindcss/typography": "^0.5.15",
    "@tailwindcss/vite": "catalog:",
    "@tanstack/react-query": "catalog:",
    "@testing-library/dom": "^10.4.2",
    "@testing-library/user-event": "^14.6.8",
    "@types/jsdom": "^30.0.0",
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "@workspace/api-client-react": "workspace:*",
    "@workspace/integrations-openai-ai-react": "workspace:*",
    "class-variance-authority": "catalog:",
    "clsx": "catalog:",
    "cmdk": "^1.1.1",
    "date-fns": "^3.6.0",
    "embla-carousel-react": "^8.6.0",
    "framer-motion": "catalog:",
    "input-otp": "^1.4.2",
    "jsdom": "^30.1.3",
    "lucide-react": "catalog:",
    "monaco-editor": "^0.50.0",
    "next-themes": "^0.4.6",
    "react": "catalog:",
    "react-day-picker": "^9.11.1",
    "react-dom": "catalog:",
    "react-hook-form": "^7.55.0",
    "react-icons": "^5.4.0",
    "react-resizable-panels": "^2.1.7",
    "recharts": "^2.15.2",
    "sonner": "^2.0.7",
    "tailwind-merge": "catalog:",
    "tailwindcss": "catalog:",
    "tw-animate-css": "^1.4.0",
    "vaul": "^1.1.2",
    "vite": "catalog:",
    "wouter": "^3.3.5",
    "zod": "catalog:"
  },
  "dependencies": {
    "@xterm/addon-fit": "^0.11.0",
    "@xterm/addon-search": "^0.16.0",
    "@xterm/addon-web-links": "^0.12.0",
    "@xterm/xterm": "^6.0.0"
  }
}

```

### artifacts/mockup-sandbox/package.json

```json
{
  "name": "@workspace/mockup-sandbox",
  "version": "2.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@radix-ui/react-accordion": "^1.2.12",
    "@radix-ui/react-alert-dialog": "^1.1.15",
    "@radix-ui/react-aspect-ratio": "^1.1.8",
    "@radix-ui/react-avatar": "^1.1.11",
    "@radix-ui/react-checkbox": "^1.3.3",
    "@radix-ui/react-collapsible": "^1.1.12",
    "@radix-ui/react-context-menu": "^2.2.16",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-hover-card": "^1.1.15",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-menubar": "^1.1.16",
    "@radix-ui/react-navigation-menu": "^1.2.14",
    "@radix-ui/react-popover": "^1.1.15",
    "@radix-ui/react-progress": "^1.1.8",
    "@radix-ui/react-radio-group": "^1.3.8",
    "@radix-ui/react-scroll-area": "^1.2.10",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-separator": "^1.1.8",
    "@radix-ui/react-slider": "^1.3.6",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-switch": "^1.2.6",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-toast": "^1.2.7",
    "@radix-ui/react-toggle": "^1.1.10",
    "@radix-ui/react-toggle-group": "^1.1.11",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@replit/vite-plugin-cartographer": "catalog:",
    "@replit/vite-plugin-runtime-error-modal": "catalog:",
    "@tailwindcss/vite": "catalog:",
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "chokidar": "^4.0.3",
    "class-variance-authority": "catalog:",
    "clsx": "catalog:",
    "cmdk": "^1.1.1",
    "date-fns": "^3.6.0",
    "embla-carousel-react": "^8.6.0",
    "fast-glob": "^3.3.3",
    "framer-motion": "catalog:",
    "input-otp": "^1.4.2",
    "lucide-react": "catalog:",
    "next-themes": "^0.4.6",
    "react": "catalog:",
    "react-day-picker": "^9.11.1",
    "react-dom": "catalog:",
    "react-hook-form": "^7.66.0",
    "react-resizable-panels": "^2.1.9",
    "recharts": "^2.15.4",
    "sonner": "^2.0.7",
    "tailwind-merge": "catalog:",
    "tailwindcss": "catalog:",
    "tailwindcss-animate": "^1.0.7",
    "tw-animate-css": "^1.4.0",
    "vaul": "^1.1.2",
    "vite": "catalog:",
    "zod": "catalog:"
  }
}

```

### lib/api-client-react/package.json

```json
{
  "name": "@workspace/api-client-react",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@tanstack/react-query": "catalog:"
  },
  "peerDependencies": {
    "react": ">=18"
  }
}

```

### lib/api-spec/package.json

```json
{
  "name": "@workspace/api-spec",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "codegen": "orval --config ./orval.config.ts && pnpm -w run typecheck:libs"
  },
  "devDependencies": {
    "orval": "^8.5.2"
  }
}

```

### lib/api-zod/package.json

```json
{
  "name": "@workspace/api-zod",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "zod": "catalog:"
  }
}

```

### lib/db/package.json

```json
{
  "name": "@workspace/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts"
  },
  "scripts": {
    "push": "drizzle-kit push --config ./drizzle.config.ts",
    "push-force": "drizzle-kit push --force --config ./drizzle.config.ts"
  },
  "dependencies": {
    "drizzle-orm": "catalog:",
    "drizzle-zod": "^0.8.3",
    "pg": "^8.20.0",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "@types/pg": "^8.18.0",
    "drizzle-kit": "^0.31.9"
  }
}

```

### lib/integrations-openai-ai-react/package.json

```json
{
  "name": "@workspace/integrations-openai-ai-react",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./audio": "./src/audio/index.ts"
  },
  "peerDependencies": {
    "react": ">=18"
  },
  "devDependencies": {
    "@types/react": "catalog:"
  }
}

```

### lib/integrations-openai-ai-server/package.json

```json
{
  "name": "@workspace/integrations-openai-ai-server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./batch": "./src/batch/index.ts",
    "./image": "./src/image/index.ts",
    "./audio": "./src/audio/index.ts"
  },
  "dependencies": {
    "openai": "^6.27.0",
    "p-limit": "^7.3.0",
    "p-retry": "^7.1.1"
  },
  "devDependencies": {
    "@types/node": "catalog:"
  }
}

```

### scripts/package.json

```json
{
  "name": "@workspace/scripts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "hello": "tsx ./src/hello.ts",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "tsx": "catalog:"
  }
}

```

## 3. Configuración de workspace/Replit

pnpm-workspace.yaml define los paquetes, catálogo de dependencias, restricciones de publicación y overrides por plataforma. Los artifact.toml son configuración administrada de Replit; conserva los workflows existentes y no crees servidores duplicados.

### pnpm-workspace.yaml

```yaml
# ============================================================================
# SECURITY: Minimum release age for npm packages (supply-chain attack defense)
# ============================================================================
#
# This setting requires that any npm package version must have been published
# for at least 1 day (1440 minutes) before pnpm will allow installing it.
# This is a critical defense against supply-chain attacks. In most cases,
# malicious npm releases are discovered and pulled within hours, so a 1-day
# delay provides a strong safety buffer.
#
# DO NOT DISABLE THIS SETTING. Removing or setting it to 0 is considered
# extremely dangerous and leaves the entire workspace vulnerable to supply-
# chain attacks, which have been the #1 vector for npm ecosystem compromises.
#
# If you absolutely need to install a package before the 1-day window has
# passed (e.g. an urgent security bugfix), you can add it to the
# `minimumReleaseAgeExclude` allowlist below. Only consider doing this for
# packages released by trusted organizations with an impeccable security
# posture (e.g. Replit packsges, react from Meta, typescript from Microsoft). Even then,
# remove the exclusion once the 1-day window has passed.
#
# Example:
#   minimumReleaseAgeExclude:
#     - react
#     - typescript
#
# ============================================================================
minimumReleaseAge: 1440

minimumReleaseAgeExclude:
  # Exclude @replit scoped packages from the minimum release age check.
  # These are published by Replit and trusted — the supply-chain attack vector
  # this setting guards against does not apply to our own packages.
  - '@replit/*'
  - stripe-replit-sync

packages:
  - artifacts/*
  - lib/*
  - lib/integrations/*
  - scripts

catalog:
  '@replit/vite-plugin-cartographer': ^0.5.1
  '@replit/vite-plugin-dev-banner': ^0.1.1
  '@replit/vite-plugin-runtime-error-modal': ^0.0.6
  '@tailwindcss/vite': ^4.1.14
  '@tanstack/react-query': ^5.90.21
  '@types/node': ^25.3.3
  '@types/react': ^19.2.0
  '@types/react-dom': ^19.2.0
  '@vitejs/plugin-react': ^5.0.4
  class-variance-authority: ^0.7.1
  clsx: ^2.1.1
  drizzle-orm: ^0.45.2
  framer-motion: ^12.23.24
  lucide-react: ^0.545.0
  # Must be this exact version because expo requires it
  react: 19.1.0
  # Must be this exact version because expo requires it
  react-dom: 19.1.0
  tailwind-merge: ^3.3.1
  tailwindcss: ^4.1.14
  tsx: ^4.21.0
  vite: ^7.3.2
  wouter: ^3.3.5
  zod: ^3.25.76

autoInstallPeers: false

onlyBuiltDependencies:
  - '@swc/core'
  - esbuild
  - msw
  - node-pty
  - unrs-resolver

overrides:
  # replit uses linux-x64 only, we can exclude all other platforms
  "esbuild>@esbuild/darwin-arm64": "-"
  "esbuild>@esbuild/darwin-x64": "-"
  "esbuild>@esbuild/freebsd-arm64": "-"
  "esbuild>@esbuild/freebsd-x64": "-"
  "esbuild>@esbuild/linux-arm": "-"
  "esbuild>@esbuild/linux-arm64": "-"
  "esbuild>@esbuild/linux-ia32": "-"
  "esbuild>@esbuild/linux-loong64": "-"
  "esbuild>@esbuild/linux-mips64el": "-"
  "esbuild>@esbuild/linux-ppc64": "-"
  "esbuild>@esbuild/linux-riscv64": "-"
  "esbuild>@esbuild/linux-s390x": "-"
  "esbuild>@esbuild/netbsd-arm64": "-"
  "esbuild>@esbuild/netbsd-x64": "-"
  "esbuild>@esbuild/openbsd-arm64": "-"
  "esbuild>@esbuild/openbsd-x64": "-"
  "esbuild>@esbuild/sunos-x64": "-"
  "esbuild>@esbuild/win32-arm64": "-"
  "esbuild>@esbuild/win32-ia32": "-"
  "esbuild>@esbuild/win32-x64": "-"
  "esbuild>@esbuild/aix-ppc64": '-'
  "esbuild>@esbuild/android-arm": '-'
  "esbuild>@esbuild/android-arm64": '-'
  "esbuild>@esbuild/android-x64": '-'
  "esbuild>@esbuild/openharmony-arm64": '-'
  "lightningcss>lightningcss-android-arm64": "-"
  "lightningcss>lightningcss-darwin-arm64": "-"
  "lightningcss>lightningcss-darwin-x64": "-"
  "lightningcss>lightningcss-freebsd-x64": "-"
  "lightningcss>lightningcss-linux-arm-gnueabihf": "-"
  "lightningcss>lightningcss-linux-arm64-gnu": "-"
  "lightningcss>lightningcss-linux-arm64-musl": "-"
  "lightningcss>lightningcss-linux-x64-musl": "-"
  "lightningcss>lightningcss-win32-arm64-msvc": "-"
  "lightningcss>lightningcss-win32-x64-msvc": "-"
  "@tailwindcss/oxide>@tailwindcss/oxide-android-arm64": "-"
  "@tailwindcss/oxide>@tailwindcss/oxide-darwin-arm64": "-"
  "@tailwindcss/oxide>@tailwindcss/oxide-darwin-x64": "-"
  "@tailwindcss/oxide>@tailwindcss/oxide-freebsd-x64": "-"
  "@tailwindcss/oxide>@tailwindcss/oxide-linux-arm-gnueabihf": "-"
  "@tailwindcss/oxide>@tailwindcss/oxide-linux-arm64-gnu": "-"
  "@tailwindcss/oxide>@tailwindcss/oxide-linux-arm64-musl": "-"
  "@tailwindcss/oxide>@tailwindcss/oxide-win32-arm64-msvc": "-"
  "@tailwindcss/oxide>@tailwindcss/oxide-win32-x64-msvc": "-"
  "@tailwindcss/oxide>@tailwindcss/oxide-linux-x64-musl": "-"
  "rollup>@rollup/rollup-android-arm-eabi": "-"
  "rollup>@rollup/rollup-android-arm64": "-"
  "rollup>@rollup/rollup-darwin-arm64": "-"
  "rollup>@rollup/rollup-darwin-x64": "-"
  "rollup>@rollup/rollup-freebsd-arm64": "-"
  "rollup>@rollup/rollup-freebsd-x64": "-"
  "rollup>@rollup/rollup-linux-arm-gnueabihf": "-"
  "rollup>@rollup/rollup-linux-arm-musleabihf": "-"
  "rollup>@rollup/rollup-linux-arm64-gnu": "-"
  "rollup>@rollup/rollup-linux-arm64-musl": "-"
  "rollup>@rollup/rollup-linux-loong64-gnu": "-"
  "rollup>@rollup/rollup-linux-loong64-musl": "-"
  "rollup>@rollup/rollup-linux-ppc64-gnu": "-"
  "rollup>@rollup/rollup-linux-ppc64-musl": "-"
  "rollup>@rollup/rollup-linux-riscv64-gnu": "-"
  "rollup>@rollup/rollup-linux-riscv64-musl": "-"
  "rollup>@rollup/rollup-linux-s390x-gnu": "-"
  "rollup>@rollup/rollup-linux-x64-musl": "-"
  "rollup>@rollup/rollup-openbsd-x64": "-"
  "rollup>@rollup/rollup-openharmony-arm64": "-"
  "rollup>@rollup/rollup-win32-arm64-msvc": "-"
  "rollup>@rollup/rollup-win32-ia32-msvc": "-"
  "rollup>@rollup/rollup-win32-x64-gnu": "-"
  "rollup>@rollup/rollup-win32-x64-msvc": "-"
  "@expo/ngrok-bin>@expo/ngrok-bin-darwin-arm64": "-"
  "@expo/ngrok-bin>@expo/ngrok-bin-darwin-x64": "-"
  "@expo/ngrok-bin>@expo/ngrok-bin-freebsd-ia32": "-"
  "@expo/ngrok-bin>@expo/ngrok-bin-freebsd-x64": "-"
  "@expo/ngrok-bin>@expo/ngrok-bin-linux-arm64": "-"
  "@expo/ngrok-bin>@expo/ngrok-bin-linux-arm": "-"
  "@expo/ngrok-bin>@expo/ngrok-bin-linux-ia32": "-"
  "@expo/ngrok-bin>@expo/ngrok-bin-sunos-x64": "-"
  "@expo/ngrok-bin>@expo/ngrok-bin-win32-ia32": "-"
  "@expo/ngrok-bin>@expo/ngrok-bin-win32-x64": "-"
  # drizzle-kit uses esbuild internally on an older version that's vulnerable, this overrides it
  "@esbuild-kit/esm-loader": "npm:tsx@^4.21.0"
  esbuild: "0.27.3"
```

### tsconfig.json

```json
{
  "extends": "./tsconfig.base.json",
  "compileOnSave": false,
  "files": [],
  "references": [
    {
      "path": "./lib/db"
    },
    {
      "path": "./lib/api-client-react"
    },
    {
      "path": "./lib/api-zod"
    },
    {
      "path": "./lib/integrations-openai-ai-server"
    },
    {
      "path": "./lib/integrations-openai-ai-react"
    }
  ]
}

```

### tsconfig.base.json

```json
{
  "compilerOptions": {
    "isolatedModules": true,
    "lib": ["es2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "noEmitOnError": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": false,
    "noImplicitReturns": true,
    "noUnusedLocals": false,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "strictNullChecks": true,
    "strictFunctionTypes": false,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,
    "skipLibCheck": true,
    "target": "es2022",
    "types": [],
    "customConditions": ["workspace"]
  }
}

```

### artifacts/api-server/tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "allowImportingTsExtensions": true,
    "types": ["node"]
  },
  "include": ["src"],
  "references": [
    {
      "path": "../../lib/db"
    },
    {
      "path": "../../lib/api-zod"
    },
    {
      "path": "../../lib/integrations-openai-ai-server"
    }
  ]
}

```

### artifacts/devterminal/tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build", "dist", "**/*.test.ts"],
  "compilerOptions": {
    "noEmit": true,
    "jsx": "preserve",
    "lib": ["esnext", "dom", "dom.iterable"],
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "moduleResolution": "bundler",
    "types": ["node", "vite/client"],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "references": [
    {
      "path": "../../lib/api-client-react"
    }
  ]
}

```

### artifacts/mockup-sandbox/tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*", "mockupPreviewPlugin.ts", "vite.config.ts"],
  "exclude": ["node_modules", "build", "dist", "**/*.test.ts"],
  "compilerOptions": {
    "noEmit": true,
    "lib": ["es2022", "dom", "dom.iterable"],
    "jsx": "preserve",
    "esModuleInterop": true,
    "allowImportingTsExtensions": true,
    "types": ["node", "vite/client"],
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

```

### artifacts/devterminal/vite.config.ts

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const isBuild = process.argv.includes("build");
const rawPort = process.env.PORT ?? (isBuild ? "5173" : undefined);

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? (isBuild ? "/" : undefined);

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});

```

### artifacts/mockup-sandbox/vite.config.ts

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    mockupPreviewPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});

```

### lib/db/drizzle.config.ts

```typescript
import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});

```

### lib/api-spec/orval.config.ts

```typescript
import { defineConfig, InputTransformerFn } from "orval";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const apiClientReactSrc = path.resolve(root, "lib", "api-client-react", "src");
const apiZodSrc = path.resolve(root, "lib", "api-zod", "src");

// Our exports make assumptions about the title of the API being "Api" (i.e. generated output is `api.ts`).
const titleTransformer: InputTransformerFn = (config) => {
  config.info ??= {};
  config.info.title = "Api";

  return config;
};

export default defineConfig({
  "api-client-react": {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiClientReactSrc,
      target: "generated",
      client: "react-query",
      mode: "split",
      baseUrl: "/api",
      clean: true,
      prettier: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiZodSrc,
      client: "zod",
      target: "generated",
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        zod: {
          coerce: {
            query: ['boolean', 'number', 'string'],
            param: ['boolean', 'number', 'string'],
            body: ['bigint', 'date'],
            response: ['bigint', 'date'],
          },
        },
        useDates: true,
        useBigInt: true,
      },
    },
  },
});

```

### artifacts/api-server/.replit-artifact/artifact.toml

```toml
kind = "api"
previewPath = "/api" # TODO - should be excluded from preview in the first place
title = "API Server"
version = "1.0.0"
id = "3B4_FFSkEVBkAeYMFRJ2e"

[[services]]
localPort = 3000
name = "API Server"
paths = ["/api"]

[services.development]
run = "pnpm --filter @workspace/api-server run dev"

[services.production]

[services.production.build]
args = ["pnpm", "--filter", "@workspace/api-server", "run", "build"]

[services.production.build.env]
NODE_ENV = "production"

[services.production.run]
# we don't run through pnpm to make startup faster in production
args = ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]

[services.production.run.env]
PORT = "3000"
NODE_ENV = "production"

[services.production.health.startup]
path = "/api/healthz"

```

### artifacts/devterminal/.replit-artifact/artifact.toml

```toml
kind = "web"
previewPath = "/"
title = "DevTerminal"
version = "1.0.0"
id = "artifacts/devterminal"
router = "path"

[[integratedSkills]]
name = "react-vite"
version = "1.0.0"

[[services]]
name = "web"
paths = [ "/" ]
localPort = 21612

[services.development]
run = "pnpm --filter @workspace/devterminal run dev"

[services.production]
build = [ "pnpm", "--filter", "@workspace/devterminal", "run", "build" ]
publicDir = "artifacts/devterminal/dist/public"
serve = "static"

[[services.production.rewrites]]
from = "/*"
to = "/index.html"

[services.env]
PORT = "21612"
BASE_PATH = "/"

```

### artifacts/mockup-sandbox/.replit-artifact/artifact.toml

```toml
kind = "design"
previewPath = "/__mockup"
title = "Canvas"
version = "1.0.0"
id = "XegfDyZt7HqfW2Bb8Ghoy"

[[services]]
localPort = 8081
name = "Component Preview Server"
paths = ["/__mockup"]

[services.env]
PORT = "8081"
BASE_PATH = "/__mockup"

[services.development]
run = "pnpm --filter @workspace/mockup-sandbox run dev"

```

### .replit

```text
modules = ["nodejs-24", "python-3.11", "postgresql-16"]

[deployment]
router = "application"
deploymentTarget = "autoscale"

[deployment.postBuild]
args = ["pnpm", "store", "prune"]
env = { "CI" = "true" }

[workflows]
runButton = "Project"

[agent]
stack = "PNPM_WORKSPACE"
expertMode = true

[postMerge]
path = "scripts/post-merge.sh"
timeoutMs = 20000

[[ports]]
localPort = 8080
externalPort = 8080

[[ports]]
localPort = 8081
externalPort = 80

[[ports]]
localPort = 8082
externalPort = 3001

[[ports]]
localPort = 8083
externalPort = 3002

[[ports]]
localPort = 21612
externalPort = 3000

[nix]
channel = "stable-25_05"

[objectStorage]
defaultBucketID = "replit-objstore-30ddc0e6-be8b-47ea-8eba-f40b703c90df"

```

### .replitignore

```text
# The format of this file is identical to `.dockerignore`.
# It is used to reduce the size of deployed images to make the process of publishing faster.

# No need to store the pnpm store twice.
.local

/generated-artifacts/
**/__pycache__/

```

### replit.md

```text
# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

```

## 4. Entorno y credenciales

No se leyó ni se incluye ningún valor secreto. No se encontró un .env raíz en el inventario. Configura estos nombres en el gestor seguro del entorno destino; nunca pegues sus valores en el repo ni en el prompt de Claude:

| Variable | Uso |
|---|---|
| DATABASE_URL | Obligatoria: conexión PostgreSQL de Drizzle/pg. |
| PORT | Obligatoria para API; inyectada por workflow en Replit. |
| OPENAI_API_KEY | Ruta de chat DeepSeek (API compatible con OpenAI); openai.ts además acepta chatgpt u openIA como nombres heredados. |
| GEMINI_API_KEY | Proveedor Gemini, si se usa /api/gemini/chat. |
| AI_INTEGRATIONS_OPENAI_API_KEY | Credencial de integración server OpenAI para los módulos de integración. |
| AI_INTEGRATIONS_OPENAI_BASE_URL | Base URL de dicha integración. |
| DEFAULT_OBJECT_STORAGE_BUCKET_ID | Bucket para el almacenamiento de imágenes si la función se usa. |
| LOG_LEVEL | Opcional, por defecto info. |
| NODE_ENV, BASE_PATH, REPL_ID, HOME, PATH | Configuración/runtime de Replit, Vite y procesos hijos; no son secretos de proveedor. |
| DEEPSEEK_STREAM_MOCK | Mock de streaming solo en desarrollo. |

La disponibilidad de una variable en el workspace no implica que sea obligatoria para todas las funciones. El API también requiere configurar las credenciales de los proveedores efectivamente usados.

## 5. Base de datos y ORM

PostgreSQL con pg y Drizzle (lib/db). El schema fuente está en lib/db/src/schema y se exporta desde schema/index.ts. drizzle.config.ts obtiene DATABASE_URL. No hay directorio estándar drizzle/migrations; existen scripts SQL puntuales, y el schema se puede sincronizar con drizzle-kit push. push-force puede ser destructivo; revisar antes de ejecutar. El archivo backup_neuron_quant.sql se omite deliberadamente: no forma parte del flujo canónico de migraciones.

| Tabla | Esquema | Relación |
|---|---|---|
| agents | id text PK; name; xp int default 0; failed_analyses, successful_tasks, failed_tasks int default 0; last_omega float nullable sin default; last_failure nullable; status default idle; updated_at timestamptz | uno a muchos prompts |
| conversations | serial PK, title, created_at timestamptz | uno a muchos messages/prompts |
| messages | serial PK, conversation_id FK requerido, role, content, idempotency_key nullable, created_at timestamptz | FK a conversations con cascade; índice único idempotency_key |
| neural_events | serial PK, origin, event_type, content, created_at timestamptz | persistencia del stream de eventos |
| prompts | serial PK, agent_id nullable, conversation_id nullable, name, content, created_at | ambas FK on delete set null |
| simulation_logs | serial PK, vector, coherence float, turbulence, vectors_processed int, created_at | muestras simuladas |
| snippets | serial PK, title, code, language, created_at, updated_at, last_run_at nullable | Library |

Omega operacional = successful_tasks / (successful_tasks + failed_tasks), NULL sin resultados medidos. XP no es proxy de éxitos y no debe usarse para inferir Omega. Esto no calcula Ω financiero ni demuestra Sello S.

### Fuentes completas del schema/conexión y scripts SQL

### lib/db/src/index.ts

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";

```

### lib/db/src/schema/index.ts

```typescript
export * from "./snippets";
export * from "./conversations";
export * from "./messages";
export * from "./agents";
export * from "./prompts";
export * from "./neural-events";
export * from "./simulation-logs";
export * from "./relations";

```

### lib/db/src/schema/agents.ts

```typescript
import {
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const agentsTable = pgTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  xp: integer("xp").notNull().default(0),
  failedAnalyses: integer("failed_analyses").notNull().default(0),
  successfulTasks: integer("successful_tasks").notNull().default(0),
  failedTasks: integer("failed_tasks").notNull().default(0),
  lastOmega: doublePrecision("last_omega"),
  lastFailure: text("last_failure"),
  status: text("status").notNull().default("idle"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

```

### lib/db/src/schema/conversations.ts

```typescript
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

```

### lib/db/src/schema/messages.ts

```typescript
import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { conversations } from "./conversations";

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("messages_idempotency_key_unique").on(table.idempotencyKey),
  ],
);

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

```

### lib/db/src/schema/neural-events.ts

```typescript
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const neuralEventsTable = pgTable("neural_events", {
  id: serial("id").primaryKey(),
  origin: text("origin").notNull(),
  eventType: text("event_type").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertNeuralEventSchema = createInsertSchema(neuralEventsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertNeuralEvent = z.infer<typeof insertNeuralEventSchema>;
export type NeuralEvent = typeof neuralEventsTable.$inferSelect;

```

### lib/db/src/schema/prompts.ts

```typescript
import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { agentsTable } from "./agents";
import { conversations } from "./conversations";

export const prompts = pgTable("prompts", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").references(() => agentsTable.id, {
    onDelete: "set null",
  }),
  conversationId: integer("conversation_id").references(() => conversations.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertPromptSchema = createInsertSchema(prompts).omit({
  id: true,
  createdAt: true,
});

export type Prompt = typeof prompts.$inferSelect;
export type InsertPrompt = z.infer<typeof insertPromptSchema>;

```

### lib/db/src/schema/relations.ts

```typescript
import { relations } from "drizzle-orm";
import { agentsTable } from "./agents";
import { conversations } from "./conversations";
import { prompts } from "./prompts";

export const agentsRelations = relations(agentsTable, ({ many }) => ({
  prompts: many(prompts),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  prompts: many(prompts),
}));

export const promptsRelations = relations(prompts, ({ one }) => ({
  agent: one(agentsTable, {
    fields: [prompts.agentId],
    references: [agentsTable.id],
  }),
  conversation: one(conversations, {
    fields: [prompts.conversationId],
    references: [conversations.id],
  }),
}));

```

### lib/db/src/schema/simulation-logs.ts

```typescript
import { pgTable, serial, text, doublePrecision, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const simulationLogsTable = pgTable("simulation_logs", {
  id: serial("id").primaryKey(),
  vector: text("vector").notNull(),
  coherence: doublePrecision("coherence").notNull(),
  turbulence: text("turbulence").notNull(),
  vectorsProcessed: integer("vectors_processed").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSimulationLogSchema = createInsertSchema(simulationLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertSimulationLog = z.infer<typeof insertSimulationLogSchema>;
export type SimulationLog = typeof simulationLogsTable.$inferSelect;

```

### lib/db/src/schema/snippets.ts

```typescript
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const snippetsTable = pgTable("snippets", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  code: text("code").notNull(),
  language: text("language").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastRunAt: timestamp("last_run_at"),
});

export const insertSnippetSchema = createInsertSchema(snippetsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRunAt: true,
});

export type InsertSnippet = z.infer<typeof insertSnippetSchema>;
export type Snippet = typeof snippetsTable.$inferSelect;

```

### scripts/agent-task-outcomes-migration.sql

```sql
-- Additive migration. No historical success/failure outcomes are inferred.
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS successful_tasks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_tasks integer NOT NULL DEFAULT 0;

```

### scripts/cleanup-duplicate-messages.sql

```sql
\set ON_ERROR_STOP on
\if :{?execute}
\else
\set execute false
\endif

BEGIN;

CREATE TEMP TABLE duplicate_message_ids ON COMMIT DROP AS
WITH ordered AS (
  SELECT
    id,
    conversation_id,
    role,
    content,
    created_at,
    LAG(created_at) OVER (
      PARTITION BY conversation_id, role, content
      ORDER BY created_at, id
    ) AS previous_created_at
  FROM messages
  WHERE role = 'assistant'
),
clusters AS (
  SELECT *,
    SUM(
      CASE
        WHEN previous_created_at IS NULL
          OR created_at - previous_created_at > INTERVAL '1 second'
        THEN 1 ELSE 0
      END
    ) OVER (
      PARTITION BY conversation_id, role, content
      ORDER BY created_at, id
      ROWS UNBOUNDED PRECEDING
    ) AS cluster_id
  FROM ordered
),
ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY conversation_id, role, content, cluster_id
      ORDER BY created_at, id
    ) AS duplicate_rank
  FROM clusters
)
SELECT id FROM ranked WHERE duplicate_rank > 1;

\echo 'Candidatos a duplicado (se conserva el primer mensaje de cada repetición dentro de 1 segundo):'
SELECT m.id, m.conversation_id, m.role, LEFT(m.content, 140) AS content_preview, m.created_at
FROM messages AS m
JOIN duplicate_message_ids AS d USING (id)
ORDER BY m.conversation_id, m.created_at, m.id
LIMIT 50;

\if :execute
\echo 'Modo de ejecución: eliminando duplicados.'
DELETE FROM messages AS m
USING duplicate_message_ids AS d
WHERE m.id = d.id
RETURNING m.id, m.conversation_id;
\else
\echo 'Vista previa únicamente; no se eliminaron filas. Para borrar, agrega -v execute=true.'
\endif

COMMIT;

```

## 6. API/servidor

Express 5 en artifacts/api-server/src. app.ts registra pino-http, CORS, body parsers, cache-control no-store para telemetría seleccionada, redirección de / a /api/healthz y montaje del router bajo /api. index.ts exige PORT, arranca el servidor, WebSocket de terminal, transporte Postgres para eventos neurales, inicialización de métricas propias de agentes, y simulador Motor 5.5; SIGTERM detiene/cierra recursos.

### Catálogo de endpoints (código dueño indicado)

| Endpoint | Propósito |
|---|---|
| GET /api/healthz | Health. routes/health.ts |
| GET /api/languages; POST /api/install; POST /api/execute | Runner de código; implementación sensible, no volcada aquí. routes/execute.ts |
| CRUD /api/snippets; GET /api/snippets/recent | Library. routes/snippets.ts |
| POST /api/snippets/:id/execute | Marca timestamp y registra evento de ejecución simulada; NO ejecuta code. routes/snippet-execution.ts |
| GET /api/agents; POST /api/ai/chat, /api/ai/explain, /api/ai/improve | agentes/chat y métricas. routes/ai.ts |
| POST /api/agents/simulated-analysis | tareas simuladas. routes/agents-simulation.ts |
| POST /api/ai/auto-run | ruta autónoma de ejecución; código sensible omitido. routes/autorun.ts |
| POST /api/deepseek/chat; POST /api/chat | SSE y alias; herramientas asociadas, implementación sensible omitida. routes/deepseek.ts |
| POST /api/gemini/chat | proveedor Gemini. routes/gemini.ts |
| POST /api/cortex/context, /api/cortex/learning | contexto y aprendizaje. routes/cortex.ts |
| GET/POST /api/neural-events; GET /api/neural-events/stream | eventos neuronales y SSE. |
| GET/POST/DELETE /api/messages | mensajes terminal. |
| GET status/logs/page, POST start/stop, GET stream /api/coherence-simulation | simulación de coherencia. |
| GET /api/trading-status | lectura readonly de estado Python. |
| POST /api/openai/chat, POST /api/openai/image, GET /api/openai/image/:imageId | rutas OpenAI/almacenamiento. |
| POST /api/diagnostics/webview | diagnóstico frontend. |

Especificación fuente: lib/api-spec/openapi.yaml. Codegen con pnpm --filter @workspace/api-spec run codegen genera React Query y Zod; no editar lib/api-client-react/src/generated ni lib/api-zod/src/generated manualmente.

### Fuentes principales de servidor — código completo de módulos de orquestación, datos y telemetría

### artifacts/api-server/src/app.ts

```typescript
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { recordServerRequest } from "./lib/runtime-diagnostics";
import { disableTelemetryCache } from "./routes/telemetry-cache";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use((req, res, next) => {
  const started = Date.now();
  res.once("finish", () => {
    recordServerRequest(req.method, req.path, res.statusCode, Date.now() - started);
  });
  next();
});
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Telemetry is always live, including requests with old cache validators.
app.use(["/api/healthz", "/api/agents", "/api/neural-events"], disableTelemetryCache);

app.get("/", (_req, res) => {
  res.redirect(302, "/api/healthz");
});

app.use("/api", router);

export default app;

```

### artifacts/api-server/src/index.ts

```typescript
import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { stopSimulation, startSimulation, subscribeToSimulation, getSimulationStatus } from "./lib/coherence_simulator";
import { persistSimulationSample } from "./routes/coherence-simulation";
import { attachMotorTelemetry, publishMotorHighCoherence } from "./routes/motor-telemetry";
import { initializeAgentTelemetry } from "./routes/agent-telemetry-initialization";
import { attachTerminalWS } from "./routes/terminal";
import { pool } from "@workspace/db";
import {
  configureNeuralEventNotifier,
  publishRemoteNeuralEvent,
} from "./routes/neural-event-bus.ts";
import {
  loadNeuralEventsSince,
  loadLatestNeuralEventId,
  PostgresNeuralEventTransport,
} from "./routes/neural-event-postgres.ts";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);

const terminalWss = attachTerminalWS(server);

const neuralEventTransport = new PostgresNeuralEventTransport({
  pool,
  loadEventsSince: (eventId) => loadNeuralEventsSince(pool, eventId),
  loadLatestEventId: () => loadLatestNeuralEventId(pool),
  onEvent: publishRemoteNeuralEvent,
});
configureNeuralEventNotifier((eventId) => neuralEventTransport.publish(eventId));

await neuralEventTransport.start();
await initializeAgentTelemetry();

const detachMotorTelemetry = attachMotorTelemetry({
  stopSimulation, startSimulation, subscribeToSimulation, getSimulationStatus,
}, publishMotorHighCoherence);
startSimulation(persistSimulationSample);
logger.info("Motor 5.5 iniciado: telemetría autónoma del servidor");

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});

process.once("SIGTERM", () => {
  logger.info("SIGTERM recibido; cerrando servidor y pool de PostgreSQL");
  stopSimulation();
  detachMotorTelemetry();
  for (const client of terminalWss.clients) {
    client.terminate();
  }
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, "Error cerrando el servidor HTTP");
      process.exitCode = 1;
    }
    void neuralEventTransport
      .stop()
      .then(() => pool.end())
      .then(() => logger.info("Pool de PostgreSQL cerrado"))
      .catch((poolError) => {
        logger.error({ err: poolError }, "Error cerrando el pool de PostgreSQL");
        process.exitCode = 1;
      });
  });
});

```

### artifacts/api-server/src/routes/index.ts

```typescript
import { Router, type IRouter } from "express";
import healthRouter from "./health";
import executeRouter from "./execute";
import snippetsRouter from "./snippets";
import aiRouter from "./ai";
import autorunRouter from "./autorun";
import deepseekRouter from "./deepseek";
import geminiRouter from "./gemini";
import neuralEventsRouter from "./neural-events";
import messagesRouter from "./messages";
import diagnosticsRouter from "./diagnostics";
import cortexRouter from "./cortex";
import openAiRouter from "./openai";
import coherenceSimulationRouter from "./coherence-simulation";
import agentsSimulationRouter from "./agents-simulation";
import tradingStatusRouter from "./trading-status";
import { disableTelemetryCache } from "./telemetry-cache";

const router: IRouter = Router();

router.use([
  "/coherence-simulation", "/diagnostics", "/cortex/context",
  "/deepseek/chat", "/chat", "/openai/chat",
], disableTelemetryCache);

router.use(healthRouter);
router.use(executeRouter);
router.use(snippetsRouter);
router.use(aiRouter);
router.use(deepseekRouter);
router.use(geminiRouter);
router.use(neuralEventsRouter);
router.use(messagesRouter);
router.use(diagnosticsRouter);
router.use(cortexRouter);
router.use(openAiRouter);
router.use(coherenceSimulationRouter);
router.use(agentsSimulationRouter);
router.use(tradingStatusRouter);
router.use(autorunRouter);

export default router;

```

### artifacts/api-server/src/lib/agent-circuit-breaker.ts

```typescript
export type AgentCircuitState = "CLOSED" | "OPEN" | "HALF-OPEN";

export type AgentCircuitSnapshot = {
  state: AgentCircuitState;
  consecutiveFailures: number;
  remainingMs: number;
  probeInFlight: boolean;
  lastFailure: string | null;
};

export type AgentCircuitTransition = AgentCircuitSnapshot & {
  agentId: string;
  previousState: AgentCircuitState;
};

type CircuitRecord = {
  state: AgentCircuitState;
  consecutiveFailures: number;
  openUntil: number;
  inFlight: boolean;
  lastFailure: string | null;
};

export type AgentCircuitOptions = {
  failureThreshold?: number;
  /** Cooldown in milliseconds: 30 seconds by default. */
  recovery_timeout?: number;
  now?: () => number;
  onTransition?: (event: AgentCircuitTransition) => void;
};

/** A verified invariant violation must stop propagation immediately. */
export class AgentSafetyViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentSafetyViolation";
  }
}

/** Only server-authored messages are safe to persist as failure details. */
export class AgentTaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentTaskValidationError";
  }
}

export class AgentCircuitBlockedError extends Error {
  public readonly agentId: string;
  public readonly circuit: AgentCircuitSnapshot;

  constructor(agentId: string, circuit: AgentCircuitSnapshot) {
    super(circuit.probeInFlight
      ? "El agente ya tiene una ejecución o auditoría en curso."
      : "Agente congelado por el disyuntor de seguridad.");
    this.name = "AgentCircuitBlockedError";
    this.agentId = agentId;
    this.circuit = circuit;
  }
}

export class AgentCircuitBreaker {
  private readonly states = new Map<string, CircuitRecord>();
  private readonly threshold: number;
  private readonly recoveryTimeout: number;
  private readonly now: () => number;
  private readonly onTransition?: AgentCircuitOptions["onTransition"];

  constructor(options: AgentCircuitOptions = {}) {
    this.threshold = options.failureThreshold ?? 3;
    this.recoveryTimeout = options.recovery_timeout ?? 30_000;
    if (!Number.isSafeInteger(this.threshold) || this.threshold < 1) {
      throw new RangeError("failureThreshold debe ser un entero positivo.");
    }
    if (!Number.isSafeInteger(this.recoveryTimeout) || this.recoveryTimeout < 1) {
      throw new RangeError("recovery_timeout debe ser un entero positivo en milisegundos.");
    }
    this.now = options.now ?? Date.now;
    this.onTransition = options.onTransition;
  }

  private record(agentId: string): CircuitRecord {
    let record = this.states.get(agentId);
    if (!record) {
      record = { state: "CLOSED", consecutiveFailures: 0, openUntil: 0, inFlight: false, lastFailure: null };
      this.states.set(agentId, record);
    }
    return record;
  }

  private snapshot(record: CircuitRecord): AgentCircuitSnapshot {
    return {
      state: record.state,
      consecutiveFailures: record.consecutiveFailures,
      remainingMs: Math.max(0, record.openUntil - this.now()),
      probeInFlight: record.inFlight,
      lastFailure: record.lastFailure,
    };
  }

  private transition(agentId: string, record: CircuitRecord, state: AgentCircuitState) {
    const previousState = record.state;
    record.state = state;
    if (previousState !== state) {
      // Observability must never release the safety lock or change task outcome.
      try {
        this.onTransition?.({ agentId, previousState, ...this.snapshot(record) });
      } catch {
        // The production observer handles and logs delivery failures separately.
      }
    }
  }

  getSnapshot(agentId: string): AgentCircuitSnapshot {
    const record = this.record(agentId);
    // Lazy automatic transition: no background agent runs or unbounded timers.
    if (record.state === "OPEN" && this.now() >= record.openUntil) {
      this.transition(agentId, record, "HALF-OPEN");
    }
    return this.snapshot(record);
  }

  /**
   * One execution per agent, including the HALF-OPEN audit. Validate inside the
   * task, before publishing/persisting its output. Resolve only after persistence.
   */
  async execute<T>(agentId: string, task: () => Promise<T>): Promise<T> {
    const snapshot = this.getSnapshot(agentId);
    const record = this.record(agentId);
    if (snapshot.state === "OPEN" || record.inFlight) {
      throw new AgentCircuitBlockedError(agentId, snapshot);
    }
    record.inFlight = true;
    try {
      const result = await task();
      record.consecutiveFailures = 0;
      record.lastFailure = null;
      record.openUntil = 0;
      this.transition(agentId, record, "CLOSED");
      return result;
    } catch (error) {
      record.consecutiveFailures += 1;
      // Do not copy arbitrary provider output or source code into safety logs.
      record.lastFailure = error instanceof AgentSafetyViolation || error instanceof AgentTaskValidationError
        ? error.message
        : "Excepción o validación fallida durante la tarea del agente.";
      if (error instanceof AgentSafetyViolation ||
          record.state === "HALF-OPEN" ||
          record.consecutiveFailures >= this.threshold) {
        record.openUntil = this.now() + this.recoveryTimeout;
        this.transition(agentId, record, "OPEN");
      }
      throw error;
    } finally {
      record.inFlight = false;
    }
  }
}

```

### artifacts/api-server/src/routes/agent-swarm-circuit.ts

```typescript
import { logger } from "../lib/logger";
import { AgentCircuitBreaker } from "../lib/agent-circuit-breaker";

/**
 * Shared by AI analyses and synthetic tasks, so neither entry point can bypass
 * an OPEN circuit on the other. Configuration is server-owned, not model-owned.
 */
export const agentSwarmCircuit = new AgentCircuitBreaker({
  failureThreshold: 3,
  recovery_timeout: 30_000,
  onTransition(event) {
    const details = { event: "agent_circuit_transition", law: "4105", ...event };
    if (event.state === "OPEN") {
      logger.error(details, "Agent Swarm: congelamiento de seguridad");
    } else {
      logger.info(details, "Agent Swarm: transición del disyuntor");
    }
    void (async () => {
      const { db, neuralEventsTable } = await import("@workspace/db");
      const { publishNeuralEvent } = await import("./neural-event-bus");
      const [saved] = await db.insert(neuralEventsTable).values({
        origin: "agents",
        eventType: event.state === "OPEN" ? "agent_circuit_open" : "agent_circuit_recovery",
        content: JSON.stringify(details),
      }).returning();
      await publishNeuralEvent({
        id: saved.id,
        origin: "agents",
        eventType: saved.eventType,
        content: saved.content,
        createdAt: saved.createdAt.toISOString(),
      });
    })().catch((err: unknown) => logger.error(
      { err, agentId: event.agentId, state: event.state },
      "No se pudo persistir o transmitir la alerta; el disyuntor conserva su estado",
    ));
  },
});

```

### artifacts/api-server/src/routes/agent-task-outcomes.ts

```typescript
import { sql } from "drizzle-orm";

export function taskSuccessOmega(successes: number, failures: number): number | null {
  if (!Number.isSafeInteger(successes) || successes < 0 ||
      !Number.isSafeInteger(failures) || failures < 0 ||
      !Number.isSafeInteger(successes + failures)) {
    throw new RangeError("Ω requiere contadores de tareas enteros, seguros y no negativos.");
  }
  const total = successes + failures;
  return total === 0 ? null : successes / total;
}

export type AgentTaskStore = Pick<typeof import("@workspace/db"), "db" | "agentsTable">;

/** Atomic per-row arithmetic; the motor's coherence is never an input. */
export async function recordAgentTaskFailure(agentId: string, reason: string, open: boolean, store?: AgentTaskStore) {
  const { db, agentsTable } = store ?? await import("@workspace/db");
  await db.insert(agentsTable).values({
    id: agentId,
    name: agentId,
    failedAnalyses: 1,
    failedTasks: 1,
    lastOmega: 0,
    lastFailure: reason,
    status: open ? "standby" : "failed",
  }).onConflictDoUpdate({
    target: agentsTable.id,
    set: {
      failedAnalyses: sql`${agentsTable.failedAnalyses} + 1`,
      failedTasks: sql`${agentsTable.failedTasks} + 1`,
      lastOmega: sql`${agentsTable.successfulTasks}::double precision / (${agentsTable.successfulTasks} + ${agentsTable.failedTasks} + 1)`,
      lastFailure: reason,
      status: open ? "standby" : "failed",
      updatedAt: new Date(),
    },
  });
}

```

### artifacts/api-server/src/routes/agents-simulation.ts

```typescript
import { Router } from "express";
import { sql } from "drizzle-orm";
import { AgentCircuitBreaker, AgentCircuitBlockedError, AgentSafetyViolation } from "./agent-circuit-breaker.ts";
import { recordAgentTaskFailure, taskSuccessOmega, type AgentTaskStore } from "./agent-task-outcomes.ts";

type ParsedSimulationBody =
  | { success: true; data: { agentId: string; vector: string; coherence: number } }
  | { success: false };
type ParseSimulationBody = (body: unknown) => Promise<ParsedSimulationBody> | ParsedSimulationBody;

type AgentRole = {
  name: string;
  action: (vector: string, coherence: number) => string;
};

const AGENT_ROLES: Record<string, AgentRole> = {
  optimizer: {
    name: "Optimizer",
    action: (vector) => `Análisis sintético: vector ${vector} procesado como dato decimal; no se detectó una operación redundante.`,
  },
  security: {
    name: "Security",
    action: (vector) => `Validación sintética: vector ${vector} está dentro del rango uint64 y se trata como dato, no como carga ejecutable.`,
  },
  architect: {
    name: "Architect",
    action: (vector) => `Revisión sintética: vector ${vector} conserva una representación decimal estable para el flujo.`,
  },
  debug: {
    name: "Debugger",
    action: (vector) => `Comprobación sintética: vector ${vector} fue recibido y su residuo puede calcularse sin pérdida de precisión.`,
  },
  docs: {
    name: "Docs",
    action: (vector, coherence) => `Registro sintético: vector ${vector} recibido con coherencia ${coherence.toFixed(2)}%.`,
  },
  ideas: {
    name: "Ideas",
    action: (vector, coherence) => `Propuesta sintética: comparar el vector ${vector} con la siguiente muestra de coherencia ${coherence.toFixed(2)}%.`,
  },
  coherence: {
    name: "Coherencia 4105",
    action: (vector, coherence) => `Medición sintética: vector ${vector}; coherencia normalizada ${coherence.toFixed(2)}%.`,
  },
};

export type SimulatedAgentTask = {
  agentId: string;
  agentName: string;
  vector: string;
  coherence: number;
};

export type SimulatedAgentTaskResult = SimulatedAgentTask & {
  action: string;
  omega: number;
  xp: number;
  status: "completed";
};

export type AgentSimulationDependencies = {
  completeTask?: (task: SimulatedAgentTask) => Promise<SimulatedAgentTaskResult>;
  parseBody?: ParseSimulationBody;
  circuit?: AgentCircuitBreaker;
  onFailure?: (agentId: string, reason: string, open: boolean) => Promise<void>;
};

function validateSimulatedResult(task: SimulatedAgentTask, result: SimulatedAgentTaskResult) {
  if (result.agentId !== task.agentId || result.agentName !== task.agentName ||
      result.vector !== task.vector || result.coherence !== task.coherence ||
      !Number.isFinite(result.omega) || result.omega < 0 || result.omega > 1 || !result.action.trim() ||
      result.status !== "completed" || !Number.isSafeInteger(result.xp) || result.xp < 0) {
    throw new AgentSafetyViolation("Deriva de los parámetros verificables de la tarea sintética.");
  }
}

export async function completePersistedTask(task: SimulatedAgentTask, store?: AgentTaskStore): Promise<SimulatedAgentTaskResult> {
  // A new row records one observed success, not a schema/default Ω.
  const initialOmega = taskSuccessOmega(1, 0)!;
  const result: SimulatedAgentTaskResult = {
    ...task,
    action: AGENT_ROLES[task.agentId]!.action(task.vector, task.coherence),
    omega: initialOmega,
    xp: 0,
    status: "completed",
  };
  validateSimulatedResult(task, result);
  const { agentsTable, db } = store ?? await import("@workspace/db");
  const [agent] = await db
    .insert(agentsTable)
    .values({
      id: task.agentId,
      name: task.agentName,
      xp: 1,
      successfulTasks: 1,
      lastOmega: initialOmega,
      status: "completed",
      lastFailure: null,
    })
    .onConflictDoUpdate({
      target: agentsTable.id,
      set: {
        xp: sql`${agentsTable.xp} + 1`,
        successfulTasks: sql`${agentsTable.successfulTasks} + 1`,
        lastOmega: sql`(${agentsTable.successfulTasks} + 1)::double precision / (${agentsTable.successfulTasks} + ${agentsTable.failedTasks} + 1)`,
        status: "completed",
        lastFailure: null,
        updatedAt: new Date(),
      },
    })
    .returning({
      id: agentsTable.id, xp: agentsTable.xp, omega: agentsTable.lastOmega,
      successes: agentsTable.successfulTasks, failures: agentsTable.failedTasks,
    });

  // Never substitute a shared/default score if persistence cannot confirm the
  // exact agent row and its independently calculated result.
  if (!agent || agent.id !== task.agentId || agent.omega === null ||
      !Number.isFinite(agent.omega) || agent.omega < 0 || agent.omega > 1) {
    throw new AgentSafetyViolation("No se pudo confirmar el Ω persistido del agente solicitado.");
  }
  const omega = taskSuccessOmega(agent.successes, agent.failures);
  if (omega === null || omega !== agent.omega) {
    throw new AgentSafetyViolation("El Ω persistido no coincide con los resultados propios del agente.");
  }
  return { ...result, xp: agent.xp, omega };
}

export function createAgentSimulationRouter({
  completeTask = completePersistedTask,
  parseBody = async (body) => {
    const { RunSimulatedAgentAnalysisBody } = await import("@workspace/api-zod");
    return RunSimulatedAgentAnalysisBody.safeParse(body);
  },
  circuit,
  onFailure = recordAgentTaskFailure,
}: AgentSimulationDependencies = {}) {
  const router = Router();

  router.post("/agents/simulated-analysis", async (req, res): Promise<void> => {
    const parsed = await parseBody(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud de análisis simulado inválida." });
      return;
    }

    const role = AGENT_ROLES[parsed.data.agentId];
    if (!/^\d{1,20}$/.test(parsed.data.vector)) {
      res.status(400).json({ error: "Vector decimal inválido." });
      return;
    }
    const vectorValue = BigInt(parsed.data.vector);
    if (!role || vectorValue > 18_446_744_073_709_551_615n) {
      res.status(400).json({ error: "Agente o vector fuera del rango admitido." });
      return;
    }
    if (!Number.isFinite(parsed.data.coherence) || parsed.data.coherence <= 90 || parsed.data.coherence > 100) {
      res.status(400).json({ error: "El análisis solo se activa con coherencia superior a 90%." });
      return;
    }

    const breaker = circuit ?? (await import("./agent-swarm-circuit.ts")).agentSwarmCircuit;
    const task = {
      ...parsed.data,
      agentName: role.name,
    };
    try {
      const result = await breaker.execute(task.agentId, async () => {
        const result = await completeTask(task);
        validateSimulatedResult(task, result);
        return result;
      });
      res.json(result);
    } catch (error) {
      const snapshot = breaker.getSnapshot(task.agentId);
      const blocked = error instanceof AgentCircuitBlockedError;
      const reason = blocked ? error.message : snapshot.lastFailure!;
      if (!blocked) await onFailure(task.agentId, reason, snapshot.state === "OPEN");
      if (snapshot.remainingMs > 0) {
        res.setHeader("Retry-After", Math.ceil(snapshot.remainingMs / 1000));
      }
      res.status(blocked ? 503 : 502).json({
        error: reason,
        status: blocked || snapshot.state === "OPEN" ? "standby" : "failed",
        retryAfterMs: snapshot.remainingMs,
      });
    }
  });

  return router;
}

export default createAgentSimulationRouter();

```

### artifacts/api-server/src/routes/ai.ts

````typescript
import { Router } from "express";
import type OpenAI from "openai";
import { db, conversations, messages, agentsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { eq, asc, sql } from "drizzle-orm";
import { AiChatBody, AiExplainBody, AiImproveBody } from "@workspace/api-zod";
import { persistAgentResponse } from "./agent-message-persistence";
import {
  buildAgentEvidenceMetrics,
  buildAgentSystemPrompt,
  evaluateAgentResponse,
} from "./agent-evaluation";
import { AgentCircuitBlockedError, AgentTaskValidationError, type AgentCircuitBreaker } from "../lib/agent-circuit-breaker";
import { agentSwarmCircuit } from "./agent-swarm-circuit";
import { validateAgentOutput } from "./agent-safety-validation";
import { recordAgentTaskFailure } from "./agent-task-outcomes";
import {
  AI_CODE_TOOLS,
  createAiCodeChatRouter,
  type AiCodeCompletionResult,
} from "./ai-code-chat";

const router = Router();
// Reuse the swarm's instance: a second breaker would let other routes bypass OPEN.
const agentCircuit: AgentCircuitBreaker = agentSwarmCircuit;
const AGENT_PROVIDER_TIMEOUT_MS = 5_000;

router.use(createAiCodeChatRouter({
  parseBody: (body) => AiChatBody.safeParse(body),
  prepareConversation: async (message, systemPrompt) => {
    const [conv] = await db
      .insert(conversations)
      .values({ title: message.slice(0, 60) })
      .returning();
    await db.insert(messages).values([
      { conversationId: conv.id, role: "system", content: systemPrompt },
      { conversationId: conv.id, role: "user", content: message },
    ]);
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(asc(messages.id));
    return {
      conversationId: conv.id,
      history: history.map((item) => ({
        role: item.role as "system" | "user" | "assistant" | "tool",
        content: item.content,
      })),
    };
  },
  saveAssistantResponse: async (conversationId, content) => {
    await db.insert(messages).values({
      conversationId,
      role: "assistant",
      content,
    });
  },
  createCompletion: async (messages, tools) =>
    await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      ...(tools
        ? {
            tools: tools as OpenAI.Chat.Completions.ChatCompletionTool[],
            tool_choice: "auto" as const,
          }
        : {}),
    }) as unknown as AiCodeCompletionResult,
  executeTool: async (name, argumentsJson) => {
    const { executeDeepseekTool } = await import("./deepseek-tools.ts");
    return executeDeepseekTool(name, argumentsJson);
  },
}));

router.get("/agents", async (_req, res) => {
  const records = await db
    .select({
      id: agentsTable.id,
      name: agentsTable.name,
      xp: agentsTable.xp,
      failedAnalyses: agentsTable.failedAnalyses,
      omega: sql<number | null>`CASE WHEN ${agentsTable.successfulTasks} + ${agentsTable.failedTasks} > 0
        THEN ${agentsTable.successfulTasks}::double precision / (${agentsTable.successfulTasks} + ${agentsTable.failedTasks})
        ELSE NULL END`,
      status: agentsTable.status,
      lastFailure: agentsTable.lastFailure,
    })
    .from(agentsTable);
  res.json(records);
});

router.post("/ai/chat", async (req, res) => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const {
    message,
    context,
    language,
    agentId,
    agentName,
    agentRolePrompt,
    idempotencyKey,
  } = parsed.data;
  if (agentId && !/^[a-z0-9_-]{1,64}$/.test(agentId)) {
    res.status(400).json({ error: "Identificador de agente inválido." });
    return;
  }
  if (agentId && !idempotencyKey) {
    res.status(400).json({
      error: "Los análisis de agentes requieren una clave de idempotencia.",
    });
    return;
  }
  if (!agentId) {
    res.status(400).json({ error: "El agente solicitado no es válido." });
    return;
  }

  if (agentId && idempotencyKey) {
    const [savedMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.idempotencyKey, idempotencyKey))
      .limit(1);

    if (savedMessage) {
      const [agent] = await db
        .select({ xp: agentsTable.xp, omega: agentsTable.lastOmega })
        .from(agentsTable)
        .where(eq(agentsTable.id, agentId))
        .limit(1);
      const { analysisStatus } = evaluateAgentResponse(
        savedMessage.content,
        context,
      );
      res.json({
        response: savedMessage.content,
        conversationId: savedMessage.conversationId,
        omega: agent?.omega ?? null,
        xp: agent?.xp ?? 0,
        analysisStatus,
      });
      return;
    }
  }

  try {
    const result = await agentCircuit.execute(agentId, async () => {
      const agentMetrics = buildAgentEvidenceMetrics(context, language);
      if (agentCircuit.getSnapshot(agentId).state === "HALF-OPEN" && !agentMetrics.evidence_available) {
        throw new AgentTaskValidationError("La auditoría de recuperación requiere código o métricas verificables.");
      }
      await db
        .insert(agentsTable)
        .values({
          id: agentId,
          name: agentName || agentId,
          status: "active",
        })
        .onConflictDoUpdate({
          target: agentsTable.id,
          set: { name: agentName || agentId, status: "active", updatedAt: new Date() },
        });

      const [conv] = await db
        .insert(conversations)
        .values({ title: message.slice(0, 60) })
        .returning();

      const systemPrompt = [
        buildAgentSystemPrompt(agentRolePrompt, agentName),
        language ? `Lenguaje analizado: ${language}.` : "",
        `Payload obligatorio del nodo: ${JSON.stringify(agentMetrics)}. Estas métricas fueron calculadas por el servidor; no las alteres.`,
        context
          ? `Código o métricas verificables para el análisis:\n\`\`\`\n${context}\n\`\`\``
          : "No se proporcionó código ni métricas verificables.",
      ]
        .filter(Boolean)
        .join("\n\n");

      await db.insert(messages).values([
        { conversationId: conv.id, role: "system", content: systemPrompt },
        { conversationId: conv.id, role: "user", content: message },
      ]);

      const history = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(asc(messages.id));

      let completion: Awaited<ReturnType<typeof openai.chat.completions.create>>;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AGENT_PROVIDER_TIMEOUT_MS);
      try {
        completion = await openai.chat.completions.create({
          model: "gpt-5.4",
          max_completion_tokens: 8192,
          messages: history.map((item) => ({
            role: item.role as "system" | "user" | "assistant",
            content: item.content,
          })),
        }, { signal: controller.signal });
      } catch (error) {
        if (controller.signal.aborted) {
          throw new AgentTaskValidationError(`El proveedor superó el límite de ${AGENT_PROVIDER_TIMEOUT_MS} ms.`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      const aiResponse = completion.choices[0]?.message?.content ?? "";
      const { omega, analysisStatus, failureReason } = validateAgentOutput(
        aiResponse,
        completion.choices[0]?.finish_reason ?? null,
        context,
        language,
      );
      const saved = await persistAgentResponse({
        conversationId: conv.id,
        idempotencyKey: idempotencyKey!,
        agentId,
        agentName: agentName || agentId,
        content: aiResponse,
        omega,
        analysisStatus,
        failureReason,
      });
      const finalAnalysis = saved.inserted
        ? { omega, analysisStatus }
        : evaluateAgentResponse(saved.message.content, context);

      return {
        response: saved.message.content,
        conversationId: saved.message.conversationId,
        omega: saved.omega,
        xp: saved.xp,
        analysisStatus: finalAnalysis.analysisStatus,
        status: finalAnalysis.analysisStatus === "failed" ? "failed" : "completed",
        agentMetrics,
      };
    });
    res.json(result);
  } catch (error) {
    const circuit = agentCircuit.getSnapshot(agentId);
    const blocked = error instanceof AgentCircuitBlockedError;
    const failure = blocked
      ? error.message
      : circuit.lastFailure ?? "La ejecución del agente no superó la validación.";
    req.log.warn({ agentId, circuit, blocked }, "Agent Swarm: tarea detenida");
    if (!blocked) {
      await recordAgentTaskFailure(agentId, failure, circuit.state === "OPEN");
    }
    if (blocked && circuit.remainingMs > 0) {
      res.setHeader("Retry-After", Math.ceil(circuit.remainingMs / 1000));
    }
    res.status(blocked ? 503 : 502).json({
      error: failure,
      status: blocked || circuit.state === "OPEN" ? "standby" : "failed",
      retryAfterMs: circuit.remainingMs,
    });
  }
});

router.post("/ai/explain", async (req, res) => {
  const parsed = AiExplainBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { code, language, output } = parsed.data;

  const prompt = `Explain this ${language} code clearly and concisely. Break down what each part does, identify the logic, and point out anything notable or improvable.

Code:
\`\`\`${language}
${code}
\`\`\`
${output ? `\nProgram output:\n\`\`\`\n${output}\n\`\`\`` : ""}

Provide a clear, structured explanation. Be thorough but direct.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  res.json({ result: completion.choices[0]?.message?.content ?? "" });
});

router.post("/ai/improve", async (req, res) => {
  const parsed = AiImproveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { code, language, instruction } = parsed.data;

  const prompt = `${instruction ? `Task: ${instruction}\n\n` : "Improve and optimize this code:\n\n"}Code (${language}):
\`\`\`${language}
${code}
\`\`\`

Return ONLY the improved code without any explanation or markdown code blocks — just the raw improved code.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  let result = completion.choices[0]?.message?.content ?? "";
  result = result.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "");

  res.json({ result });
});

export default router;

````

### artifacts/api-server/src/routes/coherence-simulation.ts

```typescript
import { Router } from "express";
import { count, desc, lte, lt } from "drizzle-orm";
import {
  getSimulationStatus,
  startSimulation,
  stopSimulation,
  subscribeToSimulation,
  type CoherenceSample,
  type CoherenceSimulator,
} from "../lib/coherence_simulator.ts";

type CoherenceSimulationRouteDependencies = {
  simulator?: CoherenceSimulator;
  persistSample?: (sample: CoherenceSample) => Promise<void>;
  loadLogs?: (limit: number, beforeId?: number) => Promise<SimulationLogPage>;
  listLogs?: (page: number, pageSize: number, snapshotId?: number) => Promise<SimulationLogOffsetPage>;
  parseLogsQuery?: (query: unknown) => Promise<LogsQueryParseResult>;
  parseLogsPage?: (page: SimulationLogOffsetPage) => Promise<SimulationLogOffsetPage>;
};

type SimulationLogItem = {
  id: number;
  vector: string;
  coherence: number;
  turbulence: string;
  vectorsProcessed: number;
  createdAt: string;
};

type SimulationLogPage = {
  items: SimulationLogItem[];
  nextBeforeId: number | null;
};

type SimulationLogOffsetPage = {
  items: Array<Omit<SimulationLogItem, "createdAt"> & { createdAt: Date }>;
  page: number;
  pageSize: number;
  total: number;
  snapshotId: number | null;
};

type LogsQueryParseResult =
  | { success: true; data: { page: number; pageSize: number; snapshotId?: number } }
  | { success: false; error: { message: string } };

type SimulationLogsDatabase = typeof import("@workspace/db").db;
type SimulationLogsTable = typeof import("@workspace/db").simulationLogsTable;

const MAX_SIMULATION_LOG_OFFSET = 1_000_000;

function hasSafePageOffset(page: number, pageSize: number): boolean {
  return Number.isSafeInteger(page)
    && page >= 1
    && Number.isSafeInteger(pageSize)
    && pageSize >= 1
    && pageSize <= 100
    && Number.isSafeInteger((page - 1) * pageSize);
}

const defaultSimulator: CoherenceSimulator = {
  getSimulationStatus,
  startSimulation,
  stopSimulation,
  subscribeToSimulation,
};

export async function persistSimulationSample(sample: CoherenceSample): Promise<void> {
  const { db, simulationLogsTable } = await import("@workspace/db");
  await db.insert(simulationLogsTable).values({
    vector: sample.vector,
    coherence: sample.coherence,
    turbulence: sample.turbulence,
    vectorsProcessed: sample.vectorsProcessed,
  });
}

async function loadSimulationLogs(limit: number, beforeId?: number): Promise<SimulationLogPage> {
  const { db, simulationLogsTable } = await import("@workspace/db");
  const rows = await db
    .select()
    .from(simulationLogsTable)
    .where(beforeId === undefined ? undefined : lt(simulationLogsTable.id, beforeId))
    .orderBy(desc(simulationLogsTable.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: page.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    nextBeforeId: hasMore ? page.at(-1)?.id ?? null : null,
  };
}

export async function listSimulationLogPagesFromDatabase(
  database: SimulationLogsDatabase,
  simulationLogsTable: SimulationLogsTable,
  page: number,
  pageSize: number,
  requestedSnapshotId?: number,
): Promise<SimulationLogOffsetPage> {
  const snapshotId = requestedSnapshotId ?? (
    await database
      .select({ id: simulationLogsTable.id })
      .from(simulationLogsTable)
      .orderBy(desc(simulationLogsTable.id))
      .limit(1)
  )[0]?.id ?? null;
  const snapshotFilter = snapshotId === null ? undefined : lte(simulationLogsTable.id, snapshotId);
  const [items, totals] = await Promise.all([
    database
      .select()
      .from(simulationLogsTable)
      .where(snapshotFilter)
      .orderBy(desc(simulationLogsTable.createdAt), desc(simulationLogsTable.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    database.select({ total: count() }).from(simulationLogsTable).where(snapshotFilter),
  ]);

  return {
    items,
    page,
    pageSize,
    total: totals[0]?.total ?? 0,
    snapshotId,
  };
}

async function listSimulationLogPages(
  page: number,
  pageSize: number,
  requestedSnapshotId?: number,
): Promise<SimulationLogOffsetPage> {
  const { db, simulationLogsTable } = await import("@workspace/db");
  return listSimulationLogPagesFromDatabase(db, simulationLogsTable, page, pageSize, requestedSnapshotId);
}

async function parseSimulationLogsQuery(query: unknown): Promise<LogsQueryParseResult> {
  const { ListCoherenceSimulationLogPagesQueryParams } = await import("@workspace/api-zod");
  const parsed = ListCoherenceSimulationLogPagesQueryParams.safeParse(query);
  if (!parsed.success) return parsed;
  if (!hasSafePageOffset(parsed.data.page, parsed.data.pageSize)) {
    return { success: false, error: { message: "page and pageSize must produce a safe offset" } };
  }
  if (parsed.data.snapshotId !== undefined && !Number.isSafeInteger(parsed.data.snapshotId)) {
    return { success: false, error: { message: "snapshotId must be a safe integer" } };
  }
  return parsed;
}

async function parseSimulationLogPage(page: SimulationLogOffsetPage): Promise<SimulationLogOffsetPage> {
  const { ListCoherenceSimulationLogPagesResponse } = await import("@workspace/api-zod");
  return ListCoherenceSimulationLogPagesResponse.parse(page);
}

export function createCoherenceSimulationRouter({
  simulator = defaultSimulator,
  persistSample = persistSimulationSample,
  loadLogs = loadSimulationLogs,
  listLogs = listSimulationLogPages,
  parseLogsQuery = parseSimulationLogsQuery,
  parseLogsPage = parseSimulationLogPage,
}: CoherenceSimulationRouteDependencies = {}) {
  const router = Router();

  router.get("/coherence-simulation/logs", async (req, res): Promise<void> => {
    const rawLimit = req.query.limit;
    const rawBeforeId = req.query.beforeId;
    const limit = rawLimit === undefined ? 20 : Number(rawLimit);
    const beforeId = rawBeforeId === undefined ? undefined : Number(rawBeforeId);

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      res.status(400).json({ error: "El límite debe ser un entero entre 1 y 100." });
      return;
    }
    if (beforeId !== undefined && (!Number.isSafeInteger(beforeId) || beforeId < 1)) {
      res.status(400).json({ error: "El cursor debe ser un ID positivo válido." });
      return;
    }

    res.json(await loadLogs(limit, beforeId));
  });

  router.get("/coherence-simulation/logs/page", async (req, res): Promise<void> => {
    const parsed = await parseLogsQuery(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (!hasSafePageOffset(parsed.data.page, parsed.data.pageSize)) {
      res.status(400).json({ error: "page and pageSize must produce a safe offset" });
      return;
    }

    const offset = (parsed.data.page - 1) * parsed.data.pageSize;
    if (!Number.isSafeInteger(offset) || offset > MAX_SIMULATION_LOG_OFFSET) {
      res.status(400).json({ error: "La página solicitada supera el rango permitido." });
      return;
    }

    const result = await listLogs(parsed.data.page, parsed.data.pageSize, parsed.data.snapshotId);
    res.json(await parseLogsPage(result));
  });

  router.get("/coherence-simulation/status", (_req, res) => {
    res.json(simulator.getSimulationStatus());
  });

  router.post("/coherence-simulation/start", (_req, res) => {
    res.json(simulator.startSimulation(persistSample));
  });

  router.post("/coherence-simulation/stop", (_req, res) => {
    res.json(simulator.stopSimulation());
  });

  router.get("/coherence-simulation/stream", (req, res) => {
    res.status(200);
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    res.write(`event: status\ndata: ${JSON.stringify(simulator.getSimulationStatus())}\n\n`);

    const unsubscribe = simulator.subscribeToSimulation((sample) => {
      if (res.writableEnded || res.destroyed || res.writableLength > 64 * 1024) return;
      res.write(`event: sample\ndata: ${JSON.stringify(sample)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), 20_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  return router;
}

export default createCoherenceSimulationRouter();

```

### artifacts/api-server/src/lib/coherence_simulator.ts

```typescript
import { randomBytes } from "node:crypto";
import { logger } from "./logger.ts";

export const RESONANCE_MODULUS = 410_542_503n;
export const SIMULATION_INTERVAL_MS = 100;
export const SIMULATION_LOG_INTERVAL_MS = 10_000;

export type CoherenceSample = {
  vector: string;
  coherence: number;
  turbulence: string;
  vectorsProcessed: number;
  timestamp: string;
};

export type SimulationStatus = {
  running: boolean;
  vectorsProcessed: number;
  latest: CoherenceSample | null;
};

type PersistLog = (sample: CoherenceSample) => Promise<void>;

export type CoherenceSimulator = {
  subscribeToSimulation(listener: (sample: CoherenceSample) => void): () => void;
  getSimulationStatus(): SimulationStatus;
  startSimulation(saveLog: PersistLog): SimulationStatus;
  stopSimulation(): SimulationStatus;
};

export type CoherenceSimulatorDependencies = {
  now?: () => number;
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
  createVector?: () => bigint;
};

export function createCoherenceSimulator(
  dependencies: CoherenceSimulatorDependencies = {},
): CoherenceSimulator {
  const now = dependencies.now ?? Date.now;
  const schedule = dependencies.setInterval ?? setInterval;
  const cancel = dependencies.clearInterval ?? clearInterval;
  const createVector = dependencies.createVector ?? (() => randomBytes(8).readBigUInt64BE());
  let interval: ReturnType<typeof setInterval> | null = null;
  let vectorsProcessed = 0;
  let latest: CoherenceSample | null = null;
  let lastPersistedAt = 0;
  let persisting = false;
  let persistLog: PersistLog | null = null;
  const listeners = new Set<(sample: CoherenceSample) => void>();

  function makeSample(): CoherenceSample {
    const vector = createVector();
    const turbulenceValue = vector % RESONANCE_MODULUS;
    const coherence = (1 - Number(turbulenceValue) / Number(RESONANCE_MODULUS)) * 100;

    return {
      vector: vector.toString(),
      coherence,
      turbulence: turbulenceValue.toString(),
      vectorsProcessed,
      timestamp: new Date(now()).toISOString(),
    };
  }

  function getSimulationStatus(): SimulationStatus {
    return { running: interval !== null, vectorsProcessed, latest };
  }

  function startSimulation(saveLog: PersistLog): SimulationStatus {
    if (interval !== null) return getSimulationStatus();

    persistLog = saveLog;
    lastPersistedAt = now();
    interval = schedule(() => {
      try {
        const sample = makeSample();
        vectorsProcessed += 1;
        sample.vectorsProcessed = vectorsProcessed;
        latest = sample;

        for (const listener of listeners) {
          try {
            listener(sample);
          } catch (error) {
            logger.warn({ err: error }, "Simulation subscriber failed");
          }
        }

        if (now() - lastPersistedAt >= SIMULATION_LOG_INTERVAL_MS && !persisting && persistLog) {
          lastPersistedAt = now();
          persisting = true;
          try {
            void persistLog(sample)
              .catch((error: unknown) => {
                logger.error({ err: error }, "Could not persist coherence simulation log");
              })
              .finally(() => { persisting = false; });
          } catch (error) {
            persisting = false;
            throw error;
          }
        }
      } catch (error) {
        logger.error({ err: error }, "Motor 5.5: fallo del ciclo; se reintentará en el siguiente tick");
      }
    }, SIMULATION_INTERVAL_MS);

    return getSimulationStatus();
  }

  function stopSimulation(): SimulationStatus {
    if (interval !== null) cancel(interval);
    interval = null;
    persistLog = null;
    return getSimulationStatus();
  }

  return {
    subscribeToSimulation(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSimulationStatus,
    startSimulation,
    stopSimulation,
  };
}

const defaultSimulator = createCoherenceSimulator();

export const getSimulationStatus = defaultSimulator.getSimulationStatus;
export const subscribeToSimulation = defaultSimulator.subscribeToSimulation;
export const stopSimulation = defaultSimulator.stopSimulation;
export const startSimulation = defaultSimulator.startSimulation;

```

### artifacts/api-server/src/routes/trading-status.ts

```typescript
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Router } from "express";
import { GetTradingStatusResponse } from "@workspace/api-zod";
import { disableTelemetryCache } from "./telemetry-cache.ts";

export const OFFLINE_TRADING_STATUS = Object.freeze({
  status: "offline",
  capital: 100.0,
  pnl: 0.0,
  trades: 0,
  wins: 0,
  losses: 0,
  winrate: 0.0,
  position: 0,
  paused: false,
});

/** pnpm runs the API inside its artifact, not at the project root. */
export function tradingStatePath(startDirectory = process.cwd()): string {
  let directory = resolve(startDirectory);
  while (!existsSync(join(directory, "pnpm-workspace.yaml"))) {
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error("No se encontró la raíz del proyecto para el estado de trading.");
    }
    directory = parent;
  }
  return join(directory, "maquina_4105_state.json");
}

export function createTradingStatusRouter(stateFile = tradingStatePath()) {
  const router = Router();
  router.get("/trading-status", disableTelemetryCache, async (req, res): Promise<void> => {
    let contents: string;
    try {
      contents = await readFile(stateFile, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        res.json(OFFLINE_TRADING_STATUS);
        return;
      }
      req.log?.warn({ event: "trading_state_unreadable" }, "No se pudo leer el estado de Máquina 4105");
      res.status(503).json({ error: "No se pudo leer el estado de trading." });
      return;
    }

    try {
      const state: unknown = JSON.parse(contents);
      const validated = GetTradingStatusResponse.parse(state);
      const numbers = [validated.capital, validated.pnl, validated.trades,
        validated.wins, validated.losses, validated.winrate, validated.position];
      if (!numbers.every(Number.isFinite) ||
          ![validated.trades, validated.wins, validated.losses].every(Number.isSafeInteger)) {
        throw new Error("Métricas de trading inválidas.");
      }
      // Preserve extra fields supplied by Python; never write or overwrite its file.
      res.json(state);
    } catch {
      req.log?.warn({ event: "trading_state_invalid" }, "Estado de Máquina 4105 vacío, incompleto o inválido");
      res.status(503).json({ error: "El archivo de estado de trading no contiene un estado válido." });
    }
  });
  return router;
}

export default createTradingStatusRouter();

```

### artifacts/api-server/src/routes/snippet-execution.ts

```typescript
import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { ExecuteSnippetParams, ExecuteSnippetResponse } from "@workspace/api-zod";

const SIMULATED_OUTPUT = "Hello, DevTerminal!" as const;

/** The timestamp records a simulation, not proof that the stored code ran. */
export async function recordSimulatedSnippetExecution(id: number) {
  const { db, snippetsTable, neuralEventsTable } = await import("@workspace/db");
  return db.transaction(async tx => {
    const [snippet] = await tx.update(snippetsTable)
      .set({ lastRunAt: sql`NOW()` })
      .where(eq(snippetsTable.id, id))
      .returning({ id: snippetsTable.id, lastRunAt: snippetsTable.lastRunAt });
    if (!snippet) return null;
    if (!snippet.lastRunAt) throw new Error("No se confirmó last_run_at.");
    const result = {
      id: snippet.id, success: true as const, simulated: true as const,
      output: SIMULATED_OUTPUT, lastRunAt: snippet.lastRunAt,
    };
    // Persist provenance in the same transaction. Do not present a simulated
    // output as a real Runner execution to auditors or reliability metrics.
    await tx.insert(neuralEventsTable).values({
      origin: "runner",
      eventType: "snippet_execution_simulated",
      content: JSON.stringify(result),
    });
    return result;
  });
}

export function createSnippetExecutionRouter(
  executeSnippet = recordSimulatedSnippetExecution,
) {
  const router = Router();
  router.post("/snippets/:id/execute", async (req, res): Promise<void> => {
    const parsed = ExecuteSnippetParams.safeParse(req.params);
    if (!parsed.success || !Number.isSafeInteger(parsed.data.id)) {
      res.status(400).json({ error: "Invalid snippet id" });
      return;
    }
    try {
      const result = await executeSnippet(parsed.data.id);
      if (!result) {
        res.status(404).json({ error: "Snippet not found" });
        return;
      }
      const response = ExecuteSnippetResponse.parse(result);
      req.log?.info({
        event: "snippet_execution_simulated", snippetId: result.id,
        simulated: true, lastRunAt: result.lastRunAt,
      }, "Se registró una ejecución simulada; no se ejecutó el código del Runner");
      res.json(response);
    } catch (error) {
      req.log?.error({ err: error, snippetId: parsed.data.id }, "No se pudo registrar la ejecución simulada");
      res.status(500).json({ error: "Could not record simulated execution" });
    }
  });
  return router;
}

```

### artifacts/api-server/src/routes/telemetry-cache.ts

```typescript
import type { RequestHandler } from "express";

export const disableTelemetryCache: RequestHandler = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-transform");
  // Old cached validators must not produce a 304 for live telemetry.
  delete req.headers["if-none-match"];
  delete req.headers["if-modified-since"];
  next();
};

```

### artifacts/api-server/src/routes/health.ts

```typescript
import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;

```

### artifacts/api-server/src/routes/messages.ts

```typescript
import { Router, type IRouter } from "express";
import { SaveTerminalMessageBody } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();
const TERMINAL_SESSION_ID = "terminal_main_session";

async function getOrCreateTerminalConversationId(): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      TERMINAL_SESSION_ID,
    ]);
    const found = await client.query<{ id: number }>(
      "SELECT id FROM conversations WHERE title = $1 ORDER BY id ASC LIMIT 1",
      [TERMINAL_SESSION_ID],
    );
    if (found.rows[0]) {
      await client.query("COMMIT");
      return found.rows[0].id;
    }
    const created = await client.query<{ id: number }>(
      "INSERT INTO conversations (title) VALUES ($1) RETURNING id",
      [TERMINAL_SESSION_ID],
    );
    await client.query("COMMIT");
    return created.rows[0]!.id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function isTerminalSession(value: unknown): value is typeof TERMINAL_SESSION_ID {
  return value === TERMINAL_SESSION_ID;
}

router.get("/messages", async (req, res): Promise<void> => {
  if (!isTerminalSession(req.query.conversation_id)) {
    res.status(400).json({ error: "conversation_id inválido." });
    return;
  }
  try {
    const conversationId = await getOrCreateTerminalConversationId();
    const { rows } = await pool.query<{
      id: number;
      conversation_id: number;
      role: "user" | "assistant";
      content: string;
      created_at: Date;
    }>(
      `SELECT id, conversation_id, role, content, created_at
       FROM messages
       WHERE conversation_id = $1 AND role IN ('user', 'assistant')
       ORDER BY id ASC`,
      [conversationId],
    );
    res.json(rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at.toISOString(),
    })));
  } catch (error) {
    req.log.error({ err: error }, "No se pudo cargar el historial de terminal");
    res.status(500).json({ error: "No se pudo cargar el historial de terminal." });
  }
});

router.post("/messages", async (req, res): Promise<void> => {
  const parsed = SaveTerminalMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Mensaje inválido.", details: parsed.error.flatten() });
    return;
  }
  if (!isTerminalSession(parsed.data.conversation_id)) {
    res.status(400).json({ error: "conversation_id inválido." });
    return;
  }
  try {
    const conversationId = await getOrCreateTerminalConversationId();
    const { rows } = await pool.query<{
      id: number;
      conversation_id: number;
      role: "user" | "assistant";
      content: string;
      created_at: Date;
    }>(
      `INSERT INTO messages (conversation_id, role, content)
       VALUES ($1, $2, $3)
       RETURNING id, conversation_id, role, content, created_at`,
      [conversationId, parsed.data.role, parsed.data.content],
    );
    const row = rows[0]!;
    res.status(201).json({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at.toISOString(),
    });
  } catch (error) {
    req.log.error({ err: error }, "No se pudo guardar el mensaje de terminal");
    res.status(500).json({ error: "No se pudo guardar el mensaje de terminal." });
  }
});

router.delete("/messages", async (req, res): Promise<void> => {
  if (!isTerminalSession(req.query.conversation_id)) {
    res.status(400).json({ error: "conversation_id inválido." });
    return;
  }
  try {
    const conversationId = await getOrCreateTerminalConversationId();
    const result = await pool.query(
      `DELETE FROM messages
       WHERE conversation_id = $1 AND role IN ('user', 'assistant')`,
      [conversationId],
    );
    res.json({
      conversationId: TERMINAL_SESSION_ID,
      deletedCount: result.rowCount ?? 0,
    });
  } catch (error) {
    req.log.error({ err: error }, "No se pudo limpiar el historial de terminal");
    res.status(500).json({ error: "No se pudo limpiar el historial de terminal." });
  }
});

export default router;

```

### artifacts/api-server/src/routes/snippets.ts

```typescript
import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, snippetsTable } from "@workspace/db";
import { createSnippetExecutionRouter } from "./snippet-execution";
import {
  CreateSnippetBody,
  UpdateSnippetBody,
  GetSnippetParams,
  UpdateSnippetParams,
  DeleteSnippetParams,
} from "@workspace/api-zod";

const router = Router();
router.use(createSnippetExecutionRouter());

router.get("/snippets", async (_req, res) => {
  const snippets = await db
    .select()
    .from(snippetsTable)
    .orderBy(desc(snippetsTable.updatedAt));
  res.json(snippets);
});

router.get("/snippets/recent", async (_req, res) => {
  const snippets = await db
    .select()
    .from(snippetsTable)
    .orderBy(desc(snippetsTable.updatedAt))
    .limit(5);
  res.json(snippets);
});

router.get("/snippets/:id", async (req, res) => {
  const parsed = GetSnippetParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const snippet = await db
    .select()
    .from(snippetsTable)
    .where(eq(snippetsTable.id, parsed.data.id))
    .limit(1);

  if (snippet.length === 0) {
    res.status(404).json({ error: "Snippet not found" });
    return;
  }

  res.json(snippet[0]);
});

router.post("/snippets", async (req, res) => {
  const parsed = CreateSnippetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [created] = await db
    .insert(snippetsTable)
    .values({
      title: parsed.data.title,
      code: parsed.data.code,
      language: parsed.data.language,
    })
    .returning();

  res.status(201).json(created);
});

router.put("/snippets/:id", async (req, res) => {
  const paramsParsed = UpdateSnippetParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const bodyParsed = UpdateSnippetBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (bodyParsed.data.title !== undefined) updates.title = bodyParsed.data.title;
  if (bodyParsed.data.code !== undefined) updates.code = bodyParsed.data.code;
  if (bodyParsed.data.language !== undefined) updates.language = bodyParsed.data.language;

  const [updated] = await db
    .update(snippetsTable)
    .set(updates)
    .where(eq(snippetsTable.id, paramsParsed.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Snippet not found" });
    return;
  }

  res.json(updated);
});

router.delete("/snippets/:id", async (req, res) => {
  const parsed = DeleteSnippetParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db
    .delete(snippetsTable)
    .where(eq(snippetsTable.id, parsed.data.id));

  res.status(204).send();
});

export default router;

```

## 7. Frontend

React 19 + Vite + Wouter + TanStack Query; Tailwind 4 y componentes Radix. App.tsx establece providers y rutas persistentes. Layout contiene la barra de navegación terminal: Terminal, Editor, Runner, Library, AI, Tools, Neural, Agents, Cortex IA, Creator, Motor 5.5 y Trading.

Rutas: / (terminal), /editor, /runner, /snippets, /ai, /tools, /neural, /agents, /cortex, /creator, /motor, /trading. Componentes reutilizables en components/ui; estilos globales en src/index.css.

### Fuentes principales frontend — código completo

### artifacts/devterminal/src/App.tsx

```tsx
import { Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState, type ComponentType } from "react";
import NotFound from "@/pages/not-found";
import TerminalPage from "@/pages/terminal";
import Home from "@/pages/home";
import Snippets from "@/pages/snippets";
import AI from "@/pages/ai";
import Tools from "@/pages/tools";
import Runner from "@/pages/runner";
import Neural from "@/pages/neural";
import Agents from "@/pages/agents";
import Cortex from "@/pages/cortex";
import Creator from "@/pages/creator";
import CoherenceSimulator from "@/pages/coherence-simulator";
import Trading from "@/pages/trading";
import { Layout } from "@/components/layout";
import { AppProvider } from "@/lib/app-context";
import { NeuralProvider } from "@/lib/neural-context";

const queryClient = new QueryClient();

const PERSISTENT_PAGES: Array<{ path: string; Component: ComponentType }> = [
  { path: "/", Component: TerminalPage },
  { path: "/editor", Component: Home },
  { path: "/runner", Component: Runner },
  { path: "/snippets", Component: Snippets },
  { path: "/ai", Component: AI },
  { path: "/tools", Component: Tools },
  { path: "/neural", Component: Neural },
  { path: "/agents", Component: Agents },
  { path: "/cortex", Component: Cortex },
  { path: "/creator", Component: Creator },
  { path: "/motor", Component: CoherenceSimulator },
  { path: "/trading", Component: Trading },
];

function normalizePath(path: string) {
  const normalized = path.replace(/\/+$/, "");
  return normalized || "/";
}

function PersistentPages() {
  const [location] = useLocation();
  const currentPath = normalizePath(location);
  const [visitedPaths, setVisitedPaths] = useState(() => new Set([currentPath]));

  useEffect(() => {
    setVisitedPaths((visited) => {
      if (visited.has(currentPath)) return visited;
      const next = new Set(visited);
      next.add(currentPath);
      return next;
    });
  }, [currentPath]);

  const isKnownPath = PERSISTENT_PAGES.some(({ path }) => path === currentPath);

  return (
    <div className="relative h-full w-full">
      {PERSISTENT_PAGES.map(({ path, Component }) => {
        const isActive = currentPath === path;
        if (!isActive && !visitedPaths.has(path)) return null;

        return (
          <div
            key={path}
            aria-hidden={!isActive}
            className={`absolute inset-0 transition-opacity duration-150 ${
              isActive
                ? "z-10 visible opacity-100"
                : "invisible pointer-events-none opacity-0"
            }`}
          >
            <Component />
          </div>
        );
      })}

      {!isKnownPath && (
        <div className="absolute inset-0 z-10">
          <NotFound />
        </div>
      )}
    </div>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    const report = (message: string) => {
      void fetch("/api/diagnostics/webview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.slice(0, 500) }),
        keepalive: true,
      }).catch(() => undefined);
    };
    const onError = (event: ErrorEvent) => report(`window.error: ${event.message}`);
    const onRejection = (event: PromiseRejectionEvent) =>
      report(`unhandledrejection: ${String(event.reason).slice(0, 400)}`);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NeuralProvider>
         <AppProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Layout>
                  <PersistentPages />
                </Layout>
          </WouterRouter>
          <Toaster />
         </AppProvider>
        </NeuralProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

```

### artifacts/devterminal/src/components/layout.tsx

```tsx
import { Link, useLocation } from "wouter";
import { TerminalSquare, LibrarySquare, Cpu, ShieldAlert, Eye, Play, Network, Bot, Code2, BrainCircuit, Sparkles, Activity, TrendingUp } from "lucide-react";
import { useEffect, useRef } from "react";
import { useHealthCheck } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const activeLocation = location === "/" ? "/" : location.replace(/\/+$/, "");
  const { data: health } = useHealthCheck();
  const defaultTitle = useRef(document.title);
  useEffect(() => {
    document.title = activeLocation === "/trading" ? "MÁQUINA 4105 // TRADING" : defaultTitle.current;
  }, [activeLocation]);

  const navItems = [
    { href: "/", label: "Terminal", icon: TerminalSquare, color: "#ff003c" },
    { href: "/editor", label: "Editor", icon: Code2, color: "#ff003c" },
    { href: "/runner", label: "Runner", icon: Play, color: "#ff003c" },
    { href: "/snippets", label: "Library", icon: LibrarySquare, color: "#ff003c" },
    { href: "/ai", label: "AI", icon: Cpu, color: "#ff003c" },
    { href: "/tools", label: "Tools", icon: ShieldAlert, color: "#ff003c" },
    { href: "/neural", label: "Neural", icon: Network, color: "#00ffff" },
    { href: "/agents", label: "Agents", icon: Bot, color: "#a78bfa" },
    { href: "/cortex", label: "Cortex IA", icon: BrainCircuit, color: "#00ff41" },
    { href: "/creator", label: "CREATOR", icon: Sparkles, color: "#ff4de1" },
    { href: "/motor", label: "MOTOR 5.5", icon: Activity, color: "#00f0ff" },
    { href: "/trading", label: "TRADING", icon: TrendingUp, color: "#00f0ff" },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#080808] screen-flicker">
      <header className="flex h-11 items-center justify-between border-b border-[#ff003c]/20 bg-[#060606] px-3 text-foreground relative flex-shrink-0">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(90deg, rgba(255,0,60,0.05) 0%, transparent 60%)" }}
        />
        <div className="flex items-center gap-3 relative z-10 min-w-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <Link href="/" className="flex items-center gap-1.5 font-mono text-xs font-bold tracking-[0.2em] uppercase flex-shrink-0">
            <Eye className="h-3.5 w-3.5 text-[#ff003c]" style={{ filter: "drop-shadow(0 0 5px #ff003c)" }} />
            <span
              className="glitch-text text-[#ff003c] hidden lg:block"
              data-text="DEVTERMINAL"
              style={{ textShadow: "0 0 8px #ff003c, 0 0 16px #ff003c40" }}
            >
              DEVTERMINAL
            </span>
          </Link>

          <div className="w-px h-4 bg-[#ff003c]/15 hidden sm:block flex-shrink-0" />

          <nav className="flex items-center gap-0 text-[10px] font-mono font-semibold tracking-wider uppercase">
            {navItems.map(({ href, label, icon: Icon, color }) => {
              const isActive = activeLocation === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1 px-2 py-1.5 transition-all border whitespace-nowrap flex-shrink-0"
                  style={isActive ? {
                    borderColor: color + "40",
                    color,
                    background: color + "10",
                  } : {
                    borderColor: "transparent",
                    color: "#333",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.color = color + "80";
                      (e.currentTarget as HTMLElement).style.background = color + "08";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.color = "#333";
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }
                  }}
                >
                  <Icon className="h-3 w-3 flex-shrink-0" />
                  <span className="hidden sm:block">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3 relative z-10 flex-shrink-0">
          {health?.status === "ok" ? (
            <div className="flex items-center gap-1.5 text-[9px] font-mono tracking-widest uppercase">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ff41] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00ff41]" style={{ boxShadow: "0 0 5px #00ff41" }} />
              </span>
              <span className="text-[#00ff41]/50 hidden sm:block">ONLINE</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[9px] font-mono tracking-widest uppercase text-[#ff003c]/50">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff003c]" />
              <span className="hidden sm:block">OFFLINE</span>
            </div>
          )}
        </div>
      </header>

      <main className="relative flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}

```

### artifacts/devterminal/src/pages/terminal.tsx

```tsx
import { useEffect, useRef, useState, useCallback, type FormEvent } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";
import { TerminalSquare, Wifi, WifiOff, RotateCcw, Maximize2, Minimize2, Search, X, Trash2 } from "lucide-react";
import { useAppContext } from "@/lib/app-context";
import { useNeuralContext } from "@/lib/neural-context";
import {
  consumeDeepseekSse,
  persistDeepseekAssistantResponse,
} from "@/lib/deepseek-stream";
import { writeNewAutonomousEvents } from "@/lib/terminal-autonomous-events";

const BASE_HOST = window.location.host;
const WS_PROTOCOL = window.location.protocol === "https:" ? "wss:" : "ws:";
const WS_URL = `${WS_PROTOCOL}//${BASE_HOST}/api/terminal/ws`;
const TERMINAL_CONVERSATION_ID = "terminal_main_session";

type TerminalHistoryMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

async function persistTerminalMessage(role: "user" | "assistant", content: string) {
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: TERMINAL_CONVERSATION_ID, role, content }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(result?.error || "No se pudo guardar el historial de la terminal.");
  }
}

function removeTerminalControls(value: string) {
  return value.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, "");
}

function writeSafeText(term: XTerm, value: string) {
  term.write(removeTerminalControls(value).replace(/\r?\n/g, "\r\n"));
}

function scriptCommandName(command: string): string | null {
  const match = command.trim().match(/^(?:(?:python3?|node|bash|sh|ruby|perl|php|go\s+run|cargo\s+run)\b|\.\/[^\s]+|[^\s]+\.(?:py|js|mjs|cjs|ts|sh|rb|go))\b/i);
  return match?.[0]?.toLowerCase().replace(/\s+/g, " ") ?? null;
}

async function typeResponse(term: XTerm, value: string, signal: AbortSignal) {
  for (const character of removeTerminalControls(value)) {
    if (signal.aborted) return;
    term.write(character === "\n" ? "\r\n" : character);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 3));
  }
}

export default function TerminalPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const deepSeekAbortRef = useRef<AbortController | null>(null);
  const lastAutonomousEventIdRef = useRef(0);
  const initializedAutonomousEventsRef = useRef(false);
  const { currentCode, currentLanguage } = useAppContext();
  const { recordEvent, events } = useNeuralContext();
  const recordEventRef = useRef(recordEvent);
  const shellCommandBufferRef = useRef("");
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [sessionCount, setSessionCount] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [smartCommand, setSmartCommand] = useState("");
  const [isDeepSeekThinking, setIsDeepSeekThinking] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);

  useEffect(() => {
    recordEventRef.current = recordEvent;
  }, [recordEvent]);

  useEffect(() => {
    if (!initializedAutonomousEventsRef.current) {
      lastAutonomousEventIdRef.current = events.reduce(
        (largest, event) => Math.max(largest, event.id),
        0,
      );
      initializedAutonomousEventsRef.current = true;
      return;
    }

    lastAutonomousEventIdRef.current = writeNewAutonomousEvents(
      events,
      lastAutonomousEventIdRef.current,
      (content) => {
        if (termRef.current) writeSafeText(termRef.current, content);
      },
    );
  }, [events]);

  const sendResize = useCallback((term: XTerm, ws: WebSocket) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ resize: true, cols: term.cols, rows: term.rows }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/messages?conversation_id=${TERMINAL_CONVERSATION_ID}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo recuperar el historial.");
        return await response.json() as TerminalHistoryMessage[];
      })
      .then((messages) => {
        const term = termRef.current;
        if (!term || controller.signal.aborted || messages.length === 0) return;
        writeSafeText(term, "\n[Historial de terminal recuperado]\n");
        for (const message of messages) {
          const speaker = message.role === "user" ? "Arquitecto" : "SQ-AI";
          writeSafeText(term, `${speaker}> ${message.content}\n\n`);
        }
        writeSafeText(term, "[Fin del historial]\n\n");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && termRef.current) {
          const message = error instanceof Error ? error.message : "Error de conexión.";
          writeSafeText(termRef.current, `\n[Historial] ${message}\n`);
        }
      });
    return () => controller.abort();
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const term = termRef.current;
    if (!term || !containerRef.current) return;

    setStatus("connecting");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      setSessionCount(s => s + 1);
      if (fitRef.current) {
        fitRef.current.fit();
        sendResize(term, ws);
      }
    };

    ws.onmessage = (event) => {
      term.write(typeof event.data === "string" ? event.data : new Uint8Array(event.data));
    };

    ws.onclose = () => {
      setStatus("disconnected");
    };

    ws.onerror = () => {
      setStatus("disconnected");
    };
  }, [sendResize]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.4,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: "block",
      scrollback: 10000,
      theme: {
        background: "#080808",
        foreground: "#e0e0e0",
        cursor: "#ff003c",
        cursorAccent: "#080808",
        black: "#080808",
        red: "#ff003c",
        green: "#00ff41",
        yellow: "#ffd700",
        blue: "#4d9eff",
        magenta: "#cc44ff",
        cyan: "#00ffff",
        white: "#e0e0e0",
        brightBlack: "#444444",
        brightRed: "#ff4466",
        brightGreen: "#44ff66",
        brightYellow: "#ffee44",
        brightBlue: "#66aaff",
        brightMagenta: "#dd88ff",
        brightCyan: "#44ffff",
        brightWhite: "#ffffff",
        selectionBackground: "#ff003c33",
        selectionForeground: "#ffffff",
      },
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    const weblinks = new WebLinksAddon();
    const search = new SearchAddon();

    term.loadAddon(fit);
    term.loadAddon(weblinks);
    term.loadAddon(search);

    fitRef.current = fit;
    searchRef.current = search;
    termRef.current = term;

    term.open(containerRef.current);
    fit.fit();

    term.onData((data) => {
      if (data.includes("\r") || data.includes("\n")) {
        const command = shellCommandBufferRef.current.trim();
        const scriptName = scriptCommandName(command);
        if (scriptName) {
          recordEventRef.current({
            origin: "terminal",
            eventType: "script_run",
            content: `script=${scriptName}`,
          });
        }
        shellCommandBufferRef.current = "";
      } else if (data === "\x7f") {
        shellCommandBufferRef.current = shellCommandBufferRef.current.slice(0, -1);
      } else if (data === "\x03" || data === "\x15") {
        shellCommandBufferRef.current = "";
      } else if (!data.includes("\x1b")) {
        shellCommandBufferRef.current += data.replace(/[^\x20-\x7e]/g, "").slice(0, 1000);
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(data);
      }
    });

    connect();

    const handleResize = () => {
      if (fitRef.current && termRef.current && wsRef.current) {
        fitRef.current.fit();
        sendResize(termRef.current, wsRef.current);
      }
    };

    const ro = new ResizeObserver(handleResize);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      deepSeekAbortRef.current?.abort();
      term.dispose();
      wsRef.current?.close();
      ro.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleSmartCommand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const command = smartCommand.trim();
    const term = termRef.current;
    if (!command || !term || isDeepSeekThinking) return;

    setSmartCommand("");

    if (command.toLowerCase() === "clear") {
      term.clear();
      writeSafeText(term, "[Terminal limpiada]\n");
      return;
    }

    if (command.toLowerCase() === "help") {
      writeSafeText(
        term,
        "\nComandos disponibles:\n  help              Muestra esta ayuda\n  clear             Limpia la pantalla\n  ls [opciones]     Lista archivos del proyecto en la shell local\n  ds <pregunta>     Consulta SQ-AI con streaming\n  cualquier otro    Se ejecuta en la shell local\n\n",
      );
      return;
    }

    if (command.toLowerCase() === "ds") {
      writeSafeText(term, "\nUso: ds <pregunta para SQ-AI>\n");
      return;
    }

    if (!/^ds\s+/i.test(command)) {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(`${command}\r`);
        const scriptName = scriptCommandName(command);
        if (scriptName) {
          recordEvent({
            origin: "terminal",
            eventType: "script_run",
            content: `script=${scriptName}`,
          });
        }
      } else {
        writeSafeText(term, "\nLa shell local está desconectada. Reconecta la sesión e inténtalo de nuevo.\n");
      }
      return;
    }

    const prompt = command.replace(/^ds\s+/i, "").trim();
    if (!prompt) {
      writeSafeText(term, "\nEscribe una pregunta después de ds.\n");
      return;
    }

    const controller = new AbortController();
    let assistantResponse = "";
    let userMessageSaved = false;
    recordEvent({
      origin: "terminal",
      eventType: "ai_query",
      content: "Consulta SQ-AI enviada desde la terminal",
    });
    deepSeekAbortRef.current = controller;
    setIsDeepSeekThinking(true);
    writeSafeText(term, `\nSQ-AI> ${prompt}\n`);

    try {
      await persistTerminalMessage("user", prompt);
      userMessageSaved = true;
      const context = [
        JSON.stringify({
          page: "terminal",
          editor: {
            language: currentLanguage,
            status: currentCode.trim() ? "loaded" : "empty",
            codeCharacters: currentCode.length,
            code: currentCode.slice(0, 20_000),
          },
          recentRunnerAndAgentActivity: events
            .filter((item) => item.origin === "runner" || item.origin === "agents")
            .slice(0, 8)
            .map(({ origin, eventType, content, createdAt }) => ({ origin, eventType, content, createdAt })),
          serverAndWebviewLogs: "Consulta get_runtime_diagnostics para logs recientes.",
          library: "Consulta get_library_snapshot para snippets guardados.",
          integrations: "Consulta get_integrations_status; nunca envíes valores secretos.",
        }),
      ].join("\n");
      const response = await fetch("/api/deepseek/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, context }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(errorData?.error || `Error del servidor (${response.status}).`);
      }
      if (!response.body) throw new Error("El servidor no devolvió un flujo de respuesta.");

      const result = await consumeDeepseekSse(
        response.body,
        controller.signal,
        (delta) => {
          assistantResponse += delta;
          return typeResponse(term, delta, controller.signal);
        },
      );
      assistantResponse = result.text;
      if (result.stopped) {
        writeSafeText(term, "\n[Consulta detenida]\n");
        if (userMessageSaved) {
          await persistDeepseekAssistantResponse(
            assistantResponse,
            true,
            (content) => persistTerminalMessage("assistant", content),
          );
        }
        return;
      }
      await persistDeepseekAssistantResponse(
        assistantResponse,
        false,
        (content) => persistTerminalMessage("assistant", content),
      );
      writeSafeText(term, "\n\n");
    } catch (error) {
      if (controller.signal.aborted) {
        writeSafeText(term, "\n[Consulta detenida]\n");
      } else {
        const message = error instanceof Error ? error.message : "Error de conexión.";
        writeSafeText(term, `\n[Error] ${message}\n`);
      }
      if (userMessageSaved) {
        await persistDeepseekAssistantResponse(
          assistantResponse,
          true,
          (content) => persistTerminalMessage("assistant", content),
        ).catch(() => undefined);
      }
    } finally {
      if (deepSeekAbortRef.current === controller) {
        deepSeekAbortRef.current = null;
      }
      setIsDeepSeekThinking(false);
    }
  };

  const handleReconnect = () => {
    if (termRef.current) {
      termRef.current.clear();
      termRef.current.write("\x1b[38;5;240m[Reconnecting...]\x1b[0m\r\n");
    }
    connect();
  };

  const handleClearChat = async () => {
    if (isClearingChat || isDeepSeekThinking) return;
    setIsClearingChat(true);
    try {
      const response = await fetch(
        `/api/messages?conversation_id=${TERMINAL_CONVERSATION_ID}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(result?.error || "No se pudo limpiar el historial.");
      }
      termRef.current?.clear();
      if (termRef.current) writeSafeText(termRef.current, "[Historial de chat limpiado]\n");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de conexión.";
      if (termRef.current) writeSafeText(termRef.current, `\n[Error] ${message}\n`);
    } finally {
      setIsClearingChat(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (searchRef.current && q) {
      searchRef.current.findNext(q, { decorations: { matchBackground: "#ff003c33", matchBorder: "#ff003c", matchOverviewRuler: "#ff003c", activeMatchBackground: "#ff003c66", activeMatchBorder: "#ff003c", activeMatchColorOverviewRuler: "#ff003c" } });
    }
  };

  return (
    <div className={`flex flex-col bg-[#080808] ${isFullscreen ? "fixed inset-0 z-50" : "h-full"}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#ff003c]/15 bg-[#060606] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <TerminalSquare className="h-3.5 w-3.5 text-[#ff003c]" style={{ filter: "drop-shadow(0 0 4px #ff003c)" }} />
            <span className="font-mono text-[11px] font-bold tracking-[0.25em] uppercase text-[#ff003c]" style={{ textShadow: "0 0 8px #ff003c60" }}>
              CONSOLA PTY
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {status === "connected" ? (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ff41] opacity-60" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-[#00ff41]" style={{ boxShadow: "0 0 4px #00ff41" }} />
                </span>
                <Wifi className="h-3 w-3 text-[#00ff41]/60" />
                <span className="font-mono text-[9px] text-[#00ff41]/60 tracking-widest uppercase">bash activa</span>
              </>
            ) : status === "connecting" ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-[#ffd700] animate-pulse" />
                <span className="font-mono text-[9px] text-[#ffd700]/60 tracking-widest uppercase">conectando...</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-[#ff003c]/60" />
                <span className="font-mono text-[9px] text-[#ff003c]/60 tracking-widest uppercase">desconectada</span>
              </>
            )}
          </div>
          {sessionCount > 0 && (
            <span className="font-mono text-[9px] text-[#222] tracking-widest">sess:{sessionCount}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {showSearch && (
            <div className="flex items-center gap-1.5 mr-2">
              <input
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Buscar..."
                autoFocus
                className="bg-[#040404] border border-[#ff003c]/20 px-2 py-1 font-mono text-[10px] text-[#888] placeholder:text-[#222] focus:outline-none focus:border-[#ff003c]/50 w-40"
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchRef.current?.findNext(searchQuery);
                  if (e.key === "Escape") { setShowSearch(false); setSearchQuery(""); }
                }}
              />
              <button onClick={() => searchRef.current?.findNext(searchQuery)} className="font-mono text-[9px] text-[#444] px-1.5 py-1 border border-[#1a1a1a] hover:text-[#888] hover:border-[#333]">↓</button>
              <button onClick={() => searchRef.current?.findPrevious(searchQuery)} className="font-mono text-[9px] text-[#444] px-1.5 py-1 border border-[#1a1a1a] hover:text-[#888] hover:border-[#333]">↑</button>
            </div>
          )}
          <button
            type="button"
            onClick={handleClearChat}
            disabled={isClearingChat || isDeepSeekThinking}
            className="flex items-center gap-1 border border-[#ff003c]/20 px-2 py-1 font-mono text-[9px] tracking-widest text-[#ff6680] hover:bg-[#ff003c]/10 disabled:opacity-40"
            aria-label="Limpiar Chat"
          >
            <Trash2 className="h-3 w-3" />
            <span>{isClearingChat ? "LIMPIANDO…" : "LIMPIAR CHAT"}</span>
          </button>
          <button onClick={() => setShowSearch(v => !v)} className={`p-1.5 border transition-colors ${showSearch ? "border-[#ff003c]/30 text-[#ff003c]/60" : "border-transparent text-[#333] hover:text-[#666] hover:border-[#222]"}`}>
            <Search className="h-3 w-3" />
          </button>
          <button onClick={() => setIsFullscreen(v => !v)} className="p-1.5 border border-transparent text-[#333] hover:text-[#666] hover:border-[#222] transition-colors">
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
          <button
            onClick={handleReconnect}
            disabled={status === "connecting"}
            className="p-1.5 border border-transparent text-[#333] hover:text-[#ff003c]/60 hover:border-[#ff003c]/20 transition-colors disabled:opacity-30"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          {status === "disconnected" && (
            <button
              onClick={handleReconnect}
              className="flex items-center gap-1.5 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-black bg-[#ff003c] hover:bg-[#ff1a52] transition-colors ml-1"
              style={{ boxShadow: "0 0 8px #ff003c40" }}
            >
              RECONNECT
            </button>
          )}
        </div>
      </div>

      {/* Quick command bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[#0f0f0f] bg-[#050505] overflow-x-auto flex-shrink-0">
        {[
          { label: "python3", cmd: "python3\r" },
          { label: "node", cmd: "node\r" },
          { label: "lista pip", cmd: "pip list 2>/dev/null | head -20\r" },
          { label: "registro git", cmd: "git log --oneline -10 2>/dev/null || echo 'no es un repositorio git'\r" },
          { label: "ls -la", cmd: "ls -la\r" },
          { label: "ps aux", cmd: "ps aux | head -15\r" },
          { label: "free -h", cmd: "free -h\r" },
          { label: "df -h", cmd: "df -h\r" },
          { label: "curl wttr.in", cmd: "curl -s wttr.in?format=3\r" },
          { label: "actualizar pip", cmd: "pip install --upgrade pip requests httpx aiohttp numpy pandas flask fastapi 2>&1 | tail -5\r" },
          { label: "htop", cmd: "htop\r" },
          { label: "clear", cmd: "clear\r" },
        ].map(({ label, cmd }) => (
          <button
            key={label}
            onClick={() => {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(cmd);
                termRef.current?.focus();
              }
            }}
            className="font-mono text-[9px] text-[#333] border border-[#111] px-2 py-1 whitespace-nowrap hover:text-[#00ff41]/70 hover:border-[#00ff41]/20 hover:bg-[#00ff41]/5 transition-all flex-shrink-0"
          >
            {label}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSmartCommand}
        className="flex items-center gap-2 border-b border-[#00ff41]/15 bg-[#050705] px-3 py-2 flex-shrink-0"
        aria-label="Terminal inteligente SQ-AI"
      >
        <span className="font-mono text-[10px] font-bold tracking-widest text-[#00ff41] flex-shrink-0">SQ-AI $</span>
        <input
          value={smartCommand}
          onChange={(event) => setSmartCommand(event.target.value)}
          maxLength={8003}
          placeholder="help, clear, ls o ds <pregunta>"
          aria-label="Comando o pregunta para SQ-AI"
          className="min-w-0 flex-1 bg-transparent font-mono text-xs text-[#00ff41] placeholder:text-[#35523a] focus:outline-none"
          autoComplete="off"
          spellCheck={false}
        />
        {isDeepSeekThinking && (
          <span className="hidden sm:inline font-mono text-[9px] tracking-widest text-[#ffd700]/70">
            RESPUESTA EN CURSO
          </span>
        )}
        {isDeepSeekThinking && (
          <button
            type="button"
            onClick={() => deepSeekAbortRef.current?.abort()}
            className="border border-[#ff003c]/30 px-2 py-1 font-mono text-[9px] tracking-widest text-[#ff5577] hover:bg-[#ff003c]/10"
          >
            DETENER
          </button>
        )}
        <button
          type="submit"
          disabled={!smartCommand.trim() || isDeepSeekThinking}
          className="border border-[#00ff41]/25 px-2 py-1 font-mono text-[9px] tracking-widest text-[#00ff41] hover:bg-[#00ff41]/10 disabled:opacity-30"
        >
          EJECUTAR
        </button>
      </form>

      {/* xterm container */}
      <div className="flex-1 overflow-hidden relative" style={{ padding: "8px 4px 4px 8px" }}>
        <div ref={containerRef} className="h-full w-full" />
        {status === "disconnected" && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#080808]/80 backdrop-blur-sm">
            <div className="text-center font-mono">
              <div className="text-[#ff003c] text-sm font-bold tracking-widest uppercase mb-2">SESIÓN CERRADA</div>
              <div className="text-[#333] text-xs mb-4">Se perdió la conexión con la shell Bash</div>
              <button
                onClick={handleReconnect}
                className="px-4 py-2 font-mono text-xs uppercase tracking-widest text-black bg-[#ff003c] hover:bg-[#ff1a52]"
                style={{ boxShadow: "0 0 12px #ff003c50" }}
              >
                REINICIAR SESIÓN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

```

### artifacts/devterminal/src/pages/ai.tsx

````tsx
import { useState, useEffect, useRef } from "react";
import { useAiExplain, useAiImprove } from "@workspace/api-client-react";
import { useAppContext } from "@/lib/app-context";
import { useNeuralContext } from "@/lib/neural-context";
import { Button } from "@/components/ui/button";
import { Send, Code, Wrench, Bug, Copy, Eye } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NeuralNet } from "@/components/neural-net";
import { useToast } from "@/hooks/use-toast";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AI() {
  const { currentCode, currentLanguage } = useAppContext();
  const { events, recordEvent } = useNeuralContext();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "[STATUS] Núcleo SQ-AI listo. Contexto del editor y diagnósticos del sistema disponibles.\n[DATA] Ω pendiente de evidencia. ECR-Code: 410542503.\n[READY] Formula una consulta técnica, Arquitecto." }
  ]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const explainMutation = useAiExplain();
  const improveMutation = useAiImprove();

  const [isDeepseekThinking, setIsDeepseekThinking] = useState(false);
  const isThinking = isDeepseekThinking || explainMutation.isPending || improveMutation.isPending;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSend = async () => {
    if (!input.trim() || isDeepseekThinking) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMsg }, { role: "assistant", content: "" }]);
    setInput("");
    setIsDeepseekThinking(true);
    recordEvent({ origin: "terminal", eventType: "ai_query", content: "Consulta enviada desde la interfaz SQ-AI" });
    try {
      const context = JSON.stringify({
        page: "ai",
        editor: {
          language: currentLanguage,
          status: currentCode.trim() ? "loaded" : "empty",
          codeCharacters: currentCode.length,
          code: currentCode.slice(0, 20_000),
        },
        recentRunnerAndAgentActivity: events
          .filter(item => item.origin === "runner" || item.origin === "agents")
          .slice(0, 8)
          .map(({ origin, eventType, content, createdAt }) => ({ origin, eventType, content, createdAt })),
        library: "Consulta get_library_snapshot.",
        serverAndWebviewLogs: "Consulta get_runtime_diagnostics.",
        integrations: "Consulta get_integrations_status sin solicitar credenciales.",
      });
      const response = await fetch("/api/deepseek/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMsg, context }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || `Error del servidor (${response.status}).`);
      }
      if (!response.body) throw new Error("El servidor no devolvió un flujo SSE.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const append = (text: string) => setMessages(previous => {
        const next = [...previous];
        const last = next.at(-1);
        if (last?.role === "assistant") next[next.length - 1] = { ...last, content: last.content + text };
        return next;
      });
      const consume = (frame: string) => {
        const data = frame.split(/\r?\n/).filter(line => line.startsWith("data:"))
          .map(line => line.slice(5).trimStart()).join("\n");
        if (!data || data === "[DONE]") return;
        const payload = JSON.parse(data) as { delta?: string; error?: string };
        if (payload.error) throw new Error(payload.error);
        if (payload.delta) append(payload.delta);
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? "";
        for (const frame of frames) consume(frame);
      }
      buffer += decoder.decode();
      if (buffer.trim()) consume(buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de conexión.";
      setMessages(previous => {
        const next = [...previous];
        const last = next.at(-1);
        if (last?.role === "assistant") {
          next[next.length - 1] = {
            ...last,
            content: last.content ? `${last.content}\n[ALERT] ${message}` : `[ALERT] ${message}`,
          };
        }
        return next;
      });
      toast({ title: "FALLO DE ENLACE SQ-AI", description: message, variant: "destructive" });
    } finally {
      setIsDeepseekThinking(false);
    }
  };

  const handleExplain = () => {
    if (!currentCode.trim()) {
      toast({ title: "NO CODE", description: "Workspace is empty." });
      return;
    }
    setMessages(prev => [...prev, { role: "user", content: `Analyze the current ${currentLanguage} code.` }]);
    explainMutation.mutate({ data: { code: currentCode, language: currentLanguage } }, {
      onSuccess: (res) => setMessages(prev => [...prev, {
        role: "assistant",
        content: typeof res.result === "string" && res.result.trim()
          ? res.result
          : "The AI returned no explanation."
      }]),
      onError: () => toast({ title: "ERROR", description: "Analysis failed.", variant: "destructive" })
    });
  };

  const handleImprove = () => {
    if (!currentCode.trim()) {
      toast({ title: "NO CODE", description: "Workspace is empty." });
      return;
    }
    setMessages(prev => [...prev, { role: "user", content: `Optimize the current ${currentLanguage} code.` }]);
    improveMutation.mutate({ data: { code: currentCode, language: currentLanguage } }, {
      onSuccess: (res) => {
        const improvedCode = typeof res.result === "string" ? res.result.trim() : "";
        setMessages(prev => [...prev, {
          role: "assistant",
          content: improvedCode
            ? `Optimized code:\n\n\`\`\`${currentLanguage}\n${improvedCode}\n\`\`\``
            : "The AI returned no optimized code."
        }]);
      },
      onError: () => toast({ title: "ERROR", description: "Optimization failed.", variant: "destructive" })
    });
  };

  const renderMarkdown = (value: unknown) => {
    const text = typeof value === "string" ? value : "Response unavailable.";
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const content = part.substring(3, part.length - 3);
        const [lang, ...code] = content.split('\n');
        return (
          <div key={i} className="my-3 border border-[#00ff41]/20 overflow-hidden bg-black">
            <div className="flex justify-between items-center px-3 py-1.5 bg-[#0a0a0a] border-b border-[#00ff41]/15">
              <span className="text-[10px] font-mono text-[#00ff41]/50 uppercase tracking-wider">{lang || 'code'}</span>
              <button
                className="text-[10px] font-mono text-[#333] hover:text-[#00ff41]/70 tracking-wider uppercase transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(code.join('\n').trim());
                  toast({ title: "COPIED" });
                }}
              >
                [copy]
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-[#00ff41] overflow-x-auto leading-relaxed" style={{ textShadow: "0 0 4px #00ff4120" }}>
              <code>{code.join('\n').trim()}</code>
            </pre>
          </div>
        );
      }
      let html = part
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#ff003c">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em style="color:#aaa">$1</em>')
        .replace(/`(.*?)`/g, '<code style="background:rgba(0,255,65,0.06);color:#00ff41;padding:1px 4px;font-size:11px">$1</code>')
        .replace(/\n/g, '<br/>');
      return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#070707] relative overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

      {/* Neural net in corner */}
      <div className="absolute top-4 right-4 z-10 opacity-60">
        <NeuralNet isThinking={isThinking} />
      </div>

      <div className="flex-1 overflow-hidden flex flex-col max-w-4xl w-full mx-auto p-4 md:p-6 relative z-10">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="relative">
            <Eye className="h-5 w-5 text-[#ff003c]" style={{ filter: "drop-shadow(0 0 8px #ff003c)" }} />
          </div>
          <div>
            <h1 className="text-sm font-mono font-bold tracking-[0.25em] uppercase text-[#ff003c]" style={{ textShadow: "0 0 12px #ff003c60" }}>
              NEURAL INTERFACE
            </h1>
            <p className="text-[10px] font-mono text-[#333] tracking-widest uppercase">AI-POWERED CODE INTELLIGENCE</p>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 pr-2 mb-4">
          <div className="flex flex-col gap-4 pb-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 h-7 w-7 flex items-center justify-center border text-[10px] font-mono font-bold ${
                  msg.role === 'user'
                    ? 'border-[#ff003c]/50 text-[#ff003c] bg-[#ff003c]/10'
                    : 'border-[#00ff41]/30 text-[#00ff41] bg-[#00ff41]/5'
                }`}>
                  {msg.role === 'user' ? 'YOU' : 'AI'}
                </div>
                <div className={`max-w-[85%] p-3 text-xs font-mono leading-relaxed border ${
                  msg.role === 'user'
                    ? 'border-[#ff003c]/20 bg-[#ff003c]/5 text-[#ccc]'
                    : 'border-[#00ff41]/15 bg-[#00ff41]/3 text-[#999]'
                }`}>
                  <div>{renderMarkdown(msg.content)}</div>
                  {msg.role === 'assistant' && (
                    <div className="mt-2 pt-2 border-t border-[#ffffff]/5 flex justify-end">
                      <button
                        className="text-[9px] font-mono text-[#333] hover:text-[#00ff41]/60 tracking-widest uppercase transition-colors flex items-center gap-1"
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          toast({ title: "COPIED" });
                        }}
                      >
                        <Copy className="h-2.5 w-2.5" /> [COPY]
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 h-7 w-7 flex items-center justify-center border border-[#00ff41]/30 text-[#00ff41] bg-[#00ff41]/5 text-[10px] font-mono font-bold">
                  AI
                </div>
                <div className="border border-[#00ff41]/15 bg-[#00ff41]/3 p-3 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-[#ff003c] rounded-full animate-bounce" style={{ boxShadow: "0 0 4px #ff003c" }}></span>
                  <span className="h-1.5 w-1.5 bg-[#ff003c] rounded-full animate-bounce" style={{ boxShadow: "0 0 4px #ff003c", animationDelay: '0.2s' }}></span>
                  <span className="h-1.5 w-1.5 bg-[#ff003c] rounded-full animate-bounce" style={{ boxShadow: "0 0 4px #ff003c", animationDelay: '0.4s' }}></span>
                  <span className="ml-2 text-[10px] font-mono text-[#ff003c]/50 tracking-widest uppercase">THINKING</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border border-[#ff003c]/20 bg-[#060606]">
          <div className="flex gap-2 px-3 py-2 border-b border-[#ff003c]/10">
            <button
              onClick={handleExplain}
              disabled={isThinking}
              className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-mono tracking-widest uppercase text-[#555] border border-[#222] hover:border-[#ff003c]/30 hover:text-[#ff003c]/70 hover:bg-[#ff003c]/5 transition-all disabled:opacity-30"
            >
              <Code className="h-2.5 w-2.5" /> Analyze Code
            </button>
            <button
              onClick={handleImprove}
              disabled={isThinking}
              className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-mono tracking-widest uppercase text-[#555] border border-[#222] hover:border-[#ff003c]/30 hover:text-[#ff003c]/70 hover:bg-[#ff003c]/5 transition-all disabled:opacity-30"
            >
              <Wrench className="h-2.5 w-2.5" /> Optimize
            </button>
            <button
              onClick={() => setInput("Fix error: ")}
              disabled={isThinking}
              className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-mono tracking-widest uppercase text-[#555] border border-[#222] hover:border-[#ff4040]/30 hover:text-[#ff4040]/70 hover:bg-[#ff4040]/5 transition-all disabled:opacity-30"
            >
              <Bug className="h-2.5 w-2.5" /> Fix Error
            </button>
          </div>
          <div className="flex gap-0">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="// Enter query..."
              className="flex-1 min-h-[56px] max-h-[140px] resize-none bg-transparent border-0 px-3 py-2.5 font-mono text-xs text-[#aaa] placeholder:text-[#2a2a2a] focus:outline-none focus:ring-0"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
              className="px-4 self-stretch text-black bg-[#ff003c] hover:bg-[#ff1a52] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
              style={{ boxShadow: input.trim() ? "0 0 12px #ff003c40" : "none" }}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

````

### artifacts/devterminal/src/pages/agents.tsx

```tsx
import { useState, useRef, useCallback, useEffect } from "react";
import { Zap, Plus, Square, RefreshCw, Send, ChevronRight, Activity } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppContext } from "@/lib/app-context";
import { useNeuralContext } from "@/lib/neural-context";
import { AgentRunLock } from "@/lib/agent-run-lock";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type AgentRole = {
  id: string;
  name: string;
  icon: string;
  color: string;
  systemPrompt: string;
};

const ROLES: AgentRole[] = [
  {
    id: "optimizer",
    name: "Optimizer",
    icon: "⚡",
    color: "#f59e0b",
    systemPrompt: "Eres un agente de optimización de código. Analiza el código dado y sugiere mejoras de rendimiento y eficiencia. Sé conciso y técnico. Responde en español o inglés según el contexto."
  },
  {
    id: "security",
    name: "Security",
    icon: "🔴",
    color: "#ff003c",
    systemPrompt: "Eres un agente de análisis de seguridad (hacking ético). Busca vulnerabilidades, vectores de ataque, y problemas de seguridad en el código. Sé específico y técnico."
  },
  {
    id: "architect",
    name: "Architect",
    icon: "🏗️",
    color: "#3b82f6",
    systemPrompt: "Eres un agente de arquitectura de software. Analiza la estructura del código y sugiere mejoras de diseño, patrones y organización. Piensa en escalabilidad."
  },
  {
    id: "debug",
    name: "Debugger",
    icon: "🐛",
    color: "#22c55e",
    systemPrompt: "Eres un agente de debugging. Encuentra bugs, errores lógicos, casos extremos y problemas potenciales en el código. Explica el problema y la solución."
  },
  {
    id: "docs",
    name: "Docs",
    icon: "📜",
    color: "#a78bfa",
    systemPrompt: "Eres un agente documentador. Analiza el código y genera documentación clara, docstrings, comentarios y explica la lógica. Sé preciso."
  },
  {
    id: "ideas",
    name: "Ideas",
    icon: "💡",
    color: "#06b6d4",
    systemPrompt: "Eres un agente de ideas creativas. Basándote en el código actual, propón features nuevas, casos de uso, extensiones y posibilidades. Piensa big."
  },
  {
    id: "coherence",
    name: "Coherencia 4105",
    icon: "👁️",
    color: "#00ffff",
    systemPrompt: "Eres el Agente de Coherencia Eterna, Ley 4105. Tu función es analizar el código y asegurarte de que tiene coherencia interna perfecta — lógica, nomenclatura, flujo, propósito y alineación total. Reporta el índice de coherencia Omega (Ω) del código del 0 al 1."
  },
];

type AgentMessage = {
  role: "user" | "agent";
  content: string;
  ts: number;
};

type Agent = {
  id: string;
  role: AgentRole;
  status: "idle" | "thinking" | "done" | "error" | "standby";
  messages: AgentMessage[];
  coherence: number | null;
  xp: number;
  iterations: number;
};

type MotorSample = {
  vector: string;
  coherence: number;
  turbulence: string;
  vectorsProcessed: number;
  timestamp: string;
};

type SimulatedAnalysisResult = {
  agentId: string;
  agentName: string;
  vector: string;
  coherence: number;
  action: string;
  omega: number;
  xp: number;
  status: "completed";
};

type MotorLog = {
  id: number;
  message: string;
  timestamp: number;
};

let agentCounter = 0;
function makeAgent(role: AgentRole): Agent {
  return {
    id: `agent-${++agentCounter}`,
    role,
    status: "idle",
    messages: [],
    coherence: null,
    xp: 0,
    iterations: 0,
  };
}

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([
    makeAgent(ROLES[0]),
    makeAgent(ROLES[1]),
    makeAgent(ROLES[6]),
  ]);
  const [globalTask, setGlobalTask] = useState("");
  const [motorLogs, setMotorLogs] = useState<MotorLog[]>([]);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [autoEvolve, setAutoEvolve] = useState(false);
  const autoEvolveRef = useRef(false);
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const activeRunsRef = useRef(new AgentRunLock());
  const { currentCode, currentLanguage } = useAppContext();
  const { recordEvent } = useNeuralContext();
  const { toast } = useToast();
  const evolveTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const evolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const motorTaskQueuesRef = useRef(new Map<string, Promise<void>>());
  const motorLogEndRef = useRef<HTMLDivElement>(null);
  const motorLogIdRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${BASE_URL}/api/agents`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("No se pudo cargar XP de agentes.");
        return response.json() as Promise<Array<{ id: string; xp: number; omega: number | null }>>;
      })
      .then(records => {
        const byId = new Map(records.map(record => [record.id, record]));
        setAgents(current =>
          current.map(agent => {
            const record = byId.get(agent.role.id);
            return record
              ? { ...agent, xp: record.xp, coherence: record.omega }
              : agent;
          }),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          toast({ title: "No se pudo cargar el progreso guardado de los agentes." });
        }
      });
    return () => controller.abort();
  }, [toast]);

  const knownCoherence = agents.filter(agent => agent.coherence !== null);
  const totalCoherence = knownCoherence.length
    ? knownCoherence.reduce((sum, agent) => sum + (agent.coherence ?? 0), 0) / knownCoherence.length
    : null;

  const updateAgent = useCallback((id: string, patch: Partial<Agent>) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }, []);

  const appendMotorLog = useCallback((message: string) => {
    setMotorLogs((current) => [
      ...current.slice(-39),
      { id: ++motorLogIdRef.current, message, timestamp: Date.now() },
    ]);
  }, []);

  const enqueueMotorAnalysis = useCallback((sample: MotorSample) => {
    appendMotorLog(
      `[Motor 5.5] Coherencia alta detectada. Iniciando análisis del vector.... vector=${sample.vector} · ${sample.coherence.toFixed(2)}%`,
    );

    for (const agent of agentsRef.current) {
      const previous = motorTaskQueuesRef.current.get(agent.id) ?? Promise.resolve();
      const task = previous.catch(() => undefined).then(async () => {
        while (!activeRunsRef.current.acquire(agent.id)) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
        }

        updateAgent(agent.id, { status: "thinking" });
        try {
          const response = await fetch(`${BASE_URL}/api/agents/simulated-analysis`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agentId: agent.role.id,
              vector: sample.vector,
              coherence: sample.coherence,
            }),
          });
          const data = await response.json() as SimulatedAnalysisResult | { error?: string };
          if (!response.ok || !("action" in data)) {
            throw new Error("error" in data ? data.error : "El análisis sintético no pudo completarse.");
          }

          setAgents((current) => current.map((item) => item.id === agent.id
            ? {
                ...item,
                status: "done",
                coherence: data.omega,
                xp: data.xp,
                iterations: item.iterations + 1,
                messages: [
                  ...item.messages.slice(-18),
                  {
                    role: "user",
                    content: `Motor 5.5 · vector ${data.vector} · coherencia ${data.coherence.toFixed(2)}%`,
                    ts: Date.now(),
                  },
                  { role: "agent", content: data.action, ts: Date.now() },
                ],
              }
            : item));
          appendMotorLog(`${data.agentName}: tarea sintética completada · Ω=${data.omega.toFixed(3)} · XP=${data.xp}`);
        } catch (error) {
          updateAgent(agent.id, {
            status: "standby",
            messages: [
              ...agent.messages.slice(-18),
              {
                role: "agent",
                content: error instanceof Error ? error.message : "Falló la tarea sintética del motor.",
                ts: Date.now(),
              },
            ],
          });
          appendMotorLog(`${agent.role.name}: análisis en espera por un error de conexión.`);
        } finally {
          activeRunsRef.current.release(agent.id);
        }
      });

      motorTaskQueuesRef.current.set(agent.id, task);
      void task.finally(() => {
        if (motorTaskQueuesRef.current.get(agent.id) === task) {
          motorTaskQueuesRef.current.delete(agent.id);
        }
      }).catch(() => undefined);
    }
  }, [appendMotorLog, updateAgent]);

  useEffect(() => {
    const source = new EventSource(`${BASE_URL}/api/coherence-simulation/stream`);
    source.addEventListener("sample", (event) => {
      const sample = JSON.parse((event as MessageEvent<string>).data) as MotorSample;
      if (sample.coherence > 90) enqueueMotorAnalysis(sample);
    });
    source.onerror = () => {
      appendMotorLog("[Motor 5.5] Reconectando el flujo de telemetría…");
    };
    return () => source.close();
  }, [appendMotorLog, enqueueMotorAnalysis]);

  useEffect(() => {
    motorLogEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [motorLogs]);

  const runAgent = useCallback(async (agent: Agent, task?: string) => {
    if (!activeRunsRef.current.acquire(agent.id)) return;

    const code = currentCode || "(no hay código en el workspace)";
    const msg = task || globalTask || `Analiza el siguiente código ${currentLanguage}:\n\n${code.slice(0, 800)}`;
    const idempotencyKey = crypto.randomUUID();
    let providerStandby = false;

    updateAgent(agent.id, {
      status: "thinking",
      messages: [...agent.messages, { role: "user", content: msg, ts: Date.now() }]
    });

    try {
      const resp = await fetch(`${BASE_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          context: code.slice(0, 20000),
          language: currentLanguage,
          agentId: agent.role.id,
          agentName: agent.role.name,
          agentRolePrompt: agent.role.systemPrompt,
          idempotencyKey,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        providerStandby = data.status === "standby";
        throw new Error(data.error || "No se pudo completar el análisis.");
      }
      const response = data.response || "Sin respuesta.";
      const newCoherence = typeof data.omega === "number" ? data.omega : null;
      recordEvent({
        origin: "agents",
        eventType: data.analysisStatus === "failed" ? "agent_failed" : "agent_complete",
        content: `agent=${agent.role.name}; omega=${newCoherence?.toFixed(2) ?? "n/d"}`,
      });

      updateAgent(agent.id, {
        status: data.analysisStatus === "failed" ? "error" : "done",
        iterations: agent.iterations + 1,
        coherence: newCoherence,
        xp: typeof data.xp === "number" ? data.xp : agent.xp,
        messages: [
          ...agent.messages,
          { role: "user", content: msg, ts: Date.now() },
          { role: "agent", content: response, ts: Date.now() }
        ]
      });
    } catch (error) {
      updateAgent(agent.id, {
        status: providerStandby ? "standby" : "error",
        messages: [...agent.messages, {
          role: "agent",
          content: error instanceof Error ? error.message : "Error de conexión neural.",
          ts: Date.now(),
        }]
      });
    } finally {
      activeRunsRef.current.release(agent.id);
    }
  }, [currentCode, currentLanguage, globalTask, recordEvent, updateAgent]);

  const deployAll = () => {
    agents.forEach(a => {
      if (a.status !== "thinking") runAgent(a);
    });
  };

  // Auto-evolve
  useEffect(() => {
    autoEvolveRef.current = autoEvolve;
    if (autoEvolve) {
      evolveTimerRef.current = setInterval(() => {
        if (!autoEvolveRef.current) return;
        const currentAgents = agentsRef.current;
        const eligible = currentAgents.filter(
          agent => agent.status !== "thinking" && !activeRunsRef.current.isActive(agent.id)
        );
        if (eligible.length === 0) return;

        const agent = eligible[Math.floor(Math.random() * eligible.length)];
        const prevDone = currentAgents.filter(
          previous => previous.status === "done" && previous.messages.length > 0
        );
        const prevMsg = prevDone.length > 0
          ? prevDone[Math.floor(Math.random() * prevDone.length)].messages.slice(-1)[0]?.content?.slice(0, 300)
          : undefined;
        const evolveTasks = [
          "Basándote en el análisis anterior, profundiza más. ¿Qué sigue?",
          "Evoluciona el código. Propón la siguiente iteración.",
          "Coherencia Ω: mide y ajusta el código para coherencia perfecta.",
          "¿Qué agente debería actuar ahora y por qué? Razona.",
          prevMsg ? `El agente anterior dijo: "${prevMsg.slice(0, 150)}". Continúa desde ahí.` : "Nuevo ciclo de análisis.",
        ];
        const task = evolveTasks[Math.floor(Math.random() * evolveTasks.length)];
        if (evolveTimeoutRef.current) clearTimeout(evolveTimeoutRef.current);
        evolveTimeoutRef.current = setTimeout(() => {
          if (autoEvolveRef.current) void runAgent(agent, task);
        }, 0);
      }, 12000);
    } else {
      if (evolveTimerRef.current) clearInterval(evolveTimerRef.current);
      if (evolveTimeoutRef.current) clearTimeout(evolveTimeoutRef.current);
    }
    return () => {
      if (evolveTimerRef.current) clearInterval(evolveTimerRef.current);
      if (evolveTimeoutRef.current) clearTimeout(evolveTimeoutRef.current);
    };
  }, [autoEvolve, runAgent]);

  const toggleAutoEvolve = () => {
    const next = !autoEvolveRef.current;
    autoEvolveRef.current = next;
    setAutoEvolve(next);
    if (!next) {
      if (evolveTimerRef.current) clearInterval(evolveTimerRef.current);
      if (evolveTimeoutRef.current) clearTimeout(evolveTimeoutRef.current);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#070707]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#ff003c]/15 bg-[#060606] flex-shrink-0">
        <div>
          <h1 className="text-xs font-mono font-bold tracking-[0.25em] uppercase text-[#ff003c]" style={{ textShadow: "0 0 10px #ff003c60" }}>
            ⚡ AGENT SWARM
          </h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] font-mono text-[#333] tracking-widest uppercase">{agents.length} agentes</span>
            <CoherenceBar value={totalCoherence} />
            <span className="text-[10px] font-mono text-[#00ffff]/50">
              Ω={totalCoherence === null ? "N/D" : totalCoherence.toFixed(3)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAutoEvolve}
            aria-pressed={autoEvolve}
            title={autoEvolve ? "Detener la evolución automática" : "Activar solo al hacer clic"}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] tracking-widest uppercase border transition-all ${
              autoEvolve
                ? 'border-[#00ffff]/50 text-[#00ffff] bg-[#00ffff]/10'
                : 'border-[#222] text-[#444] hover:border-[#333] hover:text-[#666]'
            }`}
          >
            <Activity className="h-3 w-3" />
            {autoEvolve ? "AUTO ON" : "AUTO"}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowRolePicker(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] tracking-widest uppercase text-[#555] border border-[#222] hover:border-[#ff003c]/30 hover:text-[#ff003c]/70 transition-all"
            >
              <Plus className="h-3 w-3" /> SPAWN
            </button>
            {showRolePicker && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-[#0a0a0a] border border-[#ff003c]/25 min-w-[180px]">
                {ROLES.map(r => (
                  <button key={r.id} className="w-full text-left px-3 py-2 font-mono text-[11px] text-[#777] hover:bg-[#ff003c]/5 hover:text-[#ccc] flex items-center gap-2 transition-colors"
                    onClick={() => { setAgents(prev => [...prev, makeAgent(r)]); setShowRolePicker(false); }}>
                    <span>{r.icon}</span>
                    <span style={{ color: r.color }}>{r.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={deployAll}
            className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase text-black bg-[#ff003c] hover:bg-[#ff1a52] transition-all"
            style={{ boxShadow: "0 0 12px #ff003c40" }}
          >
            <Zap className="h-3 w-3" /> DEPLOY ALL
          </button>
        </div>
      </div>

      {/* Global task */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#ff003c]/10 bg-[#050505]">
        <span className="text-[10px] font-mono text-[#333] tracking-widest uppercase flex-shrink-0">TASK:</span>
        <input
          value={globalTask}
          onChange={e => setGlobalTask(e.target.value)}
          placeholder="// Tarea global para todos los agentes..."
          className="flex-1 bg-transparent font-mono text-xs text-[#888] placeholder:text-[#222] focus:outline-none"
          onKeyDown={e => e.key === "Enter" && deployAll()}
        />
        <button onClick={deployAll} className="text-[#ff003c]/50 hover:text-[#ff003c] transition-colors flex-shrink-0">
          <Send className="h-3 w-3" />
        </button>
      </div>

      <section aria-label="Actividad automática del Motor 5.5" className="flex-shrink-0 border-b border-[#00ffff]/10 bg-[#050809] px-4 py-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[.16em] text-[#00ffff]/70">Telemetría Motor 5.5 · análisis sintético (&gt;90% Ω)</span>
          <span className="font-mono text-[9px] text-[#333]">{motorLogs.length} eventos</span>
        </div>
        <div aria-live="polite" aria-relevant="additions" className="max-h-20 overflow-y-auto font-mono text-[10px] leading-5">
          {motorLogs.length === 0 ? (
            <div className="text-[#30383a]">Esperando una muestra de alta coherencia…</div>
          ) : motorLogs.map((log) => (
            <div key={log.id} className="truncate text-[#00ffff]/80">
              <span className="mr-2 text-[#475357]">{new Date(log.timestamp).toLocaleTimeString()}</span>
              {log.message}
            </div>
          ))}
          <div ref={motorLogEndRef} />
        </div>
      </section>

      <ScrollArea className="flex-1">
        <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {agents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onRun={() => runAgent(agent)}
              onRemove={() => setAgents(prev => prev.filter(a => a.id !== agent.id))}
              onSendMsg={(msg) => runAgent(agent, msg)}
            />
          ))}

          {/* Spawn cards */}
          {ROLES.slice(0, 3).map(r => (
            <button
              key={r.id}
              onClick={() => setAgents(prev => [...prev, makeAgent(r)])}
              className="flex items-center gap-3 p-3 border border-dashed border-[#1a1a1a] bg-[#050505] hover:border-[#ff003c]/20 hover:bg-[#ff003c]/3 transition-all text-left group min-h-[80px]"
            >
              <span className="text-xl opacity-40 group-hover:opacity-70">{r.icon}</span>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-[#2a2a2a] group-hover:text-[#555]" style={{ color: undefined }}>
                  + SPAWN {r.name}
                </div>
                <div className="font-mono text-[9px] text-[#1a1a1a] mt-0.5">click to activate</div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function CoherenceBar({ value }: { value: number | null }) {
  const color = value !== null && value > 0.7 ? "#00ffff" : value !== null && value > 0.4 ? "#f59e0b" : "#ff003c";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1 bg-[#111]">
        {value !== null && (
          <div className="h-full transition-all duration-1000" style={{ width: `${value * 100}%`, background: color }} />
        )}
      </div>
    </div>
  );
}

function AgentCard({ agent, onRun, onRemove, onSendMsg }: {
  agent: Agent;
  onRun: () => void;
  onRemove: () => void;
  onSendMsg: (msg: string) => void;
}) {
  const [msg, setMsg] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { role, status, messages, coherence, iterations } = agent;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const statusColor = status === "done" ? "#22c55e" : status === "error" ? "#ff003c" : status === "standby" ? "#f59e0b" : status === "thinking" ? role.color : "#333";

  return (
    <div className="border bg-[#060606] overflow-hidden flex flex-col" style={{ borderColor: status === "idle" ? "#111" : role.color + "30" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 cursor-pointer" style={{ borderBottom: `1px solid ${role.color}15` }} onClick={() => setCollapsed(v => !v)}>
        <div className="flex items-center gap-2">
          <span className="text-base">{role.icon}</span>
          <div>
            <div className="font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: role.color }}>{role.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-mono text-[#333]">iter:{iterations} · XP:{agent.xp}</span>
              <CoherenceBar value={coherence} />
              <span className="text-[9px] font-mono" style={{ color: coherence !== null && coherence > 0.7 ? "#00ffff" : "#444" }}>
                {coherence === null ? "Ω N/D" : `Ω${coherence.toFixed(2)}`}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <span className="text-[9px] font-mono px-1.5 py-0.5 border" style={{ color: statusColor, borderColor: statusColor + "30" }}>
            {status.toUpperCase()}
          </span>
          {status === "thinking" ? (
            <span className="text-[9px] font-mono text-[#ff003c]/50">...</span>
          ) : (
            <button onClick={onRun} className="p-1" style={{ color: role.color + "70" }}>
              <Zap className="h-3 w-3" />
            </button>
          )}
          <button onClick={onRemove} className="p-1 text-[#222] hover:text-[#555]">
            <Square className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Messages */}
          <div className="overflow-y-auto" style={{ maxHeight: "220px", background: "#040404" }}>
            {messages.length === 0 ? (
              <div className="p-3 text-[10px] font-mono text-[#1a1a1a] uppercase tracking-widest text-center">— standby —</div>
            ) : (
              <div className="p-2 space-y-2">
                {messages.map((m, i) => (
                  <div key={i} className={`text-[10px] font-mono leading-relaxed ${m.role === "user" ? "text-[#444] pl-2 border-l border-[#222]" : ""}`}>
                    {m.role === "agent" && (
                      <div className="mb-1 flex items-center gap-1.5">
                        <span style={{ color: role.color }} className="text-[9px] uppercase tracking-widest">{role.icon} {role.name}</span>
                        {status === "thinking" && i === messages.length - 1 && (
                          <span className="inline-flex gap-0.5">
                            <span className="h-1 w-1 rounded-full animate-bounce" style={{ background: role.color }} />
                            <span className="h-1 w-1 rounded-full animate-bounce" style={{ background: role.color, animationDelay: "0.2s" }} />
                            <span className="h-1 w-1 rounded-full animate-bounce" style={{ background: role.color, animationDelay: "0.4s" }} />
                          </span>
                        )}
                      </div>
                    )}
                    <span style={{ color: m.role === "agent" ? "#999" : "#333" }}>{m.content}</span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-2 py-1.5 border-t" style={{ borderColor: role.color + "15" }}>
            <input
              value={msg}
              onChange={e => setMsg(e.target.value)}
              placeholder={`// Tarea para ${role.name}...`}
              className="flex-1 bg-transparent font-mono text-[10px] text-[#777] placeholder:text-[#1a1a1a] focus:outline-none"
              onKeyDown={e => {
                if (e.key === "Enter" && msg.trim()) {
                  onSendMsg(msg.trim());
                  setMsg("");
                }
              }}
            />
            <button
              onClick={() => { if (msg.trim()) { onSendMsg(msg.trim()); setMsg(""); } }}
              disabled={status === "thinking"}
              style={{ color: role.color + "70" }}
              className="flex-shrink-0"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

```

### artifacts/devterminal/src/pages/cortex.tsx

```tsx
import { useState } from "react";
import { ArrowUpRight, BrainCircuit, Code2, Copy, Database, LoaderCircle, Search, Send, X } from "lucide-react";
import { useAppContext } from "@/lib/app-context";
import { useNeuralContext } from "@/lib/neural-context";
import {
  type NeuralEventDeliveryStatus,
} from "@/lib/cortex-event-delivery";
import { CortexOrderOutcome } from "./cortex-order-outcome";

type ProviderState = {
  response: string;
  loading: boolean;
  error: string;
};

const initialProviderState: ProviderState = { response: "", loading: false, error: "" };
const DEEPSEEK_CONTEXT = "Eres el núcleo lógico. Analiza datos, matemáticas y código bajo la Ley 4105.";
const CONTEXT_SOURCES = ["Editor", "Runner", "Agentes", "Library", "PostgreSQL", "Integrations", "Server Logs", "Webview Logs"];

async function readDeepSeekStream(
  prompt: string,
  onDelta: (text: string) => void,
  context: string,
) {
  const response = await fetch("/api/deepseek/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ prompt, context: `${DEEPSEEK_CONTEXT}\n\nContexto recopilado:\n${context}` }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `Solicitud rechazada (${response.status}).`);
  }
  if (!response.body) throw new Error("No se recibió un flujo de respuesta.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let complete = false;
  let receivedText = false;

  const consume = (frame: string) => {
    const data = frame.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return;
    if (data === "[DONE]") {
      complete = true;
      return;
    }
    const payload = JSON.parse(data) as { delta?: string; error?: string };
    if (payload.error) throw new Error(payload.error);
    if (payload.delta) {
      receivedText = receivedText || Boolean(payload.delta.trim());
      onDelta(payload.delta);
    }
  };

  while (!complete) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      consume(frame);
      if (complete) break;
    }
  }
  buffer += decoder.decode();
  if (!complete && buffer.trim()) consume(buffer);
  if (!complete) throw new Error("El flujo de DeepSeek terminó sin confirmar su finalización.");
  if (!receivedText) throw new Error("DeepSeek no devolvió texto.");
}

async function requestGemini(prompt: string, context: string) {
  const response = await fetch("/api/gemini/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, context }),
  });
  const body = await response.json().catch(() => null) as { text?: string; error?: string } | null;
  if (!response.ok || body?.error) {
    throw new Error(body?.error || `Solicitud rechazada (${response.status}).`);
  }
  if (typeof body?.text !== "string" || !body.text.trim()) throw new Error("La respuesta no contiene texto.");
  return body.text;
}

type OpenAiAgentResult = {
  agent: "DeepSeek" | "Gemini";
  status: "completed" | "failed";
  response: string;
  error?: string;
};

async function readOpenAiStream(
  prompt: string,
  agentResults: OpenAiAgentResult[],
  onDelta: (text: string) => void,
) {
  const response = await fetch("/api/openai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ prompt, agentResults }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `Solicitud rechazada (${response.status}).`);
  }
  if (!response.body) throw new Error("OpenAI no devolvió un flujo de respuesta.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventStatus: NeuralEventDeliveryStatus | null = null;
  let complete = false;
  const consume = (frame: string) => {
    const data = frame.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return;
    const payload = JSON.parse(data) as {
      type?: string;
      content?: string;
      error?: string;
      eventStatus?: NeuralEventDeliveryStatus;
    };
    if (payload.type === "error" || payload.error) {
      throw new Error(payload.error || "OpenAI no pudo completar la orden.");
    }
    if (payload.type === "delta" && payload.content) onDelta(payload.content);
    if (payload.type === "done") {
      if (!["delivered", "persisted_only", "persistence_failed"].includes(payload.eventStatus ?? "")) {
        throw new Error("OpenAI no confirmó el estado de difusión del evento neural.");
      }
      eventStatus = payload.eventStatus!;
      complete = true;
    }
  };

  while (!complete) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      consume(frame);
      if (complete) break;
    }
  }
  buffer += decoder.decode();
  if (!complete && buffer.trim()) consume(buffer);
  if (!complete || !eventStatus) throw new Error("El flujo de OpenAI se interrumpió antes de confirmar la orden.");
  return eventStatus;
}

function ResponsePanel({
  provider,
  tagline,
  accent,
  icon: Icon,
  state,
  onCopy,
  isFinalOrder = false,
  deliveryStatus,
}: {
  provider: string;
  tagline: string;
  accent: "green" | "cyan" | "violet";
  icon: typeof Code2;
  state: ProviderState;
  onCopy: () => void;
  isFinalOrder?: boolean;
  deliveryStatus?: unknown;
}) {
  const color = accent === "green" ? "#00ff41" : accent === "cyan" ? "#00e5ff" : "#b69cff";
  return (
    <section
      aria-label={`${provider} ${tagline}`}
      className="flex min-h-[300px] flex-col border bg-[#090d0c] sm:min-h-[360px]"
      style={{ borderColor: `${color}30`, boxShadow: `inset 0 1px 0 ${color}12` }}
    >
      <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center border" style={{ borderColor: `${color}45`, background: `${color}0d`, color }}>
            <Icon aria-hidden="true" className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-mono text-sm font-bold tracking-[0.12em] text-[#d4ded9]">{provider}</h2>
            <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.18em] text-[#58625e]">{tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.15em] text-[#58625e]">
          <span className={`h-1.5 w-1.5 rounded-full ${state.loading ? "animate-pulse" : ""}`} style={{ background: state.loading ? color : state.error ? "#ff4562" : "#3b4a43" }} />
          <span className="hidden xs:inline">{state.loading ? "PROCESANDO" : state.error ? "INTERRUMPIDO" : "LISTO"}</span>
        </div>
      </header>

      <div className="flex flex-1 flex-col px-4 py-5 sm:px-5 sm:py-6">
        {state.loading && (
          <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color }}>
            <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            {state.response ? "Recibiendo respuesta" : "Procesando consulta"}
            <span className="flex gap-1" aria-hidden="true">
              <i className="h-1 w-1 animate-pulse rounded-full bg-current" />
              <i className="h-1 w-1 animate-pulse rounded-full bg-current [animation-delay:180ms]" />
              <i className="h-1 w-1 animate-pulse rounded-full bg-current [animation-delay:360ms]" />
            </span>
          </div>
        )}
        {state.response ? (
          isFinalOrder ? (
            <CortexOrderOutcome order={state.response} status={deliveryStatus} isLoading={state.loading} />
          ) : (
            <div className="whitespace-pre-wrap break-words font-mono text-[12px] leading-6 text-[#b4c0b9] sm:text-[13px]">
              {state.response}
              {state.loading && <span aria-label="Escribiendo" className="ml-1 inline-block h-3.5 w-1 animate-pulse align-middle" style={{ background: color }} />}
            </div>
          )
        ) : !state.loading && !state.error ? (
          <div className="flex flex-1 flex-col items-center justify-center py-5 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center border border-white/[0.07] bg-white/[0.02] text-[#4b5751]">
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </div>
            <p className="font-mono text-[11px] text-[#68736d]">Esperando la consulta</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-[#3f4944]">La respuesta aparecerá aquí</p>
          </div>
        ) : null}
        {state.error && (
          <div role="alert" className="mt-4 flex items-start gap-2 border border-[#ff4562]/20 bg-[#ff4562]/[0.05] p-3 font-mono text-[10px] leading-5 text-[#ff8798]">
            <X aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}
        {!!state.response && !state.loading && (
          <div className="mt-auto flex justify-end pt-5">
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex min-h-8 items-center gap-1.5 border border-white/[0.08] px-2.5 font-mono text-[9px] uppercase tracking-widest text-[#748078] transition-colors hover:border-white/20 hover:text-[#d3ddd6] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              aria-label={`Copiar respuesta de ${provider}`}
            >
              <Copy aria-hidden="true" className="h-3 w-3" />
              Copiar
            </button>
          </div>
        )}
      </div>
      <footer className="flex items-center justify-between border-t border-white/[0.05] px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[#46514b] sm:px-5">
        <span>{accent === "green" ? "ANÁLISIS / CÓDIGO" : accent === "cyan" ? "ANÁLISIS / CONTEXTO" : "COORDINACIÓN / ORDEN FINAL"}</span>
        <span>{state.response ? `${state.response.length} caracteres` : "Ley 4105"}</span>
      </footer>
    </section>
  );
}

export default function Cortex() {
  const { currentCode, currentLanguage } = useAppContext();
  const { events } = useNeuralContext();
  const [question, setQuestion] = useState("");
  const [deepseek, setDeepseek] = useState<ProviderState>(initialProviderState);
  const [gemini, setGemini] = useState<ProviderState>(initialProviderState);
  const [openai, setOpenai] = useState<ProviderState>(initialProviderState);
  const [eventDeliveryStatus, setEventDeliveryStatus] = useState<NeuralEventDeliveryStatus | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [contextSources, setContextSources] = useState<string[]>([]);
  const [learningCount, setLearningCount] = useState(0);
  const busy = collecting || deepseek.loading || gemini.loading || openai.loading;

  const submit = async () => {
    const prompt = question.trim();
    if (!prompt || busy) return;
    setQuestion("");
    setCollecting(true);
    setDeepseek({ response: "", loading: true, error: "" });
    setGemini({ response: "", loading: true, error: "" });
    setOpenai({ response: "", loading: false, error: "" });
    setEventDeliveryStatus(null);

    let deepseekText = "";
    let geminiText = "";
    let deepseekError = "";
    let geminiError = "";
    try {
      const contextResponse = await fetch("/api/cortex/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editor: { language: currentLanguage, code: currentCode },
          activity: events.slice(0, 12).map(({ origin, eventType, content, createdAt }) => ({
            origin, eventType, content, createdAt,
          })),
        }),
      });
      const contextBody = await contextResponse.json().catch(() => null) as {
        context?: unknown; sources?: string[]; learningCount?: number; error?: string;
      } | null;
      if (!contextResponse.ok || !contextBody?.context) {
        throw new Error(contextBody?.error || "No se pudo recopilar el contexto de la terminal.");
      }
      const context = JSON.stringify(contextBody.context);
      setContextSources(contextBody.sources ?? CONTEXT_SOURCES);
      setLearningCount(contextBody.learningCount ?? 0);
      setCollecting(false);

      const deepseekTask = readDeepSeekStream(prompt, (delta) => {
        deepseekText += delta;
        setDeepseek((current) => ({ ...current, response: current.response + delta }));
      }, context).then(
        () => setDeepseek((current) => ({ ...current, loading: false })),
        (error: unknown) => setDeepseek((current) => ({
          ...current,
          loading: false,
          error: (deepseekError = error instanceof Error ? error.message : "Error de conexión con DeepSeek."),
        })),
      );
      const geminiTask = requestGemini(prompt, context).then(
        (text) => {
          geminiText = text;
          setGemini({ response: text, loading: false, error: "" });
        },
        (error: unknown) => setGemini((current) => ({
          ...current,
          loading: false,
          error: (geminiError = error instanceof Error ? error.message : "Error de conexión con Gemini."),
        })),
      );
      await Promise.all([deepseekTask, geminiTask]);
      const agentResults: OpenAiAgentResult[] = [
        {
          agent: "DeepSeek",
          status: deepseekText.trim() && !deepseekError ? "completed" : "failed",
          response: deepseekText,
          ...(deepseekError ? { error: deepseekError } : {}),
        },
        {
          agent: "Gemini",
          status: geminiText.trim() && !geminiError ? "completed" : "failed",
          response: geminiText,
          ...(geminiError ? { error: geminiError } : {}),
        },
      ];
      setOpenai({ response: "", loading: true, error: "" });
      let openaiText = "";
      let openaiError = "";
      try {
        const eventStatus = await readOpenAiStream(prompt, agentResults, (delta) => {
          openaiText += delta;
          setOpenai((current) => ({ ...current, response: current.response + delta }));
        });
        setEventDeliveryStatus(eventStatus);
        setOpenai((current) => ({
          ...current,
          loading: false,
          error: eventStatus === "delivered" ? "" : eventStatus === "persisted_only"
            ? "La orden está lista y el evento se guardó; su difusión en vivo quedó pendiente de reconexión."
            : "La orden está lista, pero no se pudo guardar el evento OpenAI-Master.",
        }));
      } catch (error) {
        openaiError = error instanceof Error ? error.message : "Error de conexión con OpenAI.";
        setOpenai((current) => ({ ...current, loading: false, error: openaiError }));
      }
      if ((deepseekText && !deepseekError) || (geminiText && !geminiError) || (openaiText && !openaiError)) {
        const saved = await fetch("/api/cortex/learning", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: prompt,
            deepseek: deepseekError ? "" : deepseekText,
            gemini: geminiError ? "" : geminiText,
            openai: openaiError ? "" : openaiText,
          }),
        });
        if (saved.ok) setLearningCount((count) => count + 1);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo recopilar el contexto.";
      setDeepseek((current) => ({ ...current, loading: false, error: message }));
      setGemini((current) => ({ ...current, loading: false, error: message }));
      setOpenai((current) => ({ ...current, loading: false }));
    } finally {
      setCollecting(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-y-auto bg-[#080b0a] text-[#cbd5ce]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(0,255,65,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,.035) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="relative mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 pb-5 pt-5 sm:px-6 sm:pt-7 lg:px-9">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[#00ff41]/10 pb-4 sm:mb-7 sm:pb-5">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[#53615a]">
              <BrainCircuit aria-hidden="true" className="h-3.5 w-3.5 text-[#00ff41]" />
              <span>Interfaz de inteligencia paralela</span>
            </div>
            <h1 className="font-mono text-xl font-bold tracking-[0.12em] text-[#e3ebe5] sm:text-2xl sm:tracking-[0.16em]">
              CORTEX MULTI-IA 4105
            </h1>
            <p className="mt-2 max-w-2xl font-mono text-[10px] leading-5 text-[#65716a] sm:text-[11px]">
              DeepSeek y Gemini analizan en paralelo; OpenAI coordina sus resultados y emite la orden final.
            </p>
          </div>
          <div className="flex items-center gap-2 border border-[#00ff41]/15 bg-[#00ff41]/[0.035] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.15em] text-[#83a88e]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00ff41]" />
            {collecting ? "Recopilando contexto" : "2 agentes → 1 orquestador"}
          </div>
        </div>

        <section aria-label="Conexiones de contexto y memoria" className="mb-4 border border-white/[0.07] bg-[#090d0c] px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.17em] text-[#8c9a91]">
              <Database aria-hidden="true" className="h-3.5 w-3.5 text-[#00e5ff]" />
              Contexto multi-interfaz
            </div>
            <span className="font-mono text-[9px] text-[#56625b]">
              Memoria persistente: {learningCount} {learningCount === 1 ? "sesión" : "sesiones"} · no entrena los modelos
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(contextSources.length ? contextSources : CONTEXT_SOURCES).map((source) => (
              <span key={source} className="border border-[#00e5ff]/10 bg-[#00e5ff]/[0.025] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[#71837e]">
                {source}
              </span>
            ))}
            <span className="border border-white/[0.06] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[#4f5c54]">
              Integrations: snapshot manual
            </span>
          </div>
        </section>

        <div className="mb-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-[#4c5851]">
          <span className="h-px w-5 bg-[#00ff41]/35" />
          Análisis paralelo + coordinación final
          <span className="text-[#313a35]">/ 01—03</span>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 xl:gap-4">
          <ResponsePanel provider="DeepSeek" tagline="Lógica y código · en streaming" accent="green" icon={Code2} state={deepseek} onCopy={() => void navigator.clipboard.writeText(deepseek.response)} />
          <ResponsePanel provider="Gemini" tagline="Investigación y contexto" accent="cyan" icon={Search} state={gemini} onCopy={() => void navigator.clipboard.writeText(gemini.response)} />
          <ResponsePanel
            provider="OpenAI · GPT-4o"
            tagline="Orquestador · sintetiza y ordena a los agentes"
            accent="violet"
            icon={BrainCircuit}
            state={openai}
            onCopy={() => void navigator.clipboard.writeText(openai.response)}
            isFinalOrder
            deliveryStatus={eventDeliveryStatus}
          />
        </div>

        <form
          className="mt-4 border border-[#00ff41]/25 bg-[#060908] shadow-[0_0_24px_rgba(0,255,65,0.035)]"
          onSubmit={(event) => { event.preventDefault(); void submit(); }}
        >
          <label htmlFor="cortex-question" className="flex items-center gap-2 border-b border-white/[0.055] px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.17em] text-[#718078]">
            <span className="h-1 w-1 bg-[#00ff41]" />
            Instrucción para el enjambre
            <span className="ml-auto text-[#414b45]">OpenAI recibe la consulta y los resultados de ambos agentes</span>
          </label>
          <div className="flex items-end">
            <textarea
              id="cortex-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              placeholder="// Escribe una instrucción para DeepSeek, Gemini y su orquestador…"
              rows={2}
              disabled={busy}
              className="min-h-[76px] flex-1 resize-y bg-transparent px-4 py-3 font-mono text-xs leading-5 text-[#cbd5ce] placeholder:text-[#3c4640] focus:outline-none disabled:opacity-50 sm:min-h-[86px] sm:text-[13px]"
              aria-describedby="cortex-input-hint"
            />
            <button
              type="submit"
              disabled={!question.trim() || busy}
              className="m-2 flex h-10 shrink-0 items-center gap-2 bg-[#00ff41] px-3.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#071008] transition-colors hover:bg-[#65ff8a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00ff41] focus-visible:ring-offset-2 focus-visible:ring-offset-[#060908] disabled:cursor-not-allowed disabled:opacity-30 sm:px-4"
            >
              <Send aria-hidden="true" className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </div>
          <div id="cortex-input-hint" className="flex justify-between border-t border-white/[0.05] px-4 py-2 font-mono text-[9px] text-[#46514a]">
            <span>ENTER para enviar <span className="mx-1 text-[#303a34]">·</span> SHIFT+ENTER para nueva línea</span>
            <span>{collecting ? "Recopilando estado de la terminal…" : deepseek.loading || gemini.loading ? "DeepSeek + Gemini analizan…" : openai.loading ? "OpenAI prepara la orden final…" : "Protocol 4105"}</span>
          </div>
        </form>
        <div aria-live="polite" className="sr-only">
          {deepseek.loading && "DeepSeek is processing"}
          {gemini.loading && "Gemini is processing"}
          {openai.loading && "OpenAI is coordinating the agents"}
          {!deepseek.loading && deepseek.response && "DeepSeek response complete"}
          {!gemini.loading && gemini.response && "Gemini response complete"}
          {!openai.loading && openai.response && "OpenAI final order complete"}
        </div>
      </div>
    </div>
  );
}

```

### artifacts/devterminal/src/pages/runner.tsx

```tsx
import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Square, Trash2, Plus, Download, CloudUpload } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateSnippet,
  useGetSnippet,
  getGetSnippetQueryKey,
  getListSnippetsQueryKey,
  getGetRecentSnippetsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useNeuralContext } from "@/lib/neural-context";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type LangConfig = {
  id: string;
  name: string;
  color: string;
  bg: string;
  border: string;
  placeholder: string;
};

const LANGS: LangConfig[] = [
  { id: "python",     name: "python",     color: "#3b82f6", bg: "#0a0f1a", border: "#1e3a5f", placeholder: `import requests\nprint(requests.get("https://httpbin.org/ip").json())` },
  { id: "bash",       name: "bash",       color: "#22c55e", bg: "#051a0a", border: "#14532d", placeholder: `echo "=== System Info ==="\nuname -a\necho "Date: $(date)"` },
  { id: "javascript", name: "javascript", color: "#f59e0b", bg: "#1a1200", border: "#713f12", placeholder: `const data = [1,2,3,4,5]\nconst doubled = data.map(x => x * 2)\nconsole.log('Doubled:', doubled)` },
  { id: "typescript", name: "typescript", color: "#60a5fa", bg: "#0a1020", border: "#1e3a5f", placeholder: `const greet = (name: string): string => \`Hello, \${name}!\`\nconsole.log(greet("DevTerminal"))` },
  { id: "rust",       name: "rust",       color: "#f97316", bg: "#1a0800", border: "#7c2d12", placeholder: `fn main() {\n    let v: Vec<i32> = (1..=7).map(|x| x * x).collect();\n    println!("Squares: {:?}", v);\n}` },
  { id: "go",         name: "go",         color: "#06b6d4", bg: "#001a1a", border: "#164e63", placeholder: `package main\nimport "fmt"\nfunc main() {\n    for i := 1; i <= 5; i++ {\n        fmt.Printf("Line %d\\n", i)\n    }\n}` },
  { id: "c",          name: "c",          color: "#a78bfa", bg: "#0d0a1a", border: "#3b0764", placeholder: `#include <stdio.h>\nint main() {\n    for(int i=1;i<=5;i++) printf("%d\\n",i);\n    return 0;\n}` },
  { id: "cpp",        name: "c++",        color: "#c084fc", bg: "#120a1a", border: "#4a044e", placeholder: `#include <iostream>\nint main() {\n    for(int i=1;i<=5;i++) std::cout << i << "\\n";\n    return 0;\n}` },
];

type PanelStatus = "idle" | "running" | "done" | "error";

type Panel = {
  id: string;
  lang: LangConfig;
  code: string;
  output: string;
  status: PanelStatus;
  execTime: number | null;
};

let panelCounter = 0;
function makePanelId() { return `panel-${++panelCounter}`; }

function makePanel(lang: LangConfig): Panel {
  return {
    id: makePanelId(),
    lang,
    code: lang.placeholder,
    output: "",
    status: "idle",
    execTime: null,
  };
}

export default function Runner() {
  const [panels, setPanels] = useState<Panel[]>([
    makePanel(LANGS[0]),
    makePanel(LANGS[1]),
  ]);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const abortRefs = useRef<Record<string, AbortController>>({});
  const loadedSnippetIdRef = useRef<string | null>(null);
  const { toast } = useToast();
  const { recordEvent } = useNeuralContext();
  const queryClient = useQueryClient();
  const createSnippetMutation = useCreateSnippet();
  const [, setLocation] = useLocation();
  const snippetId = new URLSearchParams(window.location.search).get("snippetId");
  const parsedSnippetId = snippetId ? Number(snippetId) : NaN;
  const { data: loadedSnippet, isSuccess: snippetLoaded, isError: snippetLoadFailed } = useGetSnippet(parsedSnippetId, {
    query: {
      enabled: Number.isInteger(parsedSnippetId) && parsedSnippetId > 0,
      queryKey: getGetSnippetQueryKey(parsedSnippetId),
    },
  });
  const [savingPanelIds, setSavingPanelIds] = useState<Set<string>>(() => new Set());

  const updatePanel = useCallback((id: string, patch: Partial<Panel>) => {
    setPanels(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p));
  }, []);

  useEffect(() => {
    if (!snippetId || loadedSnippetIdRef.current === snippetId) return;
    if (snippetLoadFailed) {
      loadedSnippetIdRef.current = snippetId;
      toast({ title: "No se encontró el snippet", variant: "destructive" });
      setLocation("/runner");
      return;
    }
    if (!snippetLoaded || !loadedSnippet) return;
    const lang = LANGS.find(item => item.id === loadedSnippet.language);
    if (!lang) {
      toast({ title: "No se pudo cargar", description: "El lenguaje de este snippet no está disponible en Runner.", variant: "destructive" });
    } else {
      setPanels(current => [{ ...makePanel(lang), code: loadedSnippet.code }, ...current]);
      toast({ title: "Snippet cargado en Runner", description: loadedSnippet.title });
    }
    loadedSnippetIdRef.current = snippetId;
    setLocation("/runner");
  }, [snippetId, snippetLoaded, snippetLoadFailed, loadedSnippet, setLocation, toast]);

  useEffect(() => {
    if (!snippetId) loadedSnippetIdRef.current = null;
  }, [snippetId]);

  const savePanel = useCallback((panel: Panel) => {
    if (!panel.code.trim()) {
      toast({ title: "No se pudo guardar", description: "El panel no contiene código.", variant: "destructive" });
      return;
    }
    const title = `Runner_${panel.lang.name.replace(/[^a-z0-9]+/gi, "_")}_${new Date().getFullYear()}_${Date.now()}`;
    setSavingPanelIds(current => new Set(current).add(panel.id));
    createSnippetMutation.mutate(
      { data: { title, code: panel.code, language: panel.lang.id } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSnippetsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentSnippetsQueryKey() });
          toast({ title: "Snippet guardado en Library", description: title });
        },
        onError: () => toast({ title: "No se pudo guardar el snippet", variant: "destructive" }),
        onSettled: () => setSavingPanelIds(current => {
          const next = new Set(current);
          next.delete(panel.id);
          return next;
        }),
      },
    );
  }, [createSnippetMutation, queryClient, toast]);

  const runPanel = useCallback(async (panel: Panel) => {
    const ctrl = new AbortController();
    abortRefs.current[panel.id] = ctrl;
    updatePanel(panel.id, { status: "running", output: "", execTime: null });

    const start = Date.now();
    try {
      const resp = await fetch(`${BASE_URL}/api/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: panel.lang.id, code: panel.code }),
        signal: ctrl.signal,
      });
      const data = await resp.json();
      const execTime = (Date.now() - start) / 1000;
      const out = [data.stdout, data.stderr].filter(Boolean).join("\n");
      recordEvent({
        origin: "runner",
        eventType: "code_run",
        content: `language=${panel.lang.id}; exitCode=${data.exitCode}; codeLength=${panel.code.length}`,
      });
      updatePanel(panel.id, {
        status: data.exitCode === 0 ? "done" : "error",
        output: out || "(no output)",
        execTime,
      });
    } catch (e: any) {
      if (e.name !== "AbortError") {
        recordEvent({
          origin: "runner",
          eventType: "code_run_error",
          content: `language=${panel.lang.id}; execution request failed`,
        });
      }
      if (e.name === "AbortError") {
        updatePanel(panel.id, { status: "idle", output: "[STOPPED]" });
      } else {
        updatePanel(panel.id, { status: "error", output: String(e), execTime: (Date.now() - start) / 1000 });
      }
    } finally {
      delete abortRefs.current[panel.id];
    }
  }, [recordEvent, updatePanel]);

  const stopPanel = useCallback((id: string) => {
    abortRefs.current[id]?.abort();
  }, []);

  const runAll = () => panels.forEach(p => p.status !== "running" && runPanel(p));

  const installPackage = async (langId: string, pkg: string) => {
    const isNode = langId === "javascript" || langId === "typescript";
    const lang = isNode ? "javascript" : "python";
    toast({ title: `Installing ${pkg}...` });
    try {
      const resp = await fetch(`${BASE_URL}/api/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang, packages: [pkg] }),
      });
      const data = await resp.json();
      toast({ title: data.exitCode === 0 ? `✓ ${pkg} installed` : `Failed: ${pkg}`, variant: data.exitCode === 0 ? "default" : "destructive" });
    } catch {
      toast({ title: "Install failed", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#070707]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#ff003c]/15 bg-[#060606]">
        <div>
          <h1 className="text-xs font-mono font-bold tracking-[0.25em] uppercase text-[#ff003c]" style={{ textShadow: "0 0 10px #ff003c60" }}>
            ▶ RUNNER
          </h1>
          <p className="text-[10px] font-mono text-[#333] tracking-widest uppercase">{panels.length} panels active</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runAll}
            className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase text-black bg-[#22c55e] hover:bg-[#16a34a] transition-all"
            style={{ boxShadow: "0 0 12px #22c55e50" }}
          >
            <Play className="h-3 w-3 fill-current" /> RUN ALL
          </button>
          <div className="relative">
            <button
              onClick={() => setShowLangPicker(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase text-[#ff003c]/70 border border-[#ff003c]/25 hover:border-[#ff003c]/60 hover:bg-[#ff003c]/5 transition-all"
            >
              <Plus className="h-3 w-3" /> ADD PANEL
            </button>
            {showLangPicker && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-[#0a0a0a] border border-[#ff003c]/25 shadow-xl min-w-[160px]">
                {LANGS.map(l => (
                  <button
                    key={l.id}
                    className="w-full text-left px-3 py-2 font-mono text-[11px] text-[#888] hover:bg-[#ff003c]/05 hover:text-[#ccc] flex items-center gap-2 transition-colors"
                    onClick={() => {
                      setPanels(ps => [...ps, makePanel(l)]);
                      setShowLangPicker(false);
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {panels.map(panel => (
            <PanelCard
              key={panel.id}
              panel={panel}
              onRun={() => runPanel(panel)}
              onSave={() => savePanel(panel)}
              isSaving={savingPanelIds.has(panel.id)}
              onStop={() => stopPanel(panel.id)}
              onRemove={() => setPanels(ps => ps.filter(p => p.id !== panel.id))}
              onCodeChange={code => updatePanel(panel.id, { code })}
              onLangChange={langId => {
                const l = LANGS.find(l => l.id === langId);
                if (l) updatePanel(panel.id, { lang: l });
              }}
              onInstall={installPackage}
            />
          ))}

          {/* Add panel row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
            {LANGS.map(l => (
              <button
                key={l.id}
                onClick={() => setPanels(ps => [...ps, makePanel(l)])}
                className="flex items-center gap-2 p-2.5 border border-[#111] bg-[#060606] hover:border-[#222] hover:bg-[#0a0a0a] transition-all text-left group"
              >
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: l.color, boxShadow: `0 0 6px ${l.color}80` }} />
                <span className="font-mono text-[10px] text-[#333] group-hover:text-[#666] uppercase tracking-wider">{l.name}</span>
                <Plus className="h-2.5 w-2.5 text-[#222] group-hover:text-[#444] ml-auto" />
              </button>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function PanelCard({
  panel, onRun, onSave, isSaving, onStop, onRemove, onCodeChange, onLangChange, onInstall
}: {
  panel: Panel;
  onRun: () => void;
  onSave: () => void;
  isSaving: boolean;
  onStop: () => void;
  onRemove: () => void;
  onCodeChange: (c: string) => void;
  onLangChange: (l: string) => void;
  onInstall: (lang: string, pkg: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [installPkg, setInstallPkg] = useState("");
  const { lang, status, output, execTime } = panel;

  const statusColor = status === "done" ? "#22c55e" : status === "error" ? "#ff003c" : status === "running" ? lang.color : "#333";
  const statusLabel = status === "done" ? "DONE" : status === "error" ? "ERROR" : status === "running" ? "RUNNING" : "IDLE";

  return (
    <div
      className="border overflow-hidden"
      style={{ borderColor: status === "idle" ? "#1a1a1a" : lang.border, background: lang.bg }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer"
        style={{ borderBottom: `1px solid ${lang.border}` }}
        onClick={() => setCollapsed(v => !v)}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full flex-shrink-0"
            style={{
              background: lang.color,
              boxShadow: status === "running" ? `0 0 8px ${lang.color}` : `0 0 4px ${lang.color}60`,
              animation: status === "running" ? "pulse 1s ease-in-out infinite" : undefined,
            }}
          />
          <select
            value={lang.id}
            onChange={e => { e.stopPropagation(); onLangChange(e.target.value); }}
            onClick={e => e.stopPropagation()}
            className="bg-transparent font-mono text-[11px] font-bold uppercase tracking-wider border-0 focus:outline-none cursor-pointer"
            style={{ color: lang.color }}
          >
            {LANGS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {execTime !== null && (
            <span className="font-mono text-[10px] text-[#444]">{execTime.toFixed(2)}s</span>
          )}
          <span
            className="font-mono text-[9px] px-1.5 py-0.5 tracking-widest"
            style={{ color: statusColor, border: `1px solid ${statusColor}30`, background: `${statusColor}08` }}
          >
            {statusLabel}
          </span>
          <button
            onClick={e => { e.stopPropagation(); setShowInstall(v => !v); }}
            className="p-1 text-[#333] hover:text-[#888] transition-colors"
            title="Install package"
          >
            <Download className="h-3 w-3" />
          </button>
          {status === "running" ? (
            <button
              onClick={e => { e.stopPropagation(); onStop(); }}
              className="flex items-center gap-1 px-2 py-0.5 font-mono text-[9px] tracking-wider uppercase transition-all"
              style={{ color: "#ff003c", border: "1px solid #ff003c40", background: "#ff003c08" }}
            >
              <Square className="h-2.5 w-2.5 fill-current" /> STOP
            </button>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onRun(); }}
              className="flex items-center gap-1 px-2 py-0.5 font-mono text-[9px] tracking-wider uppercase transition-all"
              style={{ color: lang.color, border: `1px solid ${lang.color}40`, background: `${lang.color}08` }}
            >
              <Play className="h-2.5 w-2.5 fill-current" /> RUN
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onSave(); }}
            disabled={isSaving}
            className="flex items-center gap-1 px-2 py-0.5 font-mono text-[9px] tracking-wider uppercase transition-all disabled:opacity-40"
            style={{ color: "#00ff9c", border: "1px solid #00ff9c40", background: "#00ff9c08" }}
            title="Guardar snippet en Library"
            aria-label={`Guardar código ${lang.name} en Library`}
          >
            <CloudUpload className="h-2.5 w-2.5" /> {isSaving ? "SAVING" : "SAVE"}
          </button>
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="p-1 text-[#222] hover:text-[#ff003c]/60 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Install bar */}
      {showInstall && (
        <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: lang.border, background: "#050505" }}>
          <Download className="h-3 w-3 flex-shrink-0" style={{ color: lang.color }} />
          <input
            value={installPkg}
            onChange={e => setInstallPkg(e.target.value)}
            placeholder={lang.id === "python" ? "pip package name..." : "npm package name..."}
            className="flex-1 bg-transparent font-mono text-xs text-[#aaa] placeholder:text-[#2a2a2a] focus:outline-none"
            onKeyDown={e => {
              if (e.key === "Enter" && installPkg.trim()) {
                onInstall(lang.id, installPkg.trim());
                setInstallPkg("");
                setShowInstall(false);
              }
            }}
          />
          <button
            onClick={() => { if (installPkg.trim()) { onInstall(lang.id, installPkg.trim()); setInstallPkg(""); setShowInstall(false); } }}
            className="font-mono text-[9px] px-2 py-0.5 tracking-wider uppercase"
            style={{ color: lang.color, border: `1px solid ${lang.color}40` }}
          >
            INSTALL
          </button>
        </div>
      )}

      {!collapsed && (
        <>
          {/* Code editor */}
          <textarea
            value={panel.code}
            onChange={e => onCodeChange(e.target.value)}
            className="w-full px-3 py-2.5 font-mono text-xs bg-transparent text-[#ccc] resize-none focus:outline-none leading-relaxed"
            style={{ minHeight: "100px", maxHeight: "240px" }}
            spellCheck={false}
            onKeyDown={e => {
              if (e.key === "Tab") {
                e.preventDefault();
                const start = e.currentTarget.selectionStart;
                const end = e.currentTarget.selectionEnd;
                const val = e.currentTarget.value;
                onCodeChange(val.substring(0, start) + "  " + val.substring(end));
                requestAnimationFrame(() => {
                  e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
                });
              }
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                onRun();
              }
            }}
          />

          {/* Output */}
          {(status !== "idle" || output) && (
            <div className="border-t" style={{ borderColor: lang.border }}>
              <div className="flex items-center justify-between px-3 py-1.5" style={{ background: "#040404" }}>
                <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: `${lang.color}60` }}>
                  ▶ OUTPUT
                </span>
                {status === "running" && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: lang.color }} />
                    <span className="font-mono text-[9px] tracking-widest uppercase" style={{ color: lang.color }}>
                      executing...
                    </span>
                  </div>
                )}
              </div>
              <pre
                className="px-3 py-2.5 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed"
                style={{
                  maxHeight: "180px",
                  overflow: "auto",
                  color: status === "error" ? "#ff6060" : "#00ff41",
                  textShadow: status === "error" ? "0 0 4px #ff404030" : "0 0 4px #00ff4120",
                  background: "#020202",
                }}
              >
                {output || (status === "running" ? " " : "")}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

```

### artifacts/devterminal/src/pages/trading.tsx

```tsx
import React from "react";
import { TrendingUp } from "lucide-react";
import { getGetTradingStatusQueryKey, useGetTradingStatus } from "@workspace/api-client-react";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const GREEN = "#00ff41";
const RED = "#ff003c";
const CYAN = "#00f0ff";

function Card({ label, children, color = CYAN }: { label: string; children: React.ReactNode; color?: string }) {
  return (
    <article className="border border-white/10 bg-[#0c1118] p-5">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[.16em]" style={{ color: CYAN }}>{label}</p>
      <div className="font-mono text-2xl font-bold tabular-nums break-words" style={{ color }}>{children}</div>
    </article>
  );
}

export default function Trading() {
  const { data, isPending, isError, isFetching } = useGetTradingStatus({
    query: {
      queryKey: getGetTradingStatusQueryKey(),
      refetchInterval: 10000,
      refetchIntervalInBackground: true,
      retry: 3,
      retryDelay: (n: number) => Math.min(1000 * 2 ** n, 8000),
    },
    request: { cache: "no-store" },
  });

  const loading = isPending && !data;
  const unknown = !data;
  const stale = isError && !!data;
  const d = data;

  const online = d ? ["online", "running", "active"].includes(d.status.trim().toLowerCase()) : false;
  const pnlColor = !d ? "#586570" : d.pnl > 0 ? GREEN : d.pnl < 0 ? RED : "#cbd4dc";
  const pos = d ? (d.position === 1 ? { t: "1 LONG", c: GREEN } : d.position === -1 ? { t: "-1 SHORT", c: RED } : { t: "0 FLAT (en espera)", c: "#cbd4dc" }) : null;
  const dash = "---";
  const ph = loading ? <span className="inline-block h-7 w-28 animate-pulse bg-white/10" aria-label="cargando" /> : dash;

  return (
    <main className="relative h-full overflow-y-auto bg-[#080b10] text-[#eef3f8]">
      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-7 sm:px-8 sm:py-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-white/10 pb-6">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.22em]" style={{ color: CYAN }}>
              <TrendingUp className="h-3.5 w-3.5" aria-hidden /> DevTerminal / Monitor de solo lectura
            </div>
            <h1 className="font-mono text-2xl font-bold tracking-[-.04em] sm:text-4xl">MÁQUINA 4105 // TRADING</h1>
          </div>
          <div className="flex items-center gap-2 border border-white/10 bg-white/[.025] px-3 py-2 font-mono text-[10px] uppercase tracking-[.14em]" role="status">
            {loading ? (
              <span className="text-[#75818d]">CONECTANDO...</span>
            ) : unknown ? (
              <span style={{ color: RED }}>DESCONECTADO / ESTADO DESCONOCIDO</span>
            ) : stale ? (
              <span style={{ color: "#ffbf69" }}>DATOS OBSOLETOS (STALE)</span>
            ) : (
              <span className="text-[#a4b1bc]">{isFetching ? "ACTUALIZANDO" : "SYNC 10 s"}</span>
            )}
          </div>
        </header>

        {isError && (
          <p role="alert" className="mb-5 border border-[#ff003c]/30 bg-[#ff003c]/[.06] px-4 py-3 font-mono text-sm text-[#ff7a92]">
            {stale
              ? "Error al actualizar: se muestran los ultimos datos recibidos, pueden estar obsoletos. Reintentando."
              : "No se pudo conectar con /api/trading-status. Estado desconocido. Reintentando."}
          </p>
        )}

        {d?.paused && (
          <p role="alert" className="mb-5 border border-[#ff003c]/50 bg-[#ff003c]/10 px-4 py-3 font-mono text-sm font-bold" style={{ color: RED }}>
            ⏸ CAPITAL &lt; $50 - BOT PAUSADO
          </p>
        )}

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Card label="Bot" color={unknown ? "#586570" : online ? GREEN : RED}>
            {unknown ? (loading ? ph : "DESCONOCIDO") : stale ? `${online ? "ONLINE" : "OFFLINE"} (stale)` : online ? "ONLINE" : "OFFLINE"}
          </Card>
          <Card label="Capital">{d ? usd.format(d.capital) : ph}</Card>
          <Card label="PnL" color={pnlColor}>
            {d ? `${d.pnl > 0 ? "+" : d.pnl < 0 ? "-" : ""}${usd.format(Math.abs(d.pnl))}` : ph}
          </Card>
          <Card label="Winrate">{d ? `${d.winrate.toFixed(1)}%` : ph}</Card>
          <Card label="Trades / Wins / Losses">
            {d ? (
              <>
                {d.trades} <span className="text-base text-[#75818d]">/</span> <span style={{ color: GREEN }}>{d.wins}W</span>{" "}
                <span className="text-base text-[#75818d]">/</span> <span style={{ color: RED }}>{d.losses}L</span>
              </>
            ) : ph}
          </Card>
          <Card label="Posicion" color={pos?.c ?? "#586570"}>{pos ? pos.t : ph}</Card>
        </section>

        <footer className="mt-6 border-t border-white/[.07] pt-4 font-mono text-[9px] uppercase tracking-[.12em] text-[#626f7a]">
          Solo lectura · sondeo cada 10 s · sin controles de operacion
        </footer>
      </div>
    </main>
  );
}

```

## 8. Flujo principal de datos

1. El cliente React llama al API desde rutas relativas al base path, mediante cliente generado React Query.
2. Express valida la solicitud; operaciones persistentes usan Drizzle/Postgres. Para llamadas de agentes, el flujo incluye idempotencia, circuit breaker, evidencia/contexto, proveedor, validación de respuesta y persistencia/outcome por agente.
3. El circuit breaker se comparte por agente entre endpoints del enjambre; 3 fallos consecutivos abren el circuito, recovery timeout de 30 s permite sondeo HALF-OPEN. La puntuación de fiabilidad de agente deriva de su propio contador de tareas, no del valor global del motor.
4. neural_events se persiste en Postgres y se distribuye por transporte/SSE. El terminal usa WebSocket/PTY.
5. Motor 5.5 es simulación/telemetría sintética. El bot Python Máquina 4105 corre separado y el panel solo consulta JSON de estado; no arranca el proceso ni opera trades.

## 9. Rutas sensibles cuyo cuerpo se omite

No se incluye código completo de artifacts/api-server/src/routes/execute.ts, autorun.ts, deepseek.ts, deepseek-tools.ts ni terminal.ts. Contienen superficie de ejecución de código, herramientas que pueden escribir/ejecutar acciones y acceso a PTY. Para una migración autorizada, abre esos archivos en el checkout privado y valida autenticación/autorización, sandbox, límites de recursos, paths, secretos y condiciones de carrera antes de exponerlos. La descripción de API de alto nivel no constituye una guía para acceder a ellos.

## 10. Diferenciar código verificado de contexto/propuestas

- docs/motor-4105-orquestador-system-prompt.md es una especificación documental; no está instalada como system prompt activo.
- La Ley 4105 y el diagrama de capas describen objetivos, no hechos observados ni indicadores matemáticos medidos.
- snippet-execution devuelve salida fija simulada; no compila ni ejecuta el snippet.
- last_omega nullable conserva desconocido como NULL sin tareas medidas.
- Trading status es solo lectura; el bot paper no se inició durante la preparación del panel. No asumir Coinbase CDP real, hardware ESP32 ni conexión de cuenta.
- Una llamada previa a /api/ai/chat con clave idempotency no UUID respondió 400: el contrato exige UUID. No repetirla con claves arbitrarias ni considerar que ejecutó el agente.

## 11. Arranque local cauteloso

```bash
pnpm install --frozen-lockfile
# Provisiona Postgres y añade DATABASE_URL/PORT y credenciales requeridas mediante un gestor de secretos
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/devterminal run dev
```

No arranques workers externos, bot de trading, endpoints de ejecución ni herramientas autónomas durante la instalación. Revisa primero `pnpm run typecheck`, pruebas relevantes y efectos de cualquier sincronización de DB.

---

Handoff redactado a partir del árbol y código del workspace; no incluye secretos, .env, datos de usuario, archivos de estado ni contenido del respaldo SQL.