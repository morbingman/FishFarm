import "./native-select.css";
import { cn } from "@/utils/cn";
import { ChevronDownIcon } from "lucide-react";
function NativeSelect({
  className,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & {
  size?: "sm" | "default";
}) {
  return (
    <div
      className="group/native-select native-select-view-1"
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        data-size={size}
        className={cn(
          "native-select-view-2",
          "native-select-view-3",
          "native-select-view-4",
          className,
        )}
        {...props}
      />
      <ChevronDownIcon
        className="native-select-view-5"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}
function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("native-select-view-6", className)}
      {...props}
    />
  );
}
function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("native-select-view-6", className)}
      {...props}
    />
  );
}
export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
