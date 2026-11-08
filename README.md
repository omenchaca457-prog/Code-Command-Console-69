# DevTerminal 2.0

Réplica mejorada de [Code-Command-Console-69](https://github.com/omenchaca457-prog/Code-Command-Console-69), basada en el commit `a0a5d986633b51371d2f39ffbe6e570ba3d8d566`.

Conserva los módulos del proyecto original: terminal PTY, editor, Runner, biblioteca, asistente DeepSeek, agentes, Cortex, Creator, red neuronal, simulador Motor 5.5, monitor Trading 4105 y herramientas.

## Qué mejora

- Vista general con accesos a los módulos, snippets recientes y actividad real.
- Navegación lateral adaptable, menú móvil, controles de teclado y paleta `Ctrl+K` / `⌘K`.
- Estado de PostgreSQL y configuración de proveedores consultados al servidor. La existencia de una credencial no implica que se haya validado con el proveedor.
- Borrador del editor recuperable tras recargar y exportación de la biblioteca a JSON.
- Editor Monaco y sus workers servidos por la aplicación, sin depender de un CDN.
- Carga de cada módulo bajo demanda y aislamiento de fallos entre páginas.
- El servidor arranca sin exigir las integraciones opcionales de OpenAI/Replit.
- Proxy de API y WebSocket para desarrollo, rutas de terminal portables y reconexión corregida.
- Respuestas de IA renderizadas como texto y elementos React, evitando interpretar HTML recibido.
- Corregido el fallo del contexto neuronal cuando el servidor devuelve datos inesperados.
- Build y comandos de pruebas compatibles con el monorepo fuera de Replit.

## Requisitos

Node.js 24+, pnpm 11.25.0 y PostgreSQL. Para levantar PostgreSQL con el archivo incluido, instala Docker con Compose. La terminal necesita un sistema Unix y las herramientas de compilación de `node-pty` (Python 3, `make` y un compilador C/C++). Cada lenguaje necesita su propio runtime; Node.js y Python 3 permiten ejecutar los ejemplos principales.

## Ejecutar

Desde la raíz del proyecto:

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install
cp .env.example .env
docker compose up -d database
pnpm db:push
pnpm dev
```

Abre **http://localhost:21612**. La API escucha por defecto en el puerto 3000. Si usas otro PostgreSQL, configura `DATABASE_URL` en `.env` antes de ejecutar `pnpm db:push`. La base de datos debe estar disponible antes del arranque.

Los puertos pueden cambiarse con `WEB_PORT` y `API_PORT`. `pnpm dev` carga `.env` y transmite la configuración a ambos servicios. La terminal se abre en la raíz del workspace.

## DeepSeek e integraciones

Configura una **clave nueva** de DeepSeek en la variable `DEEPSEEK_API_KEY` del servidor (o en el `.env` local ignorado por Git) y reinicia `pnpm dev`. La clave compartida en la conversación no se ha guardado, incluido en el código ni utilizado para solicitudes reales.

La pantalla **Configuración** muestra qué proveedores tienen una credencial configurada, sin devolver su valor al navegador. El chat usa la integración original de DeepSeek. Los botones originales de análisis/optimización del editor y la orquestación de OpenAI requieren `OPENAI_API_KEY`; Gemini requiere `GEMINI_API_KEY`. La generación y persistencia de imágenes conserva la integración de Replit App Storage y necesita su configuración original. Ningún proveedor se activa automáticamente con una clave de otro proveedor.

El editor, la terminal, la biblioteca y el simulador funcionan sin una clave de IA. El monitor de trading conserva su función de lectura; no se ejecutó el bot ni se enviaron operaciones.

## Verificar

```bash
pnpm typecheck
pnpm build
pnpm test
```

`pnpm test` ejecuta las pruebas del servidor y del frontend sin llamar a proveedores de IA reales. Las dos pruebas opcionales de PostgreSQL se activan cuando `DATABASE_URL` está definido en el proceso de pruebas; utiliza una base dedicada para pruebas.

También se comprobaron con Chromium: ejecución real de Python, guardado y consulta de snippets, exportación JSON, persistencia del borrador, paleta de comandos, shell PTY, reconexión, navegación de todos los módulos, menú móvil, recuperación 404 y funcionamiento de la interfaz con servicios caídos.

## Alcance de la entrega

El ZIP contiene el código fuente, su lockfile y esta guía. No incluye dependencias instaladas, el historial Git, bases de datos, volcados SQL, credenciales, archivos adjuntos históricos ni el ZIP de exportación antiguo. Los datos de comprobación se crearon en una base PostgreSQL aislada. La entrega está en la rama `replica/devterminal-2` del repositorio privado, con un PR en borrador para revisión. La rama `main` no se modificó.

La aplicación abre una shell real y ejecuta código en el servidor. Úsala en un entorno local o con acceso controlado; su API original no incorpora autenticación para una publicación abierta en Internet.

## Capturas y evidencia

- [Vista de escritorio](docs/devterminal-2/escritorio.png).
- [Vista móvil](docs/devterminal-2/movil.png).
- [Resultados de validación](docs/devterminal-2/validacion.json).
