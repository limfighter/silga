// 최근기록 탭 — 최근 조회한 부품(상품). ma_window 설정과 동일하게
// localStorage에만 저장 (서버/DB 없음, 이 기기에서만 유효, 2026-08-04 결정)

export const MAX_RECENT_PRODUCTS = 20;

const STORAGE_KEY = "silga:recent_products";

export interface RecentProduct {
  code: number;
  title: string;
  priceFormatted: string | null;
  viewedAt: string; // ISO
}

export function getRecentProducts(): RecentProduct[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addRecentProduct(product: {
  code: number;
  title: string;
  priceFormatted: string | null;
}): RecentProduct[] {
  const existing = getRecentProducts().filter((p) => p.code !== product.code);
  const next: RecentProduct[] = [
    { ...product, viewedAt: new Date().toISOString() },
    ...existing,
  ].slice(0, MAX_RECENT_PRODUCTS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function removeRecentProduct(code: number): RecentProduct[] {
  const next = getRecentProducts().filter((p) => p.code !== code);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearRecentProducts(): void {
  localStorage.removeItem(STORAGE_KEY);
}
