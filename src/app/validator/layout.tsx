import { AppShell } from "@/components/shell/AppShell";

export default function Layout({ children }: LayoutProps<"/validator">) {
  return <AppShell role="validator">{children}</AppShell>;
}
