import { Router } from "express";

const router = Router();

const DISABLED_RESPONSE = {
  error: "La ejecución de código y la instalación de paquetes están desactivadas por seguridad.",
  code: "execution_disabled",
  reason: "No hay autenticación de usuario ni un aislamiento de procesos verificado.",
};

const LANGUAGES = [
  { id: "javascript", name: "JavaScript", extension: "js", monacoLanguage: "javascript" },
  { id: "typescript", name: "TypeScript", extension: "ts", monacoLanguage: "typescript" },
  { id: "python", name: "Python", extension: "py", monacoLanguage: "python" },
  { id: "bash", name: "Bash", extension: "sh", monacoLanguage: "shell" },
  { id: "c", name: "C", extension: "c", monacoLanguage: "c" },
  { id: "cpp", name: "C++", extension: "cpp", monacoLanguage: "cpp" },
  { id: "perl", name: "Perl", extension: "pl", monacoLanguage: "perl" },
  { id: "rust", name: "Rust", extension: "rs", monacoLanguage: "rust" },
  { id: "go", name: "Go", extension: "go", monacoLanguage: "go" },
];

router.get("/languages", (_req, res) => {
  res.json({ languages: LANGUAGES });
});

router.post(["/execute", "/install"], (req, res) => {
  req.log?.warn(
    { path: req.path, event: "execution_blocked" },
    "Solicitud de ejecución bloqueada: no hay autenticación ni sandbox verificado",
  );
  res.setHeader("Cache-Control", "no-store");
  res.status(503).json(DISABLED_RESPONSE);
});

export default router;
