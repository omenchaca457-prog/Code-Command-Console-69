# Máquina 4105 — integración PAPER con DevTerminal

El bot fue preparado a partir del archivo adjunto del usuario. No se ha arrancado
ni se han consultado precios durante su preparación. No existe un workflow que
lo inicie automáticamente. No envía órdenes reales y no requiere claves de API.

## Archivos

- `maquina_4105_v32.py`: estrategia PAPER original y ciclo de ejecución.
- `maquina_4105_state.py`: persistencia del estado, sin conexiones de red.
- `requirements-trading.txt`: dependencias Python (`requests`, `numpy`).
- `maquina_4105_state.json`: lo genera el bot cuando se arranca explícitamente.
  No se creó un saldo ficticio ni se sobrescribió un estado existente al preparar
  esta integración.

La instalación de las dependencias debe usar el gestor de paquetes del entorno.
Cuando el operador decida iniciar el bot, el comando desde la raíz es:

```sh
python maquina_4105_v32.py
```

Ese comando **sí inicia la simulación y hace consultas públicas a Coinbase**.
No ejecutarlo para verificar únicamente el formato del estado.

## Contrato del monitor

El JSON se escribe junto a `maquina_4105_state.py`, independientemente del
directorio actual de la terminal. La API y Python deben compartir ese archivo y
el mismo sistema de archivos; un bot en otra máquina no actualiza este panel
automáticamente.

El archivo conserva los datos originales y añade:

- `status`: `online` mientras corre el proceso; `offline` en cierre controlado.
- `winrate`: `wins / trades * 100`, o `0` cuando no hay trades.
- `mode`: `paper`.
- `saved_at`: fecha UTC con zona horaria.

Se guarda al arrancar, en cada ciclo y al salir. La API sigue consultándose desde
el panel cada 10 segundos; el ciclo normal del bot espera 30 segundos, además del
tiempo empleado en obtener precios. Estar `online` no garantiza que Coinbase
esté proporcionando datos válidos.

`paused` es independiente del estado del proceso: el bot puede estar online y
pausado. La alerta del panel sigue dependiendo de ese campo.

El guardado utiliza un temporal en el mismo directorio y reemplazo atómico.
Un estado corrupto o incompleto impide el arranque: no se sustituye silenciosamente
por una cuenta nueva de $100. Los estados antiguos sin `status` o `winrate` se
pueden cargar y se completan en el siguiente guardado.

## Límites que no cambia esta integración

Se mantienen la estrategia, los umbrales y la comisión **0.25%** más el slippage
**0.15%**, aplicados en entrada y salida como en el original.

`trades` cuenta entradas, incluida una posición abierta. El winrate conserva ese
denominador, no el número exclusivo de operaciones cerradas. `capital` descuenta
el importe comprometido durante una posición abierta: no representa el patrimonio
total marcado a mercado, y su diferencia frente a $100 no es necesariamente PnL
realizado. Wins/losses siguen usando el PnL bruto original, no una auditoría neta
de ambos costos. Esta conexión al panel no valida la rentabilidad de la estrategia.

Un cierre forzoso (`SIGKILL`, caída del equipo) no puede escribir `offline`.
En ese caso debe comprobarse `saved_at`; la detección automática de heartbeat
vencido no forma parte del monitor actual.

## Pruebas sin iniciar el bot

```sh
python -m unittest discover -s scripts -p test_maquina_4105_state.py -v
```

Estas pruebas solo usan la persistencia estándar de Python, archivos temporales
y análisis de sintaxis; no importan el módulo del bot ni hacen llamadas de red.
