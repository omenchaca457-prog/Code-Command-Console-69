# Telemetría del Motor 5.5 y Ω operativo

El Motor se inicia con el servidor, sin depender de una pestaña abierta.
El control explícito STOP sigue deteniéndolo hasta START o reiniciar el servicio.
Cada 100 ms genera una muestra; fallos de generación o de un suscriptor
no terminan el ciclo. Los clientes SSE lentos descartan muestras intermedias,
en vez de acumular una cola de escritura ilimitada.

`high_coherence` se persiste y transmite desde el servidor para muestras
reales superiores a 95%, con un máximo de un evento por segundo y una
publicación en curso. No se inventan eventos cuando no hay muestras válidas.
La página del simulador ya no duplica esos eventos. Los fallos de persistencia
se registran sin bloquear la generación de muestras.

## Ω por agente

`last_omega = successful_tasks / (successful_tasks + failed_tasks)`.
Los contadores son propios de cada agente y se actualizan atómicamente.
Los rechazos por circuito abierto no cuentan como nuevas tareas fallidas.
Una respuesta sin evidencia no acredita una tarea exitosa.

Este Ω expresa **fiabilidad operativa**, no la coherencia global del Motor,
el juicio Ω de un modelo, el rendimiento financiero ni una certificación del Sello S.
Dos agentes pueden tener legítimamente el mismo ratio si sus resultados coinciden.
Los contadores comienzan en cero: no se infiere éxito de XP ni de datos antiguos.
Sin observaciones nuevas, `/agents` devuelve Ω desconocido aunque conserve
un valor legado en almacenamiento.

Migración aditiva: `scripts/agent-task-outcomes-migration.sql`.
No elimina datos ni reescribe los fallos históricos.

## DeepSeek

La ruta ya emitía tokens SSE. La preparación de contexto ahora ejecuta todas
las lecturas en paralelo, con dos segundos de límite por lectura y un marcador
explícito de indisponibilidad si falla. Emite inmediatamente un comentario
de conexión SSE, mantiene el transporte con heartbeats y limita la consulta
completa a 90 segundos. El SDK mantiene su timeout de conexión/proveedor de
45 segundos. La latencia hasta el primer token del proveedor sigue siendo
externa; no se simulan tokens durante esa espera.

Si la consulta supera 2000 ms, se registra un `warn`
`deepseek_latency_degraded` y se emite un evento SSE `telemetry` con
`type: latency_warning` y `status: degraded`. El HTTP 200 de un flujo ya
abierto no se interpreta como una medición de salud o rendimiento.

## Caché y estado del orquestador

Los endpoints de agentes, Motor, eventos neuronales y contexto usan
`Cache-Control: no-store, no-transform`; los validadores antiguos no producen
respuestas 304 para esas lecturas de telemetría.

Al iniciar se reconcilia `last_omega` de los tres agentes supervisados con sus
propios contadores; sin observaciones, se guarda NULL y se muestra N/D.
ORQUESTADOR-OPENAI se inicializa en `idle`, pasa a `active` durante una
coordinación y vuelve a `idle` al terminar, incluso ante fallo. El evento
de una orden completada se conserva por separado del estado actual del nodo.
