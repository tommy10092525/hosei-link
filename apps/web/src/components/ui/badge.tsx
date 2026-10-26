import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-3 py-0.5 text-xs leading-[18px] font-bold whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        /** 未読件数など。色だけでなく数字そのもので伝える */
        default: "bg-ink text-surface [a&]:hover:bg-ink/90",
        /** 新着・ハイライト */
        brand: "bg-brand-tint text-brand-strong",
        /** 学内認証済み・完了 */
        trust: "bg-trust-tint text-trust-strong",
        /** 今後対応予定 */
        soon: "border-dashed border-input bg-surface text-muted-foreground",
        /** 押せない属性表示 (曜日時限・区分など) */
        tag: "rounded-sm bg-muted px-2 font-normal text-muted-foreground",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-danger text-on-danger [a&]:hover:bg-danger/90",
        outline:
          "border-input bg-surface-raised text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-brand-strong underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
