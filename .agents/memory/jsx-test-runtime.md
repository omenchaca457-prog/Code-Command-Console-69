---
name: JSX in frontend tests
description: Why components can render in Vite but fail when imported by frontend Node tests.
---

Keep React in scope in JSX components imported by the frontend's tsx-based Node tests.

**Why:** The current standalone test command compiles JSX using the classic runtime, while Vite supports the automatic runtime. A component can pass TypeScript checks and work in the browser yet throw `React is not defined` when rendered by a test.

**How to apply:** Follow the existing explicit React import convention for test-imported JSX components unless the test runner's JSX configuration is deliberately changed. Do not assume a passing Vite build proves compatibility with the standalone test runtime.
