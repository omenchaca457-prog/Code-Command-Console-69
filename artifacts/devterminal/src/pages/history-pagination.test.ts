import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { HistoryPagination } from "./history-pagination.tsx";

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
