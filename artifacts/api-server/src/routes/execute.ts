import { Router } from "express";
import { spawn, exec } from "child_process";
import { writeFile, mkdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { ExecuteCodeBody } from "@workspace/api-zod";

const execAsync = promisify(exec);
const router = Router();

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

const TIMEOUT_MS = 60000;

// Track auto-installed packages to avoid reinstalling
const installedPythonPkgs = new Set<string>();
const installedNpmPkgs = new Set<string>();

router.get("/languages", (_req, res) => {
  res.json({ languages: LANGUAGES });
});

// Manual install endpoint
router.post("/install", async (req, res) => {
  const { language, packages } = req.body as { language: string; packages: string[] };
  if (!language || !packages?.length) {
    res.status(400).json({ error: "Missing language or packages" });
    return;
  }

  const startTime = Date.now();
  let installLog = "";
  let exitCode = 0;

  try {
    if (language === "python" || language === "pip") {
      installLog += `[INSTALL] pip install ${packages.join(" ")}\n`;
      const result = await runProcess("pip3", ["install", "--quiet", "--break-system-packages", ...packages], "", 90000);
      installLog += result.stdout || result.stderr;
      exitCode = result.exitCode;
      if (exitCode === 0) packages.forEach(p => installedPythonPkgs.add(p));
    } else if (language === "javascript" || language === "typescript" || language === "npm") {
      installLog += `[INSTALL] npm install ${packages.join(" ")}\n`;
      const result = await runProcess("npm", ["install", "--no-save", "--quiet", ...packages], "", 90000);
      installLog += result.stdout || result.stderr;
      exitCode = result.exitCode;
      if (exitCode === 0) packages.forEach(p => installedNpmPkgs.add(p));
    } else {
      res.status(400).json({ error: `Package install not supported for ${language}` });
      return;
    }
  } catch (e) {
    exitCode = 1;
    installLog += String(e);
  }

  res.json({
    stdout: installLog,
    stderr: "",
    exitCode,
    executionTime: (Date.now() - startTime) / 1000,
  });
});

router.post("/execute", async (req, res) => {
  const parsed = ExecuteCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { language, code, stdin } = parsed.data;
  const startTime = Date.now();

  const tmpDir = join(tmpdir(), `devterm-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  try {
    await mkdir(tmpDir, { recursive: true });

    let cmd: string;
    let args: string[];
    let filePath: string;
    let preOutput = "";

    if (language === "javascript") {
      filePath = join(tmpDir, "script.js");
      await writeFile(filePath, code, "utf8");
      cmd = "node";
      args = [filePath];

      // Auto-install missing npm packages
      const result = await runProcess(cmd, args, stdin ?? "", TIMEOUT_MS);
      const cannotFind = extractNpmMissing(result.stderr);
      if (result.exitCode !== 0 && cannotFind.length > 0) {
        const toInstall = cannotFind.filter(p => !installedNpmPkgs.has(p));
        if (toInstall.length > 0) {
          preOutput += `[AUTO-INSTALL] npm install ${toInstall.join(" ")}\n`;
          const installResult = await runProcess("npm", ["install", "--no-save", "--quiet", ...toInstall], "", 60000);
          preOutput += installResult.stderr.trim() ? installResult.stderr + "\n" : `[OK] Installed: ${toInstall.join(", ")}\n`;
          toInstall.forEach(p => installedNpmPkgs.add(p));
          const retryResult = await runProcess(cmd, args, stdin ?? "", TIMEOUT_MS);
          const execTime = (Date.now() - startTime) / 1000;
          res.json({ stdout: preOutput + retryResult.stdout, stderr: retryResult.stderr, exitCode: retryResult.exitCode, executionTime: execTime });
          return;
        }
      }
      const execTime = (Date.now() - startTime) / 1000;
      res.json({ stdout: preOutput + result.stdout, stderr: result.stderr, exitCode: result.exitCode, executionTime: execTime });
      return;

    } else if (language === "typescript") {
      filePath = join(tmpDir, "script.ts");
      await writeFile(filePath, code, "utf8");
      cmd = "npx";
      args = ["--yes", "tsx", filePath];

    } else if (language === "python") {
      filePath = join(tmpDir, "script.py");
      await writeFile(filePath, code, "utf8");
      cmd = "python3";
      args = [filePath];

      // First run
      const result = await runProcess(cmd, args, stdin ?? "", TIMEOUT_MS);
      const missingMods = extractPythonMissing(result.stderr);

      if (result.exitCode !== 0 && missingMods.length > 0) {
        const toInstall = missingMods.filter(m => !installedPythonPkgs.has(m));
        if (toInstall.length > 0) {
          preOutput += `[AUTO-INSTALL] pip install ${toInstall.join(" ")}\n`;
          const installResult = await runProcess("pip3", ["install", "--quiet", "--break-system-packages", ...toInstall], "", 90000);
          const installErr = installResult.stderr.trim();
          if (installErr && !installErr.includes("WARNING")) {
            preOutput += `[WARN] ${installErr}\n`;
          } else {
            preOutput += `[OK] Installed: ${toInstall.join(", ")}\n`;
          }
          toInstall.forEach(m => installedPythonPkgs.add(m));
          const retryResult = await runProcess(cmd, args, stdin ?? "", TIMEOUT_MS);
          const execTime = (Date.now() - startTime) / 1000;
          res.json({ stdout: preOutput + retryResult.stdout, stderr: retryResult.exitCode === 0 ? "" : retryResult.stderr, exitCode: retryResult.exitCode, executionTime: execTime });
          return;
        }
      }

      const execTime = (Date.now() - startTime) / 1000;
      res.json({ stdout: preOutput + result.stdout, stderr: result.stderr, exitCode: result.exitCode, executionTime: execTime });
      return;

    } else if (language === "bash") {
      filePath = join(tmpDir, "script.sh");
      await writeFile(filePath, `#!/bin/bash\n${code}`, "utf8");
      cmd = "bash";
      args = [filePath];

    } else if (language === "c") {
      filePath = join(tmpDir, "script.c");
      await writeFile(filePath, code, "utf8");
      const outFile = join(tmpDir, "a.out");
      const compileResult = await runProcess("gcc", [filePath, "-o", outFile, "-lm"], "", 15000);
      if (compileResult.exitCode !== 0) {
        res.json({ stdout: "", stderr: compileResult.stderr, exitCode: compileResult.exitCode, executionTime: (Date.now() - startTime) / 1000 });
        return;
      }
      cmd = outFile;
      args = [];

    } else if (language === "cpp") {
      filePath = join(tmpDir, "script.cpp");
      await writeFile(filePath, code, "utf8");
      const outFile = join(tmpDir, "a.out");
      const compileResult = await runProcess("g++", [filePath, "-o", outFile, "-std=c++17", "-lm"], "", 15000);
      if (compileResult.exitCode !== 0) {
        res.json({ stdout: "", stderr: compileResult.stderr, exitCode: compileResult.exitCode, executionTime: (Date.now() - startTime) / 1000 });
        return;
      }
      cmd = outFile;
      args = [];

    } else if (language === "perl") {
      filePath = join(tmpDir, "script.pl");
      await writeFile(filePath, code, "utf8");
      cmd = "perl";
      args = [filePath];

    } else if (language === "rust") {
      filePath = join(tmpDir, "main.rs");
      await writeFile(filePath, code, "utf8");
      const outFile = join(tmpDir, "main");
      const compileResult = await runProcess("rustc", [filePath, "-o", outFile], "", 30000);
      if (compileResult.exitCode !== 0) {
        res.json({ stdout: compileResult.stdout, stderr: compileResult.stderr, exitCode: compileResult.exitCode, executionTime: (Date.now() - startTime) / 1000 });
        return;
      }
      cmd = outFile;
      args = [];

    } else if (language === "go") {
      filePath = join(tmpDir, "main.go");
      await writeFile(filePath, code, "utf8");
      cmd = "go";
      args = ["run", filePath];

    } else {
      res.status(400).json({ error: `Unsupported language: ${language}` });
      return;
    }

    const result = await runProcess(cmd!, args!, stdin ?? "", TIMEOUT_MS);
    const executionTime = (Date.now() - startTime) / 1000;

    res.json({
      stdout: preOutput + result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      executionTime,
    });
  } catch (err: unknown) {
    const executionTime = (Date.now() - startTime) / 1000;
    const message = err instanceof Error ? err.message : String(err);
    res.json({ stdout: "", stderr: message, exitCode: 1, executionTime });
  } finally {
    try { await rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

function extractPythonMissing(stderr: string): string[] {
  const mods: string[] = [];
  // ModuleNotFoundError: No module named 'requests'
  const re1 = /No module named '([^']+)'/g;
  let m;
  while ((m = re1.exec(stderr)) !== null) {
    // Handle submodules: 'PIL.Image' -> 'Pillow', 'cv2' -> 'opencv-python'
    const raw = m[1].split('.')[0];
    mods.push(mapPythonPkg(raw));
  }
  // ImportError: cannot import name 'x' from 'y'
  const re2 = /cannot import name '.+' from '([^']+)'/g;
  while ((m = re2.exec(stderr)) !== null) {
    mods.push(mapPythonPkg(m[1].split('.')[0]));
  }
  return [...new Set(mods)];
}

function mapPythonPkg(mod: string): string {
  const MAP: Record<string, string> = {
    cv2: "opencv-python",
    PIL: "Pillow",
    sklearn: "scikit-learn",
    skimage: "scikit-image",
    yaml: "pyyaml",
    bs4: "beautifulsoup4",
    dotenv: "python-dotenv",
    telegram: "python-telegram-bot",
    serial: "pyserial",
    gi: "PyGObject",
  };
  return MAP[mod] || mod;
}

function extractNpmMissing(stderr: string): string[] {
  const mods: string[] = [];
  const re = /Cannot find module '([^'./][^']*)'/g;
  let m;
  while ((m = re.exec(stderr)) !== null) {
    const pkg = m[1].startsWith('@') ? m[1].split('/').slice(0, 2).join('/') : m[1].split('/')[0];
    mods.push(pkg);
  }
  return [...new Set(mods)];
}

function runProcess(
  cmd: string,
  args: string[],
  stdin: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      env: { ...process.env, NODE_ENV: "production", HOME: process.env.HOME || "/root" },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    if (stdin) { child.stdin.write(stdin); child.stdin.end(); }

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({ stdout, stderr: stderr + "\n[TIMEOUT] Process killed after " + Math.round(timeoutMs / 1000) + "s", exitCode: 124 });
      } else {
        resolve({ stdout, stderr, exitCode: code ?? 1 });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: err.message, exitCode: 1 });
    });
  });
}

export default router;
