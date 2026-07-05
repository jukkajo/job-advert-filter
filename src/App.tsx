export default function App() {
  return (
    <main className="app-shell">
      <header className="app-shell__header">
        <h1>Job advert filter</h1>
      </header>

      <section className="panel">
        <label className="field" htmlFor="job-advert">
          <span className="field__label">Paste job advert</span>
          <textarea
            id="job-advert"
            name="job-advert"
            rows={14}
            spellCheck={false}
          />
        </label>

        <div className="actions" aria-label="Job advert actions">
          <button type="button">Analyze</button>
          <button type="button">Clear</button>
        </div>
      </section>

      <section className="panel results-panel" aria-label="Results panel">
        <h2 className="results-panel__title">Results</h2>
        <div className="results-panel__empty" />
      </section>
    </main>
  );
}

