"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BrainPage() {
  const router = useRouter();
  useEffect(() => {
    if (window.innerWidth < 768) {
      router.replace("/quick");
    } else {
      router.replace("/inbox");
    }
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-screen">
      <span className="text-4xl animate-pulse">🧠</span>
    </div>
  );
}
