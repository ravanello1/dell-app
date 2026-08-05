"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, LogIn, TriangleAlert } from "lucide-react";
import { loginAction, type LoginState } from "@/modules/auth/auth.actions";
import { Button } from "@/ui/button";
import { Field, Input } from "@/ui/field";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending}>
      <LogIn className="size-4" aria-hidden />
      Entrar
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-(--radius-field) border border-danger/25 bg-danger-soft px-3 py-2.5 text-sm text-danger"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      <Field label="E-mail" error={state.fieldErrors?.email} required>
        <Input
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="voce@dellbeautystudio.com.br"
          autoFocus
          required
        />
      </Field>

      <Field label="Senha" error={state.fieldErrors?.password} required>
        <div className="relative">
          <Input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className="pr-11"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink-400 transition-colors hover:bg-gold-50 hover:text-gold-700"
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </Field>

      <SubmitButton />
    </form>
  );
}
