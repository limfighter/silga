import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type BuildSummary } from "./api";

/**
 * 홈/빌드 목록이 공유하는 빌드 로딩 훅 — 구조와 가격을 나눠서 받는다.
 *
 * 예전엔 GET /builds 하나로 끝냈는데, 그 응답이 저장된 빌드 전부를 다나와로
 * 다시 조회하고 나서야 오기 때문에 이름·부품수·저장일처럼 DB에서 바로 나오는
 * 값까지 몇 초를 기다려야 했다. 홈은 집계(판정 분포/총액/부품 수/판정 축)에
 * 전체 빌드를 쓰는 구조라 빌드가 늘수록 그대로 체감 지연이 됐음.
 *
 * 그래서 구조(with_prices=false, 즉시)를 먼저 받아 화면을 그리고, 가격은
 * GET /builds/prices로 뒤따라 받아 id로 채워 넣는다. 요청을 빌드마다 쪼개지
 * 않은 건 의도적 — 브라우저가 동시에 날려버리면 매너 크롤링 원칙(동시 병렬
 * 지양)을 깨기 때문에, 스크래핑은 서버가 한 요청 안에서 순차로 돌게 뒀다.
 * 총 소요 시간은 그대로이고 첫 화면이 뜨는 시점만 당겨진다(backend v0.18).
 */
export function useBuilds(maWindow: number) {
  const structure = useQuery({
    queryKey: ["builds", "structure"],
    queryFn: () => api.listBuildStructure(),
  });

  const prices = useQuery({
    queryKey: ["builds", "prices", maWindow],
    // 구조가 먼저 와야 채울 대상이 생기고, 빌드가 0개면 조회할 이유도 없음
    enabled: (structure.data?.length ?? 0) > 0,
    queryFn: () => api.listBuildPrices(maWindow),
  });

  const builds: BuildSummary[] = useMemo(() => {
    const base = structure.data ?? [];
    const byId = new Map((prices.data ?? []).map((p) => [p.id, p]));
    return base.map((b) => {
      const p = byId.get(b.id);
      return p ? { ...b, ...p } : b;
    });
  }, [structure.data, prices.data]);

  return {
    builds,
    // 구조조차 못 받은 상태 = 화면에 그릴 게 아무것도 없음
    isLoading: structure.isLoading,
    // 카드는 떴지만 가격/판정이 아직 안 온 상태
    isPricesPending: builds.length > 0 && prices.data === undefined && !prices.isError,
    isError: structure.isError || prices.isError,
    error: structure.error ?? prices.error,
  };
}
