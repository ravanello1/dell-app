"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/core/api/client";
import type {
  CreatePromotionInput,
  PromotionDto,
  UpdatePromotionInput,
} from "./marketing.dto";

/**
 * Acesso do navegador às promoções. As listagens de grupos vêm renderizadas do
 * servidor (a página é server component); aqui ficam só as escritas de promoção,
 * que revalidam a rota depois.
 */

export function useCreatePromotion() {
  const queryClient = useQueryClient();
  return useMutation<PromotionDto, ApiError, CreatePromotionInput>({
    mutationFn: (input) => api.post<PromotionDto>("/promotions", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["promotions"] }),
  });
}

export function useUpdatePromotion(id: string) {
  const queryClient = useQueryClient();
  return useMutation<PromotionDto, ApiError, UpdatePromotionInput>({
    mutationFn: (input) => api.patch<PromotionDto>(`/promotions/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["promotions"] }),
  });
}

export function useDeletePromotion() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`/promotions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["promotions"] }),
  });
}
