import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return <ComingSoon role="player" eyebrow="My progress" title="Dashboard" comingIn="the player module (10)" />;
}
