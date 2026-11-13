import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { Router, type RequestHandler } from "express";

const COOKIE = "devterminal_session";
const SESSION_MS = 8 * 60 * 60 * 1000;
const digest = (value: string) => createHash("sha256").update(value).digest();
const equal = (left: string, right: string) => timingSafeEqual(digest(left), digest(right));

export function createWorkspaceAccess(options: {
  password?: string;
  secret?: string;
  publicUrl?: string;
  allowedHosts?: string[];
  now?: () => number;
} = {}) {
  const password = options.password ?? "";
  const required = password.length > 0;
  const secret = options.secret || randomBytes(32).toString("hex");
  const now = options.now ?? Date.now;
  const publicUrl = options.publicUrl ? new URL(options.publicUrl) : null;
  const hosts = new Set(["localhost", "127.0.0.1", "[::1]", ...(options.allowedHosts ?? [])].map(host => host.toLowerCase()));
  if (publicUrl) hosts.add(publicUrl.hostname.toLowerCase());
  const failures = new Map<string, { count: number; expires: number }>();

  const acceptsOrigin = (request: IncomingMessage) => {
    const host = request.headers.host ?? "";
    if (!host || /[\s/@\\?#]/.test(host)) return false;
    let hostname: string;
    try { hostname = new URL(`http://${host}`).hostname.toLowerCase(); } catch { return false; }
    if (!hosts.has(hostname)) return false;
    const origin = request.headers.origin;
    if (!origin) return true;
    try {
      const parsed = new URL(origin);
      return (parsed.protocol === "http:" || parsed.protocol === "https:") &&
        (parsed.host.toLowerCase() === host.toLowerCase() || parsed.origin === publicUrl?.origin);
    } catch { return false; }
  };
  const sign = (value: string) => createHmac("sha256", secret).update(value).digest("base64url");
  const authenticated = (request: IncomingMessage) => {
    if (!required) return true;
    const token = request.headers.cookie?.split(";").map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!token) return false;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra || !equal(sign(payload), signature)) return false;
    try {
      const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      return typeof session.expires === "number" && session.expires > now() && session.expires <= now() + SESSION_MS && typeof session.nonce === "string";
    } catch { return false; }
  };
  const cookie = (value: string, maxAge: number) => `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${publicUrl?.protocol === "https:" ? "; Secure" : ""}`;
  const originGuard: RequestHandler = (request, response, next) => {
    if (!acceptsOrigin(request)) { response.status(403).json({ error: "El origen de la solicitud no está permitido." }); return; }
    next();
  };
  const requireAccess: RequestHandler = (request, response, next) => {
    if (!acceptsOrigin(request)) { response.status(403).json({ error: "El origen de la solicitud no está permitido." }); return; }
    if (!authenticated(request)) { response.setHeader("Cache-Control", "no-store"); response.status(401).json({ error: "Inicia sesión para acceder al workspace.", code: "authentication_required" }); return; }
    next();
  };
  const router = Router();
  router.use(originGuard);
  router.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
  router.get("/session", (request, response) => response.json({ required, authenticated: authenticated(request) }));
  router.post("/session/login", (request, response) => {
    if (!request.is("application/json")) { response.status(415).json({ error: "Envía una solicitud JSON." }); return; }
    const address = request.socket.remoteAddress ?? "local";
    if (failures.size > 1000) for (const [key, entry] of failures) if (entry.expires <= now()) failures.delete(key);
    const previous = failures.get(address);
    if (previous && previous.expires > now() && previous.count >= 8) {
      response.setHeader("Retry-After", String(Math.ceil((previous.expires - now()) / 1000)));
      response.status(429).json({ error: "Espera un minuto antes de volver a intentarlo." }); return;
    }
    if (required && (typeof request.body?.password !== "string" || !equal(request.body.password, password))) {
      const entry = previous && previous.expires > now() ? previous : { count: 0, expires: now() + 60_000 };
      entry.count += 1; failures.set(address, entry);
      response.status(401).json({ error: "La contraseña no es correcta." }); return;
    }
    failures.delete(address);
    const payload = Buffer.from(JSON.stringify({ expires: now() + SESSION_MS, nonce: randomBytes(18).toString("hex") })).toString("base64url");
    response.setHeader("Set-Cookie", cookie(`${payload}.${sign(payload)}`, SESSION_MS / 1000));
    response.json({ required, authenticated: true });
  });
  router.post("/session/logout", (_request, response) => {
    response.setHeader("Set-Cookie", cookie("", 0));
    response.json({ authenticated: !required, required });
  });
  return { router, required, requireAccess, authenticated, acceptsOrigin, authorizeWebSocket: (request: IncomingMessage) => acceptsOrigin(request) && authenticated(request) };
}

export const workspaceAccess = createWorkspaceAccess({
  password: process.env.APP_PASSWORD,
  secret: process.env.SESSION_SECRET,
  publicUrl: process.env.PUBLIC_URL,
  allowedHosts: process.env.ALLOWED_HOSTS?.split(",").map(host => host.trim()).filter(Boolean),
});
