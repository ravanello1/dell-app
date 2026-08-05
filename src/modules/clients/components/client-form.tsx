"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ApiError } from "@/core/api/client";
import { maskPhoneInput } from "@/core/utils/phone";
import { Button } from "@/ui/button";
import { Card, CardBody, CardHeader } from "@/ui/card";
import { Field, Input, Select, Textarea } from "@/ui/field";
import { createClientSchema } from "../client.dto";
import { clientSourceLabels, clientSources } from "../client.schema";
import { useCreateClient, useUpdateClient } from "../client.api";
import type { ClientDto } from "../client.dto";

/**
 * Formulário de cadastro e edição.
 *
 * Valida no navegador com o MESMO schema que a API usa — as duas pontas nunca
 * divergem. Quando o servidor recusa por uma regra que só ele conhece (telefone
 * já cadastrado, por exemplo), o erro volta por campo e é plantado direto no
 * controle correspondente.
 */

type FormInput = z.input<typeof createClientSchema>;
type FormOutput = z.output<typeof createClientSchema>;

interface ClientFormProps {
  /** Ausente = cadastro novo. */
  client?: ClientDto;
  /** A recepção não enxerga nem edita observações de saúde. */
  canEditHealthNotes: boolean;
}

export function ClientForm({ client, canEditHealthNotes }: ClientFormProps) {
  const router = useRouter();
  const isEditing = Boolean(client);

  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient(client?.id ?? "");
  const mutation = isEditing ? updateMutation : createMutation;

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createClientSchema) as Resolver<FormInput, unknown, FormOutput>,
    defaultValues: {
      name: client?.name ?? "",
      phone: client ? client.phoneFormatted : "",
      email: client?.email ?? "",
      birthDate: client?.birthDate ?? "",
      instagram: client?.instagram ?? "",
      cep: client?.cep ?? "",
      street: client?.street ?? "",
      streetNumber: client?.streetNumber ?? "",
      complement: client?.complement ?? "",
      district: client?.district ?? "",
      city: client?.city ?? "Curitiba",
      state: client?.state ?? "PR",
      source: client?.source ?? undefined,
      notes: client?.notes ?? "",
      healthNotes: client?.healthNotes ?? "",
      lgpdConsent: client?.hasLgpdConsent ?? false,
    },
  });

  const phoneValue = watch("phone") ?? "";

  async function onSubmit(values: FormOutput) {
    try {
      const saved = await mutation.mutateAsync(values);
      toast.success(isEditing ? "Cliente atualizada." : "Cliente cadastrada.");
      router.push(`/clientes/${saved.id}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        // Erros por campo vindos da API vão para o controle correspondente.
        for (const [field, messages] of Object.entries(error.fields ?? {})) {
          setError(field as keyof FormInput, {
            type: "server",
            message: messages[0] ?? "Valor inválido.",
          });
        }
        toast.error(error.message);
        return;
      }
      toast.error("Não foi possível salvar. Tente novamente.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <Card>
        <CardHeader title="Dados da cliente" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo" error={errors.name?.message} required className="sm:col-span-2">
            <Input {...register("name")} placeholder="Maria Eduarda Silva" autoComplete="name" />
          </Field>

          <Field label="WhatsApp / telefone" error={errors.phone?.message} required>
            {/* Controlado à mão para a máscara ir aparecendo enquanto digita.
                O schema tira a máscara de volta antes de salvar. */}
            <Input
              {...register("phone")}
              value={String(phoneValue)}
              onChange={(event) =>
                setValue("phone", maskPhoneInput(event.target.value), { shouldValidate: false })
              }
              placeholder="(41) 99123-4567"
              inputMode="tel"
              autoComplete="tel"
            />
          </Field>

          <Field label="Instagram" error={errors.instagram?.message} hint="Só o usuário, sem o @">
            <Input {...register("instagram")} placeholder="dellbeautystudio" autoCapitalize="none" />
          </Field>

          <Field label="E-mail" error={errors.email?.message}>
            <Input {...register("email")} type="email" placeholder="maria@email.com" autoComplete="email" />
          </Field>

          <Field label="Data de nascimento" error={errors.birthDate?.message} hint="Usada nos aniversários do mês">
            <Input {...register("birthDate")} type="date" max="2030-12-31" />
          </Field>

          <Field label="Como conheceu o studio" error={errors.source?.message} className="sm:col-span-2">
            <Select {...register("source")}>
              <option value="">Não informado</option>
              {clientSources.map((source) => (
                <option key={source} value={source}>
                  {clientSourceLabels[source]}
                </option>
              ))}
            </Select>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Endereço" description="Opcional — útil para entregas e deslocamento" />
        <CardBody className="grid gap-4 sm:grid-cols-6">
          <Field label="CEP" error={errors.cep?.message} className="sm:col-span-2">
            <Input {...register("cep")} placeholder="80000-000" inputMode="numeric" />
          </Field>

          <Field label="Rua" error={errors.street?.message} className="sm:col-span-4">
            <Input {...register("street")} placeholder="Av. Sete de Setembro" />
          </Field>

          <Field label="Número" error={errors.streetNumber?.message} className="sm:col-span-2">
            <Input {...register("streetNumber")} placeholder="1234" inputMode="numeric" />
          </Field>

          <Field label="Complemento" error={errors.complement?.message} className="sm:col-span-4">
            <Input {...register("complement")} placeholder="Apto 91" />
          </Field>

          <Field label="Bairro" error={errors.district?.message} className="sm:col-span-3">
            <Input {...register("district")} placeholder="Batel" />
          </Field>

          <Field label="Cidade" error={errors.city?.message} className="sm:col-span-2">
            <Input {...register("city")} />
          </Field>

          <Field label="UF" error={errors.state?.message} className="sm:col-span-1">
            <Input {...register("state")} maxLength={2} className="uppercase" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Observações" />
        <CardBody className="flex flex-col gap-4">
          <Field
            label="Anotações gerais"
            error={errors.notes?.message}
            hint="Preferências, estilo favorito, combinados"
          >
            <Textarea {...register("notes")} rows={3} placeholder="Prefere volume mais leve, curvatura D…" />
          </Field>

          {canEditHealthNotes && (
            <Field
              label="Saúde e alergias"
              error={errors.healthNotes?.message}
              hint="Dado sensível: só você e as profissionais enxergam"
            >
              <Textarea
                {...register("healthNotes")}
                rows={3}
                placeholder="Sensibilidade à cola com cianoacrilato, usa lente de contato…"
              />
            </Field>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              {...register("lgpdConsent")}
              className="mt-0.5 size-5 shrink-0 rounded border-line-strong text-rose-600 accent-rose-600"
            />
            <span className="text-sm leading-relaxed text-ink-700">
              A cliente autorizou o studio a guardar seus dados pessoais para agendamento e
              acompanhamento dos atendimentos.
              <span className="mt-0.5 block text-xs text-ink-400">
                Consentimento previsto na LGPD. Ela pode pedir uma cópia ou a exclusão a qualquer
                momento.
              </span>
            </span>
          </label>
        </CardBody>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" loading={isSubmitting || mutation.isPending}>
          {isEditing ? "Salvar alterações" : "Cadastrar cliente"}
        </Button>
      </div>
    </form>
  );
}
