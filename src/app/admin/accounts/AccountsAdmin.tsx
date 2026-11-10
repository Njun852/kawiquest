"use client";

import { useActionState, useCallback, useState } from "react";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  CardBody,
  CardHead,
  DataTable,
  Drawer,
  FilterBar,
  PageHead,
  RoleBadge,
  SelectField,
  SplitLayout,
  Tabs,
  TextField,
  type Column,
} from "@/components/ui";
import type { AccountRow } from "@/lib/accounts/queries";
import type { ActionResult } from "@/lib/server-actions";
import type { Role } from "@/lib/constants";
import { changeRole, createAccountAsAdmin, deleteAccount, sendPasswordLink, setActive, signOutEverywhere, updateDetails } from "./actions";

const TABS: { value: Role | "all" | "inactive"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "player", label: "Players" },
  { value: "contributor", label: "Contributors" },
  { value: "validator", label: "Validators" },
  { value: "admin", label: "Admins" },
  { value: "inactive", label: "Deactivated" },
];
const inTab = (a: AccountRow, tab: string) => tab === "all" || (tab === "inactive" ? !a.active : a.role === tab);
const ROLE_OPTIONS = [
  { value: "player", label: "Player" },
  { value: "contributor", label: "Contributor" },
  { value: "validator", label: "Validator" },
  { value: "admin", label: "Admin" },
];

export function AccountsAdmin({ accounts, meId }: { accounts: AccountRow[]; meId: number }) {
  const [tab, setTab] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const close = useCallback(() => setSelected(null), []);

  const q = query.trim().toLowerCase();
  const visible = accounts.filter(
    (a) =>
      inTab(a, tab) &&
      (!q || [a.username, a.email, `${a.first_name} ${a.last_name}`, `#${a.account_id}`].some((s) => s.toLowerCase().includes(q))),
  );

  const columns: Column<AccountRow>[] = [
    {
      key: "user",
      header: "Account",
      render: (a) => (
        <span className="kq-row" style={{ flexWrap: "nowrap", gap: 10 }}>
          <Avatar name={a.username} />
          <span>
            <strong>{a.username}</strong>
            {a.account_id === meId && <span className="kq-muted"> (you)</span>}
            <div className="kq-mono kq-muted" style={{ fontSize: 11 }}>
              #{a.account_id}
            </div>
          </span>
        </span>
      ),
    },
    { key: "email", header: "Email", render: (a) => a.email },
    { key: "role", header: "Role", render: (a) => <RoleBadge role={a.role} /> },
    { key: "registered", header: "Registered", render: (a) => a.registered },
    {
      key: "status",
      header: "Status",
      render: (a) =>
        !a.active ? (
          <Badge icon="lock">Deactivated</Badge>
        ) : a.invited ? (
          <Badge tone="wait" icon="clock">
            Invite pending
          </Badge>
        ) : (
          <span className="kq-muted">Active</span>
        ),
    },
  ];

  const current = selected != null ? accounts.find((a) => a.account_id === selected) ?? null : null;

  return (
    <>
      <PageHead
        eyebrow="People"
        title="Accounts"
        actions={
          <Button variant="primary" icon="plus" onClick={() => setCreating((v) => !v)} aria-expanded={creating}>
            New account
          </Button>
        }
      />
      {notice && <Banner tone="ok" title={notice} />}
      {creating && (
        <NewAccountPanel
          onClose={() => setCreating(false)}
          onCreated={(message) => {
            setCreating(false);
            setNotice(message);
          }}
        />
      )}

      <Tabs
        label="Role"
        value={tab}
        onChange={setTab}
        items={TABS.map((t) => ({
          value: t.value,
          label: t.label,
          count: accounts.filter((a) => inTab(a, t.value)).length,
        }))}
      />
      <FilterBar>
        <TextField
          compact
          grow
          label="Search"
          placeholder="Username, email, name or #id"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </FilterBar>

      <SplitLayout open={current != null}>
        <Card style={{ overflow: "hidden" }}>
          <CardHead title={`${accounts.length} account${accounts.length === 1 ? "" : "s"}`}>
            <span className="kq-muted" style={{ fontSize: 13 }}>
              Click a row to manage · {visible.length} shown
            </span>
          </CardHead>
          <DataTable
            caption="Accounts"
            columns={columns}
            rows={visible}
            rowKey={(a) => String(a.account_id)}
            selectedKey={selected != null ? String(selected) : null}
            onRowClick={(a) => {
              setNotice(null);
              setSelected(a.account_id);
            }}
            empty={accounts.length ? "No accounts match." : "No accounts yet."}
          />
        </Card>
        {current && (
          <AccountDrawer
            key={current.account_id}
            account={current}
            isMe={current.account_id === meId}
            onClose={close}
            onDeleted={(m) => {
              setSelected(null);
              setNotice(m);
            }}
          />
        )}
      </SplitLayout>
    </>
  );
}

function NewAccountPanel({ onClose, onCreated }: { onClose: () => void; onCreated: (message: string) => void }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await createAccountAsAdmin(prev, fd);
    if (r.done === "saved") onCreated(r.success!);
    return r;
  }, {});
  const err = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <Card>
      <CardHead title="New account">
        <Button variant="ghost" size="sm" icon="x" iconOnly onClick={onClose}>
          Close
        </Button>
      </CardHead>
      <CardBody>
        <form action={action} className="kq-stack" style={{ gap: 14 }} noValidate>
          <p className="kq-muted" style={{ margin: 0, fontSize: 13 }}>
            Any role can be created here; validators and admins only here. The person gets an email with a link to set
            their own password; you never see or type it.
          </p>
          <div className="kq-grid kq-g2">
            <TextField label="First name" name="first_name" defaultValue={v.first_name} error={err.first_name} />
            <TextField label="Last name" name="last_name" defaultValue={v.last_name} error={err.last_name} />
          </div>
          <div className="kq-grid kq-g2">
            <TextField label="Email" name="email" type="email" defaultValue={v.email} error={err.email} />
            <TextField label="Username" name="username" defaultValue={v.username} error={err.username} />
          </div>
          <div className="kq-grid kq-g2">
            <SelectField label="Role" name="role" defaultValue={v.role ?? "player"} error={err.role} options={ROLE_OPTIONS} />
            <TextField label="Birthday (optional)" name="birthday" type="date" defaultValue={v.birthday} error={err.birthday} />
          </div>
          {state.error && <Banner tone="bad" title={state.error} />}
          <div className="kq-row" style={{ justifyContent: "flex-end" }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" icon="plus" pending={pending}>
              {pending ? "Creating…" : "Create and send invite"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function AccountDrawer({
  account,
  isMe,
  onClose,
  onDeleted,
}: {
  account: AccountRow;
  isMe: boolean;
  onClose: () => void;
  onDeleted: (message: string) => void;
}) {
  // One result line for the drawer's several small forms: whichever ran last.
  const [result, setResult] = useState<ActionResult>({});
  const wrap = (fn: (prev: ActionResult, fd: FormData) => Promise<ActionResult>) => async (prev: ActionResult, fd: FormData) => {
    const r = await fn(prev, fd);
    setResult(r);
    return r;
  };
  const [details, detailsAction, saving] = useActionState<ActionResult, FormData>(wrap(updateDetails), {});
  const [, activeAction, toggling] = useActionState<ActionResult, FormData>(wrap(setActive), {});
  const [, roleAction, changing] = useActionState<ActionResult, FormData>(wrap(changeRole), {});
  const [, linkAction, sending] = useActionState<ActionResult, FormData>(wrap(sendPasswordLink), {});
  const [, outAction, signingOut] = useActionState<ActionResult, FormData>(wrap(signOutEverywhere), {});
  const [, delAction, deleting] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await deleteAccount(prev, fd);
    if (r.done === "deleted") onDeleted(r.success!);
    else setResult(r);
    return r;
  }, {});
  const [confirming, setConfirming] = useState(false);
  const idField = <input type="hidden" name="account_id" value={account.account_id} />;
  const hasData = account.samples + account.sessions + account.questProgress + account.reviews > 0;
  // Field errors and typed values from the details form, kept until the next save.
  const de = details.fieldErrors ?? {};
  const dv = details.values ?? {};

  return (
    <Drawer title={account.username} onClose={onClose}>
      {!account.active && (
        <Banner tone="wait" title="Deactivated">
          This account can&apos;t sign in. Its data is kept.
        </Banner>
      )}
      <form action={detailsAction} className="kq-stack" style={{ gap: 10 }} noValidate>
        {idField}
        <div className="kq-grid kq-g2" style={{ gap: 10 }}>
          <TextField label="First name" name="first_name" defaultValue={dv.first_name ?? account.first_name} error={de.first_name} />
          <TextField label="Last name" name="last_name" defaultValue={dv.last_name ?? account.last_name} error={de.last_name} />
        </div>
        <TextField label="Email" name="email" type="email" defaultValue={dv.email ?? account.email} error={de.email} />
        <div className="kq-grid kq-g2" style={{ gap: 10 }}>
          <TextField label="Username" name="username" defaultValue={dv.username ?? account.username} error={de.username} />
          <TextField label="Birthday" name="birthday" type="date" defaultValue={dv.birthday ?? account.birthday ?? ""} error={de.birthday} />
        </div>
        <Button type="submit" size="sm" icon="save" pending={saving} style={{ alignSelf: "flex-start" }}>
          {saving ? "Saving…" : "Save details"}
        </Button>
      </form>

      <dl className="kq-facts" style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <dt>Account ID</dt>
        <dd className="kq-mono">#{account.account_id}</dd>
        <dt>Registered</dt>
        <dd>{account.registered}</dd>
        <dt>Data</dt>
        <dd>
          {account.samples} sample(s) · {account.sessions} game session(s)
          {account.reviews > 0 && <> · {account.reviews} review(s)</>}
        </dd>
      </dl>

      <form key={account.role} action={roleAction} className="kq-stack" style={{ gap: 8 }}>
        {idField}
        <SelectField
          label="Role"
          name="role"
          defaultValue={account.role}
          disabled={isMe}
          hint={isMe ? "You can't change your own role." : "Changing the role signs them out everywhere."}
          options={ROLE_OPTIONS}
        />
        {!isMe && (
          <Button type="submit" size="sm" pending={changing} style={{ alignSelf: "flex-start" }}>
            {changing ? "Changing…" : "Change role"}
          </Button>
        )}
      </form>

      <div className="kq-stack" style={{ gap: 8, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <form action={linkAction}>
          {idField}
          <Button type="submit" size="sm" icon="key" pending={sending}>
            {sending ? "Sending…" : account.invited ? "Resend invite" : "Send password reset"}
          </Button>
        </form>
        <form action={outAction}>
          {idField}
          <Button type="submit" size="sm" icon="logout" pending={signingOut}>
            {signingOut ? "Signing out…" : "Sign out everywhere"}
          </Button>
        </form>
        {!isMe && (
          <form action={activeAction}>
            {idField}
            <input type="hidden" name="active" value={account.active ? "false" : "true"} />
            <Button type="submit" size="sm" variant={account.active ? "danger" : "secondary"} icon={account.active ? "lock" : "check"} pending={toggling}>
              {toggling ? "Saving…" : account.active ? "Deactivate account" : "Reactivate account"}
            </Button>
          </form>
        )}
      </div>

      {result.error && <Banner tone="bad" title={result.error} />}
      {result.success && !result.fieldErrors && <Banner tone="ok" title={result.success} />}

      {!isMe && hasData && (
        <p className="kq-muted" style={{ margin: 0, fontSize: 13, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          This account can&apos;t be deleted: its samples, game data and reviews are research records. Deactivate it instead.
        </p>
      )}
      {!isMe && !hasData && (
        <div className="kq-stack" style={{ gap: 10, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          {!confirming ? (
            <Button variant="danger" size="sm" icon="trash" onClick={() => setConfirming(true)} style={{ alignSelf: "flex-start" }}>
              Delete account
            </Button>
          ) : (
            <form action={delAction} className="kq-stack" style={{ gap: 10 }}>
              {idField}
              <Banner tone="bad" title={`Delete ${account.username}?`}>
                This can&apos;t be undone.
              </Banner>
              <div className="kq-row" style={{ justifyContent: "flex-end" }}>
                <Button onClick={() => setConfirming(false)}>Keep it</Button>
                <Button type="submit" variant="danger" icon="trash" pending={deleting}>
                  {deleting ? "Deleting…" : "Delete account"}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </Drawer>
  );
}
