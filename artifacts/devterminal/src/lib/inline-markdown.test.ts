import assert from "node:assert/strict";
import { it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InlineMarkdown } from "../components/inline-markdown.tsx";

it("shows provider-supplied HTML as text while preserving supported formatting", () => {
  const html = renderToStaticMarkup(
    createElement(InlineMarkdown, {
      text: '**<img src=x onerror="alert(1)">**\n`<script>run()</script>` *hello* & goodbye',
    }),
  );
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("<script"));
  assert.match(html, /&lt;img/);
  assert.match(html, /<strong/);
  assert.match(html, /<code/);
  assert.match(html, /<em>hello<\/em>/);
  assert.match(html, /&amp; goodbye/);
});
