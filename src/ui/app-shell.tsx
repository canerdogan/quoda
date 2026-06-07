import type { FC, PropsWithChildren } from "hono/jsx";
import { raw } from "hono/html";
import { Layout } from "./layout";
import { Nav } from "./components/nav";
import type { AppUser } from "../middleware/auth";

type AppShellProps = PropsWithChildren<{
  user: AppUser;
  title?: string;
  /** active top-nav key for aria-current */
  active?: "dashboard" | "new" | "settings";
}>;

/**
 * AppShell — the authenticated page wrapper. Shared by dashboard, studio,
 * qr-detail, settings, and onboarding so the signed-in surface is consistent.
 * Includes the top Nav (brand, primary links, theme toggle) and a centered
 * content container. Returns a full HTML document (doctype + Layout).
 */
export const AppShell: FC<AppShellProps> = ({ user, title, active, children }) => (
  <>
    {raw("<!DOCTYPE html>")}
    <Layout title={title}>
      <div class="page">
        <Nav
          brandHref="/app"
          links={[
            { label: "Dashboard", href: "/app", active: active === "dashboard" },
            { label: "Settings", href: "/app/settings", active: active === "settings" },
            { label: "Sign out", href: "/auth/logout" },
          ]}
          cta={{ label: "New QR", href: "/app/new" }}
        />
        <main class="page-main">{children}</main>
      </div>
    </Layout>
  </>
);
