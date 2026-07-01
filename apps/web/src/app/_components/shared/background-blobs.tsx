import { cn } from "@/lib/utils";

/**
 * Animated decorative brand-glow blobs. Drop into any `relative` container
 * (ideally `overflow-hidden`); keep foreground content above it with a
 * positioned wrapper, e.g. `relative z-10`.
 */
export function BackgroundBlobs({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <div
        className="absolute -left-48 -top-48 h-[700px] w-[700px] rounded-full bg-brand opacity-40 blur-[130px] max-md:h-[320px] max-md:w-[320px] max-md:opacity-60 max-md:blur-[60px]"
        style={{ animation: "blob-drift-1 10s ease-in-out infinite" }}
      />
      <div
        className="absolute -bottom-48 right-0 h-[600px] w-[600px] rounded-full bg-brand opacity-30 blur-[110px] max-md:h-[280px] max-md:w-[280px] max-md:opacity-50 max-md:blur-[55px]"
        style={{ animation: "blob-drift-2 13s ease-in-out infinite" }}
      />
      <div
        className="absolute bottom-1/3 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-brand opacity-20 blur-[90px] max-md:h-[200px] max-md:w-[200px] max-md:opacity-40 max-md:blur-[45px]"
        style={{ animation: "blob-drift-3 16s ease-in-out infinite" }}
      />
    </div>
  );
}
