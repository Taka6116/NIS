"use client";

import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <Button
      variant="outline"
      className="rounded-xl border-rose-400/30 text-rose-200 hover:bg-rose-500/15"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      ログアウト
    </Button>
  );
}
