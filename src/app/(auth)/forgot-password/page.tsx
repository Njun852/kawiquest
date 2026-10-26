import type { Metadata } from "next";
import { AuthPlate } from "../AuthPlate";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthPlate>
      <ForgotForm />
    </AuthPlate>
  );
}
