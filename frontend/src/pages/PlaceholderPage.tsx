export default function PlaceholderPage({ label, todo }: { label: string; todo: string }) {
  return (
    <div className="empty-state">
      <svg width="40" height="40" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.3" />
      </svg>
      <div className="t">{label} 화면 준비 중</div>
      <div className="d">// TODO: {todo}</div>
    </div>
  );
}
