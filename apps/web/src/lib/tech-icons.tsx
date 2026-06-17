import {
  SiReact,
  SiNextdotjs,
  SiTypescript,
  SiJavascript,
  SiGo,
  SiPython,
  SiNodedotjs,
  SiPostgresql,
  SiKubernetes,
  SiDocker,
  SiAmazonwebservices,
  SiGraphql,
  SiTailwindcss,
  SiPrisma,
  SiRedis,
  SiMongodb,
  SiApachekafka,
  SiTerraform,
  SiFastapi,
  SiHuggingface,
  SiClickhouse,
  SiRust,
  SiSwift,
  SiKotlin,
  SiFlutter,
  SiFirebase,
  SiSupabase,
  SiStripe,
  SiVercel,
  SiCloudflare,
  SiElasticsearch,
  SiMysql,
  SiSqlite,
  SiCelery,
  SiOpenai,
  SiAnthropic,
} from "react-icons/si";

/**
 * Map of tech stack names (lowercase) to their corresponding icons.
 * Use this to display icons for tech stack tags.
 *
 * @example
 * ```tsx
 * import { getTechIcon } from "@/lib/tech-icons";
 *
 * const icon = getTechIcon("react");
 * const icon2 = getTechIcon("React"); // Case insensitive
 * ```
 */
export const TECH_ICONS: Record<string, React.ReactNode> = {
  react: <SiReact size={12} />,
  "next.js": <SiNextdotjs size={12} />,
  nextjs: <SiNextdotjs size={12} />,
  typescript: <SiTypescript size={12} />,
  javascript: <SiJavascript size={12} />,
  go: <SiGo size={12} />,
  golang: <SiGo size={12} />,
  python: <SiPython size={12} />,
  "node.js": <SiNodedotjs size={12} />,
  nodejs: <SiNodedotjs size={12} />,
  postgresql: <SiPostgresql size={12} />,
  postgres: <SiPostgresql size={12} />,
  kubernetes: <SiKubernetes size={12} />,
  k8s: <SiKubernetes size={12} />,
  docker: <SiDocker size={12} />,
  aws: <SiAmazonwebservices size={12} />,
  graphql: <SiGraphql size={12} />,
  tailwind: <SiTailwindcss size={12} />,
  tailwindcss: <SiTailwindcss size={12} />,
  prisma: <SiPrisma size={12} />,
  redis: <SiRedis size={12} />,
  mongodb: <SiMongodb size={12} />,
  kafka: <SiApachekafka size={12} />,
  terraform: <SiTerraform size={12} />,
  fastapi: <SiFastapi size={12} />,
  "hugging face": <SiHuggingface size={12} />,
  huggingface: <SiHuggingface size={12} />,
  clickhouse: <SiClickhouse size={12} />,
  rust: <SiRust size={12} />,
  swift: <SiSwift size={12} />,
  kotlin: <SiKotlin size={12} />,
  flutter: <SiFlutter size={12} />,
  firebase: <SiFirebase size={12} />,
  supabase: <SiSupabase size={12} />,
  stripe: <SiStripe size={12} />,
  vercel: <SiVercel size={12} />,
  cloudflare: <SiCloudflare size={12} />,
  elasticsearch: <SiElasticsearch size={12} />,
  mysql: <SiMysql size={12} />,
  sqlite: <SiSqlite size={12} />,
  celery: <SiCelery size={12} />,
  openai: <SiOpenai size={12} />,
  anthropic: <SiAnthropic size={12} />,
};

/**
 * Get the icon for a given tech stack name (case insensitive).
 * Returns undefined if no icon is found.
 *
 * @param techName - The name of the technology (e.g., "React", "node.js", "PostgreSQL")
 * @returns The icon component or undefined
 */
export function getTechIcon(techName: string): React.ReactNode | undefined {
  return TECH_ICONS[techName.toLowerCase()];
}

/**
 * Parse a comma-separated tech stack string into an array of tech names.
 *
 * @param techStack - Comma-separated string of tech names
 * @returns Array of trimmed tech names
 *
 * @example
 * ```tsx
 * parseTechStack("React, TypeScript, Node.js")
 * // Returns: ["React", "TypeScript", "Node.js"]
 * ```
 */
export function parseTechStack(techStack: string | null | undefined): string[] {
  if (!techStack) return [];
  return techStack
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
