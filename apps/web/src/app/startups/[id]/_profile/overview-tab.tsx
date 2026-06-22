import { Mail } from "lucide-react";
import { components } from "@/lib/api/generated";
import { Section, SocialLink } from "./ui";

type Startup = components["schemas"]["Startup"];

export function OverviewTab({ startup }: { startup: Startup }) {
  const hasContact = !!startup.contact_general;

  return (
    <div className="flex flex-col gap-8">
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

      {/* Contact */}
      {hasContact && (
        <Section title="Contact">
          <div className="flex flex-wrap gap-3">
            <SocialLink
              href={`mailto:${startup.contact_general}`}
              label={startup.contact_general!}
            >
              <Mail size={14} />
            </SocialLink>
          </div>
        </Section>
      )}
    </div>
  );
}
