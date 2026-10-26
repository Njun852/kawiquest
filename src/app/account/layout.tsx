import { SignedInShell } from "@/components/shell/AppShell";

export default function Layout({ children }: LayoutProps<"/account">) {
  return <SignedInShell>{children}</SignedInShell>;
}
