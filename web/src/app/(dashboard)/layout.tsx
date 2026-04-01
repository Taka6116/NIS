import { LoginTransition } from "@/components/layout/login-transition";

/** Dashboard routes call `auth()` and DB — dynamic only. */
export const dynamic = "force-dynamic";

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return <LoginTransition>{children}</LoginTransition>;
}
