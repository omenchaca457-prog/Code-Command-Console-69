if (!process.env.npm_config_user_agent?.startsWith("pnpm/")) {
  process.stderr.write("Este proyecto utiliza pnpm. Ejecuta pnpm install.\n");
  process.exitCode = 1;
}
