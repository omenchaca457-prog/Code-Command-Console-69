import assert from "node:assert/strict";
import { describe, it, type TestContext } from "node:test";
import { act, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { getByRole } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { HistoryPagination } from "./history-pagination.tsx";
import { HistoryRefreshButton, HistoryRequestFeedback } from "./history-request-feedback.tsx";
import {
  getHistoryPageRequest,
  historyPaginationReducer,
  INITIAL_HISTORY_PAGINATION_STATE,
  type HistoryPaginationAction,
  type HistoryPaginationState,
} from "./history-pagination-state.ts";

type HistoryButtonProps = {
  "data-testid": string;
  disabled: boolean;
  onClick: () => void;
};

function findButtons(node: ReactNode): Array<ReactElement<HistoryButtonProps>> {
  if (Array.isArray(node)) return node.flatMap(findButtons);
  if (!isValidElement(node)) return [];

  const props = node.props as { children?: ReactNode };
  const nestedButtons = findButtons(props.children);
  return node.type === "button"
    ? [node as ReactElement<HistoryButtonProps>, ...nestedButtons]
    : nestedButtons;
}

function renderButtons(
  page: number,
  pageCount: number,
  onPageChange: (page: number) => void,
  isFetching = false,
): Array<ReactElement<HistoryButtonProps>> {
  return findButtons(
    HistoryPagination({ page, pageCount, isFetching, onPageChange }),
  );
}

describe("history pagination controls", () => {
  it("changes pages and disables navigation at the first and final pages", () => {
    const requestedPages: number[] = [];
    const onPageChange = (page: number) => requestedPages.push(page);

    const firstPageButtons = renderButtons(1, 3, onPageChange);
    assert.equal(firstPageButtons[0]?.props["data-testid"], "button-history-previous");
    assert.equal(firstPageButtons[0]?.props.disabled, true);
    assert.equal(firstPageButtons[1]?.props["data-testid"], "button-history-next");
    assert.equal(firstPageButtons[1]?.props.disabled, false);
    firstPageButtons[1]?.props.onClick();
    assert.deepEqual(requestedPages, [2]);

    const middlePageButtons = renderButtons(2, 3, onPageChange);
    assert.equal(middlePageButtons[0]?.props.disabled, false);
    assert.equal(middlePageButtons[1]?.props.disabled, false);
    middlePageButtons[0]?.props.onClick();
    middlePageButtons[1]?.props.onClick();
    assert.deepEqual(requestedPages, [2, 1, 3]);

    const finalPageButtons = renderButtons(3, 3, onPageChange);
    assert.equal(finalPageButtons[0]?.props.disabled, false);
    assert.equal(finalPageButtons[1]?.props.disabled, true);
    finalPageButtons[1]?.props.onClick();
    assert.deepEqual(requestedPages, [2, 1, 3, 3], "El siguiente no debe rebasar la última página");
  });

  it("disables both controls while a page request is in progress", () => {
    const buttons = renderButtons(2, 3, () => undefined, true);
    assert.deepEqual(buttons.map((button) => button.props.disabled), [true, true]);
  });
});

// Exercise native button behavior through DOM events, not direct onClick calls.
async function mountPagination(t: TestContext, page = 2, pageCount = 3) {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>");
  const globals = {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const originalGlobals = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const { createRoot } = await import("react-dom/client");
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  t.after(async () => {
    try {
      await act(async () => root.unmount());
    } finally {
      dom.window.close();
      for (const [key, descriptor] of originalGlobals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    }
  });
  const requestedPages: number[] = [];
  const render = async (currentPage: number, isFetching = false) => {
    await act(async () => root.render(createElement(HistoryPagination, {
      page: currentPage,
      pageCount,
      isFetching,
      onPageChange: (nextPage) => requestedPages.push(nextPage),
    })));
  };
  await render(page);
  return {
    container,
    document: dom.window.document,
    user: userEvent.setup({ document: dom.window.document }),
    requestedPages,
    render,
    previous: getByRole(container, "button", { name: "Página anterior del historial" }) as HTMLButtonElement,
    next: getByRole(container, "button", { name: "Página siguiente del historial" }) as HTMLButtonElement,
  };
}

describe("history pagination accessibility", () => {
  it("supports Tab and Shift+Tab, and activates both directions with Enter and Space", async (t) => {
    const { user, document, previous, next, requestedPages } = await mountPagination(t);
    assert.equal(previous.type, "button");
    assert.equal(next.type, "button");
    await user.tab();
    assert.equal(document.activeElement, previous);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    await user.tab();
    assert.equal(document.activeElement, next);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    assert.deepEqual(requestedPages, [1, 1, 3, 3]);
    await user.tab({ shift: true });
    assert.equal(document.activeElement, previous);
    for (const button of [previous, next]) {
      assert.match(button.className, /focus-visible:ring-2/);
      assert.equal(button.querySelector("svg")?.getAttribute("aria-hidden"), "true");
    }
  });

  it("keeps the complete current page announcement in a polite, atomic status region", async (t) => {
    const { container, render } = await mountPagination(t, 1);
    const navigation = getByRole(container, "navigation", { name: "Paginación del historial" });
    assert.equal(navigation.getAttribute("lang"), "es");
    const status = getByRole(navigation, "status");
    assert.equal(status.getAttribute("aria-live"), "polite");
    assert.equal(status.getAttribute("aria-atomic"), "true");
    assert.equal(status.textContent, "Página 1 de 3");
    await render(2);
    assert.equal(getByRole(navigation, "status"), status, "Keep the live region mounted when pages change");
    assert.equal(status.textContent, "Página 2 de 3");
    await render(3);
    assert.equal(status.textContent, "Página 3 de 3");
  });

  for (const page of [1, 3]) {
    it(`exposes the disabled boundary and skips it in the tab order on page ${page}`, async (t) => {
      const { user, document, previous, next, requestedPages } = await mountPagination(t, page);
      const disabled = page === 1 ? previous : next;
      const enabled = page === 1 ? next : previous;
      assert.equal(disabled.disabled, true);
      assert.equal(disabled.hasAttribute("disabled"), true);
      assert.equal(enabled.disabled, false);
      await user.tab();
      assert.equal(document.activeElement, enabled);
      await user.keyboard("{Enter}");
      assert.deepEqual(requestedPages, [2]);
      await user.tab();
      assert.equal(document.activeElement, document.body);
      disabled.focus();
      assert.equal(document.activeElement, document.body);
      await user.click(disabled);
      assert.deepEqual(requestedPages, [2], "Disabled controls must not navigate");
    });
  }

  it("disables both controls on a single page and leaves no keyboard navigation targets", async (t) => {
    const { container, user, document, previous, next, requestedPages } = await mountPagination(t, 1, 1);
    assert.equal(getByRole(container, "status").textContent, "Página 1 de 1");
    assert.equal(previous.disabled, true);
    assert.equal(next.disabled, true);
    await user.tab();
    assert.equal(document.activeElement, document.body);
    await user.keyboard("{Enter} ");
    await user.click(previous);
    await user.click(next);
    assert.deepEqual(requestedPages, []);
  });

  it("blocks mouse and keyboard navigation while fetching, then restores keyboard access", async (t) => {
    const { user, document, previous, next, requestedPages, render } = await mountPagination(t);
    await render(2, true);
    assert.equal(previous.disabled, true);
    assert.equal(next.disabled, true);
    await user.tab();
    assert.equal(document.activeElement, document.body);
    await user.keyboard("{Enter} ");
    await user.click(previous);
    await user.click(next);
    assert.deepEqual(requestedPages, []);
    await render(2, false);
    await user.tab();
    assert.equal(document.activeElement, previous);
    await user.keyboard("{Enter}");
    assert.deepEqual(requestedPages, [1]);
  });
});

describe("history request recovery", () => {
  // Exercise request failure/recovery without depending on snapshot boundaries.
  for (const hasSavedRows of [false, true]) {
    it(`shows a settled error and recovers on retry ${hasSavedRows ? "with cached rows" : "without cached rows"}`, { timeout: 5000 }, async () => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } },
      });
      let pagination = INITIAL_HISTORY_PAGINATION_STATE;
      let attempts = 0;
      let resolveRetry!: (rows: SavedLog[]) => void;
      const retryResponse = new Promise<SavedLog[]>((resolve) => {
        resolveRetry = resolve;
      });
      const options = () => ({
        queryKey: ["history-recovery", pagination.generation],
        queryFn: async () => {
          attempts += 1;
          if (attempts === 1) throw new Error("HTTP 503");
          return retryResponse;
        },
      });
      if (hasSavedRows) {
        client.setQueryData(options().queryKey, [{ id: 1 }]);
      }
      const observer = new QueryObserver(client, options());
      const unsubscribe = observer.subscribe(() => undefined);

      const renderFeedback = () => {
        const result = observer.getCurrentResult();
        return renderToStaticMarkup(createElement(
          HistoryRequestFeedback,
          { ...result, itemCount: result.data?.length },
          result.data?.map(({ id }) => createElement(
            "div", { key: id, "data-testid": `row-simulation-log-${id}` }, `Registro ${id}`,
          )),
        ));
      };
      const refreshButton = () => {
        const result = observer.getCurrentResult();
        const buttons = findButtons(HistoryRefreshButton({
          ...result,
          onRefresh: () => {
            pagination = historyPaginationReducer(pagination, { type: "refresh" });
            observer.setOptions(options());
          },
        }));
        assert.equal(buttons.length, 1);
        return buttons[0]!;
      };

      try {
        await observer.refetch({ cancelRefetch: false });
        assert.equal(attempts, 1);
        const failure = renderFeedback();
        assert.match(failure, /role="alert"/);
        assert.match(failure, /No se pudo cargar el historial/);
        assert.match(failure, /Pulsa Reintentar/);
        assert.doesNotMatch(failure, /status-history-empty|status-history-loading/);
        if (hasSavedRows) {
          assert.match(failure, /pueden estar desactualizados/);
          assert.match(failure, /row-simulation-log-1/);
        } else {
          assert.match(failure, /No se pudo confirmar si hay registros guardados/);
          assert.doesNotMatch(failure, /row-simulation-log-/);
        }
        const retry = refreshButton();
        assert.equal(retry.props.disabled, false, "Retry becomes available after failure settles");
        assert.match(renderToStaticMarkup(retry), /Reintentar/);
        retry.props.onClick();
        assert.equal(attempts, 2, "The retry control issues a new request");
        assert.equal(refreshButton().props.disabled, true);
        assert.match(renderFeedback(), /status-history-loading/);
        assert.doesNotMatch(renderFeedback(), /status-history-empty/);

        resolveRetry([{ id: 2 }]);
        await observer.refetch({ cancelRefetch: false });
        const success = renderFeedback();
        assert.match(success, /row-simulation-log-2/);
        assert.doesNotMatch(success, /status-history-error|status-history-loading|status-history-empty|row-simulation-log-1/);
        assert.equal(refreshButton().props.disabled, false);
        assert.match(renderToStaticMarkup(refreshButton()), /Actualizar/);
      } finally {
        unsubscribe();
        observer.destroy();
        client.clear();
      }
    });
  }

  it("keeps retry disabled during a failed background request and distinguishes an empty success", () => {
    const pendingButton = HistoryRefreshButton({
      isError: true,
      isFetching: true,
      onRefresh: () => undefined,
    });
    assert.equal(findButtons(pendingButton)[0]?.props.disabled, true);
    const pending = renderToStaticMarkup(createElement(HistoryRequestFeedback, {
      isError: true, isFetching: true, isLoading: false, itemCount: 0,
    }));
    assert.match(pending, /status-history-error/);
    assert.match(pending, /status-history-loading/);
    assert.doesNotMatch(pending, /status-history-empty/);
    const empty = renderToStaticMarkup(createElement(HistoryRequestFeedback, {
      isError: false, isFetching: false, isLoading: false, itemCount: 0,
    }));
    assert.match(empty, /Todavía no hay muestras guardadas/);
    assert.doesNotMatch(empty, /status-history-error|status-history-loading/);
  });
});

type SavedLog = { id: number };

function requestLogs(
  request: ReturnType<typeof getHistoryPageRequest>,
  logs: SavedLog[],
) {
  const snapshotId = request.snapshotId ?? Math.max(0, ...logs.map(({ id }) => id));
  const snapshotLogs = logs
    .filter(({ id }) => id <= snapshotId)
    .sort((left, right) => right.id - left.id);
  const start = (request.page - 1) * request.pageSize;
  return {
    items: snapshotLogs.slice(start, start + request.pageSize),
    snapshotId,
    total: snapshotLogs.length,
  };
}

function clickHistoryPage(
  state: HistoryPaginationState,
  pageCount: number,
  page: "previous" | "next",
  snapshotId: number,
): HistoryPaginationState {
  let nextState = state;
  const buttons = renderButtons(
    state.page,
    pageCount,
    (nextPage) => {
      nextState = historyPaginationReducer(state, {
        type: "navigate",
        page: nextPage,
        snapshotId,
      });
    },
  );
  const button = buttons.find((candidate) =>
    candidate.props["data-testid"] === `button-history-${page}`,
  );

  assert.ok(button, `Expected ${page} history control`);
  assert.equal(button.props.disabled, false);
  button.props.onClick();
  return nextState;
}

function reduceHistoryState(
  state: HistoryPaginationState,
  action: HistoryPaginationAction,
): HistoryPaginationState {
  return historyPaginationReducer(state, action);
}

describe("history snapshot navigation", () => {
  it("keeps one boundary while returning between pages without repeating or skipping saved rows", () => {
    let state = INITIAL_HISTORY_PAGINATION_STATE;
    const logs: SavedLog[] = Array.from({ length: 10 }, (_, index) => ({ id: 10 - index }));
    const pageSize = 3;
    const requests = [];
    const firstRequest = getHistoryPageRequest(state, pageSize);
    requests.push(firstRequest);
    const firstResponse = requestLogs(firstRequest, logs);
    state = reduceHistoryState(state, {
      type: "accept-snapshot",
      snapshotId: firstResponse.snapshotId,
    });

    const initialRequest = getHistoryPageRequest(state, pageSize);
    requests.push(initialRequest);
    const initialPage = requestLogs(initialRequest, logs);
    const pageCount = Math.ceil(initialPage.total / pageSize);
    state = clickHistoryPage(state, pageCount, "next", initialPage.snapshotId);
    logs.push({ id: 11 });
    const secondRequest = getHistoryPageRequest(state, pageSize);
    requests.push(secondRequest);
    const secondPage = requestLogs(secondRequest, logs);

    state = clickHistoryPage(state, pageCount, "previous", secondPage.snapshotId);
    const returnedFirstRequest = getHistoryPageRequest(state, pageSize);
    requests.push(returnedFirstRequest);
    const returnedFirstPage = requestLogs(returnedFirstRequest, logs);
    state = clickHistoryPage(state, pageCount, "next", returnedFirstPage.snapshotId);
    const returnedSecondRequest = getHistoryPageRequest(state, pageSize);
    requests.push(returnedSecondRequest);
    const returnedSecondPage = requestLogs(returnedSecondRequest, logs);
    state = clickHistoryPage(state, pageCount, "next", returnedSecondPage.snapshotId);
    const thirdRequest = getHistoryPageRequest(state, pageSize);
    requests.push(thirdRequest);
    const thirdPage = requestLogs(thirdRequest, logs);
    state = clickHistoryPage(state, pageCount, "next", thirdPage.snapshotId);
    const fourthRequest = getHistoryPageRequest(state, pageSize);
    requests.push(fourthRequest);
    const fourthPage = requestLogs(fourthRequest, logs);

    assert.deepEqual(initialPage.items.map(({ id }) => id), [10, 9, 8]);
    assert.deepEqual(secondPage.items.map(({ id }) => id), [7, 6, 5]);
    assert.deepEqual(returnedFirstPage.items, initialPage.items);
    assert.deepEqual(returnedSecondPage.items, secondPage.items);
    assert.deepEqual(
      [...initialPage.items, ...secondPage.items, ...thirdPage.items, ...fourthPage.items].map(({ id }) => id),
      [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
      "The full saved history must not repeat or omit records",
    );
    assert.equal(new Set(
      [...initialPage.items, ...secondPage.items, ...thirdPage.items, ...fourthPage.items]
        .map(({ id }) => id),
    ).size, 10);
    assert.deepEqual(requests.map(({ page, snapshotId }) => [page, snapshotId]), [
      [1, undefined],
      [1, 10],
      [2, 10],
      [1, 10],
      [2, 10],
      [3, 10],
      [4, 10],
    ]);
    assert.equal(state.snapshotId, 10);
    assert.equal(state.page, 4);
    assert.equal(fourthPage.items.some(({ id }) => id === 11), false);
  });

  it("starts a new page-one boundary on manual refresh and after automatic refresh is safe on page one", () => {
    let state: HistoryPaginationState = {
      page: 2,
      snapshotId: 10,
      generation: 4,
    };
    const pageTwoState = state;
    state = reduceHistoryState(state, { type: "auto-refresh" });
    assert.equal(state, pageTwoState, "A simulator refresh must not move an active page sequence");

    state = reduceHistoryState(state, { type: "refresh" });
    assert.deepEqual(state, { page: 1, snapshotId: undefined, generation: 5 });

    const logs = [{ id: 11 }, { id: 10 }, { id: 9 }];
    const freshRequest = getHistoryPageRequest(state, 3);
    assert.deepEqual(freshRequest, { page: 1, pageSize: 3, snapshotId: undefined });
    const freshResponse = requestLogs(freshRequest, logs);
    assert.equal(freshResponse.snapshotId, 11);

    state = reduceHistoryState(state, {
      type: "accept-snapshot",
      snapshotId: freshResponse.snapshotId,
    });
    assert.deepEqual(getHistoryPageRequest(state, 3), {
      page: 1,
      pageSize: 3,
      snapshotId: 11,
    });

    state = reduceHistoryState(state, { type: "auto-refresh" });
    assert.deepEqual(state, { page: 1, snapshotId: undefined, generation: 6 });
  });
});
