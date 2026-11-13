import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { it } from "node:test";
import express from "express";
import { createWorkspaceAccess } from "./workspace-access.ts";

it("protects HTTP and WebSocket sessions, rejects foreign origins and expires signed cookies", async () => {
  let time = 1000;
  const gate = createWorkspaceAccess({ password: "test-owner-password", secret: "test-session-secret", now: () => time });
  const app = express(); app.use(express.json()); app.use("/api", gate.router); app.get("/api/private", gate.requireAccess, (_request, response) => response.json({ ok: true }));
  const server = createServer(app).listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(`${origin}/api/private`)).status, 401);
    assert.equal((await fetch(`${origin}/api/session`)).status, 200);
    assert.equal((await fetch(`${origin}/api/session/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://foreign.example" }, body: JSON.stringify({ password: "test-owner-password" }) })).status, 403);
    assert.equal((await fetch(`${origin}/api/session/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "wrong" }) })).status, 401);
    const login = await fetch(`${origin}/api/session/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "test-owner-password" }) });
    const cookie = login.headers.get("set-cookie")!;
    assert.match(cookie, /HttpOnly; SameSite=Strict/);
    const headers = { cookie: cookie.split(";")[0] };
    assert.equal((await fetch(`${origin}/api/private`, { headers })).status, 200);
    assert.equal((await fetch(`${origin}/api/private`, { headers: { cookie: headers.cookie + "invalid" } })).status, 401);
    const req = { headers: { host: `127.0.0.1:${address.port}`, origin, cookie: headers.cookie } } as any;
    assert.equal(gate.authorizeWebSocket(req), true);
    assert.equal(gate.authorizeWebSocket({ headers: { ...req.headers, origin: "https://foreign.example" } } as any), false);
    time += 8 * 60 * 60 * 1000 + 1;
    assert.equal((await fetch(`${origin}/api/private`, { headers })).status, 401);
    const logout = await fetch(`${origin}/api/session/logout`, { method: "POST" });
    assert.match(logout.headers.get("set-cookie")!, /Max-Age=0/);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

it("rejects DNS rebinding hosts and rate limits password guesses", async () => {
  const gate = createWorkspaceAccess({ password: "test-owner-password" });
  assert.equal(gate.acceptsOrigin({ headers: { host: "attacker.example:3000" } } as any), false);
  assert.equal(gate.acceptsOrigin({ headers: { host: "attacker@localhost" } } as any), false);
  assert.equal(gate.acceptsOrigin({ headers: { host: "localhost:3000", origin: "null" } } as any), false);
  const app = express(); app.use(express.json()); app.use("/api", gate.router);
  const server = createServer(app).listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  try {
    for (let i = 0; i < 8; i++) assert.equal((await fetch(`http://127.0.0.1:${address.port}/api/session/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"password":"wrong"}' })).status, 401);
    assert.equal((await fetch(`http://127.0.0.1:${address.port}/api/session/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"password":"wrong"}' })).status, 429);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
