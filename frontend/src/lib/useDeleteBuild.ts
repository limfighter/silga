import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// 빌드 삭제 공통 로직(확인창 + API 호출 + 목록 쿼리 무효화) — 빌드 상세/
// 목록/홈 3곳이 공유. 삭제 성공 후 동작은 화면마다 다름(상세는 목록으로
// 이동, 목록/홈은 그 자리에서 그리드만 갱신)이라 onSuccess 콜백으로 위임.
export function useDeleteBuild(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: number) => api.deleteBuild(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["builds"] });
      onSuccess?.();
    },
  });

  const deleteBuild = (id: number, name: string) => {
    if (!window.confirm(`"${name}" 빌드를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    mutation.mutate(id);
  };

  return {
    deleteBuild,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}
