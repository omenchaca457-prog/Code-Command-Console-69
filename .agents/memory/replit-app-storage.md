---
name: Replit App Storage client
description: Authentication and bucket selection behavior when using App Storage from the API server.
---

Use `@replit/object-storage` for App Storage instead of constructing a raw Google Cloud Storage client. Instantiate it with `DEFAULT_OBJECT_STORAGE_BUCKET_ID`; relying on implicit bucket discovery did not work in this workspace.

**Why:** The raw GCS client lacked Replit's managed ADC credentials, while the Replit SDK supplies them. The SDK's default bucket lookup also failed here unless given the configured bucket ID.

**How to apply:** For server-side generated objects, pass the explicit bucket ID to the Replit SDK and use its byte upload/download methods. Keep generated-object serving behind the app's API when a stable URL is required.
