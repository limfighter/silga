const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore parse failure */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

// ---- 타입 (backend/app/schemas/*.py 와 1:1 대응) ----

export interface SearchResultItem {
  code: number;
  title: string | null;
  price: number | null;
  price_formatted: string | null;
}

export interface ProductVariant {
  type: string | null;
  price: string | null;
  mall_count: string | null;
  pcode: number | null;
  is_current: boolean;
}

export interface ProductDetail {
  code: number;
  title: string | null;
  category: string | null;
  current_price: number | null;
  cash_price: number | null;
  spec: string | null;
  variants: ProductVariant[];
  in_stock: boolean | null;
}

export interface BuildItemInput {
  category: string;
  code: number;
}

export interface BuildSummary {
  id: number;
  name: string;
  market_price: number | null;
  created_at: string;
  item_count: number;
  total_price: number | null;
  total_price_formatted: string | null;
  verdict: "저가" | "적정가" | "고가" | null;
}

export interface BuildItemDetail {
  category: string;
  code: number;
  title: string | null;
  price: number | null;
}

export interface BuildDetail {
  id: number;
  name: string;
  market_price: number | null;
  created_at: string;
  items: BuildItemDetail[];
  total_price: number;
  total_price_formatted: string;
  verdict: "저가" | "적정가" | "고가" | null;
  diff_percent: number | null;
}

// ---- API 함수 ----

export const api = {
  search: (q: string) =>
    request<SearchResultItem[]>(`/search?q=${encodeURIComponent(q)}`),

  getProduct: (code: number) => request<ProductDetail>(`/product/${code}`),

  listBuilds: () => request<BuildSummary[]>("/builds"),

  getBuild: (id: number) => request<BuildDetail>(`/builds/${id}`),

  createBuild: (payload: { name: string; market_price?: number; items: BuildItemInput[] }) =>
    request<BuildSummary>("/builds", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
