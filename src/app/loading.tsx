export default function Loading() {
  return (
    <main className="app-shell master-app-shell" aria-busy="true" aria-live="polite">
      <aside className="sidebar" aria-hidden="true">
        <div className="brand master-brand-link">
          <div className="brand-mark">S</div>
          <div><b>SPPD<span>.</span></b><small>SEKRETARIAT DAERAH</small></div>
        </div>
        <div className="workspace">
          <div className="workspace-icon">▦</div>
          <div><b>Sekretariat Daerah</b><small>Kabupaten Pekalongan</small></div>
        </div>
        <div className="nav-group">
          <p>MEMUAT MENU</p>
          {[1, 2, 3, 4, 5, 6, 7].map((item) => (
            <div key={item} className="nav-item" style={{ opacity: 0.42 }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, background: "currentColor" }} />
              <span style={{ width: item % 2 ? "68%" : "52%", height: 10, borderRadius: 6, background: "currentColor" }} />
            </div>
          ))}
        </div>
      </aside>
      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <b>Memuat halaman</b></div>
        </header>
        <div className="content master-content">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface-muted, #e5e7eb)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ width: 190, height: 16, borderRadius: 6, background: "var(--surface-muted, #e5e7eb)", marginBottom: 9 }} />
              <div style={{ width: 280, maxWidth: "75%", height: 10, borderRadius: 6, background: "var(--surface-muted, #e5e7eb)" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 20 }}>
            {[1, 2, 3, 4].map((item) => <div key={item} style={{ height: 94, border: "1px solid var(--border, #e5e7eb)", borderRadius: 12, background: "var(--card, #fff)" }} />)}
          </div>
          <div style={{ height: 300, border: "1px solid var(--border, #e5e7eb)", borderRadius: 12, background: "var(--card, #fff)", display: "grid", placeItems: "center", color: "var(--muted, #6b7280)" }}>
            Memuat data halaman…
          </div>
        </div>
      </section>
    </main>
  );
}
