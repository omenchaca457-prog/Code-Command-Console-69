---
name: Provider error redaction
description: Prevent upstream AI provider exceptions from leaking credential fragments into application logs.
---

Never serialize raw AI-provider exceptions into logs. Authentication failures may include a fragment of the submitted credential in the exception message.

**Why:** A live DeepSeek authentication failure returned an error message containing part of the configured key, so logging the full exception exposed credential data.

**How to apply:** In AI-provider error handlers, log only fixed provider identifiers and validated status codes; return a generic actionable message without forwarding upstream error text.
