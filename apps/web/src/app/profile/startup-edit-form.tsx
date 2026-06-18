"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUser } from "@/lib/user";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { components } from "@/lib/api/generated";
import ImageCropperModal from "@/app/_components/shared/image-cropper-modal";
import LocationInput from "@/app/_components/forms/location-input";
import PillInput from "@/app/_components/shared/pill-input";
import { FormSection, ToggleRow } from "./form-components";
import {
  startupProfileSchema,
  type StartupProfileFormData,
  VALID_STAGES,
  VALID_INDUSTRIES,
  VALID_ROUNDS,
} from "@/lib/schemas/startup-schema";

type Startup = components["schemas"]["Startup"];

const SOCIAL_PREFIXES = {
  linkedin: "https://linkedin.com/",
  twitter: "https://x.com/",
  github: "https://github.com/",
  instagram: "https://instagram.com/",
};
const IOS_PREFIX = "https://apps.apple.com/";
const ANDROID_PREFIX = "https://play.google.com/";

function stripPrefix(url: string | undefined | null, prefix: string): string {
  if (!url) return "";
  const normalized = url.replace("https://www.", "https://");
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : url;
}

function PrefixInput({
  urlPrefix,
  ...props
}: { urlPrefix: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const displayPrefix = urlPrefix.replace("https://", "");
  return (
    <div className="flex overflow-hidden rounded-lg border border-border bg-bg-raised focus-within:border-border-focus focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand)_20%,transparent)]">
      <span className="flex shrink-0 items-center border-r border-border bg-bg-subtle px-3 text-sm text-text-subtle">
        {displayPrefix}
      </span>
      <input
        {...props}
        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-text outline-none placeholder:text-text-subtle"
      />
    </div>
  );
}

interface StartupEditFormProps {
  startup: Startup;
  onSaved: (s: Startup) => void;
}

export function StartupEditForm({ startup, onSaved }: StartupEditFormProps) {
  const { authenticated } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Logo state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(
    startup.logo_url ?? null,
  );
  const [logoCropSrc, setLogoCropSrc] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Founders state
  type FounderLocal = {
    name: string;
    linkedin: string;
    photo_url: string;
    photoFile?: File;
    photoPreview?: string;
    cropSrc?: string;
  };
  const [founders, setFounders] = useState<FounderLocal[]>(() =>
    (startup.founders ?? []).map((f) => ({
      name: f.name ?? "",
      linkedin: f.linkedin ?? "",
      photo_url: f.photo_url ?? "",
    }))
  );
  const [founderCropIndex, setFounderCropIndex] = useState<number | null>(null);
  const founderInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Banner state
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(
    startup.banner_image ?? null,
  );
  const [bannerCropSrc, setBannerCropSrc] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Parse product links
  const parsedProductLinks = (() => {
    try {
      return JSON.parse(startup.product_links ?? "{}");
    } catch {
      return {};
    }
  })();

  // Initialize form with React Hook Form + Zod
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StartupProfileFormData>({
    resolver: zodResolver(startupProfileSchema),
    defaultValues: {
      name: startup.name,
      tagline: startup.tagline ?? "",
      description: startup.description ?? "",
      stage: (startup.stage ?? "") as StartupProfileFormData["stage"],
      industry: (startup.industry ?? "") as StartupProfileFormData["industry"],
      team_size: startup.team_size ?? undefined,
      location: startup.location ?? "",
      founded_year: startup.founded_year ?? undefined,
      tech_stack: startup.tech_stack ?? "",
      product_links: {
        web: parsedProductLinks.web ?? "",
        ios: stripPrefix(parsedProductLinks.ios, IOS_PREFIX),
        android: stripPrefix(parsedProductLinks.android, ANDROID_PREFIX),
      },
      linkedin: stripPrefix(startup.linkedin, SOCIAL_PREFIXES.linkedin),
      twitter: stripPrefix(startup.twitter, SOCIAL_PREFIXES.twitter),
      github: stripPrefix(startup.github, SOCIAL_PREFIXES.github),
      instagram: stripPrefix(startup.instagram, SOCIAL_PREFIXES.instagram),
      is_raising: startup.is_raising ?? false,
      current_round: (startup.current_round ??
        "") as StartupProfileFormData["current_round"],
      funding_ask: startup.funding_ask ?? "",
      funding_use: startup.funding_use ?? "",
      is_hiring: startup.is_hiring ?? false,
      open_roles: startup.open_roles ?? "",
      contact_general: startup.contact_general ?? "",
      contact_funding: startup.contact_funding ?? "",
      contact_talent: startup.contact_talent ?? "",
    },
  });

  // Watch boolean fields for toggles
  const isRaising = watch("is_raising");
  const isHiring = watch("is_hiring");

  // Keyboard shortcut: Cmd/Ctrl + S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSubmit(onSubmit)();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onSubmit is intentionally excluded
  }, [handleSubmit]);

  // Handle logo file selection - show cropper
  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo file size must be less than 5MB");
      return;
    }

    // Read file and show cropper
    const reader = new FileReader();
    reader.onload = () => setLogoCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  // Handle logo crop complete
  function handleLogoCropComplete(croppedBlob: Blob) {
    const croppedFile = new File([croppedBlob], "logo.jpg", {
      type: "image/jpeg",
    });
    setLogoFile(croppedFile);

    // Create preview
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(croppedBlob);

    // Close cropper
    setLogoCropSrc(null);
  }

  // Handle banner file selection - show cropper
  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Banner file size must be less than 10MB");
      return;
    }

    // Read file and show cropper
    const reader = new FileReader();
    reader.onload = () => setBannerCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  // Handle banner crop complete
  function handleBannerCropComplete(croppedBlob: Blob) {
    const croppedFile = new File([croppedBlob], "banner.jpg", {
      type: "image/jpeg",
    });
    setBannerFile(croppedFile);

    // Create preview
    const reader = new FileReader();
    reader.onload = () => setBannerPreview(reader.result as string);
    reader.readAsDataURL(croppedBlob);

    // Close cropper
    setBannerCropSrc(null);
  }

  // Upload image helper
  async function uploadImage(
    file: File,
    endpoint: string,
    fieldName: string,
  ): Promise<string> {
    const formData = new FormData();
    formData.append(fieldName, file);

    const res = await fetch(endpoint, {
      method: "POST",
      credentials: "include", // SuperTokens session cookies
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to upload ${fieldName}`);
    }

    const data = await res.json();
    return data.url || data.logo_url || data.banner_image;
  }

  // Form submission handler
  async function onSubmit(data: StartupProfileFormData) {
    setError("");
    setLoading(true);

    try {
      const apiBase = "/api/proxy";

      // Upload logo if changed
      if (logoFile) {
        await uploadImage(
          logoFile,
          `${apiBase}/startups/${startup.id}/logo`,
          "logo",
        );
      }

      // Upload banner if changed
      if (bannerFile) {
        await uploadImage(
          bannerFile,
          `${apiBase}/startups/${startup.id}/banner`,
          "banner",
        );
      }

      // Prepare update payload
      const updatePayload = {
        name: data.name,
        tagline: data.tagline || undefined,
        description: data.description || undefined,
        stage: data.stage || undefined,
        industry: data.industry || undefined,
        team_size: data.team_size ?? undefined,
        location: data.location || undefined,
        founded_year: data.founded_year ?? undefined,
        tech_stack: data.tech_stack || undefined,
        product_links: JSON.stringify({
          web: data.product_links?.web || undefined,
          ios: data.product_links?.ios
            ? IOS_PREFIX + data.product_links.ios
            : undefined,
          android: data.product_links?.android
            ? ANDROID_PREFIX + data.product_links.android
            : undefined,
        }),
        linkedin: data.linkedin
          ? SOCIAL_PREFIXES.linkedin + data.linkedin
          : undefined,
        twitter: data.twitter
          ? SOCIAL_PREFIXES.twitter + data.twitter
          : undefined,
        github: data.github ? SOCIAL_PREFIXES.github + data.github : undefined,
        instagram: data.instagram
          ? SOCIAL_PREFIXES.instagram + data.instagram
          : undefined,
        is_raising: data.is_raising,
        current_round: data.current_round || undefined,
        funding_ask: data.funding_ask || undefined,
        funding_use: data.funding_use || undefined,
        is_hiring: data.is_hiring,
        open_roles: data.open_roles || undefined,
        contact_general: data.contact_general || undefined,
        contact_funding: data.contact_funding || undefined,
        contact_talent: data.contact_talent || undefined,
        profile_setup: true, // Mark profile as complete
        founders: JSON.stringify(
          await Promise.all(
            founders.map(async (f) => {
              let photoUrl = f.photo_url;
              if (f.photoFile) {
                const url = await uploadImage(
                  f.photoFile,
                  `${apiBase}/startups/${startup.id}/founder-photo`,
                  "photo",
                );
                photoUrl = url;
              }
              return { name: f.name, linkedin: f.linkedin, photo_url: photoUrl };
            })
          )
        ),
      };

      // Update startup profile
      const updateRes = await fetch(`${apiBase}/startups/${startup.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // SuperTokens session cookies
        body: JSON.stringify(updatePayload),
      });

      if (!updateRes.ok) {
        const errorData = await updateRes.json().catch(() => ({}));
        throw new Error(
          errorData.message || "Failed to update startup profile",
        );
      }

      const updated = await updateRes.json();

      // Success!
      toast.success("Profile updated successfully!");
      onSaved(updated);
      router.refresh();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      toast.error(errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Logo Cropper Modal */}
      {logoCropSrc && (
        <ImageCropperModal
          imageSrc={logoCropSrc}
          onComplete={handleLogoCropComplete}
          onCancel={() => setLogoCropSrc(null)}
          aspect={1}
          cropShape="round"
          title="Crop Logo"
        />
      )}

      {/* Banner Cropper Modal */}
      {bannerCropSrc && (
        <ImageCropperModal
          imageSrc={bannerCropSrc}
          onComplete={handleBannerCropComplete}
          onCancel={() => setBannerCropSrc(null)}
          aspect={16 / 5}
          cropShape="rect"
          title="Crop Banner"
        />
      )}

      <div className="flex gap-8">
        {/* Main form content */}
        <form
          id="startup-edit-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 flex flex-col gap-8"
        >
          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-danger bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          {/* Section 1: Identity */}
          <FormSection
            title="Identity"
            hint="Basic information about your startup"
          >
            <div>
              <label
                htmlFor="name"
                className="mb-1 block text-sm font-medium text-text"
              >
                Name <span className="text-danger">*</span>
              </label>
              <input
                id="name"
                {...register("name")}
                className="input"
                placeholder="Acme Inc."
              />
              {errors.name && (
                <p className="mt-1 text-xs text-danger">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="tagline"
                className="mb-1 block text-sm font-medium text-text"
              >
                Tagline
              </label>
              <input
                id="tagline"
                {...register("tagline")}
                className="input"
                placeholder="Building the future of..."
                maxLength={160}
              />
              {errors.tagline && (
                <p className="mt-1 text-xs text-danger">
                  {errors.tagline.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-1 block text-sm font-medium text-text"
              >
                Description
              </label>
              <textarea
                id="description"
                {...register("description")}
                className="input min-h-[120px]"
                placeholder="Tell us about your startup..."
                maxLength={1000}
              />
              {errors.description && (
                <p className="mt-1 text-xs text-danger">
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="stage"
                  className="mb-1 block text-sm font-medium text-text"
                >
                  Stage
                </label>
                <select id="stage" {...register("stage")} className="input">
                  <option value="">Select stage...</option>
                  {VALID_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
                {errors.stage && (
                  <p className="mt-1 text-xs text-danger">
                    {errors.stage.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="industry"
                  className="mb-1 block text-sm font-medium text-text"
                >
                  Industry
                </label>
                <select
                  id="industry"
                  {...register("industry")}
                  className="input"
                >
                  <option value="">Select industry...</option>
                  {VALID_INDUSTRIES.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </select>
                {errors.industry && (
                  <p className="mt-1 text-xs text-danger">
                    {errors.industry.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="team_size"
                  className="mb-1 block text-sm font-medium text-text"
                >
                  Team Size
                </label>
                <input
                  id="team_size"
                  type="number"
                  {...register("team_size", { valueAsNumber: true })}
                  className="input"
                  placeholder="10"
                  min="1"
                />
                {errors.team_size && (
                  <p className="mt-1 text-xs text-danger">
                    {errors.team_size.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="founded_year"
                  className="mb-1 block text-sm font-medium text-text"
                >
                  Founded Year
                </label>
                <input
                  id="founded_year"
                  type="number"
                  {...register("founded_year", { valueAsNumber: true })}
                  className="input"
                  placeholder="2024"
                  min="1800"
                  max={new Date().getFullYear() + 1}
                />
                {errors.founded_year && (
                  <p className="mt-1 text-xs text-danger">
                    {errors.founded_year.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="location"
                className="mb-1 block text-sm font-medium text-text"
              >
                Location
              </label>
              <LocationInput
                id="location"
                value={watch("location") || ""}
                onChange={(val) => setValue("location", val)}
                className="input"
              />
              {errors.location && (
                <p className="mt-1 text-xs text-danger">
                  {errors.location.message}
                </p>
              )}
            </div>

            {/* Logo Upload */}
            <div>
              <label className="mb-1 block text-sm font-medium text-text">
                Logo
              </label>
              <div className="flex items-center gap-4">
                {logoPreview && (
                  <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-border bg-bg-subtle">
                    <Image
                      src={logoPreview}
                      alt="Logo preview"
                      fill
                      className="object-cover"
                      unoptimized={logoPreview.startsWith("data:")}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="btn-ghost"
                >
                  {logoPreview ? "Change Logo" : "Upload Logo"}
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </div>
              <p className="mt-1 text-xs text-text-subtle">
                Max 5MB, square aspect ratio recommended
              </p>
            </div>

            {/* Banner Upload */}
            <div>
              <label className="mb-1 block text-sm font-medium text-text">
                Banner Image
              </label>
              <div className="flex flex-col gap-3">
                {bannerPreview && (
                  <div
                    className="relative w-full overflow-hidden rounded-lg border border-border bg-bg-subtle"
                    style={{ aspectRatio: "16/5" }}
                  >
                    <Image
                      src={bannerPreview}
                      alt="Banner preview"
                      fill
                      className="object-cover"
                      unoptimized={bannerPreview.startsWith("data:")}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  className="btn-ghost w-fit"
                >
                  {bannerPreview ? "Change Banner" : "Upload Banner"}
                </button>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerChange}
                  className="hidden"
                />
              </div>
              <p className="mt-1 text-xs text-text-subtle">
                Max 10MB, 16:5 aspect ratio
              </p>
            </div>
          </FormSection>

          {/* Section 2: Tech & Product */}
          <FormSection
            title="Tech & Product"
            hint="Technical details and product information"
          >
            <div>
              <label
                htmlFor="tech_stack"
                className="mb-1 block text-sm font-medium text-text"
              >
                Tech Stack
              </label>
              <PillInput
                value={watch("tech_stack") || ""}
                onChange={(val) => setValue("tech_stack", val)}
                placeholder="React, Node.js, PostgreSQL..."
              />
              {errors.tech_stack && (
                <p className="mt-1 text-xs text-danger">
                  {errors.tech_stack.message}
                </p>
              )}
              <p className="mt-1 text-xs text-text-subtle">
                Comma-separated list
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-text">
                Product Links
              </label>
              <div className="flex flex-col gap-2">
                <input
                  {...register("product_links.web")}
                  className="input"
                  placeholder="Web: https://example.com"
                />
                <PrefixInput
                  {...register("product_links.ios")}
                  urlPrefix={IOS_PREFIX}
                  placeholder="app/your-app/id123456789"
                />
                <PrefixInput
                  {...register("product_links.android")}
                  urlPrefix={ANDROID_PREFIX}
                  placeholder="store/apps/details?id=com.example"
                />
              </div>
            </div>
          </FormSection>

          {/* Section 3: Social Media */}
          <FormSection title="Social Media" hint="Connect your social profiles">
            <div>
              <label
                htmlFor="linkedin"
                className="mb-1 block text-sm font-medium text-text"
              >
                LinkedIn
              </label>
              <PrefixInput
                id="linkedin"
                {...register("linkedin")}
                urlPrefix={SOCIAL_PREFIXES.linkedin}
                placeholder="company/narval or in/johndoe"
              />
              {errors.linkedin && (
                <p className="mt-1 text-xs text-danger">
                  {errors.linkedin.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="twitter"
                className="mb-1 block text-sm font-medium text-text"
              >
                X / Twitter
              </label>
              <PrefixInput
                id="twitter"
                {...register("twitter")}
                urlPrefix={SOCIAL_PREFIXES.twitter}
                placeholder="yourhandle"
              />
              {errors.twitter && (
                <p className="mt-1 text-xs text-danger">
                  {errors.twitter.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="github"
                className="mb-1 block text-sm font-medium text-text"
              >
                GitHub
              </label>
              <PrefixInput
                id="github"
                {...register("github")}
                urlPrefix={SOCIAL_PREFIXES.github}
                placeholder="yourorg"
              />
              {errors.github && (
                <p className="mt-1 text-xs text-danger">
                  {errors.github.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="instagram"
                className="mb-1 block text-sm font-medium text-text"
              >
                Instagram
              </label>
              <PrefixInput
                id="instagram"
                {...register("instagram")}
                urlPrefix={SOCIAL_PREFIXES.instagram}
                placeholder="yourhandle"
              />
              {errors.instagram && (
                <p className="mt-1 text-xs text-danger">
                  {errors.instagram.message}
                </p>
              )}
            </div>
          </FormSection>

          {/* Section 4: Funding */}
          <FormSection title="Funding" hint="Fundraising information">
            <ToggleRow
              id="is_raising"
              label="Currently Raising"
              checked={isRaising ?? false}
              onChange={(val) => setValue("is_raising", val)}
            />

            {isRaising && (
              <>
                <div>
                  <label
                    htmlFor="current_round"
                    className="mb-1 block text-sm font-medium text-text"
                  >
                    Current Round
                  </label>
                  <select
                    id="current_round"
                    {...register("current_round")}
                    className="input"
                  >
                    <option value="">Select round...</option>
                    {VALID_ROUNDS.map((round) => (
                      <option key={round} value={round}>
                        {round}
                      </option>
                    ))}
                  </select>
                  {errors.current_round && (
                    <p className="mt-1 text-xs text-danger">
                      {errors.current_round.message}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="funding_ask"
                    className="mb-1 block text-sm font-medium text-text"
                  >
                    Funding Ask
                  </label>
                  <input
                    id="funding_ask"
                    {...register("funding_ask")}
                    className="input"
                    placeholder="€500k - €1M"
                  />
                  {errors.funding_ask && (
                    <p className="mt-1 text-xs text-danger">
                      {errors.funding_ask.message}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="funding_use"
                    className="mb-1 block text-sm font-medium text-text"
                  >
                    Use of Funds
                  </label>
                  <textarea
                    id="funding_use"
                    {...register("funding_use")}
                    className="input min-h-[80px]"
                    placeholder="How will you use the funding?"
                  />
                  {errors.funding_use && (
                    <p className="mt-1 text-xs text-danger">
                      {errors.funding_use.message}
                    </p>
                  )}
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="contact_funding"
                className="mb-1 block text-sm font-medium text-text"
              >
                Funding Contact Email
              </label>
              <input
                id="contact_funding"
                type="email"
                {...register("contact_funding")}
                className="input"
                placeholder="funding@example.com"
              />
              {errors.contact_funding && (
                <p className="mt-1 text-xs text-danger">
                  {errors.contact_funding.message}
                </p>
              )}
            </div>
          </FormSection>

          {/* Section 5: Talent */}
          <FormSection title="Talent" hint="Hiring information">
            <ToggleRow
              id="is_hiring"
              label="Currently Hiring"
              checked={isHiring ?? false}
              onChange={(val) => setValue("is_hiring", val)}
            />

            {isHiring && (
              <div>
                <label
                  htmlFor="open_roles"
                  className="mb-1 block text-sm font-medium text-text"
                >
                  Open Roles
                </label>
                <PillInput
                  value={watch("open_roles") || ""}
                  onChange={(val) => setValue("open_roles", val)}
                  placeholder="Software Engineer, Product Manager..."
                />
                {errors.open_roles && (
                  <p className="mt-1 text-xs text-danger">
                    {errors.open_roles.message}
                  </p>
                )}
                <p className="mt-1 text-xs text-text-subtle">
                  Comma-separated list
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="contact_talent"
                className="mb-1 block text-sm font-medium text-text"
              >
                Talent Contact Email
              </label>
              <input
                id="contact_talent"
                type="email"
                {...register("contact_talent")}
                className="input"
                placeholder="jobs@example.com"
              />
              {errors.contact_talent && (
                <p className="mt-1 text-xs text-danger">
                  {errors.contact_talent.message}
                </p>
              )}
            </div>
          </FormSection>

          {/* Section 6: Contact */}
          <FormSection title="Contact" hint="General contact information">
            <div>
              <label
                htmlFor="contact_general"
                className="mb-1 block text-sm font-medium text-text"
              >
                General Contact Email
              </label>
              <input
                id="contact_general"
                type="email"
                {...register("contact_general")}
                className="input"
                placeholder="hello@example.com"
              />
              {errors.contact_general && (
                <p className="mt-1 text-xs text-danger">
                  {errors.contact_general.message}
                </p>
              )}
            </div>
          </FormSection>

          {/* Section 7: Founders */}
          <FormSection title="Founders" hint="Add the people behind the startup">
            <div className="flex flex-col gap-4">
              {founders.map((founder, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-bg-raised p-4">
                  {/* Photo */}
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => founderInputRefs.current[i]?.click()}
                      className="relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-bg-subtle transition hover:opacity-80"
                    >
                      {(founder.photoPreview || founder.photo_url) ? (
                        <img
                          src={founder.photoPreview ?? founder.photo_url}
                          alt={founder.name || "Founder"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs text-text-muted">Photo</span>
                      )}
                    </button>
                    <input
                      ref={(el) => { founderInputRefs.current[i] = el; }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const preview = URL.createObjectURL(file);
                        setFounders((prev) =>
                          prev.map((f, idx) =>
                            idx === i ? { ...f, photoFile: file, photoPreview: preview, cropSrc: preview } : f
                          )
                        );
                        setFounderCropIndex(i);
                      }}
                    />
                  </div>

                  {/* Fields */}
                  <div className="flex flex-1 flex-col gap-2">
                    <input
                      type="text"
                      value={founder.name}
                      onChange={(e) =>
                        setFounders((prev) =>
                          prev.map((f, idx) => idx === i ? { ...f, name: e.target.value } : f)
                        )
                      }
                      placeholder="Full name"
                      className="input"
                    />
                    <div className="flex overflow-hidden rounded-lg border border-border bg-bg-raised focus-within:border-border-focus">
                      <span className="flex shrink-0 items-center border-r border-border bg-bg-subtle px-3 text-sm text-text-subtle">linkedin.com/in/</span>
                      <input
                        type="text"
                        value={founder.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "")}
                        onChange={(e) =>
                          setFounders((prev) =>
                            prev.map((f, idx) =>
                              idx === i ? { ...f, linkedin: e.target.value ? `https://linkedin.com/in/${e.target.value}` : "" } : f
                            )
                          )
                        }
                        placeholder="username"
                        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-text outline-none placeholder:text-text-subtle"
                      />
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => setFounders((prev) => prev.filter((_, idx) => idx !== i))}
                    className="ml-1 mt-0.5 rounded-lg p-1.5 text-text-muted transition hover:bg-bg-subtle hover:text-danger"
                    aria-label="Remove founder"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M2 2l10 10M12 2L2 12" />
                    </svg>
                  </button>
                </div>
              ))}

              {/* Crop modal for founder photo */}
              {founderCropIndex !== null && founders[founderCropIndex]?.cropSrc && (
                <ImageCropperModal
                  imageSrc={founders[founderCropIndex].cropSrc!}
                  onComplete={(blob) => {
                    const idx = founderCropIndex;
                    const file = new File([blob], "founder-photo.jpg", { type: "image/jpeg" });
                    const preview = URL.createObjectURL(blob);
                    setFounders((prev) =>
                      prev.map((f, i) => i === idx ? { ...f, photoFile: file, photoPreview: preview, cropSrc: undefined } : f)
                    );
                    setFounderCropIndex(null);
                  }}
                  onCancel={() => {
                    setFounders((prev) =>
                      prev.map((f, i) => i === founderCropIndex ? { ...f, cropSrc: undefined } : f)
                    );
                    setFounderCropIndex(null);
                  }}
                  aspect={1}
                  cropShape="rect"
                  title="Crop Founder Photo"
                />
              )}

              <button
                type="button"
                onClick={() => setFounders((prev) => [...prev, { name: "", linkedin: "", photo_url: "" }])}
                className="mt-1 flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-text-muted transition hover:border-brand hover:text-brand"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M7 2v10M2 7h10" />
                </svg>
                Add founder
              </button>
            </div>
          </FormSection>
        </form>

        {/* Sticky Save Button Sidebar */}
        <div className="w-56 shrink-0">
          <div className="sticky top-8 space-y-4">
            <button
              type="submit"
              form="startup-edit-form"
              disabled={loading}
              className="btn-primary w-full h-11 font-semibold shadow-md hover:shadow-lg transition-shadow"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </span>
              ) : (
                "Save Changes"
              )}
            </button>
            <p className="text-xs text-text-subtle text-center">
              <kbd className="px-2 py-1 bg-bg-subtle rounded text-[10px] font-mono border border-border">
                ⌘
              </kbd>
              {" + "}
              <kbd className="px-2 py-1 bg-bg-subtle rounded text-[10px] font-mono border border-border">
                S
              </kbd>
              {" to save"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
