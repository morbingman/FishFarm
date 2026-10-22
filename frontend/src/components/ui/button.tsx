import "./button.css";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";
const buttonVariants = cva("button-view-1", {
  variants: {
    variant: {
      plain: "",
      default: "button-view-2",
      destructive: "button-view-3",
      outline: "button-view-4",
      secondary: "button-view-5",
      ghost: "button-view-6",
      link: "button-view-7",
    },
    size: {
      default: "button-view-8",
      sm: "button-view-9",
      lg: "button-view-10",
      icon: "button-view-11",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={
          variant === "plain"
            ? cn("button-view-12", className)
            : cn(
                buttonVariants({
                  variant,
                  size,
                  className,
                }),
              )
        }
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
export { Button, buttonVariants };
