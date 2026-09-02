"use client";

import { useState } from "react";
import { Pencil, X, Check, KeyRound, Ban, RotateCcw } from "lucide-react";
import { Badge } from "@/components/admin/badge";
import { adminRoleLabel, adminRoles, type AdminRole } from "@/lib/roles";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => chars[n % chars.length]).join("");
}

const inputClass =
  "rounded-md border border-admin-border px-3 py-1.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function PersonelRow({
  id,
  name,
  email,
  role,
  isActive,
  isSelf,
  updateAction,
  toggleActiveAction,
  resetPasswordAction
}: {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  isSelf: boolean;
  updateAction: (formData: FormData) => void;
  toggleActiveAction: (formData: FormData) => void;
  resetPasswordAction: (formData: FormData) => void;
}) {
  const [mode, setMode] = useState<"view" | "editing" | "resetting">("view");
  const [tempPassword, setTempPassword] = useState("");

  if (mode === "editing") {
    return (
      <li className="flex items-center gap-2 px-4 py-3">
        <form action={updateAction} className="flex flex-1 flex-wrap items-center gap-2">
          <input name="name" defaultValue={name} required autoFocus className={`flex-1 ${inputClass}`} />
          <select name="role" defaultValue={role} disabled={isSelf} className={inputClass}>
            {adminRoles.map((r) => (
              <option key={r} value={r}>
                {adminRoleLabel[r]}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md p-1.5 text-green-600 hover:bg-green-50" title="Kaydet">
            <Check size={16} />
          </button>
        </form>
        <button
          type="button"
          onClick={() => setMode("view")}
          className="rounded-md p-1.5 text-admin-text-muted hover:bg-admin-bg"
          title="Vazgeç"
        >
          <X size={16} />
        </button>
      </li>
    );
  }

  if (mode === "resetting") {
    return (
      <li className="flex items-center gap-2 px-4 py-3">
        <form
          action={resetPasswordAction}
          className="flex flex-1 flex-wrap items-center gap-2"
          onSubmit={() => setMode("view")}
        >
          <input
            name="password"
            defaultValue={tempPassword}
            required
            minLength={8}
            autoFocus
            className={`flex-1 font-mono ${inputClass}`}
          />
          <button type="submit" className="rounded-md p-1.5 text-green-600 hover:bg-green-50" title="Şifreyi Kaydet">
            <Check size={16} />
          </button>
        </form>
        <button
          type="button"
          onClick={() => setMode("view")}
          className="rounded-md p-1.5 text-admin-text-muted hover:bg-admin-bg"
          title="Vazgeç"
        >
          <X size={16} />
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between px-4 py-3 text-sm text-admin-text">
      <div className="flex items-center gap-3">
        <div>
          <p>
            {name} {isSelf && <span className="text-xs text-admin-text-muted">(siz)</span>}
          </p>
          <p className="text-xs text-admin-text-muted">{email}</p>
        </div>
        <Badge tone={role === "ADMIN" ? "blue" : "gray"}>{adminRoleLabel[role]}</Badge>
        <Badge tone={isActive ? "green" : "red"}>{isActive ? "Aktif" : "Pasif"}</Badge>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMode("editing")}
          className="rounded-md p-1.5 text-admin-text-muted hover:bg-admin-bg"
          title="Düzenle"
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          onClick={() => {
            setTempPassword(generateTempPassword());
            setMode("resetting");
          }}
          className="rounded-md p-1.5 text-admin-text-muted hover:bg-admin-bg"
          title="Şifre Sıfırla"
        >
          <KeyRound size={15} />
        </button>
        {!isSelf && (
          <form
            action={toggleActiveAction}
            onSubmit={(e) => {
              if (!window.confirm(isActive ? `"${name}" pasifleştirilsin mi?` : `"${name}" aktifleştirilsin mi?`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="isActive" value={String(!isActive)} />
            <button
              type="submit"
              className="rounded-md p-1.5 text-admin-text-muted hover:bg-red-50 hover:text-red-600"
              title={isActive ? "Pasifleştir" : "Aktifleştir"}
            >
              {isActive ? <Ban size={15} /> : <RotateCcw size={15} />}
            </button>
          </form>
        )}
      </div>
    </li>
  );
}
