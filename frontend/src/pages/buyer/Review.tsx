import { Button as UiButton } from "@/components/ui/button";
import { Textarea as UiTextarea } from "@/components/ui/textarea";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { BuyButton, Glyph, Verified } from "@/components/buyer/BuyerParts";
import { useBuyer } from "@/context/BuyerContext";
import { FileUpload } from "@/components/buyer/BuyerWidgets";
export function Review() {
  const {
    items,
    errors,
    setErrors,
    rating,
    setRating,
    review,
    setReview,
    reviewSent,
    submitReview,
    files,
    purchaseId,
    heading,
    go,
  } = useBuyer();
  return (
    <div className="buy-centered-flow">
      {reviewSent ? (
        <>
          <span className="buy-state-icon">
            <Glyph name="check" />
          </span>
          <span className="buy-eyebrow">YOUR VOICE MAKES A DIFFERENCE</span>
          <h1 ref={heading} tabIndex={-1}>
            Thank you for your review.
          </h1>
          <p>
            You've helped the next buyer trade with a little more confidence.
          </p>
          <section className="buy-panel buy-posted-review">
            <span className="buy-status-pill">Order completed</span>
            <h2>{items[0].seller}</h2>
            <div className="buy-review-stars">
              {Array.from(
                {
                  length: 5,
                },
                (_, i) => (
                  <Glyph
                    key={i}
                    name="star"
                    className={i < rating ? "filled" : ""}
                  />
                ),
              )}
            </div>
            <p>{review}</p>
            {files.length > 0 && (
              <small>
                {files.length} photo{files.length > 1 ? "s" : ""} attached
                locally
              </small>
            )}
            <Verified />
          </section>
          <BuyButton onClick={() => go("marketplace")}>
            Continue Shopping
            <Glyph name="arrow" />
          </BuyButton>
          <BuyButton secondary onClick={() => go("orders")}>
            View Orders
          </BuyButton>
        </>
      ) : (
        <>
          <span className="buy-state-icon">
            <Glyph name="star" />
          </span>
          <span className="buy-eyebrow">ORDER COMPLETED · {purchaseId}</span>
          <h1 ref={heading} tabIndex={-1}>
            How was your experience?
          </h1>
          <p>
            Your honest feedback helps great sellers grow and buyers choose with
            confidence.
          </p>
          <form
            className="buy-panel buy-review-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const next: Record<string, string> = {};
              if (!rating) next.rating = "Choose a star rating.";
              if (review.trim().length < 10)
                next.review = "Tell us a little more (at least 10 characters).";
              setErrors(next);
              if (!Object.keys(next).length)
                void submitReview().catch(() =>
                  setErrors({
                    review: "Could not save your review. Please try again.",
                  }),
                );
            }}
          >
            <div className="buy-review-seller">
              <img src={items[0].image} alt={items[0].name} />
              <div>
                <strong>{items[0].name}</strong>
                <span>{items[0].seller}</span>
              </div>
            </div>
            <fieldset className="buy-star-field">
              <legend>Rate your experience</legend>
              <div className="buy-star-input">
                {Array.from(
                  {
                    length: 5,
                  },
                  (_, i) => (
                    <UiLabel key={i} className={i < rating ? "filled" : ""}>
                      <UiInput
                        type="radio"
                        name="rating"
                        value={i + 1}
                        checked={rating === i + 1}
                        onChange={() => setRating(i + 1)}
                        aria-label={`${i + 1} star${i ? "s" : ""}`}
                      />
                      <Glyph name="star" />
                    </UiLabel>
                  ),
                )}
              </div>
              <span>
                {rating
                  ? [
                      "",
                      "Not great",
                      "Could be better",
                      "Good",
                      "Really good",
                      "Exceptional",
                    ][rating]
                  : "Choose a rating"}
              </span>
              {errors.rating && (
                <span className="buy-error">{errors.rating}</span>
              )}
            </fieldset>
            <div className="buy-field">
              <UiLabel htmlFor="review">Your review</UiLabel>
              <UiTextarea
                id="review"
                placeholder="Tell us about the fish, the seller, and the delivery..."
                rows={4}
                value={review}
                maxLength={1000}
                onChange={(e) => setReview(e.target.value)}
                aria-invalid={!!errors.review}
              />
              {errors.review && (
                <span className="buy-error">{errors.review}</span>
              )}
              <small>{review.length}/1000 characters</small>
            </div>
            <div className="buy-field">
              <UiLabel>
                Photos <span>(optional)</span>
              </UiLabel>
              <FileUpload />
            </div>
            <BuyButton type="submit">
              Submit Review
              <Glyph name="arrow" />
            </BuyButton>
            <UiButton
              variant="plain"
              type="button"
              className="buy-text-link"
              onClick={() => go("orders")}
            >
              I'll do this later
            </UiButton>
          </form>
        </>
      )}
    </div>
  );
}
