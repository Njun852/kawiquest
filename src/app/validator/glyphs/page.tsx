import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";

export const metadata: Metadata = { title: "Reference glyphs" };

export default function Page() {
  return <ComingSoon role="validator" eyebrow="Review" title="Reference glyphs" comingIn="the validator module (9)" />;
}
