import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { connect } from "node:net";
import { it } from "node:test";
import { attachTerminalWS } from "./terminal.ts";

it("keeps the original PTY path mounted and rejects it safely until isolation is verified", async () => {
  const server = createServer();
  const terminal = attachTerminalWS(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const socket = connect(address.port, "127.0.0.1");
  const chunks: Buffer[] = [];
  const responseEnded = new Promise<string>((resolve, reject) => {
    socket.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    socket.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    socket.on("error", reject);
  });

  socket.write([
    "GET /api/terminal/ws HTTP/1.1",
    `Host: 127.0.0.1:${address.port}`,
    "Upgrade: websocket",
    "Connection: Upgrade",
    "Sec-WebSocket-Version: 13",
    "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
    "",
    "",
  ].join("\r\n"));

  try {
    const response = await responseEnded;
    assert.match(response, /^HTTP\/1\.1 503 Service Unavailable/m);
    assert.match(response, /execution_disabled/);
    assert.match(response, /Cache-Control: no-store/i);
  } finally {
    socket.destroy();
    for (const client of terminal.clients) client.terminate();
    await new Promise<void>((resolve) => terminal.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
