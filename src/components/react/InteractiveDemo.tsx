import { type ReactNode } from "react";

interface InteractiveDemoProps {
  title: string;
  description: string;
  children: ReactNode;
  onReset?: () => void;
}

export default function InteractiveDemo({
  title,
  description,
  children,
  onReset,
}: InteractiveDemoProps) {
  return (
    <div className="not-content my-6 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 m-0">
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 m-0 mt-1">
            {description}
          </p>
        </div>
        {onReset && (
          <button
            onClick={onReset}
            className="ml-4 shrink-0 rounded-md bg-gray-200 dark:bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
