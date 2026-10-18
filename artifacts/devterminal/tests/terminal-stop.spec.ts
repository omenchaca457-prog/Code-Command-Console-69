import { expect, test } from "@playwright/test";

test("stopping a streamed SQ-AI answer restores the form for another query", async ({
  page,
}) => {
  let requestCount = 0;
  let resolveFirstResponse: (() => void) | undefined;
  const firstResponseStarted = new Promise<void>((resolve) => {
    resolveFirstResponse = resolve;
  });

  await page.addInitScript(() => {
    class MockWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      readyState = MockWebSocket.OPEN;
      onopen: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;

      constructor() {
        queueMicrotask(() => this.onopen?.(new Event("open")));
      }

      send() {}

      close() {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.(new CloseEvent("close"));
      }
    }

    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      value: MockWebSocket,
    });
  });

  await page.route("**/api/deepseek/chat", async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      resolveFirstResponse?.();
      const frames = Array.from(
        { length: 100 },
        () => `data: ${JSON.stringify({ delta: "fragmento visible " })}\n\n`,
      );
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: frames.join(""),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify({ delta: "segunda respuesta" })}\n\ndata: [DONE]\n\n`,
    });
  });

  await page.goto("/");

  const commandInput = page.getByRole("textbox", {
    name: "Comando o pregunta para SQ-AI",
  });
  const executeButton = page.getByRole("button", { name: "EJECUTAR" });
  const terminalRows = page.locator(".xterm-rows");

  await commandInput.fill("ds primera consulta");
  await executeButton.click();
  await firstResponseStarted;

  const stopButton = page.getByRole("button", { name: "DETENER" });
  await expect(stopButton).toBeVisible();
  await expect(terminalRows).toContainText("fragmento", { timeout: 5_000 });
  await stopButton.click();

  await expect(terminalRows).toContainText("[Consulta detenida]", {
    timeout: 5_000,
  });
  await expect(stopButton).toHaveCount(0);

  await commandInput.fill("ds segunda consulta");
  await expect(executeButton).toBeEnabled();
  await executeButton.click();

  await expect(terminalRows).toContainText("segunda respuesta", {
    timeout: 5_000,
  });
  expect(requestCount).toBe(2);
});
