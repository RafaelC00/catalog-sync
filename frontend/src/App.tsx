import { NavLink, Route, Routes } from "react-router-dom";
import { HealthWidget } from "./components/HealthWidget";
import { SyncRunsPage } from "./pages/SyncRunsPage";
import { RunDetailPage } from "./pages/RunDetailPage";
import { CatalogPage } from "./pages/CatalogPage";

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            CS
          </span>
          <span className="brand-text">
            <span className="brand-title">Catalog Sync</span>
            <span className="brand-subtitle">Multi-tenant Shopify sync console</span>
          </span>
        </a>
        <nav className="nav-links" aria-label="Primary">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            Sync runs
          </NavLink>
          <NavLink to="/catalog" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            Catalog
          </NavLink>
        </nav>
        <div className="topbar-spacer" />
        <HealthWidget />
      </header>

      <main>
        <Routes>
          <Route path="/" element={<SyncRunsPage />} />
          <Route path="/runs/:id" element={<RunDetailPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
        </Routes>
      </main>

      <footer>
        Catalog Sync: Django, Django Ninja, and React against live Shopify stores. <a href="https://github.com/RafaelC00" target="_blank" rel="noreferrer">Source</a>
      </footer>
    </div>
  );
}
