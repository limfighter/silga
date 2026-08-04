import { useState } from "react";

// verdict 판정 기준가 이동평균 기간 설정 (2026-08-04 결정, 실가_인수인계.md 참조)
// 백엔드 ma_window 쿼리파라미터와 1:1 대응 (Literal[7, 14, 30], 기본 14)

export const MA_WINDOW_OPTIONS = [7, 14, 30] as const;
export type MaWindow = (typeof MA_WINDOW_OPTIONS)[number];
export const DEFAULT_MA_WINDOW: MaWindow = 14;

const STORAGE_KEY = "silga:ma_window";

function isMaWindow(value: number): value is MaWindow {
  return (MA_WINDOW_OPTIONS as readonly number[]).includes(value);
}

export function getStoredMaWindow(): MaWindow {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return isMaWindow(parsed) ? parsed : DEFAULT_MA_WINDOW;
}

export function useMaWindow(): [MaWindow, (value: MaWindow) => void] {
  const [maWindow, setMaWindowState] = useState<MaWindow>(getStoredMaWindow);

  const setMaWindow = (value: MaWindow) => {
    localStorage.setItem(STORAGE_KEY, String(value));
    setMaWindowState(value);
  };

  return [maWindow, setMaWindow];
}
