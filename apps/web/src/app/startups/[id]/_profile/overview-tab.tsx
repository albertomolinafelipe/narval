import { MapPin, Users, Calendar, Mail, Globe } from "lucide-react";
import { SiLinkedin, SiX, SiInstagram } from "react-icons/si";
import { components } from "@/lib/api/generated";
import { Pill } from "@/app/_components/shared/list-panel";
import { Section, SocialLink } from "./ui";
import { EditableText, EditableNumber, EditableLocation } from "./editable";

type Startup = components["schemas"]["Startup"];

export function OverviewTab({ startup }: { startup: Startup }) {
  const currentYear = new Date().getFullYear();

  const hasLinks =
    startup.website ||
    startup.contact_general ||
    startup.linkedin ||
    startup.twitter ||
    startup.instagram;

  return (
    <div className="flex flex-col gap-8">
      {/* Meta */}
      <div className="flex flex-wrap items-center gap-2">
        <EditableText
          field="stage"
          value={startup.stage ?? ""}
          placeholder="Stage"
          display={(v) => <Pill label={v} />}
        />
        <EditableText
          field="industry"
          value={startup.industry ?? ""}
          placeholder="Industry"
          display={(v) => <Pill label={v} />}
        />
        <EditableLocation
          field="location"
          value={startup.location ?? ""}
          placeholder="Location"
          display={(v) => <Pill icon={<MapPin size={12} />} label={v} />}
        />
        <EditableNumber
          field="founded_year"
          value={startup.founded_year}
          placeholder="Founded year"
          min={1900}
          max={currentYear}
          display={(v) => (
            <Pill icon={<Calendar size={12} />} label={`Founded ${v}`} />
          )}
        />
        <EditableNumber
          field="team_size"
          value={startup.team_size}
          placeholder="Team size"
          min={1}
          display={(v) => (
            <Pill icon={<Users size={12} />} label={`${v} people`} />
          )}
        />
      </div>

      {/* Founders */}
      {startup.founders && startup.founders.length > 0 && (
        <Section title="Founders">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {startup.founders.map((founder, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-border bg-bg-raised p-3"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-bg-subtle">
                  {founder.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={founder.photo_url}
                      alt={founder.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-brand">
                      {founder.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">
                    {founder.name}
                  </p>
                  {founder.linkedin && (
                    <a
                      href={
                        founder.linkedin.startsWith("http")
                          ? founder.linkedin
                          : `https://linkedin.com/in/${founder.linkedin}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand hover:underline"
                    >
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Links */}
      {hasLinks && (
        <Section title="Links">
          <div className="flex flex-wrap gap-3">
            {startup.website && (
              <SocialLink
                href={startup.website}
                label={startup.website.replace(/^https?:\/\//, "")}
              >
                <Globe size={14} />
              </SocialLink>
            )}
            {startup.contact_general && (
              <SocialLink
                href={`mailto:${startup.contact_general}`}
                label={startup.contact_general}
              >
                <Mail size={14} />
              </SocialLink>
            )}
            {startup.linkedin && (
              <SocialLink href={startup.linkedin} label="LinkedIn">
                <SiLinkedin size={14} />
              </SocialLink>
            )}
            {startup.twitter && (
              <SocialLink href={startup.twitter} label="X / Twitter">
                <SiX size={14} />
              </SocialLink>
            )}
            {startup.instagram && (
              <SocialLink href={startup.instagram} label="Instagram">
                <SiInstagram size={14} />
              </SocialLink>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
