---
name: Autonomous write notices
description: Failure handling policy when autonomous file writes succeed but activity events fail.
---

Treat file writes as the primary operation and activity notices as secondary. Report the write as applied even if event persistence or live delivery fails. Do not automatically retry event persistence after an ambiguous failure, because the database may have committed even if the caller did not receive confirmation; a retry could duplicate the notice. If persistence succeeded but live delivery failed, rely on the persisted event being available for stream replay after reconnection.

**Why:** A failed notification must not falsely tell the user that their file was unchanged, and automatic retries can produce duplicate activity records.

**How to apply:** Preserve this distinction in any future autonomous write paths, notification recovery mechanisms, and tests.
