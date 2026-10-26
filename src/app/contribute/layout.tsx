import { AppShell } from "@/components/shell/AppShell";

export default function Layout({ children }: LayoutProps<"/contribute">) {
  return <AppShell role="contributor">{children}</AppShell>;
}
