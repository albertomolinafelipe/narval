"use client";

import Image from "next/image";
import Link from "next/link";
import { useUser } from "@/lib/user";
import { useEffect, useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Star,
  Share2,
  Check,
  Mail,
  X,
  Maximize2,
  BadgeCheck,
  Pencil,
  Eye,
} from "lucide-react";
import { MdLocationOn, MdGroups } from "react-icons/md";
import { components } from "@/lib/api/generated";
import { useAuthGuard } from "@/lib/use-auth-guard";
import {
  useStartupQuery,
  useFavoriteMutation,
} from "@/lib/api/use-startups-query";
import { Avatar, Pill, IconButton } from "@/app/_components/shared/list-panel";
import { Button } from "@/components/ui/button";
import { BoostButton } from "@/app/_components/shared/boost-button";
import { getTechIcon, parseTechStack } from "@/lib/tech-icons";
import { trackViewDetail, trackFavorite } from "@/lib/analytics";
import { startupPath, startupEditPath } from "@/lib/startup-url";
import { getStartupSocials, getStartupProductLinks } from "@/lib/startup/links";
import { ProfileTabs } from "./_profile/profile-tabs";
import { ProfileEditProvider } from "./_profile/edit-context";
import { EditableText } from "./_profile/editable";
import { EditableImage } from "./_profile/editable-image";
import { SocialsColumn } from "./_profile/socials";
import { MetaPills } from "./_profile/meta-pills";
import { SetupBanner } from "./_profile/setup-banner";
import { Section, SocialLink } from "./_profile/ui";
import { StartupLinks } from "./_profile/startup-links";

type Startup = components["schemas"]["Startup"];

interface Props {
  startup: Startup;
  compact?: boolean;
  /** Full-page edit mode — renders inline edit affordances for the owner. */
  editable?: boolean;
  onClose?: () => void;
}

//  Main component
export default function StartupPageClient({
  startup: initialStartup,
  compact = false,
  editable = false,
  onClose,
}: Props) {
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

  const isOwner = user?.email === startup.owner_email;
  const [copied, setCopied] = useState(false);

  function handleShare() {
    const url = `${window.location.origin}${startupPath(startup)}`;
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

  const banner = startup.banner_image ?? null;

  const socialLinks = getStartupSocials(startup);
  const productLinkItems = getStartupProductLinks(startup);

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
        {/* Header — the whole top section links to the full page */}
        <div className="group relative flex items-start justify-between gap-4 border-b border-border px-6 py-5 transition hover:bg-bg-subtle/40 active:scale-[0.99]">
          {/* Stretched link: covers the header; interactive children below sit above it via z-10 */}
          <Link
            href={startupPath(startup)}
            aria-label={`View ${startup.name} full page`}
            className="absolute inset-0"
          />
          <div className="flex items-center gap-4">
            <Avatar entity={startup} size={16} />
            <div>
              <h2 className="flex items-center gap-1.5 text-lg font-semibold text-text">
                {startup.name}
                <Maximize2
                  size={14}
                  className="text-text-subtle opacity-0 transition group-hover:opacity-100"
                />
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
                  className="relative z-10 mt-1 inline-block text-xs text-brand hover:underline"
                >
                  {startup.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>

          {/* Action icons */}
          <div className="relative z-10 flex items-center gap-1">
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
            <BoostButton startup={startup} showCount={true} size="large" />
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
              <Pill icon={<MdLocationOn size={14} />} label={startup.location} />
            )}
            {startup.team_size != null && startup.team_size > 0 && (
              <Pill
                icon={<MdGroups size={14} />}
                label={`${startup.team_size} people`}
              />
            )}
          </div>

          {/* About */}
          {(startup.description || socialLinks.length > 0) && (
            <Section title="About">
              {startup.description && (
                <p className="text-sm leading-relaxed text-text-muted">
                  {startup.description}
                </p>
              )}
              <StartupLinks
                links={socialLinks}
                className={startup.description ? "mt-4" : undefined}
              />
            </Section>
          )}

          {/* Tech stack */}
          {techTags.length > 0 && (
            <Section title="Tech stack">
              <div className="flex flex-wrap gap-2">
                {techTags.map((tag) => (
                  <Pill
                    key={tag}
                    icon={getTechIcon(tag)}
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
          {productLinkItems.length > 0 && (
            <Section title="Product">
              <StartupLinks links={productLinkItems} />
            </Section>
          )}
        </div>
      </div>
    );
  }

  // Full page mode. Editing is gated on both real ownership AND the edit route
  // (`editable`) — the public page renders read-only even for the owner.
  const canEdit = isOwner && editable;

  return (
    <ProfileEditProvider startupId={startup.id} isOwner={canEdit}>
    <div className="mx-auto max-w-7xl px-[var(--page-px)] py-8">
      {/*  Setup invitation (owner, profile not yet published)  */}
      {isOwner && !startup.profile_setup && <SetupBanner />}

      {/*  Banner  */}
      <EditableImage
        kind="banner"
        hasImage={!!banner}
        aspect={16 / 4}
        rounded="rounded-2xl max-md:rounded-none"
        className="mb-8 bg-bg-subtle max-md:-mx-6"
      >
        {banner ? (
          <div className="relative w-full" style={{ aspectRatio: "16/4" }}>
            <Image
              src={banner}
              alt={`${startup.name} banner`}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div
            className="h-36 w-full"
            style={{
              background:
                "linear-gradient(135deg, var(--color-brand-subtle) 0%, var(--color-bg-raised) 100%)",
            }}
          />
        )}
      </EditableImage>

      {/*  Header: logo + name + actions  */}
      <div className="mb-6 flex items-center gap-5 max-md:flex-wrap max-md:gap-3">
        <EditableImage
          kind="logo"
          hasImage={!!startup.logo_url}
          aspect={1}
          rounded="rounded-lg"
          className="shrink-0"
        >
          <Avatar entity={startup} size={18} />
        </EditableImage>
        <div className="min-w-0 flex-1 max-md:order-last max-md:w-full max-md:flex-none">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-text">
            {startup.name}
            {startup.verified && (
              <Tooltip.Provider delayDuration={150}>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <span className="flex items-center text-brand">
                      <BadgeCheck size={20} className="shrink-0" />
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      sideOffset={5}
                      className="rounded-lg border border-border bg-bg-raised px-3 py-2 text-xs text-text shadow-md"
                    >
                      {startup.verified_domain
                        ? `Verified · ${startup.verified_domain}`
                        : "Verified"}
                      <Tooltip.Arrow className="fill-border" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            )}
          </h1>
          <EditableText
            field="tagline"
            value={startup.tagline ?? ""}
            placeholder="Add a tagline"
            maxLength={100}
            className="mt-0.5 block break-words text-sm text-text-muted"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2 max-md:ml-auto">
          {isOwner &&
            (editable ? (
              <Button asChild variant="soft" size="sm">
                <Link href={startupPath(startup)}>
                  <Eye size={16} />
                  Done
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href={startupEditPath(startup)}>
                  <Pencil size={16} />
                  Edit
                </Link>
              </Button>
            ))}
          <Button
            variant="ghost"
            size="icon"
            aria-label={copied ? "Copied!" : "Share"}
            title={copied ? "Copied!" : "Share"}
            onClick={handleShare}
          >
            {copied ? <Check size={16} /> : <Share2 size={16} />}
          </Button>
          <Button
            variant={startup.is_favorited ? "soft" : "ghost"}
            size="icon"
            aria-label={
              startup.is_favorited
                ? "Remove from favorites"
                : "Add to favorites"
            }
            title={
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
          </Button>
          <BoostButton startup={startup} showCount={true} size="large" />
        </div>
      </div>

      {/*  Meta pills + description (left)  |  Links (right)  */}
      <div className="mb-8 flex items-start justify-between gap-6">
        <div className="min-w-0 max-w-4xl flex-1">
          {/*  Meta pills  */}
          <div className="mb-4">
            <MetaPills startup={startup} />
          </div>
          <EditableText
            field="description"
            value={startup.description ?? ""}
            placeholder="Add a description"
            multiline
            maxLength={600}
            className="block whitespace-pre-wrap break-words text-sm leading-relaxed text-text-muted"
          />
        </div>
        <SocialsColumn startup={startup} />
      </div>

      {/*  Tabs  */}
      <ProfileTabs startup={startup} />
    </div>
    </ProfileEditProvider>
  );
}

