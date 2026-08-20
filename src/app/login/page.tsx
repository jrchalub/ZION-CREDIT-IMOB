import { Suspense } from "react";
import LoginPage from "./page-client";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <LoginPage />
    </Suspense>
  );
}
