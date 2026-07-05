import { useState } from "react";
import {
  analyzeJobAdvert,
  type AnalysisResult,
  type MatchedRule,
} from "./lib/analyzeJobAdvert";

function renderMatchedKeywords(items: MatchedRule[]) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="matched-list">
      {items.map((item) => (
        <li key={item.id} className="matched-list__item">
          <div className="matched-list__label">
            <span>{item.label}</span>
            <span className={`severity-chip severity-chip--${item.severity}`}>
              {item.severity}
            </span>
          </div>
          <div className="matched-list__keywords">
            Matched keywords: {item.matchedKeywords.join(", ")}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ResultSection({
  title,
  items,
}: {
  title: string;
  items: MatchedRule[];
}) {
  return (
    <section className="result-group">
      <h3 className="result-group__title">{title}</h3>
      {items.length > 0 ? renderMatchedKeywords(items) : <p className="result-empty">None</p>}
    </section>
  );
}

export default function App() {
  const [jobAdvert, setJobAdvert] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  function handleAnalyze() {
    setAnalysis(analyzeJobAdvert(jobAdvert));
  }

  function handleClear() {
    setJobAdvert("");
    setAnalysis(null);
  }

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
            value={jobAdvert}
            onChange={(event) => setJobAdvert(event.target.value)}
          />
        </label>

        <div className="actions" aria-label="Job advert actions">
          <button type="button" onClick={handleAnalyze}>
            Analyze
          </button>
          <button type="button" onClick={handleClear}>
            Clear
          </button>
        </div>
      </section>

      <section className="panel results-panel" aria-label="Results panel">
        <h2 className="results-panel__title">Results</h2>

        {analysis ? (
          <div className="results">
            <dl className="summary-grid">
              <div className="summary-item">
                <dt>Recommendation</dt>
                <dd>
                  <span className={`recommendation recommendation--${analysis.recommendation}`}>
                    {analysis.recommendation}
                  </span>
                </dd>
              </div>
              <div className="summary-item">
                <dt>Score</dt>
                <dd>{analysis.score}</dd>
              </div>
            </dl>

            <div className="results-grid">
              <ResultSection title="Hard blockers" items={analysis.hardBlockers} />
              <ResultSection title="Concerns" items={analysis.concerns} />
              <ResultSection title="Strong positives" items={analysis.strongPositives} />
              <ResultSection title="Bonuses" items={analysis.bonuses} />
            </div>

            <section className="result-group">
              <h3 className="result-group__title">Explanation</h3>
              <p className="explanation">{analysis.explanation}</p>
            </section>
          </div>
        ) : (
          <div className="results-panel__empty">
            <p className="result-empty result-empty--placeholder">
              Run an analysis to see the summary and matched keywords here.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
