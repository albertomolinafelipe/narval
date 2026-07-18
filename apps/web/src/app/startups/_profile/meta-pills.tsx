import { MdLocationOn, MdGroups, MdCalendarMonth } from "react-icons/md";
import type { Startup } from "@/lib/api/gen";
import { Pill } from "@/app/_components/shared/list-panel";
import { STAGES, INDUSTRIES } from "@/lib/enums";
import { EditableSelect, EditableNumber, EditableLocation } from "./editable";

/** The five core meta pills: stage, industry, location, founded year, team size. */
export function MetaPills({ startup }: { startup: Startup }) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex flex-wrap items-start gap-2">
      <EditableSelect
        field="stage"
        value={startup.stage ?? ""}
        options={STAGES}
        placeholder="Stage"
        display={(v) => <Pill label={v} />}
      />
      <EditableSelect
        field="industry"
        value={startup.industry ?? ""}
        options={INDUSTRIES}
        placeholder="Industry"
        display={(v) => <Pill label={v} />}
      />
      <EditableLocation
        field="location"
        value={startup.location ?? ""}
        placeholder="Location"
        className="text-sm"
        display={(v) => <Pill icon={<MdLocationOn size={14} />} label={v} />}
      />
      <EditableNumber
        field="founded_year"
        value={startup.founded_year}
        placeholder="Founded year"
        min={1900}
        max={currentYear}
        className="text-sm"
        display={(v) => (
          <Pill icon={<MdCalendarMonth size={14} />} label={`Founded ${v}`} />
        )}
      />
      <EditableNumber
        field="team_size"
        value={startup.team_size}
        placeholder="Team size"
        min={1}
        className="text-sm"
        display={(v) => (
          <Pill
            icon={<MdGroups size={14} />}
            label={`${v} ${v === 1 ? "person" : "people"}`}
          />
        )}
      />
    </div>
  );
}
