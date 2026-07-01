import { cn } from "@/lib/utils";
import type { StartupLink } from "@/lib/startup/links";
import { SocialLink } from "./ui";

/**
 * Read-only renderer for a group of startup links (socials or product links).
 * Driven entirely by the selectors in `lib/startup/links.ts` — presentational
 * only, no knowledge of which fields exist.
 */
export function StartupLinks({
  links,
  className,
}: {
  links: StartupLink[];
  className?: string;
}) {
  if (links.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {links.map(({ id, label, href, Icon }) => (
        <SocialLink key={id} href={href} label={label}>
          <Icon size={14} />
        </SocialLink>
      ))}
    </div>
  );
}
