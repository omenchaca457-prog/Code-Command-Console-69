import assert from "node:assert/strict";
import { test } from "node:test";
import { coherence4105 } from "./coherence-4105.ts";

test("C4105 uses five normalized inputs", () => {
  assert.equal(coherence4105({ omega: 0.42, psi: 0.72, k: 0.58, s: 0.38, p: 0.45 }), 0.558);
});
test("C4105 extremes", () => {
  assert.equal(coherence4105({ omega: 1, psi: 1, k: 1, s: 0, p: 1 }), 1);
  assert.equal(coherence4105({ omega: 0, psi: 0, k: 0, s: 1, p: 0 }), 0);
});
test("C4105 rejects invalid data", () => {
  for (const value of [NaN, Infinity, -0.01, 1.01]) {
    assert.throws(() => coherence4105({ omega: value, psi: 0.5, k: 0.5, s: 0.5, p: 0.5 }), RangeError);
  }
});
