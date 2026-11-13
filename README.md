# DevTerminal independiente

Copia de la versión aprobada en Replit (073390e3), recuperada en 50901da. Conserva los módulos y restricciones funcionales originales. No necesita servicios de Replit.

## Arranque

Copia `.env.example` a `.env` y define APP_PASSWORD. Ejecuta `docker compose up -d --build` y abre http://localhost:3000. PostgreSQL y archivos locales usan volúmenes persistentes.

Sin Docker: Node24, pnpm10.26.1 y PostgreSQL; configura `.env`, ejecuta `pnpm install`, `pnpm build` y `pnpm start`. El arranque aplica las migraciones originales. Neon es opcional.

## Alcance

Conserva terminal, editor, Runner, biblioteca, IA, agentes, Cortex, Creator, red neuronal, Motor, Trading y herramientas. Las restricciones de ejecución, PTY y AUTO de la última versión aprobada se conservan; no se presentan como reactivadas. Las imágenes se guardan en DATA_DIR/creator. DeepSeek, OpenAI y Gemini usan sus propias credenciales del servidor. No se copiaron secretos ni datos privados. Para migrar imágenes anteriores, copia los PNG conservando sus identificadores.

Fuentes y Monaco son locales. Incluye acceso con sesión y contraseña, comprobación de origen, almacenamiento local y preparación Docker.

## Validación

Las siete pruebas de acceso y almacenamiento local pasan. La construcción Docker completa queda pendiente: el entorno agotó el espacio de disco.
