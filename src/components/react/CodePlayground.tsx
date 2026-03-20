interface CodePlaygroundProps {
  code: string;
  language?: string;
  title?: string;
}

export default function CodePlayground({
  code,
  language = "python",
  title,
}: CodePlaygroundProps) {
  const lines = code.split("\n");

  return (
    <div className="not-content my-6 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden font-mono text-sm">
      {/* Title bar */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {/* Fake traffic lights */}
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-400" />
          {title && (
            <span className="ml-2 text-xs font-medium text-gray-600 dark:text-gray-400">
              {title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {language}
          </span>
          <button
            disabled
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white opacity-50 cursor-not-allowed"
            title="Coming soon"
          >
            Run ▶
          </button>
        </div>
      </div>

      {/* Code area with line numbers */}
      <div className="flex overflow-x-auto bg-gray-900 text-gray-100">
        {/* Line numbers */}
        <div className="shrink-0 select-none border-r border-gray-700 bg-gray-950 px-3 py-3 text-right text-gray-500">
          {lines.map((_, i) => (
            <div key={i} className="leading-6">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code content */}
        <pre className="flex-1 overflow-x-auto p-3 m-0">
          <code>
            {lines.map((line, i) => (
              <div key={i} className="leading-6 whitespace-pre">
                {line || " "}
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
