import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Button as UiButton } from "@/components/ui/button";
import { Textarea as UiTextarea } from "@/components/ui/textarea";
import { Label as UiLabel } from "@/components/ui/label";
import { BuyButton, Glyph } from "@/components/buyer/BuyerParts";
import { useBuyer } from "@/context/BuyerContext";
import { OrderProduct, FileUpload } from "@/components/buyer/BuyerWidgets";
export function Dispute() {
  const {
    setModal,
    errors,
    setErrors,
    disputeSent,
    setDisputeSent,
    reason,
    setReason,
    problem,
    setProblem,
    heading,
    go,
  } = useBuyer();
  return (
    <div className="buy-centered-flow">
      <span className="buy-state-icon is-neutral">
        <Glyph name="shield" />
      </span>
      <span className="buy-eyebrow">WE'RE HERE TO HELP</span>
      <h1 ref={heading} tabIndex={-1}>
        {disputeSent ? "Your report is with our team." : "Let's Make It Right"}
      </h1>
      <p>
        {disputeSent
          ? "Your demo case #DS-10248 has been opened. The order is marked for review, not completed."
          : "Tell us what happened. We'll help you and the seller find a fair resolution."}
      </p>
      {disputeSent ? (
        <>
          <section className="buy-panel buy-dispute-success">
            <strong>Case #DS-10248 · Review pending</strong>
            <p>Reason: {reason}</p>
            <p>{problem}</p>
            <p className="buy-fine-print">
              In a live transaction, support would review the evidence and
              contact you. This report is saved only in this session.
            </p>
          </section>
          <BuyButton onClick={() => go("tracking")}>
            Back to Order
            <Glyph name="arrow" />
          </BuyButton>
          <BuyButton secondary onClick={() => setModal("support")}>
            Contact Support
          </BuyButton>
        </>
      ) : (
        <form
          className="buy-panel buy-dispute-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const next: Record<string, string> = {};
            if (!reason) next.reason = "Choose the type of issue.";
            if (problem.trim().length < 15)
              next.problem =
                "Please describe the issue in at least 15 characters.";
            setErrors(next);
            if (!Object.keys(next).length) setDisputeSent(true);
          }}
        >
          <OrderProduct />
          <div className="buy-field">
            <UiLabel htmlFor="reason">What went wrong?</UiLabel>
            <NativeSelect
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-invalid={!!errors.reason}
            >
              <NativeSelectOption value="">Select an issue</NativeSelectOption>
              {[
                "Fish arrived unwell",
                "Item doesn't match listing",
                "Damaged packaging",
                "Order not received",
                "Other issue",
              ].map((r) => (
                <NativeSelectOption key={r}>{r}</NativeSelectOption>
              ))}
            </NativeSelect>
            {errors.reason && (
              <span className="buy-error">{errors.reason}</span>
            )}
          </div>
          <div className="buy-field">
            <UiLabel htmlFor="problem">Describe the problem</UiLabel>
            <UiTextarea
              id="problem"
              rows={4}
              value={problem}
              maxLength={2000}
              placeholder="Include as much detail as you can..."
              onChange={(e) => setProblem(e.target.value)}
              aria-invalid={!!errors.problem}
            />
            {errors.problem && (
              <span className="buy-error">{errors.problem}</span>
            )}
          </div>
          <FileUpload />
          <BuyButton type="submit">
            Submit Report
            <Glyph name="arrow" />
          </BuyButton>
          <UiButton
            variant="plain"
            type="button"
            className="buy-text-link"
            onClick={() => go("delivery")}
          >
            Back to delivery confirmation
          </UiButton>
        </form>
      )}
    </div>
  );
}
