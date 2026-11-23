import { useCallback, useEffect, useRef, useState } from "react";
import type { RunnerMessage, RunnerRequest, RunnerStatus } from "./pyodide.worker";

type Phase = "idle" | RunnerStatus | "done" | "error" | "stopped";

interface OutputChunk {
  stream: "stdout" | "stderr";
  text: string;
}

const RUNTIME_FAILURE_TEXT = "The Python runtime couldn't load. Check your connection and press Run to try again.";

const STATUS_TEXT: Record<Phase, string> = {
  idle: "",
  "loading-runtime": "Loading Python. The first run downloads about 9 MB.",
  "loading-packages": "Loading packages…",
  running: "Running…",
  done: "Finished.",
  error: "Stopped with an error.",
  stopped: "Stopped.",
};

const isBusy = (phase: Phase) => phase === "loading-runtime" || phase === "loading-packages" || phase === "running";

interface PyRunControlsProps {
  code: string;
}

/** Run button, status and output for a PyRunner block. The code itself is rendered by Expressive Code above. */
export default function PyRunControls({ code }: PyRunControlsProps) {
  const workerRef = useRef<Worker | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [output, setOutput] = useState<OutputChunk[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const terminateWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => terminateWorker, [terminateWorker]);

  const handleMessage = useCallback((event: MessageEvent<RunnerMessage>) => {
    const message = event.data;
    switch (message.type) {
      case "status":
        setPhase(message.status);
        break;
      case "stdout":
      case "stderr":
        setOutput((previous) => [...previous, { stream: message.type, text: message.text }]);
        break;
      case "done":
        setPhase("done");
        break;
      case "error":
        // Download failures get a plain explanation; Python exceptions keep their traceback.
        setErrorMessage(message.kind === "runtime" ? RUNTIME_FAILURE_TEXT : message.message);
        setPhase("error");
        break;
    }
  }, []);

  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("./pyodide.worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", (event) => {
      console.error("Python runner worker failed:", event.message);
      setErrorMessage(RUNTIME_FAILURE_TEXT);
      setPhase("error");
      terminateWorker();
    });
    workerRef.current = worker;
    return worker;
  }, [handleMessage, terminateWorker]);

  const handleRun = useCallback(() => {
    setOutput([]);
    setErrorMessage("");
    const request: RunnerRequest = { type: "run", code };
    getWorker().postMessage(request);
  }, [code, getWorker]);

  const handleStop = useCallback(() => {
    terminateWorker();
    setPhase("stopped");
  }, [terminateWorker]);

  const busy = isBusy(phase);
  const hasOutput = output.length > 0 || errorMessage !== "";

  return (
    <div className="ms-runner">
      <div className="ms-runner-bar">
        {busy ? (
          <button type="button" className="ms-runner-button" onClick={handleStop}>
            Stop
          </button>
        ) : (
          <button type="button" className="ms-runner-button" onClick={handleRun}>
            Run
          </button>
        )}
        <p className="ms-runner-status" aria-live="polite">
          {STATUS_TEXT[phase]}
        </p>
      </div>
      {hasOutput && (
        <output className="ms-runner-output" aria-label="Program output">
          {output.map((chunk, index) => (
            <span key={index} className={chunk.stream === "stderr" ? "ms-runner-stderr" : undefined}>
              {chunk.text}
              {"\n"}
            </span>
          ))}
          {errorMessage && <span className="ms-runner-error">{errorMessage}</span>}
        </output>
      )}
    </div>
  );
}
