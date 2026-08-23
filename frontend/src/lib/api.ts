// 설정 화면이 "지금 어느 백엔드를 보고 있는지" 표시하는 데도 씀
export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

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
  // 다나와 상품 li의 카테고리 조각("CPU"/"데스크탑" 등). 카테고리 필터를
  // 안 걸었을 때 부품 단품인지 완제품 PC인지 구분하는 용도(backend v0.17)
  category: string | null;
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
  cpuType?: string; // CPU 전용
  igpu?: string; // CPU 전용 (내장그래픽 탑재/미탑재)
  gpuChip?: string; // GPU 전용 (칩셋 모델 — chipset이 제조사라면 이건 모델)
  capacity?: string; // RAM(모듈 1개당 용량) / SSD(용량 구간) 공용
  ramCount?: string; // RAM 전용
  efficiency?: string; // 파워 전용 (80PLUS 등급)
  caseSize?: string; // 케이스 전용
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
  // BuildDetail.diff_percent와 동일 의미 — 목록에서도 판정 근거를 보여주려고
  // 2026-08-13 추가(백엔드가 이미 계산하던 값이라 조회 비용 증가 없음)
  diff_percent: number | null;
}

// GET /builds/prices 응답 — BuildSummary의 가격/판정 필드만 떼어낸 것.
// id로 매칭해서 구조 응답에 덮어쓴다(backend v0.18)
export interface BuildPrice {
  id: number;
  // BuildSummary의 동명 필드를 그대로 떼어낸 것이라 타입도 그쪽에서 끌어온다
  // — 따로 적어두면 verdict 리터럴 유니온 같은 게 조용히 어긋남
  total_price: BuildSummary["total_price"];
  total_price_formatted: BuildSummary["total_price_formatted"];
  verdict: BuildSummary["verdict"];
  verdict_confidence: BuildSummary["verdict_confidence"];
  ma_window: BuildSummary["ma_window"];
  diff_percent: BuildSummary["diff_percent"];
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
  search: (q: string | undefined, category?: string, spec?: SearchSpecParams, page?: number) => {
    const params = new URLSearchParams();
    // 다나와가 한 번에 40건까지만 주므로 그 이상은 page로 넘긴다(backend v0.17)
    if (page && page > 1) params.set("page", String(page));
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
    if (spec?.cpuType) params.set("cpu_type", spec.cpuType);
    if (spec?.igpu) params.set("igpu", spec.igpu);
    if (spec?.gpuChip) params.set("gpu_chip", spec.gpuChip);
    if (spec?.capacity) params.set("capacity", spec.capacity);
    if (spec?.ramCount) params.set("ram_count", spec.ramCount);
    if (spec?.efficiency) params.set("efficiency", spec.efficiency);
    if (spec?.caseSize) params.set("case_size", spec.caseSize);
    return request<SearchResultItem[]>(`/search?${params.toString()}`);
  },

  getProduct: (code: number) => request<ProductDetail>(`/product/${code}`),

  getHistory: (code: number, months: number) =>
    request<PriceHistory>(`/product/${code}/history?months=${months}`),

  // 구조(DB만, 즉시)와 가격(스크래핑)을 나눠 받는 2단계 로딩 — lib/useBuilds.ts
  // 참조(backend v0.18).
  //
  // 한 방에 다 받는 listBuilds(GET /builds?ma_window=N) 래퍼는 여기 남아
  // 있었는데 호출처가 0곳이라 2026-08-23에 지웠다. 백엔드의
  // with_prices=true(기본값) 경로는 그대로 살아 있음 — 프론트만 안 쓸 뿐,
  // REST를 tool처럼 부르는 AI 라우터에겐 한 번에 받는 쪽이 맞는 모양이라
  // 엔드포인트를 없애면 안 된다
  listBuildStructure: () =>
    request<BuildSummary[]>(`/builds?with_prices=false`),

  listBuildPrices: (maWindow: number) =>
    request<BuildPrice[]>(`/builds/prices?ma_window=${maWindow}`),

  getBuild: (id: number, maWindow: number) =>
    request<BuildDetail>(`/builds/${id}?ma_window=${maWindow}`),

  createBuild: (payload: { name: string; market_price?: number; items: BuildItemInput[] }) =>
    request<BuildSummary>("/builds", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteBuild: (id: number) =>
    request<void>(`/builds/${id}`, { method: "DELETE" }),

  listFavorites: () => request<FavoriteItem[]>("/favorites"),

  addFavorite: (code: number) =>
    request<FavoriteItem>("/favorites", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  removeFavorite: (code: number) =>
    request<void>(`/favorites/${code}`, { method: "DELETE" }),
};
