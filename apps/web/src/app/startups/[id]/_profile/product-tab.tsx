import { Globe } from "lucide-react";
import { SiAppstore, SiGoogleplay } from "react-icons/si";
import { components } from "@/lib/api/generated";
import { Section, SocialLink, EmptyState } from "./ui";

type Startup = components["schemas"]["Startup"];

export function ProductTab({ startup }: { startup: Startup }) {
  let productLinks: Record<string, string> = {};
  if (startup.product_links) {
    try {
      productLinks = JSON.parse(startup.product_links);
    } catch {
      /* ignore */
    }
  }

  if (Object.keys(productLinks).length === 0) {
    return (
      <EmptyState
        title="Nothing here yet"
        hint="Intro video, screenshots and demo links will live here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Section title="Links">
        <div className="flex flex-wrap gap-3">
          {productLinks.web && (
            <SocialLink href={productLinks.web} label="Try it online">
              <Globe size={14} />
            </SocialLink>
          )}
          {productLinks.ios && (
            <SocialLink href={productLinks.ios} label="App Store">
              <SiAppstore size={14} />
            </SocialLink>
          )}
          {productLinks.android && (
            <SocialLink href={productLinks.android} label="Google Play">
              <SiGoogleplay size={14} />
            </SocialLink>
          )}
        </div>
      </Section>
    </div>
  );
}
