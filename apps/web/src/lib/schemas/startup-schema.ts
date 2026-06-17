import { z } from "zod";

// Valid enum values matching backend validation
const VALID_STAGES = [
  "idea",
  "pre-seed",
  "seed",
  "series-a",
  "series-b",
  "growth",
  "profitable",
] as const;

const VALID_INDUSTRIES = [
  "AI/ML",
  "FinTech",
  "HealthTech",
  "Climate Tech",
  "EdTech",
  "SaaS",
  "Marketplace",
  "Developer Tools",
  "Hardware",
  "Consumer",
  "Deep Tech",
  "Logistics",
  "Legal Tech",
  "HR Tech",
  "Other",
] as const;

const VALID_ROUNDS = [
  "pre-seed",
  "seed",
  "series-a",
  "series-b",
  "bridge",
] as const;

// Helper for optional URL validation
const optionalUrl = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val || val === "") return true;
      try {
        // Allow URLs without protocol
        const urlToTest = val.startsWith("http") ? val : `https://${val}`;
        new URL(urlToTest);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Must be a valid URL" },
  );

// Social handle: user enters only the path after the fixed domain prefix
const socialHandle = z.string().max(200).optional().or(z.literal(""));

// Product links JSON structure
const productLinksSchema = z.object({
  web: optionalUrl,
  ios: z.string().max(500).optional().or(z.literal("")),
  android: z.string().max(500).optional().or(z.literal("")),
});

// Main startup profile schema
export const startupProfileSchema = z.object({
  // Identity
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  tagline: z
    .string()
    .max(160, "Tagline must be less than 160 characters")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .max(1000, "Description must be less than 1000 characters")
    .optional()
    .or(z.literal("")),
  stage: z.enum(VALID_STAGES).optional().or(z.literal("")),
  industry: z.enum(VALID_INDUSTRIES).optional().or(z.literal("")),
  team_size: z
    .number()
    .int()
    .positive("Team size must be positive")
    .optional()
    .nullable(),
  location: z.string().optional().or(z.literal("")),
  founded_year: z
    .number()
    .int()
    .min(1800, "Founded year seems too early")
    .max(new Date().getFullYear() + 1, "Founded year cannot be in the future")
    .optional()
    .nullable(),

  // Tech & Product
  tech_stack: z.string().optional().or(z.literal("")),
  product_links: productLinksSchema.optional(),

  // Social Media — handle only (domain prefix is fixed in the UI)
  linkedin: socialHandle,
  twitter: socialHandle,
  github: socialHandle,
  instagram: socialHandle,

  // Funding
  is_raising: z.boolean().optional(),
  current_round: z.enum(VALID_ROUNDS).optional().or(z.literal("")),
  funding_ask: z.string().optional().or(z.literal("")),
  funding_use: z.string().optional().or(z.literal("")),

  // Talent
  is_hiring: z.boolean().optional(),
  open_roles: z.string().optional().or(z.literal("")),

  // Contact
  contact_general: z
    .string()
    .email("Must be a valid email")
    .optional()
    .or(z.literal("")),
  contact_funding: z
    .string()
    .email("Must be a valid email")
    .optional()
    .or(z.literal("")),
  contact_talent: z
    .string()
    .email("Must be a valid email")
    .optional()
    .or(z.literal("")),
});

// Type inference
export type StartupProfileFormData = z.infer<typeof startupProfileSchema>;

// Export enums for use in form dropdowns
export { VALID_STAGES, VALID_INDUSTRIES, VALID_ROUNDS };
