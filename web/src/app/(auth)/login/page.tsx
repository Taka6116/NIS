import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { CredentialsForm } from "./credentials-form";

export const dynamic = "force-dynamic";

const hasGoogle = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const hasDevBypass = process.env.NIS_DEV_BYPASS_AUTH === "1";
const hasCredentials = !!(process.env.AUTH_EMAIL && process.env.AUTH_PASSWORD);

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="glow-border w-full max-w-md space-y-6 p-8">
        <div>
          <h1 className="text-2xl font-bold text-white">NIS</h1>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Nihon Insight System
          </p>
          <p className="mt-3 text-sm text-slate-400">
            サインインしてプロジェクトへアクセスします。
          </p>
        </div>

        {hasCredentials ? <CredentialsForm /> : null}

        {hasGoogle ? (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <Button type="submit" className="w-full">
              Google で続行
            </Button>
          </form>
        ) : null}

        {hasDevBypass ? (
          <form
            action={async () => {
              "use server";
              await signIn("dev-bypass", { redirectTo: "/" });
            }}
          >
            <Button type="submit" variant="secondary" className="w-full">
              開発モードで続行（OAuth 不要）
            </Button>
          </form>
        ) : null}

        {!hasGoogle && !hasDevBypass && !hasCredentials ? (
          <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-200">
            ログイン手段がありません。<code>.env.local</code> に{" "}
            <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code>（Google OAuth）、
            <code>AUTH_EMAIL</code> / <code>AUTH_PASSWORD</code>（メール認証）、
            または <code>NIS_DEV_BYPASS_AUTH=1</code>（開発バイパス）を設定してください。
          </div>
        ) : null}
      </Card>
    </div>
  );
}
