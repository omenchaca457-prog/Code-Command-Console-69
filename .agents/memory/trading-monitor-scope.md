---
name: Máquina 4105 monitoring scope
description: Ownership and scope of the Python trading bot integration.
---

La Máquina 4105 es un bot Python cuyo archivo de estado lo aportará el usuario. La integración solicitada es un monitor de solo lectura, no un nuevo motor de trading.

**Why:** El usuario pidió conectar el estado de su bot existente a DevTerminal, no implementar estrategias, ejecutar órdenes ni sustituir el bot.

**How to apply:** Mantener separados el monitor y la ejecución del bot. No convertir los valores iniciales offline en evidencia de capital real ni confundir métricas de trading con la simulación sintética Motor 5.5.
