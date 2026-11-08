import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TypeScriptWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

self.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    if (label === "typescript" || label === "javascript")
      return new TypeScriptWorker();
    if (label === "json") return new JsonWorker();
    return new EditorWorker();
  },
};
// Serve the editor and its workers from this app instead of an external CDN.
loader.config({ monaco });
