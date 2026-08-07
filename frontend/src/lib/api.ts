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
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---- 타입 (backend/app/schemas/*.py 와 1:1 대응) ----

export interface SearchResultItem {
  code: number;
  title: string | null;
  price: number | null;
  price_formatted: string | null;
  img: string | null;
}

// /search 스펙 필터 파라미터 — 카테고리와 안 맞는 필드는 백엔드가 무시함
// (backend/app/main.py::search()의 category별 분기 참조)
export interface SearchSpecParams {
  memoryGb?: number; // GPU 전용
  socket?: string; // CPU/메인보드/쿨러 전용
  chipset?: string; // GPU 전용
  length?: string; // GPU 전용
  formfactor?: string; // 메인보드/케이스/SSD 전용
  ramType?: string; // RAM 전용
  wattage?: string; // 파워 전용
  interface?: string; // SSD 전용
  coolerType?: string; // 쿨러 전용
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

export interface PricePoint {
  date: string;
  price: string;
  full_date: string | null;
}

export interface PriceHistory {
  min: string;
  max: string;
  prices: PricePoint[];
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
  verdict_confidence: "high" | "low" | null;
  ma_window: number | null;
}

export interface BuildItemDetail {
  category: string;
  code: number;
  title: string | null;
  price: number | null;
}

export interface VerdictBasisItem {
  code: number;
  price: number | null;
  source: "ma" | "current_fallback";
}

export interface BuildDetail {
  id: number;
  name: string;
  market_price: number | null;
  created_at: string;
  items: BuildItemDetail[];
  total_price: number;
  total_price_formatted: string;
  verdict_basis_price: number | null;
  verdict_basis_price_formatted: string | null;
  verdict_confidence: "high" | "low" | null;
  verdict_basis_breakdown: VerdictBasisItem[];
  ma_window: number | null;
  verdict: "저가" | "적정가" | "고가" | null;
  diff_percent: number | null;
}

export interface FavoriteItem {
  code: number;
  title: string | null;
  price: number | null;
  price_formatted: string | null;
  created_at: string;
}

// ---- API 함수 ----

export const api = {
  // q 생략(빈 문자열/undefined) 시 백엔드가 category 기본 키워드로 대신
  // 검색함(검색 버튼을 안 눌러도 카테고리 선택만으로 기본 목록이 뜨도록) —
  // 이 경우 category는 필수(백엔드가 q/category 둘 다 없으면 400)
  search: (q: string | undefined, category?: string, spec?: SearchSpecParams) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (spec?.memoryGb) params.set("memory_gb", String(spec.memoryGb));
    if (spec?.socket) params.set("socket", spec.socket);
    if (spec?.chipset) params.set("chipset", spec.chipset);
    if (spec?.length) params.set("length", spec.length);
    if (spec?.formfactor) params.set("formfactor", spec.formfactor);
    if (spec?.ramType) params.set("ram_type", spec.ramType);
    if (spec?.wattage) params.set("wattage", spec.wattage);
    if (spec?.interface) params.set("interface", spec.interface);
    if (spec?.coolerType) params.set("cooler_type", spec.coolerType);
    return request<SearchResultItem[]>(`/search?${params.toString()}`);
  },

  getProduct: (code: number) => request<ProductDetail>(`/product/${code}`),

  getHistory: (code: number, months: number) =>
    request<PriceHistory>(`/product/${code}/history?months=${months}`),

  listBuilds: (maWindow: number) =>
    request<BuildSummary[]>(`/builds?ma_window=${maWindow}`),

  getBuild: (id: number, maWindow: number) =>
    request<BuildDetail>(`/builds/${id}?ma_window=${maWindow}`),

  createBuild: (payload: { name: string; market_price?: number; items: BuildItemInput[] }) =>
    request<BuildSummary>("/builds", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listFavorites: () => request<FavoriteItem[]>("/favorites"),

  addFavorite: (code: number) =>
    request<FavoriteItem>("/favorites", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  removeFavorite: (code: number) =>
    request<void>(`/favorites/${code}`, { method: "DELETE" }),
};
