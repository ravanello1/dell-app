"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/core/api/client";
import type {
  AnamneseDto,
  AnamneseListItem,
  CreateAnamneseInput,
  SaveAnamneseInput,
  SignAnamneseInput,
} from "./anamnese.dto";

/** Acesso do navegador ao módulo de anamnese. Chaves hierárquicas para
 *  invalidar por cliente ou por ficha sem enumerar cada consulta. */
export const anamneseKeys = {
  all: ["anamnese"] as const,
  byClient: (clientId: string) => [...anamneseKeys.all, "client", clientId] as const,
  detail: (id: string) => [...anamneseKeys.all, "detail", id] as const,
};

export function useClientAnamneses(clientId: string) {
  return useQuery({
    queryKey: anamneseKeys.byClient(clientId),
    queryFn: () => api.get<AnamneseListItem[]>(`/clients/${clientId}/anamnese`),
    enabled: Boolean(clientId),
  });
}

export function useAnamnese(id: string | undefined) {
  return useQuery({
    queryKey: anamneseKeys.detail(id ?? ""),
    queryFn: () => api.get<AnamneseDto>(`/anamnese/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateAnamnese(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation<AnamneseDto, ApiError, CreateAnamneseInput>({
    mutationFn: (input) => api.post<AnamneseDto>(`/clients/${clientId}/anamnese`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: anamneseKeys.byClient(clientId) });
    },
  });
}

export function useSaveAnamnese(id: string) {
  const queryClient = useQueryClient();
  return useMutation<AnamneseDto, ApiError, SaveAnamneseInput>({
    mutationFn: (input) => api.patch<AnamneseDto>(`/anamnese/${id}`, input),
    onSuccess: (dto) => {
      queryClient.setQueryData(anamneseKeys.detail(id), dto);
      void queryClient.invalidateQueries({ queryKey: anamneseKeys.byClient(dto.clientId) });
    },
  });
}

/** Gera o link público e devolve o WhatsApp pronto (com número e mensagem). */
export function useShareAnamnese(id: string) {
  return useMutation<{ url: string; whatsappUrl: string }, ApiError, void>({
    mutationFn: () => api.post<{ url: string; whatsappUrl: string }>(`/anamnese/${id}/share`, {}),
  });
}

export function useSignAnamnese(id: string) {
  const queryClient = useQueryClient();
  return useMutation<AnamneseDto, ApiError, SignAnamneseInput>({
    mutationFn: (input) => api.post<AnamneseDto>(`/anamnese/${id}/sign`, input),
    onSuccess: (dto) => {
      queryClient.setQueryData(anamneseKeys.detail(id), dto);
      void queryClient.invalidateQueries({ queryKey: anamneseKeys.byClient(dto.clientId) });
    },
  });
}

export function useDiscardAnamnese(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`/anamnese/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: anamneseKeys.byClient(clientId) });
    },
  });
}
