import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Badge,
  Banner,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHead,
  CopperTile,
  GlyphCard,
  IconButton,
  Logo,
  PageHead,
  RoleBadge,
  StatTile,
  StatusBadge,
} from "@/components/ui";
import { InteractiveDemo } from "./InteractiveDemo";

export const metadata: Metadata = { title: "Component guide" };

// Dev-only reference page for module 1: every UI primitive rendered with the design system's sample content.
export default function UiGuide() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="kq-main" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <PageHead
        eyebrow="Module 1 · Foundation"
        title="Component guide"
        actions={<ButtonLink href="/">Back home</ButtonLink>}
      />

      <Card>
        <CardHead title="Brand" />
        <CardBody className="kq-row" style={{ gap: 32 }}>
          <Logo />
          <div className="kq-plate" style={{ padding: "12px 16px", borderRadius: "var(--radius-md)" }}>
            <Logo />
          </div>
          <span className="kq-goldpill">
            Write <span className="kq-k">𑼒</span> ka
          </span>
        </CardBody>
      </Card>

      <div className="kq-grid kq-g2">
        <Card>
          <CardHead title="Buttons" />
          <CardBody className="kq-stack" style={{ gap: 14 }}>
            <div className="kq-row" style={{ gap: 12 }}>
              <Button variant="primary" icon="check">
                Submit
              </Button>
              <Button>Cancel</Button>
              <Button variant="danger">Sign out</Button>
              <Button variant="primary" disabled>
                Submit
              </Button>
            </div>
            <div className="kq-row" style={{ gap: 12 }}>
              <Button variant="primary" size="lg">
                Sign in
              </Button>
              <Button size="sm" icon="download">
                Export
              </Button>
              <Button variant="ghost">Forgot password?</Button>
              <Button variant="danger" icon="trash" iconOnly>
                Delete
              </Button>
            </div>
            <div className="kq-row" style={{ gap: 18 }}>
              <IconButton icon="undo">Undo</IconButton>
              <IconButton icon="trash">Clear</IconButton>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Status and role badges" />
          <CardBody className="kq-stack" style={{ gap: 14 }}>
            <div className="kq-row">
              <StatusBadge status="approved" />
              <StatusBadge status="completed" />
              <StatusBadge status="accepted" />
              <StatusBadge status="rejected" />
              <StatusBadge status="pending" />
              <StatusBadge status="flagged" />
              <StatusBadge status="in_progress" />
              <StatusBadge status="not_started" />
              <StatusBadge status="locked">Tier 4</StatusBadge>
            </div>
            <div className="kq-row">
              <RoleBadge role="admin" />
              <RoleBadge role="validator" />
              <RoleBadge role="contributor" />
              <RoleBadge role="player" />
              <Badge>Ligature</Badge>
              <Badge tone="wait" icon="clock">
                Combining · on KA
              </Badge>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="kq-grid kq-g3">
        <StatTile label="Writers enrolled" value="61" target="90" percent={68} footnote="68% of target" />
        <StatTile
          label="Reference forms"
          value="101"
          target="107"
          percent={94}
          tone="patina"
          footnote="6 waiting for the validator"
        />
        <StatTile label="Handwriting samples" value="11,482" footnote="2 passes per contributor" />
      </div>

      <Card>
        <CardHead title="Kawi on copper tiles" />
        <CardBody className="kq-stack" style={{ gap: 20 }}>
          <div className="kq-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
            <GlyphCard form="𑼄" transliteration="a" detail="U+11F04" status={<StatusBadge status="approved" />} />
            <GlyphCard form="𑼒" transliteration="ka" detail="U+11F12" status={<StatusBadge status="approved" />} />
            <GlyphCard form="𑼒𑼶" transliteration="ki" detail="sign I on KA" status={<StatusBadge status="pending">Pending review</StatusBadge>} />
            <GlyphCard form="𑼒𑽂𑼱" transliteration="ksa" detail="ligature" status={<StatusBadge status="locked">Tier 4</StatusBadge>} />
          </div>
          <div className="kq-row" style={{ gap: 8 }}>
            <span className="kq-label" style={{ marginRight: 8 }}>
              Mastery grid
            </span>
            <CopperTile form="𑼄" state="learned" />
            <CopperTile form="𑼅" state="learned" />
            <CopperTile form="𑼒" />
            <CopperTile form="𑼓" selected />
            <CopperTile form="𑼔" state="locked" />
            <CopperTile form="𑼕" state="locked" />
            <span className="kq-muted" style={{ fontSize: 13 }}>
              off-white = mastered · copper = practising · ? = locked
            </span>
          </div>
          <div className="kq-row" style={{ gap: 16, alignItems: "flex-end" }}>
            <CopperTile form="𑼒" size="sm" />
            <CopperTile form="𑼒" size="md" />
            <CopperTile form="𑼒" size="lg" large />
            <CopperTile form="𑼒𑽂𑼱" size="xl" large label="ksa" />
          </div>
        </CardBody>
      </Card>

      <div className="kq-grid kq-g3">
        <Banner tone="ok" title="Sent for validation">
          Next: write the form shown above.
        </Banner>
        <Banner tone="bad" title="That email/username and password don't match.">
          Try again, or use Forgot password?
        </Banner>
        <Banner tone="wait" title="Saving…" />
      </div>

      <InteractiveDemo />
    </main>
  );
}
