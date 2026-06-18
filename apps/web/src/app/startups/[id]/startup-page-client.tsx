"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/user";
import { useEffect, useState } from "react";
import {
  Star,
  Share2,
  Check,
  MapPin,
  Users,
  Calendar,
  Mail,
  Globe,
  X,
  Maximize2,
} from "lucide-react";
import {
  SiLinkedin,
  SiGithub,
  SiX,
  SiInstagram,
  SiAppstore,
  SiGoogleplay,
} from "react-icons/si";
import { components } from "@/lib/api/generated";
import { useAuthGuard } from "@/lib/use-auth-guard";
import {
  useStartupQuery,
  useFavoriteMutation,
  useBoostMutation,
} from "@/lib/api/use-startups-query";
import { Avatar, Pill, IconButton } from "@/app/_components/shared/list-panel";
import { BoostButton } from "@/app/_components/shared/boost-button";
import { TECH_ICONS, parseTechStack } from "@/lib/tech-icons";
import { trackViewDetail, trackFavorite } from "@/lib/analytics";

type Startup = components["schemas"]["Startup"];

interface Props {
  startup: Startup;
  compact?: boolean;
  onClose?: () => void;
}

//  Main component
export default function StartupPageClient({
  startup: initialStartup,
  compact = false,
  onClose,
}: Props) {
  const router = useRouter();
  const { user } = useUser();
  const requireAuth = useAuthGuard();

  // Use React Query with server data as placeholder while fetching
  // Note: We know initialStartup is non-null (checked by server page), so we can safely fallback
  const { data: queryStartup = initialStartup } = useStartupQuery(
    initialStartup.id,
    initialStartup,
  );

  // Safety check: if query returns null, fall back to initialStartup
  const startup = queryStartup ?? initialStartup;

  // Mutations
  const favoriteMutation = useFavoriteMutation();
  const boostMutation = useBoostMutation();

  const isOwner = user?.email === startup.owner_email;
  const [copied, setCopied] = useState(false);

  function handleShare() {
    const url = `${window.location.origin}/startups/${startup.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Track page view (only in full page mode)
  useEffect(() => {
    if (!compact) {
      trackViewDetail("startup", startup.id.toString(), {
        name: startup.name,
        industry: startup.industry,
        stage: startup.stage,
      });
    }
  }, [compact, startup.id, startup.name, startup.industry, startup.stage]);

  async function handleFavorite() {
    if (!requireAuth()) return;

    try {
      const wasFavorited = startup.is_favorited ?? false;
      await favoriteMutation.mutateAsync({
        id: startup.id,
        isFavorited: wasFavorited,
      });
      // Track the opposite state since we're toggling
      trackFavorite(startup.id.toString(), !wasFavorited);
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
      // You could add toast notification here
    }
  }

  async function handleBoost() {
    if (!requireAuth()) return;

    try {
      await boostMutation.mutateAsync(startup.id);
    } catch (error) {
      console.error("Failed to boost:", error);
    }
  }

  const banner = startup.banner_image ?? null;

  let productLinks: Record<string, string> = {};
  if (startup.product_links) {
    try {
      productLinks = JSON.parse(startup.product_links);
    } catch {
      /* ignore */
    }
  }

  const techTags = parseTechStack(startup.tech_stack);

  const openRoleTags = startup.open_roles
    ? startup.open_roles
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  // Compact mode: simplified panel view
  if (compact) {
    return (
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push(`/startups/${startup.id}`)}
              className="shrink-0 transition hover:opacity-80"
              aria-label="View full startup page"
            >
              <Avatar entity={startup} size={16} />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-text">
                {startup.name}
              </h2>
              {startup.tagline && (
                <p className="mt-0.5 text-sm text-text-muted">
                  {startup.tagline}
                </p>
              )}
              {startup.website && (
                <a
                  href={`https://${startup.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs text-brand hover:underline"
                >
                  {startup.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-1">
            <Link href={`/startups/${startup.id}`}>
              <IconButton label="Expand to full page">
                <Maximize2 size={16} />
              </IconButton>
            </Link>
            <IconButton
              label={
                startup.is_favorited
                  ? "Remove from favorites"
                  : "Add to favorites"
              }
              onClick={handleFavorite}
              disabled={favoriteMutation.isPending}
            >
              <Star
                size={16}
                fill={startup.is_favorited ? "currentColor" : "none"}
              />
            </IconButton>
            <BoostButton
              boosted={startup.has_boosted ?? false}
              count={startup.boost_count ?? 0}
              isPending={boostMutation.isPending}
              onClick={handleBoost}
              showCount={true}
              size="large"
            />
            <IconButton label={copied ? "Copied!" : "Share"} onClick={handleShare}>
              {copied ? <Check size={16} /> : <Share2 size={16} />}
            </IconButton>
            {onClose && (
              <>
                <div className="mx-1 h-4 w-px bg-border" />
                <IconButton label="Close" onClick={onClose}>
                  <X size={16} />
                </IconButton>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-6 px-6 py-5">
          {/* Metadata pills */}
          <div className="flex flex-wrap gap-2">
            {startup.stage && <Pill label={startup.stage} />}
            {startup.industry && <Pill label={startup.industry} />}
            {startup.location && (
              <Pill icon={<MapPin size={12} />} label={startup.location} />
            )}
            {startup.team_size != null && startup.team_size > 0 && (
              <Pill
                icon={<Users size={12} />}
                label={`${startup.team_size} people`}
              />
            )}
          </div>

          {/* About */}
          {startup.description && (
            <Section title="About">
              <p className="text-sm leading-relaxed text-text-muted">
                {startup.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
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
                {startup.github && (
                  <SocialLink href={startup.github} label="GitHub">
                    <SiGithub size={14} />
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

          {/* Tech stack */}
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

          {/* Funding */}
          {startup.is_raising && (
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
          )}

          {/* Talent / open roles */}
          {startup.is_hiring && openRoleTags.length > 0 && (
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

          {/* Product links */}
          {Object.keys(productLinks).length > 0 && (
            <Section title="Product">
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
      </div>
    );
  }

  // Full page mode
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/*  Banner  */}
      {banner ? (
        <div
          className="relative mb-8 overflow-hidden rounded-2xl bg-bg-subtle max-md:-mx-6 max-md:rounded-none"
          style={{ aspectRatio: "16/4" }}
        >
          <Image
            src={banner}
            alt={`${startup.name} banner`}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div
          className="mb-8 h-36 rounded-2xl max-md:-mx-6 max-md:rounded-none"
          style={{
            background:
              "linear-gradient(135deg, var(--color-brand-subtle) 0%, var(--color-bg-raised) 100%)",
          }}
        />
      )}

      {/*  Header: logo + name + actions  */}
      <div className="mb-6 flex items-start gap-5">
        <Avatar entity={startup} size={18} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-text">{startup.name}</h1>
          {startup.tagline && (
            <p className="mt-0.5 text-sm text-text-muted">{startup.tagline}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {startup.stage && <Pill label={startup.stage} />}
            {startup.industry && <Pill label={startup.industry} />}
            {startup.location && (
              <Pill icon={<MapPin size={12} />} label={startup.location} />
            )}
            {startup.founded_year != null && startup.founded_year > 0 && (
              <Pill
                icon={<Calendar size={12} />}
                label={`Founded ${startup.founded_year}`}
              />
            )}
            {startup.team_size != null && startup.team_size > 0 && (
              <Pill
                icon={<Users size={12} />}
                label={`${startup.team_size} people`}
              />
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 pt-1">
          <IconButton
            label={
              startup.is_favorited
                ? "Remove from favorites"
                : "Add to favorites"
            }
            onClick={handleFavorite}
            disabled={favoriteMutation.isPending}
          >
            <Star
              size={16}
              fill={startup.is_favorited ? "currentColor" : "none"}
            />
          </IconButton>
          <BoostButton
            boosted={startup.has_boosted ?? false}
            count={startup.boost_count ?? 0}
            isPending={boostMutation.isPending}
            onClick={handleBoost}
            showCount={true}
            size="large"
          />
          <IconButton label={copied ? "Copied!" : "Share"} onClick={handleShare}>
            {copied ? <Check size={16} /> : <Share2 size={16} />}
          </IconButton>
          {isOwner && (
            <Link
              href="/profile"
              className="ml-1 rounded-lg border border-border bg-bg-raised px-3 py-1.5 text-xs font-medium text-text transition hover:bg-bg-subtle"
            >
              Edit profile
            </Link>
          )}
        </div>
      </div>

      {/*  Body  */}
      <div className="flex flex-col gap-8">
          {/* About */}
          {startup.description && (
            <Section title="About">
              <p className="text-sm leading-relaxed text-text-muted">
                {startup.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
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
                {startup.github && (
                  <SocialLink href={startup.github} label="GitHub">
                    <SiGithub size={14} />
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

          {/* Tech stack */}
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

          {/* Funding */}
          {startup.is_raising && (
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
          )}

          {/* Talent / open roles */}
          {startup.is_hiring && openRoleTags.length > 0 && (
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

          {/* Product links */}
          {Object.keys(productLinks).length > 0 && (
            <Section title="Product">
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
    </div>
  );
}

//  Layout helpers

function Section({
  title,
  wip,
  children,
}: {
  title: string;
  wip?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className={wip ? "wip" : ""}>
      <SectionHeading>{title}</SectionHeading>
      {children}
    </section>
  );
}

//  Small components

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-subtle">
      {children}
    </h2>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  const url = href.startsWith("http") || href.startsWith("mailto:") ? href : `https://${href}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-subtle px-3 py-1.5 text-xs text-text-muted transition hover:bg-bg hover:text-text"
    >
      {children}
      <span>{label}</span>
    </a>
  );
}
