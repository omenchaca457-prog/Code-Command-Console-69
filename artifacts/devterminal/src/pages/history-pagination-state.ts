export type HistoryPaginationState = {
  page: number;
  snapshotId: number | undefined;
  generation: number;
};

export type HistoryPaginationAction =
  | { type: "navigate"; page: number; snapshotId?: number }
  | { type: "accept-snapshot"; snapshotId: number | null | undefined }
  | { type: "refresh" }
  | { type: "auto-refresh" };

export type HistoryPageRequest = {
  page: number;
  pageSize: number;
  snapshotId: number | undefined;
};

export const INITIAL_HISTORY_PAGINATION_STATE: HistoryPaginationState = {
  page: 1,
  snapshotId: undefined,
  generation: 0,
};

export function historyPaginationReducer(
  state: HistoryPaginationState,
  action: HistoryPaginationAction,
): HistoryPaginationState {
  switch (action.type) {
    case "navigate": {
      const snapshotId = state.snapshotId ?? action.snapshotId;
      if (action.page === state.page && snapshotId === state.snapshotId) return state;
      return { ...state, page: action.page, snapshotId };
    }
    case "accept-snapshot":
      if (
        state.page !== 1
        || state.snapshotId !== undefined
        || action.snapshotId == null
      ) {
        return state;
      }
      return { ...state, snapshotId: action.snapshotId };
    case "refresh":
      return { page: 1, snapshotId: undefined, generation: state.generation + 1 };
    case "auto-refresh":
      if (state.page !== 1) return state;
      return { page: 1, snapshotId: undefined, generation: state.generation + 1 };
  }
}

export function getHistoryPageRequest(
  state: HistoryPaginationState,
  pageSize: number,
): HistoryPageRequest {
  return { page: state.page, pageSize, snapshotId: state.snapshotId };
}
