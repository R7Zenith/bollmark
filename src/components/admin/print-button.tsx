"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/admin/button";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" size="sm" onClick={() => window.print()}>
      <Printer size={14} aria-hidden /> {label}
    </Button>
  );
}
