"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, toQueryString, type ApiError } from "@/core/api/client";
import type { AppointmentDto, ProfessionalDto, ServiceDto } from "./agenda.dto";

export const agendaKeys = {
  all: ["agenda"] as const,
  range: (from: string, to: string, professionalId?: string) =>
    [...agendaKeys.all, "range", from, to, professionalId ?? "todas"] as const,
  appointment: (id: string) => [...agendaKeys.all, "appointment", id] as const,
  clientHistory: (clientId: string) => [...agendaKeys.all, "client", clientId] as const,
  services: (includeInactive: boolean) => ["services", includeInactive] as const,
  professionals: (includeInactive: boolean) => ["professionals", includeInactive] as const,
};

/** Atendimentos de uma janela. `from`/`to` são instantes ISO em UTC. */
export function useAgendaRange(params: {
  from: string;
  to: string;
  professionalId?: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: agendaKeys.range(params.from, params.to, params.professionalId),
    queryFn: () =>
      api.get<AppointmentDto[]>(
        `/appointments${toQueryString({
          from: params.from,
          to: params.to,
          professionalId: params.professionalId,
        })}`,
      ),
    enabled: params.enabled ?? true,
  });
}

export function useClientHistory(clientId: string | undefined) {
  return useQuery({
    queryKey: agendaKeys.clientHistory(clientId ?? ""),
    queryFn: () => api.get<AppointmentDto[]>(`/clients/${clientId}/appointments`),
    enabled: Boolean(clientId),
  });
}

export function useServices(includeInactive = false) {
  return useQuery({
    queryKey: agendaKeys.services(includeInactive),
    queryFn: () => api.get<ServiceDto[]>(`/services${toQueryString({ includeInactive })}`),
    // Procedimentos e profissionais quase não mudam — vale segurar por mais tempo.
    staleTime: 10 * 60_000,
  });
}

export function useProfessionals(includeInactive = false) {
  return useQuery({
    queryKey: agendaKeys.professionals(includeInactive),
    queryFn: () =>
      api.get<ProfessionalDto[]>(`/professionals${toQueryString({ includeInactive })}`),
    staleTime: 10 * 60_000,
  });
}

/** Invalida toda a agenda: qualquer escrita pode mexer em qualquer janela. */
function useInvalidateAgenda() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: agendaKeys.all });
  };
}

export function useCreateAppointment() {
  const invalidate = useInvalidateAgenda();
  return useMutation<AppointmentDto, ApiError, unknown>({
    mutationFn: (input) => api.post<AppointmentDto>("/appointments", input),
    onSuccess: invalidate,
  });
}

export function useUpdateAppointment() {
  const invalidate = useInvalidateAgenda();
  return useMutation<AppointmentDto, ApiError, { id: string; input: unknown }>({
    mutationFn: ({ id, input }) => api.patch<AppointmentDto>(`/appointments/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useMarkReminderSent() {
  const invalidate = useInvalidateAgenda();
  return useMutation<AppointmentDto, ApiError, string>({
    mutationFn: (id) => api.post<AppointmentDto>(`/appointments/${id}/reminder`, {}),
    onSuccess: invalidate,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  return useMutation<ServiceDto, ApiError, unknown>({
    mutationFn: (input) => api.post<ServiceDto>("/services", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();
  return useMutation<ServiceDto, ApiError, { id: string; input: unknown }>({
    mutationFn: ({ id, input }) => api.patch<ServiceDto>(`/services/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useCreateProfessional() {
  const queryClient = useQueryClient();
  return useMutation<ProfessionalDto, ApiError, unknown>({
    mutationFn: (input) => api.post<ProfessionalDto>("/professionals", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["professionals"] });
    },
  });
}

export function useUpdateProfessional() {
  const queryClient = useQueryClient();
  return useMutation<ProfessionalDto, ApiError, { id: string; input: unknown }>({
    mutationFn: ({ id, input }) => api.patch<ProfessionalDto>(`/professionals/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["professionals"] });
    },
  });
}
