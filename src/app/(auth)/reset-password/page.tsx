import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPlate } from "../AuthPlate";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Choose a password" };

// Used for both password resets and staff invites: the link's token decides which account it is.
export default function ResetPasswordPage() {
  return (
    <AuthPlate>
      <Suspense fallback={<div className="kq-panel kq-auth__form" aria-busy />}>
        <ResetForm />
      </Suspense>
    </AuthPlate>
  );
}
