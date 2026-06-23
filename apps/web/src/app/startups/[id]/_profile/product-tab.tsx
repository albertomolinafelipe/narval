"use client";

import { Globe } from "lucide-react";
import { SiAppstore, SiGoogleplay } from "react-icons/si";
import { components } from "@/lib/api/generated";
import { Section, SocialLink, EmptyState } from "./ui";
import { GallerySection } from "./gallery-section";
import { useProfileEdit } from "./edit-context";

type Startup = components["schemas"]["Startup"];

export function ProductTab({ startup }: { startup: Startup }) {
  const { isOwner } = useProfileEdit();

  let productLinks: Record<string, string> = {};
  if (startup.product_links) {
    try {
      productLinks = JSON.parse(startup.product_links);
    } catch {
      /* ignore */
    }
  }

  const hasLinks = Object.keys(productLinks).length > 0;
  let hasGallery = false;
  if (startup.gallery) {
    try {
      const g = JSON.parse(startup.gallery);
      hasGallery = Array.isArray(g) && g.length > 0;
    } catch {
      /* ignore */
    }
  }

  // Visitors with nothing to show get the placeholder; the owner always sees the
  // sections so they can add content (GallerySection renders its own add slot).
  if (!isOwner && !hasLinks && !hasGallery) {
    return (
      <EmptyState
        title="Nothing here yet"
        hint="Intro video, screenshots and demo links will live here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <GallerySection startup={startup} />

      {hasLinks && (
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
      )}
    </div>
  );
}
