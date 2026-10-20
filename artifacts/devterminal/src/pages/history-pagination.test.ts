import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { HistoryPagination } from "./history-pagination.tsx";
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
