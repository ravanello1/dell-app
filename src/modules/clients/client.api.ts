"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { api, toQueryString, type ApiError } from "@/core/api/client";
import type { PageMeta } from "@/core/api/dto";
import type { ClientDto, ClientListItem } from "./client.dto";

/**
 * Acesso do navegador ao módulo de clientes.
 *
 * As chaves de cache são hierárquicas (`["clients"] → ["clients","list",…]`), o
 * que permite invalidar tudo de uma vez depois de uma escrita sem enumerar
 * cada consulta ativa.
 */

export const clientKeys = {
  all: ["clients"] as const,
  lists: () => [...clientKeys.all, "list"] as const,
  list: (params: ClientListParams) => [...clientKeys.lists(), params] as const,
  details: () => [...clientKeys.all, "detail"] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
};

export interface ClientListParams {
  q?: string;
  page?: number;
  perPage?: number;
  includeInactive?: boolean;
  sort?: "name" | "recent";
}

export function useClientList(params: ClientListParams) {
  return useQuery({
    queryKey: clientKeys.list(params),
    queryFn: () =>
      api.getWithMeta<ClientListItem[]>(`/clients${toQueryString({ ...params })}`),
    // Mantém a lista anterior visível enquanto a nova página carrega: sem isso
    // a tela pisca a cada tecla digitada na busca.
    placeholderData: keepPreviousData,
    select: (envelope) => ({
      items: envelope.data,
      meta: envelope.meta as unknown as PageMeta,
    }),
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: clientKeys.detail(id ?? ""),
    queryFn: () => api.get<ClientDto>(`/clients/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation<ClientDto, ApiError, unknown>({
    mutationFn: (input) => api.post<ClientDto>("/clients", input),
    onSuccess: (client) => {
      queryClient.setQueryData(clientKeys.detail(client.id), client);
      void queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

export function useUpdateClient(id: string) {
  const queryClient = useQueryClient();
  return useMutation<ClientDto, ApiError, unknown>({
    mutationFn: (input) => api.patch<ClientDto>(`/clients/${id}`, input),
    onSuccess: (client) => {
      queryClient.setQueryData(clientKeys.detail(client.id), client);
      void queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

/** Arquiva (some das listas, mantém o histórico). */
export function useArchiveClient() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`/clients/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}

/** Exclusão definitiva — LGPD. */
export function useEraseClient() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.post<void>(`/clients/${id}/erase`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}
