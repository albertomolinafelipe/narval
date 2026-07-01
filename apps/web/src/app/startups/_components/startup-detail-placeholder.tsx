import { Rocket, MousePointerClick } from "lucide-react";

/** Shown in the persistent right panel when no startup is selected. */
export function StartupDetailPlaceholder() {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center gap-2">
          <Rocket size={18} className="text-brand" />
          <h2 className="text-lg font-semibold text-text">Startup details</h2>
        </div>
        <p className="mt-0.5 text-sm text-text-muted">
          Select a startup from the list to see its profile here.
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
          <MousePointerClick size={24} />
        </div>
        <div className="max-w-xs">
          <p className="text-sm font-medium text-text">Nothing selected yet</p>
          <p className="mt-1 text-sm text-text-muted">
            Click any startup on the left to preview its details. Click it again
            to open the full page.
          </p>
        </div>
      </div>
    </div>
  );
}
