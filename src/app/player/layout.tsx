import { AppShell } from "@/components/shell/AppShell";

export default function Layout({ children }: LayoutProps<"/player">) {
  return <AppShell role="player">{children}</AppShell>;
}
