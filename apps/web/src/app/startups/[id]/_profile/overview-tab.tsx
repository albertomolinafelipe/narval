import { Mail } from "lucide-react";
import { components } from "@/lib/api/generated";
import { Section, SocialLink } from "./ui";
import { FoundersSection } from "./founders-section";

type Startup = components["schemas"]["Startup"];

export function OverviewTab({ startup }: { startup: Startup }) {
  const hasContact = !!startup.contact_general;

  return (
    <div className="flex flex-col gap-8">
      {/* Founders */}
      <FoundersSection startup={startup} />

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
