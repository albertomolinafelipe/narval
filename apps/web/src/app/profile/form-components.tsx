export function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-text-subtle">{hint}</p>}
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-bg-subtle px-4 py-4">
        {children}
      </div>
    </div>
  );
}

export function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between"
    >
      <span className="text-sm text-text">{label}</span>
      <div className="relative">
        <input
          id={id}
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={`h-6 w-11 rounded-full transition ${checked ? "bg-brand" : "bg-border"}`}
        />
        <div
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`}
        />
      </div>
    </label>
  );
}
