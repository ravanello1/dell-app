"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, toQueryString, type ApiError } from "@/core/api/client";
import type { ProductDto, StockMovementDto } from "./inventory.dto";

export const inventoryKeys = {
  all: ["inventory"] as const,
  products: (params: ProductListParams) => [...inventoryKeys.all, "products", params] as const,
  product: (id: string) => [...inventoryKeys.all, "product", id] as const,
  movements: (id: string) => [...inventoryKeys.all, "movements", id] as const,
};

export interface ProductListParams {
  q?: string;
  category?: string;
  lowStockOnly?: boolean;
  includeInactive?: boolean;
  sort?: "name" | "qty" | "category";
}

export function useProducts(params: ProductListParams) {
  return useQuery({
    queryKey: inventoryKeys.products(params),
    queryFn: () => api.get<ProductDto[]>(`/products${toQueryString({ ...params })}`),
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: inventoryKeys.product(id ?? ""),
    queryFn: () => api.get<ProductDto>(`/products/${id}`),
    enabled: Boolean(id),
  });
}

export function useMovements(productId: string | undefined) {
  return useQuery({
    queryKey: inventoryKeys.movements(productId ?? ""),
    queryFn: () => api.get<StockMovementDto[]>(`/products/${productId}/movements`),
    enabled: Boolean(productId),
  });
}

function useInvalidateInventory() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
  };
}

export function useCreateProduct() {
  const invalidate = useInvalidateInventory();
  return useMutation<ProductDto, ApiError, unknown>({
    mutationFn: (input) => api.post<ProductDto>("/products", input),
    onSuccess: invalidate,
  });
}

export function useUpdateProduct() {
  const invalidate = useInvalidateInventory();
  return useMutation<ProductDto, ApiError, { id: string; input: unknown }>({
    mutationFn: ({ id, input }) => api.patch<ProductDto>(`/products/${id}`, input),
    onSuccess: invalidate,
  });
}

/** Entrada, saída, perda ou ajuste. Devolve o produto com o saldo já atualizado. */
export function useRegisterMovement() {
  const invalidate = useInvalidateInventory();
  return useMutation<ProductDto, ApiError, unknown>({
    mutationFn: (input) => api.post<ProductDto>("/stock-movements", input),
    onSuccess: invalidate,
  });
}
