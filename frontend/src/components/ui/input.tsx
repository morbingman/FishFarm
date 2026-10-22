import "./input.css";
import * as React from "react";
import { cn } from "@/utils/cn";
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          ["checkbox", "radio", "range", "file"].includes(type ?? "")
            ? ""
            : "input-view-5",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
export { Input };
