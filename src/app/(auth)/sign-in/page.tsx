import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPlate } from "../AuthPlate";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthPlate>
      {/* The form reads ?next, ?expired and ?reset from the URL, so it renders on the client behind a boundary. */}
      <Suspense fallback={<div className="kq-panel kq-auth__form" aria-busy />}>
        <SignInForm />
      </Suspense>
    </AuthPlate>
  );
}
