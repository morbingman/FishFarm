import type { Listing, Perm } from "@/services/demoStore";
export const TABS: [string, string, (l: Listing) => boolean][] = [
  ["pending", "Pending Review", (l) => l.status === "pending"],
  ["changes", "Changes Requested", (l) => l.status === "changes"],
  ["rejected", "Rejected", (l) => l.status === "rejected"],
  ["approved", "Live", (l) => l.status === "approved"],
  ["paused", "Paused", (l) => l.status === "paused"],
  ["all", "All", (l) => l.status !== "draft"],
];
export const REASONS: [string, number][] = [
  ["Image quality", 4],
  ["Incomplete fish details", 2],
  ["Pricing concern", 3],
  ["Species policy", 1],
];
export const CHECKS = [
  "Photos are clear and show the actual fish",
  "Species and breed match the photos",
  "Price is within the market range",
  "Health status is credible",
];
export const money = (v: string) =>
  `$${Number(v || 0).toLocaleString("en-US")}`;
export const waitingHours = (l: Listing) =>
  Math.max(
    0,
    Math.round(
      (Date.now() - new Date(l.submittedAt ?? l.createdAt).getTime()) /
        3600_000,
    ),
  );
export type Mode = null | "approve" | "rejected" | "changes" | "takedown";
export const MATRIX: [string, string, Perm][] = [
  ["Browse marketplace", "View", "market.view"],
  ["Place orders", "Create", "order.create"],
  ["View own orders", "View", "order.view"],
  ["Create listings", "Create", "listing.create"],
  ["Edit own listings", "Edit", "listing.edit"],
  ["Delete own listings", "Delete", "listing.delete"],
  ["Submit listings for review", "Create", "listing.submit"],
  ["Pause / resume live listings", "Edit", "listing.pause"],
  ["Open moderation queue", "View", "listing.review"],
  ["Approve listings", "Approve", "listing.approve"],
  ["Reject / request changes", "Reject", "listing.reject"],
  ["Take down live listings", "Manage", "listing.takedown"],
  ["View users", "View", "user.view"],
  ["Suspend / reactivate users", "Manage", "user.manage"],
  ["View platform activity", "View", "activity.all"],
  ["Edit own profile", "Edit", "profile.edit"],
];
