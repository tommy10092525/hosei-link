import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-transparent text-base font-bold whitespace-nowrap transition-colors duration-150 outline-none focus-visible:border-ring focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** 主要操作。1画面に1つ。文字は on-brand (白にしない) */
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 disabled:border-input disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100",
        /** 取り消せない操作の実行ボタン。必ず確認ダイアログの中で使う */
        destructive: "bg-danger text-on-danger hover:bg-danger/90",
        /** 副次操作 (枠線) */
        outline:
          "border-input bg-surface-raised text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        /** 学内認証など安心・完了を示す操作 */
        trust: "bg-trust text-on-trust hover:bg-trust/90",
        /** 通報・ブロックの入口 (枠線のみ) */
        danger: "border-danger bg-surface-raised text-danger hover:bg-danger-tint",
        ink: "bg-ink text-surface hover:bg-ink/90",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-brand-strong underline underline-offset-4 hover:text-foreground",
      },
      size: {
        default: "min-h-12 px-6 py-2 has-[>svg]:px-5 [&_svg:not([class*='size-'])]:size-5",
        xs: "min-h-8 gap-1 px-3 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3.5",
        /** リスト内の補助操作だけに使う */
        sm: "min-h-10 gap-1.5 px-4 text-sm has-[>svg]:px-3",
        lg: "min-h-14 px-8 text-[17px] has-[>svg]:px-6 [&_svg:not([class*='size-'])]:size-5",
        icon: "size-12 [&_svg:not([class*='size-'])]:size-6",
        "icon-xs": "size-8 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-10 [&_svg:not([class*='size-'])]:size-5",
        "icon-lg": "size-14 [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
