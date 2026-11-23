import { useCallback, useState } from "react";

interface MarimoEmbedProps {
  /** URL of a published marimo notebook. */
  src: string;
  /** CSS height of the notebook frame. */
  height?: string;
  mode?: "edit" | "read";
  title?: string;
}

/** Embeds a marimo notebook in an iframe. Styles: src/styles/components.css (.ms-marimo). */
export default function MarimoEmbed({ src, height = "600px", mode = "edit", title }: MarimoEmbedProps) {
  const [loaded, setLoaded] = useState(false);
  const handleLoad = useCallback(() => setLoaded(true), []);

  const separator = src.includes("?") ? "&" : "?";
  const iframeSrc = mode === "read" ? `${src}${separator}embed=true&mode=read` : `${src}${separator}embed=true`;
  const frameTitle = title ?? "Marimo notebook";

  return (
    <div className="ms-marimo">
      {title && (
        <div className="ms-marimo-bar">
          <span className="ms-marimo-title">{title}</span>
          <a className="ms-marimo-link" href={src} target="_blank" rel="noopener noreferrer">
            Open in marimo<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      )}

      <div className="ms-marimo-frame" style={{ height }}>
        {!loaded && (
          <div className="ms-marimo-loading" role="status">
            <span className="ms-marimo-spinner" aria-hidden="true" />
            Loading notebook…
          </div>
        )}
        <iframe
          src={iframeSrc}
          title={frameTitle}
          sandbox="allow-scripts allow-same-origin allow-downloads allow-popups allow-forms"
          loading="lazy"
          onLoad={handleLoad}
          className="ms-marimo-iframe"
          // Kept laid out (not display: none) while loading: a lazy iframe that isn't rendered never loads.
          data-loaded={loaded}
        />
      </div>
    </div>
  );
}
