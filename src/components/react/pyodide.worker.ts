/// <reference lib="webworker" />
// Runs Python in the browser with Pyodide, off the main thread so a long computation never freezes
// the page. The runtime downloads only on the first Run (about 9 MB with NumPy) and is cached by the
// browser after that. Stopping terminates this worker; the next Run starts a fresh one.

const PYODIDE_VERSION = "314.0.8";
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export type RunnerRequest = { type: "run"; code: string };

export type RunnerStatus = "loading-runtime" | "loading-packages" | "running";

export type RunnerMessage =
  | { type: "status"; status: RunnerStatus }
  | { type: "stdout"; text: string }
  | { type: "stderr"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

/** The small part of Pyodide's API this worker uses. */
interface PyodideRuntime {
  setStdout(options: { batched: (text: string) => void }): void;
  setStderr(options: { batched: (text: string) => void }): void;
  loadPackagesFromImports(code: string, options?: { messageCallback?: (message: string) => void }): Promise<unknown>;
  runPythonAsync(code: string): Promise<unknown>;
}

interface PyodideModule {
  loadPyodide(options: { indexURL: string }): Promise<PyodideRuntime>;
}

const post = (message: RunnerMessage) => self.postMessage(message);

let runtimePromise: Promise<PyodideRuntime> | null = null;

function loadRuntime(): Promise<PyodideRuntime> {
  runtimePromise ??= (async () => {
    const module = (await import(/* @vite-ignore */ `${PYODIDE_INDEX_URL}pyodide.mjs`)) as PyodideModule;
    const runtime = await module.loadPyodide({ indexURL: PYODIDE_INDEX_URL });
    runtime.setStdout({ batched: (text) => post({ type: "stdout", text }) });
    runtime.setStderr({ batched: (text) => post({ type: "stderr", text }) });
    return runtime;
  })();
  return runtimePromise;
}

async function run(code: string) {
  post({ type: "status", status: "loading-runtime" });
  const runtime = await loadRuntime();
  post({ type: "status", status: "loading-packages" });
  // Package-loading progress goes to the status line, not into the program's output.
  await runtime.loadPackagesFromImports(code, { messageCallback: () => undefined });
  post({ type: "status", status: "running" });
  await runtime.runPythonAsync(code);
}

self.onmessage = async (event: MessageEvent<RunnerRequest>) => {
  if (event.data?.type !== "run") {
    post({ type: "error", message: `Unknown request: ${JSON.stringify(event.data)}` });
    return;
  }
  try {
    await run(event.data.code);
    post({ type: "done" });
  } catch (error) {
    // Python exceptions arrive as PythonError with the traceback in .message.
    // A failed runtime download must not be cached, so the next Run retries it.
    if (!(error instanceof Error && error.constructor.name === "PythonError")) runtimePromise = null;
    post({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
