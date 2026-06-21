import { components } from "@/lib/api/generated";
import { parseTechStack, TechIcon } from "@/lib/tech-icons";
import { Section } from "./ui";
import { EditableMarkdown } from "./markdown";
import { EditableSource } from "./source-link";
import { EditableText } from "./editable";
import { useProfileEdit } from "./edit-context";

type Startup = components["schemas"]["Startup"];

/** A tab with no content is hidden from visitors (only the owner sees it). */
export function isContributingEmpty(startup: Startup): boolean {
  const hasTech = parseTechStack(startup.tech_stack).length > 0;
  return !(startup.contributing_text || hasTech || startup.github);
}

export function ContributingTab({ startup }: { startup: Startup }) {
  const { isOwner } = useProfileEdit();
  const techTags = parseTechStack(startup.tech_stack);

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* Left: editable markdown */}
      <EditableMarkdown
        field="contributing_text"
        value={startup.contributing_text ?? ""}
        placeholder="Describe how others can get involved (issues, repos…). Leave empty and this tab stays hidden from visitors."
        maxLength={2000}
      />

      {/* Right: source + stack */}
      <div className="flex flex-col gap-8">
        {(startup.github || isOwner) && (
          <div className="rounded-xl border border-brand/20 bg-brand-subtle/30 p-4">
            <Section title="Source">
              <EditableSource value={startup.github ?? ""} />
            </Section>
          </div>
        )}

        {(techTags.length > 0 || isOwner) && (
          <Section title="Tech stack">
            <EditableText
              field="tech_stack"
              value={startup.tech_stack ?? ""}
              placeholder="Add your stack (comma separated)"
              maxLength={200}
              display={(v) => (
                <span className="flex flex-wrap gap-5">
                  {parseTechStack(v).map((tag) => (
                    <span
                      key={tag}
                      className="flex w-14 flex-col items-center gap-1.5 text-center"
                      title={tag}
                    >
                      <TechIcon name={tag} size={34} />
                      <span className="max-w-full truncate text-[11px] text-text-muted">
                        {tag}
                      </span>
                    </span>
                  ))}
                </span>
              )}
            />
          </Section>
        )}
      </div>
    </div>
  );
}
