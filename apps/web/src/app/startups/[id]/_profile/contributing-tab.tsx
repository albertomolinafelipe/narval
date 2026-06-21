import { Mail } from "lucide-react";
import { SiGithub } from "react-icons/si";
import { components } from "@/lib/api/generated";
import { Pill } from "@/app/_components/shared/list-panel";
import { TECH_ICONS, parseTechStack } from "@/lib/tech-icons";
import { Section, SocialLink, EmptyState } from "./ui";

type Startup = components["schemas"]["Startup"];

export function ContributingTab({ startup }: { startup: Startup }) {
  const techTags = parseTechStack(startup.tech_stack);

  const openRoleTags = startup.open_roles
    ? startup.open_roles.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const isHiring = startup.is_hiring && openRoleTags.length > 0;
  const hasAny = techTags.length > 0 || startup.github || isHiring;

  if (!hasAny) {
    return (
      <EmptyState
        title="Nothing here yet"
        hint="Open-source info, good first issues and ways to help will live here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {techTags.length > 0 && (
        <Section title="Tech stack">
          <div className="flex flex-wrap gap-2">
            {techTags.map((tag) => (
              <Pill
                key={tag}
                icon={TECH_ICONS[tag.toLowerCase()]}
                label={tag}
                variant="code"
              />
            ))}
          </div>
        </Section>
      )}

      {startup.github && (
        <Section title="Source">
          <div className="flex flex-wrap gap-3">
            <SocialLink href={startup.github} label="GitHub">
              <SiGithub size={14} />
            </SocialLink>
          </div>
        </Section>
      )}

      {isHiring && (
        <Section title="We're hiring">
          <div className="flex flex-wrap gap-2">
            {openRoleTags.map((role) => (
              <Pill key={role} label={role} variant="accent" />
            ))}
          </div>
          {startup.contact_talent && (
            <div className="mt-3 flex flex-wrap gap-3">
              <SocialLink
                href={`mailto:${startup.contact_talent}`}
                label={startup.contact_talent}
              >
                <Mail size={14} />
              </SocialLink>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
