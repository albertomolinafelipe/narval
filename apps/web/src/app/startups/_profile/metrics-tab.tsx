import { Mail } from "lucide-react";
import type { Startup } from "@/lib/api/gen";
import { Pill } from "@/app/_components/shared/list-panel";
import { Section, SocialLink, EmptyState } from "./ui";

export function MetricsTab({ startup }: { startup: Startup }) {
  if (!startup.is_raising) {
    return (
      <EmptyState
        title="Coming soon"
        hint="Traction — users, growth and milestones."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Section title="Funding">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {startup.current_round && (
              <Pill label={startup.current_round} variant="accent" />
            )}
            {startup.funding_ask && <Pill label={startup.funding_ask} />}
          </div>
          {startup.funding_use && (
            <p className="text-sm leading-relaxed text-text-muted">
              {startup.funding_use}
            </p>
          )}
          {startup.contact_funding && (
            <div className="flex flex-wrap gap-3 pt-1">
              <SocialLink
                href={`mailto:${startup.contact_funding}`}
                label={startup.contact_funding}
              >
                <Mail size={14} />
              </SocialLink>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
