import {
  INDUSTRIES,
  STAGES,
  STAGE_LABELS,
  TEAM_SCALE,
  toggleValue,
} from "@/lib/startup/constraints";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/** Inclusive [min, max] numeric bounds. */
export type Range = [number, number];

interface Props {
  industries: string[];
  onIndustriesChange: (industries: string[]) => void;
  stages: string[];
  onStagesChange: (stages: string[]) => void;
  /** Full [min, max] domains derived from the loaded list. */
  foundedDomain: Range;
  foundedRange: Range;
  onFoundedChange: (range: Range) => void;
  teamDomain: Range;
  teamRange: Range;
  onTeamChange: (range: Range) => void;
}

/**
 * The expandable advanced-search panel. Each field is a wrap of multi-select
 * chips; selecting several within a field is OR (see the `*InConstraint`
 * factories). Range fields (founded, team size) land here in a later slice.
 */
export function AdvancedFilters({
  industries,
  onIndustriesChange,
  stages,
  onStagesChange,
  foundedDomain,
  foundedRange,
  onFoundedChange,
  teamDomain,
  teamRange,
  onTeamChange,
}: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-bg-subtle/40 p-4">
      <ChipGroup
        label="Industry"
        options={INDUSTRIES}
        selected={industries}
        onToggle={(v) => onIndustriesChange(toggleValue(industries, v))}
      />
      <ChipGroup
        label="Stage"
        options={STAGES}
        selected={stages}
        onToggle={(v) => onStagesChange(toggleValue(stages, v))}
        renderLabel={(v) => STAGE_LABELS[v] ?? v}
      />
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <RangeField
          label="Founded"
          domain={foundedDomain}
          value={foundedRange}
          onChange={onFoundedChange}
        />
        <RangeField
          label="Team size"
          domain={teamDomain}
          value={teamRange}
          onChange={onTeamChange}
          scale={TEAM_SCALE}
        />
      </div>
    </div>
  );
}

interface RangeFieldProps {
  label: string;
  domain: Range;
  value: Range;
  onChange: (range: Range) => void;
  /**
   * Optional non-linear stops. When given, the slider runs over scale *indices*
   * (evenly spaced notches) and `value`/`onChange` speak actual scale values;
   * the top stop renders as "N+".
   */
  scale?: readonly number[];
}

/** A labelled dual-handle slider bounding one numeric field. */
function RangeField({ label, domain, value, onChange, scale }: RangeFieldProps) {
  const last = scale ? scale.length - 1 : 0;
  const idx = (v: number) => Math.max(0, scale?.indexOf(v) ?? -1);

  // Slider always works in a plain numeric space: scale indices, or raw values.
  const sliderValue: Range = scale ? [idx(value[0]), idx(value[1])] : value;
  const handleChange = (v: number[]) =>
    onChange(
      scale ? ([scale[v[0]], scale[v[1]]] as Range) : ([v[0], v[1]] as Range),
    );
  const showMax =
    scale && idx(value[1]) === last ? `${value[1]}+` : `${value[1]}`;

  return (
    <div className="flex w-40 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-text-muted">{label}</span>
        <span className="text-xs tabular-nums text-text">
          {value[0]} – {showMax}
        </span>
      </div>
      <Slider
        min={scale ? 0 : domain[0]}
        max={scale ? last : domain[1]}
        step={1}
        value={sliderValue}
        onValueChange={handleChange}
        aria-label={label}
        className="py-1"
      />
    </div>
  );
}

interface ChipGroupProps {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  renderLabel?: (value: string) => string;
}

/** A labelled row of toggleable filter chips for one multi-select field. */
function ChipGroup({
  label,
  options,
  selected,
  onToggle,
  renderLabel,
}: ChipGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(opt)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                on
                  ? "border-brand/40 bg-brand-subtle text-brand-text"
                  : "border-border text-text-muted hover:bg-bg-subtle hover:text-text",
              )}
            >
              {renderLabel ? renderLabel(opt) : opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
