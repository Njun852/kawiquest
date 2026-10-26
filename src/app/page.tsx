import { redirect } from "next/navigation";

// The proxy sends "/" to the signed-in person's landing page or to sign-in before this renders.
export default function Home() {
  redirect("/sign-in");
}
