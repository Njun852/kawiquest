import { signOut } from "@/app/(auth)/actions";
import { Avatar, Button } from "@/components/ui";
import { getCurrentAccount } from "@/lib/auth/session";

const ROLE_WORD = { admin: "Admin", validator: "Validator", contributor: "Contributor", player: "Player" } as const;

/** Sidebar footer: who is signed in, and sign out. People are shown by username. */
export async function SidebarUser() {
  const me = await getCurrentAccount();
  if (!me) return null;
  return (
    <>
      <Avatar name={me.username} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{me.username}</div>
        <div className="kq-muted" style={{ fontSize: 12 }}>
          {ROLE_WORD[me.role]}
        </div>
      </div>
      <form action={signOut} style={{ marginLeft: "auto" }}>
        <Button type="submit" variant="ghost" size="sm" icon="logout" iconOnly>
          Sign out
        </Button>
      </form>
    </>
  );
}
