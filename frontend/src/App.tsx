import { Routes, Route } from "react-router-dom";
import AppShell from "./components/AppShell";
import SearchPage from "./pages/SearchPage";
import BuildListPage from "./pages/BuildListPage";
import BuildCreatePage from "./pages/BuildCreatePage";
import BuildDetailPage from "./pages/BuildDetailPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import SettingsPage from "./pages/SettingsPage";
import StatsPage from "./pages/StatsPage";
import HomePage from "./pages/HomePage";
import RecentHistoryPage from "./pages/RecentHistoryPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/build" element={<BuildListPage />} />
        <Route path="/build/new" element={<BuildCreatePage />} />
        <Route path="/build/:id" element={<BuildDetailPage />} />
        <Route path="/favorites" element={<PlaceholderPage label="즐겨찾기" todo="saved parts list" />} />
        <Route path="/history" element={<RecentHistoryPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
