import { Button as UiButton } from "@/components/ui/button";
export const Req = () => (
  <b className="pt-req" aria-hidden>
    *
  </b>
);
export const Opt = () => <span className="pt-opt">Optional</span>;
export function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="pt-toggle">
      <div>
        <b>{label}</b>
        <span>{hint}</span>
      </div>
      <UiButton
        variant="plain"
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className="pt-switch"
        onClick={() => onChange(!on)}
      />
    </div>
  );
}
