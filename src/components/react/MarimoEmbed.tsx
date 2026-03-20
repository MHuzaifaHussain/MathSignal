import { useState, useCallback } from "react";

interface MarimoEmbedProps {
  src: string;
  height?: string;
  mode?: "edit" | "read";
  title?: string;
}

export default function MarimoEmbed({
  src,
  height = "600px",
  mode = "edit",
  title,
}: MarimoEmbedProps) {
  const [loaded, setLoaded] = useState(false);

  const handleLoad = useCallback(() => setLoaded(true), []);

  const separator = src.includes("?") ? "&" : "?";
  const iframeSrc =
    mode === "read"
      ? `${src}${separator}embed=true&mode=read`
      : `${src}${separator}embed=true`;

  return (
    <div className="not-content my-6 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {title && (
        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </span>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Open in Marimo ↗
          </a>
        </div>
      )}

      <div className="relative" style={{ height }}>
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 dark:border-t-blue-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Loading notebook...
              </span>
            </div>
          </div>
        )}

        <iframe
          src={iframeSrc}
          title={title ?? "Marimo notebook"}
          sandbox="allow-scripts allow-same-origin allow-downloads allow-popups allow-forms"
          loading="lazy"
          onLoad={handleLoad}
          className="h-full w-full border-0"
          style={{ display: loaded ? "block" : "hidden" }}
        />
      </div>
    </div>
  );
}
