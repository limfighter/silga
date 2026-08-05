import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function SearchPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["search", query],
    queryFn: () => api.search(query),
    enabled: query.length > 0,
  });

  const submit = () => setQuery(input.trim());

  return (
    <div>
      <div className="section-label">REAL-TIME SCAN</div>
      <div className="build-header">
        <h2>부품 검색</h2>
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder="예: RTX 5070 Ti 16GB"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="btn-primary" onClick={submit}>검색</button>
      </div>

      {query.length === 0 && (
        <div className="empty-state">
          <div className="t">검색어를 입력하세요</div>
          <div className="d">다나와 실시간 최저가 기준</div>
        </div>
      )}

      {isFetching && <div className="status-line">검색 중...</div>}
      {isError && (
        <div className="status-line error">
          검색 실패: {error instanceof Error ? error.message : "알 수 없는 오류"}
        </div>
      )}

      {data && data.length === 0 && !isFetching && (
        <div className="status-line">검색 결과가 없습니다.</div>
      )}

      {data && data.length > 0 && (
        <div className="search-results">
          {data.map((item) => (
            <div className="search-result-row" key={item.code}>
              <span className="nm">
                {item.title ?? "(제목 없음)"}
                <span className="code">#{item.code}</span>
              </span>
              <span className="pr">{item.price_formatted ?? "-"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
