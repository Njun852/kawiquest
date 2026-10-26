import { AppShell } from "@/components/shell/AppShell";

export default function Layout({ children }: LayoutProps<"/admin">) {
  return <AppShell role="admin">{children}</AppShell>;
}
