---
name: Native DevTerminal features
description: Scope rule for adding catalogs and navigation to the existing Code Command Console app.
---

Keep user-facing tools and catalogs inside the existing Code Command Console/DevTerminal app. Preserve `/` as the Terminal entry point and add requested catalog access to its native navigation; do not create separate Canvas or mockup artifacts unless explicitly requested.

**Why:** The user explicitly corrected a separate Canvas/mockup approach and asked for the catalog to function as a native terminal module.

**How to apply:** For navigation and module-catalog requests, reuse existing DevTerminal routing and real module destinations. Keep the catalog first in navigation while retaining Terminal as the root route.
