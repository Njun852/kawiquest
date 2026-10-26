import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";

export const metadata: Metadata = { title: "Validation queue" };

export default function Page() {
  return <ComingSoon role="validator" eyebrow="Review" title="Validation queue" comingIn="the validator module (9)" />;
}
