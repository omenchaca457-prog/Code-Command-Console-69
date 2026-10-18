import { Router } from "express";
import { spawn } from "child_process";
import { writeFile, mkdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const installedPkgs = new Set<string>();

type SseEvent =
  | { step: "scan"; msg: string }
  | { step: "analysis"; issues: string[]; packages: string[]; hasChanges: boolean; explanation: string }
  | { step: "fix"; msg: string; fixedCode: string }
  | { step: "install"; msg: string; package: string }
  | { step: "installed"; msg: string; package: string }
  | { step: "install_error"; msg: string }
  | { step: "run"; msg: string; attempt: number }
  | { step: "output"; stdout: string; stderr: string; exitCode: number; executionTime: number }
  | { step: "retry"; msg: string; attempt: number; fixedCode: string }
  | { step: "done"; msg: string; exitCode: number; totalTime: number }
  | { step: "error"; msg: string };

router.post("/ai/auto-run", async (req, res) => {
  const { code, language, consent } = req.body as {
    code: string;
    language: string;
    consent?: boolean;
  };

  if (consent !== true) {
    res.status(403).json({
      error: "Auto-run está desactivado. Inícialo manualmente desde la interfaz para dar permiso.",
    });
    return;
  }
  if (!code?.trim() || !language) {
    res.status(400).json({ error: "Falta código o lenguaje." });
    return;
  }

  // SSE setup
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: SseEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const startTime = Date.now();
  const MAX_RETRIES = 3;
  let currentCode = code;
  let attempt = 0;

  try {
    // STEP 1: AI Pre-scan
    send({ step: "scan", msg: `🔍 Analizando código ${language} antes de ejecutar...` });

    const analysis = await aiAnalyze(currentCode, language);

    send({
      step: "analysis",
      issues: analysis.issues,
      packages: analysis.packages,
      hasChanges: analysis.hasChanges,
      explanation: analysis.explanation,
    });

    // STEP 2: Apply fix if needed
    if (analysis.hasChanges && analysis.fixedCode.trim()) {
      currentCode = analysis.fixedCode;
      send({ step: "fix", msg: `🔧 Código corregido automáticamente`, fixedCode: currentCode });
    }

    // STEP 3: Install missing packages
    for (const pkg of analysis.packages) {
      if (installedPkgs.has(pkg)) continue;
      send({ step: "install", msg: `📦 Instalando ${pkg}...`, package: pkg });
      try {
        const installCmd = getInstallCmd(language, pkg);
        if (installCmd) {
          await runProcess(installCmd.cmd, installCmd.args, 90000);
          installedPkgs.add(pkg);
          send({ step: "installed", msg: `✅ ${pkg} instalado`, package: pkg });
        }
      } catch {
        send({ step: "install_error", msg: `⚠️ No se pudo instalar ${pkg}` });
      }
    }

    // STEP 4: Execute loop
    while (attempt < MAX_RETRIES) {
      attempt++;
      send({ step: "run", msg: `▶ Ejecutando... (intento ${attempt}/${MAX_RETRIES})`, attempt });

      const execStart = Date.now();
      const result = await executeCode(currentCode, language);
      const execTime = Date.now() - execStart;

      send({
        step: "output",
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTime: execTime,
      });

      // Success
      if (result.exitCode === 0) {
        send({
          step: "done",
          msg: `✅ Ejecución exitosa en ${((Date.now() - startTime) / 1000).toFixed(2)}s`,
          exitCode: 0,
          totalTime: Date.now() - startTime,
        });
        break;
      }

      // Error — try to auto-fix if retries remain
      if (attempt < MAX_RETRIES) {
        const errorFix = await aiFixError(currentCode, language, result.stderr, result.stdout);

        if (errorFix.fixedCode && errorFix.hasChanges) {
          currentCode = errorFix.fixedCode;

          // Install any new packages found
          for (const pkg of errorFix.packages) {
            if (installedPkgs.has(pkg)) continue;
            send({ step: "install", msg: `📦 Instalando ${pkg}...`, package: pkg });
            try {
              const installCmd = getInstallCmd(language, pkg);
              if (installCmd) {
                await runProcess(installCmd.cmd, installCmd.args, 90000);
                installedPkgs.add(pkg);
                send({ step: "installed", msg: `✅ ${pkg} instalado`, package: pkg });
              }
            } catch {
              send({ step: "install_error", msg: `⚠️ No se pudo instalar ${pkg}` });
            }
          }

          send({
            step: "retry",
            msg: `🔄 Error corregido — reintentando (${attempt + 1}/${MAX_RETRIES})`,
            attempt: attempt + 1,
            fixedCode: currentCode,
          });
        } else {
          // AI couldn't fix it
          send({
            step: "done",
            msg: `❌ Error no corregible después de ${attempt} intento(s)`,
            exitCode: result.exitCode,
            totalTime: Date.now() - startTime,
          });
          break;
        }
      } else {
        send({
          step: "done",
          msg: `❌ Falló después de ${MAX_RETRIES} intentos`,
          exitCode: result.exitCode,
          totalTime: Date.now() - startTime,
        });
      }
    }
  } catch (err) {
    send({ step: "error", msg: `Error fatal: ${err instanceof Error ? err.message : String(err)}` });
  }

  res.end();
});

async function aiAnalyze(code: string, language: string): Promise<{
  packages: string[];
  issues: string[];
  fixedCode: string;
  hasChanges: boolean;
  explanation: string;
}> {
  const prompt = `Eres un analizador de código autónomo de élite. Analiza este código ${language} ANTES de ejecutarlo.

Tu misión:
1. Detecta TODOS los imports/librerías faltantes que necesitan instalarse
2. Encuentra errores de sintaxis, errores de runtime, bugs lógicos
3. Corrige el código para que funcione perfectamente

Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto extra):
{
  "packages": ["paquete1", "paquete2"],
  "issues": ["descripción del problema 1", "descripción del problema 2"],
  "fixedCode": "código completo corregido aquí",
  "hasChanges": true,
  "explanation": "qué se corrigió y por qué"
}

Si el código está perfecto: packages=[], issues=[], hasChanges=false, fixedCode igual al original.

Código ${language}:
\`\`\`${language}
${code}
\`\`\``;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    max_completion_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    const cleaned = raw.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { packages: [], issues: [], fixedCode: code, hasChanges: false, explanation: "No se pudo analizar" };
  }
}

async function aiFixError(code: string, language: string, stderr: string, stdout: string): Promise<{
  packages: string[];
  fixedCode: string;
  hasChanges: boolean;
  explanation: string;
}> {
  const prompt = `Eres un debugger autónomo. El siguiente código ${language} falló con este error. Corrígelo.

ERROR:
\`\`\`
${stderr.slice(0, 2000)}
\`\`\`

STDOUT:
\`\`\`
${stdout.slice(0, 500)}
\`\`\`

CÓDIGO:
\`\`\`${language}
${code}
\`\`\`

Responde ÚNICAMENTE con JSON válido:
{
  "packages": ["paquetes adicionales si necesita"],
  "fixedCode": "código completamente corregido aquí",
  "hasChanges": true,
  "explanation": "qué causó el error y cómo se corrigió"
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    max_completion_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    const cleaned = raw.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { packages: [], fixedCode: code, hasChanges: false, explanation: "No se pudo corregir" };
  }
}

function getInstallCmd(language: string, pkg: string): { cmd: string; args: string[] } | null {
  if (language === "python") {
    return { cmd: "pip3", args: ["install", "--quiet", "--break-system-packages", mapPyPkg(pkg)] };
  }
  if (language === "javascript" || language === "typescript") {
    return { cmd: "npm", args: ["install", "--no-save", "--quiet", pkg] };
  }
  return null;
}

function mapPyPkg(mod: string): string {
  const MAP: Record<string, string> = {
    cv2: "opencv-python", PIL: "Pillow", sklearn: "scikit-learn",
    skimage: "scikit-image", yaml: "pyyaml", bs4: "beautifulsoup4",
    dotenv: "python-dotenv", serial: "pyserial", requests: "requests",
    numpy: "numpy", pandas: "pandas", matplotlib: "matplotlib",
    scipy: "scipy", flask: "flask", fastapi: "fastapi", aiohttp: "aiohttp",
    httpx: "httpx", sqlalchemy: "sqlalchemy", psycopg2: "psycopg2-binary",
    redis: "redis", celery: "celery", pydantic: "pydantic",
    jwt: "PyJWT", crypto: "pycryptodome", paramiko: "paramiko",
    scapy: "scapy", nmap: "python-nmap", shodan: "shodan",
  };
  return MAP[mod] || mod;
}

async function executeCode(code: string, language: string): Promise<{
  stdout: string; stderr: string; exitCode: number
}> {
  const tmpDir = join(tmpdir(), `autorun-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(tmpDir, { recursive: true });

  try {
    let cmd: string;
    let args: string[];

    if (language === "python") {
      const f = join(tmpDir, "script.py");
      await writeFile(f, code, "utf8");
      cmd = "python3"; args = [f];
    } else if (language === "javascript") {
      const f = join(tmpDir, "script.js");
      await writeFile(f, code, "utf8");
      cmd = "node"; args = [f];
    } else if (language === "typescript") {
      const f = join(tmpDir, "script.ts");
      await writeFile(f, code, "utf8");
      cmd = "npx"; args = ["--yes", "tsx", f];
    } else if (language === "bash") {
      const f = join(tmpDir, "script.sh");
      await writeFile(f, `#!/bin/bash\n${code}`, "utf8");
      cmd = "bash"; args = [f];
    } else if (language === "go") {
      const f = join(tmpDir, "main.go");
      await writeFile(f, code, "utf8");
      cmd = "go"; args = ["run", f];
    } else if (language === "rust") {
      const f = join(tmpDir, "main.rs");
      await writeFile(f, code, "utf8");
      const out = join(tmpDir, "main");
      const c = await runProcess("rustc", [f, "-o", out], 30000);
      if (c.exitCode !== 0) return c;
      cmd = out; args = [];
    } else if (language === "c") {
      const f = join(tmpDir, "script.c");
      await writeFile(f, code, "utf8");
      const out = join(tmpDir, "a.out");
      const c = await runProcess("gcc", [f, "-o", out, "-lm"], 15000);
      if (c.exitCode !== 0) return c;
      cmd = out; args = [];
    } else if (language === "cpp") {
      const f = join(tmpDir, "script.cpp");
      await writeFile(f, code, "utf8");
      const out = join(tmpDir, "a.out");
      const c = await runProcess("g++", [f, "-o", out, "-std=c++17", "-lm"], 15000);
      if (c.exitCode !== 0) return c;
      cmd = out; args = [];
    } else {
      return { stdout: "", stderr: `Unsupported language: ${language}`, exitCode: 1 };
    }

    return await runProcess(cmd!, args!, 60000);
  } finally {
    try { await rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

function runProcess(cmd: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      env: { ...process.env, HOME: process.env.HOME || "/root", NODE_ENV: "production" },
    });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); }, timeoutMs);
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ stdout, stderr, exitCode: code ?? 1 }); });
    child.on("error", (err) => { clearTimeout(timer); resolve({ stdout: "", stderr: err.message, exitCode: 1 }); });
  });
}

export default router;
