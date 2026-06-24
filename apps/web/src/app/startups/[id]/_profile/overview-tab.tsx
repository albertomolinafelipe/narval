"use client";

import { Mail } from "lucide-react";
import { components } from "@/lib/api/generated";
import { Section, SocialLink } from "./ui";
import { EditableMarkdown, MarkdownHelp } from "./markdown";
import { FoundersSection } from "./founders-section";
import { MilestonesSection } from "./milestones-section";
import { EditableVideo } from "./video-embed";
import { useProfileEdit } from "./edit-context";

type Startup = components["schemas"]["Startup"];

export function OverviewTab({ startup }: { startup: Startup }) {
  const { isOwner } = useProfileEdit();
  const hasContact = !!startup.contact_general;

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
      {/* Left column — primary content (~60%) */}
      <div className="flex min-w-0 flex-1 flex-col gap-8 lg:basis-3/5">
        {/* About — long-form markdown pitch */}
        {(startup.about || isOwner) && (
          <Section title="About">
            <MarkdownHelp />
            <EditableMarkdown
              field="about"
              value={startup.about ?? ""}
              placeholder="Tell your story — what you're building, why it matters, and where you're headed."
              maxLength={5000}
            />
          </Section>
        )}

        {/* Milestones */}
        <MilestonesSection startup={startup} />

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

      {/* Right column — founders + video (~40%) */}
      <div className="flex min-w-0 flex-col gap-8 lg:basis-2/5">
        {/* Founders */}
        <FoundersSection startup={startup} />

        {/* Intro video (self-gates: owners get an add slot, visitors see nothing when empty) */}
        <EditableVideo value={startup.video_url ?? ""} />
      </div>
    </div>
  );
}
