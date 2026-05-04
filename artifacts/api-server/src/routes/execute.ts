import { Router } from "express";
import { spawn } from "child_process";
import { writeFile, unlink, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { ExecuteCodeBody } from "@workspace/api-zod";

const router = Router();

const LANGUAGES = [
  { id: "javascript", name: "JavaScript", extension: "js", monacoLanguage: "javascript" },
  { id: "typescript", name: "TypeScript", extension: "ts", monacoLanguage: "typescript" },
  { id: "python", name: "Python", extension: "py", monacoLanguage: "python" },
  { id: "bash", name: "Bash", extension: "sh", monacoLanguage: "shell" },
];

const TIMEOUT_MS = 10000;

router.get("/languages", (_req, res) => {
  res.json({ languages: LANGUAGES });
});

router.post("/execute", async (req, res) => {
  const parsed = ExecuteCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { language, code, stdin } = parsed.data;
  const startTime = Date.now();

  let tmpDir: string | null = null;

  try {
    tmpDir = await mkdtemp(join(tmpdir(), "devterm-"));

    let cmd: string;
    let args: string[];
    let filePath: string;

    if (language === "javascript") {
      filePath = join(tmpDir, "script.js");
      await writeFile(filePath, code, "utf8");
      cmd = "node";
      args = [filePath];
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
    } else if (language === "bash") {
      filePath = join(tmpDir, "script.sh");
      await writeFile(filePath, code, "utf8");
      cmd = "bash";
      args = [filePath];
    } else {
      res.status(400).json({ error: `Unsupported language: ${language}` });
      return;
    }

    const result = await runProcess(cmd, args, stdin ?? "", TIMEOUT_MS);
    const executionTime = (Date.now() - startTime) / 1000;

    res.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      executionTime,
    });
  } catch (err: unknown) {
    const executionTime = (Date.now() - startTime) / 1000;
    const message = err instanceof Error ? err.message : String(err);
    res.json({
      stdout: "",
      stderr: message,
      exitCode: 1,
      executionTime,
    });
  } finally {
    if (tmpDir) {
      try {
        const fs = await import("fs/promises");
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }
});

function runProcess(
  cmd: string,
  args: string[],
  stdin: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      timeout: timeoutMs,
      env: { ...process.env, NODE_ENV: "production" },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    if (stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({ stdout, stderr: stderr + "\nProcess timed out after 10 seconds.", exitCode: 124 });
      } else {
        resolve({ stdout, stderr, exitCode: code ?? 1 });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export default router;
