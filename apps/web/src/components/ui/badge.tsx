import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Solid brand.
        default: "border-transparent bg-brand text-brand-fg",
        // Soft neutral chip — default for tags and inline links.
        secondary:
          "border-transparent bg-bg-subtle text-text-muted hover:bg-bg-subtle/70 hover:text-text",
        // Bordered, transparent fill.
        outline:
          "border-border text-text-muted hover:bg-bg-subtle hover:text-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}

export { Badge, badgeVariants };
