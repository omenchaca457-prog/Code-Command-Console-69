# Disyuntor del Agent Swarm

El circuito es compartido por `/api/ai/chat` y
`/api/agents/simulated-analysis`, separado por identificador de agente
(incluidos `optimizer`, `security` y `coherence`).

## Configuración

La instancia de producción se configura en `agent-swarm-circuit.ts`:

```ts
new AgentCircuitBreaker({
  failureThreshold: 3,
  recovery_timeout: 30_000, // milisegundos
  onTransition(event) { /* registro y alerta */ },
});
```

Ambos valores deben ser enteros positivos. La clase admite un reloj inyectable
para pruebas deterministas; no se modifica el reloj de producción.

## Estados y recuperación

- **CLOSED**: una tarea por agente; el éxito completo reinicia el contador.
- **OPEN**: tres fallos consecutivos o una violación de seguridad verificada.
  Se rechazan nuevas ejecuciones con HTTP 503, `retryAfterMs` y `Retry-After`.
  Los rechazos no ejecutan el proveedor ni incrementan los fallos.
- **HALF-OPEN**: al vencer el enfriamiento, la siguiente consulta/ejecución
  cambia automáticamente a auditoría. Solo admite una tarea de prueba.
  Si valida y persiste su resultado, vuelve a CLOSED; si falla, vuelve a OPEN
  durante todo el tiempo de recuperación. No inicia tareas sin una petición.

Se validan las respuestas antes de almacenar el resultado del modelo:
contenido no vacío, terminación completa, payload JSON coincidente con las
métricas del servidor, cita del código y Ω válido cuando hay evidencia.
Modificar parámetros verificables abre el circuito inmediatamente.
Las tareas sintéticas validan identidad, vector y coherencia del payload.
Su Ω operativo proviene exclusivamente del historial de tareas del agente,
no de la coherencia del motor.
El circuito cubre también excepciones y errores de persistencia.

Las transiciones generan registros estructurados con agente, estado anterior,
estado nuevo, fallos consecutivos, motivo y enfriamiento. También se intenta
guardar y transmitir un evento neural. Un fallo al entregar esa alerta no
desactiva el disyuntor y se registra por separado.

## Alcance de seguridad

- No se confunde la fidelidad del payload con una prueba física del **Sello S**.
  Sin evidencia verificable, Ω sigue siendo desconocido. Una auditoría de IA
  sin evidencia no permite cerrar el circuito.
- Los agentes de estas rutas analizan código; no aplican modificaciones
  autónomas al repositorio. El disyuntor no es un monitor de integridad de
  archivos ni puede revertir efectos externos ya producidos.
- El estado reside en memoria **por proceso** y se reinicia al reiniciar el
  servidor. Varias réplicas no comparten bloqueo. Las alertas sí se persisten
  cuando la base de datos está disponible.
