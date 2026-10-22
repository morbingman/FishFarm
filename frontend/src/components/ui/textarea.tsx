import "./textarea.css";
import * as React from "react";
import { cn } from "@/utils/cn";
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn("textarea-view-1", className)}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";
export { Textarea };
