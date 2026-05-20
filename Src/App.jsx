import { useState, useEffect } from "react";

const WEEKLY_BASE = 22;
const CONTRACT_DAYS = [4, 6, 0];

function getWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function getWeekDays(weekKey) {
  const [y, mo, d] = weekKey.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => new Date(y, mo - 1, d + i));
}

function getISOWeek(weekKey) {
  const [y, m, d] = weekKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const jan4 = new Date(date.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - (jan4.getDay() === 0 ? 6 : jan4.getDay() - 1));
  const diff = date - startOfWeek1;
  return Math.floor(diff / (7 * 24 * 3600 * 1000)) + 1;
}


// Convertit un nombre décimal en "HH:MM" (gère les négatifs)
function decimalToHM(val) {
  const sign = val < 0 ? "-" : "";
  const abs = Math.abs(val);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `${sign}${h}:${String(m).padStart(2, "0")}`;
}

// Convertit "HH:MM" en nombre décimal
function hmToDecimal(val) {
  if (!val) return 0;
  if (val.includes(":")) {
    const [h, m] = val.split(":").map(Number);
    return (h || 0) + (m || 0) / 60;
  }
  return parseFloat(val) || 0;
}

// Valide et formate la saisie à la sortie du champ
// Exemples : "645" → "6:45", "1230" → "12:30", "8" → "8:00", "7:30" → "7:30"
function formatHM(val) {
  if (!val) return "";
  val = val.replace(/[^0-9:]/g, "");
  if (val.includes(":")) {
    let [h, m] = val.split(":");
    h = Math.min(23, parseInt(h) || 0);
    m = Math.min(59, parseInt(m) || 0);
    return `${h}:${String(m).padStart(2, "0")}`;
  }
  // Pas de ":" → on insère automatiquement
  const digits = val.replace(/:/g, "");
  if (digits.length <= 2) {
    // "8" → "8:00", "75" → "7:05" ? Non : "75" → "7:05" serait ambigu
    // On traite comme heures seules
    const h = Math.min(23, parseInt(digits) || 0);
    return `${h}:00`;
  }
  if (digits.length === 3) {
    // "645" → h=6, m=45
    const h = Math.min(23, parseInt(digits[0]) || 0);
    const m = Math.min(59, parseInt(digits.slice(1)) || 0);
    return `${h}:${String(m).padStart(2, "0")}`;
  }
  // 4 chiffres : "1230" → h=12, m=30
  const h = Math.min(23, parseInt(digits.slice(0, 2)) || 0);
  const m = Math.min(59, parseInt(digits.slice(2)) || 0);
  return `${h}:${String(m).padStart(2, "0")}`;
}
function isContractDay(date) {
  return CONTRACT_DAYS.includes(date.getDay());
}

const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export default function JulieHeures() {
  const [weeks, setWeeks] = useState({});
  const [currentWeek, setCurrentWeek] = useState(getWeekKey(new Date()));
  const [view, setView] = useState("semaine");

  useEffect(() => {
    const saved = localStorage.getItem("julie-heures");
    if (saved) setWeeks(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("julie-heures", JSON.stringify(weeks));
  }, [weeks]);

  const days = getWeekDays(currentWeek);

  function getHours(weekKey, dayIndex) {
    return weeks[weekKey]?.[dayIndex] ?? "";
  }

  function setHours(weekKey, dayIndex, value) {
    setWeeks(prev => ({
      ...prev,
      [weekKey]: { ...(prev[weekKey] || {}), [dayIndex]: value },
    }));
  }

  function weekTotal(weekKey) {
    const data = weeks[weekKey] || {};
    return Object.values(data).reduce((sum, v) => sum + hmToDecimal(v), 0);
  }

  function weekSolde(weekKey) {
    return weekTotal(weekKey) - WEEKLY_BASE;
  }

  function cumulSolde(upToWeekKey) {
    let cumul = 0;
    for (const wk of Object.keys(weeks).sort()) {
      if (wk > upToWeekKey) break;
      cumul += weekSolde(wk);
    }
    return cumul;
  }

  function prevWeek() {
    const [y, m, d] = currentWeek.split("-").map(Number);
    setCurrentWeek(getWeekKey(new Date(y, m - 1, d - 7)));
  }

  function nextWeek() {
    const [y, m, d] = currentWeek.split("-").map(Number);
    setCurrentWeek(getWeekKey(new Date(y, m - 1, d + 7)));
  }

  const totalThisWeek = weekTotal(currentWeek);
  const soldeThisWeek = weekSolde(currentWeek);
  const cumulNow = cumulSolde(currentWeek);
  const sortedHistoryWeeks = Object.keys(weeks).sort().reverse();

  function fmtWeekRange(weekKey) {
    const [y, m, d] = weekKey.split("-").map(Number);
    const mon = new Date(y, m - 1, d);
    const sun = new Date(y, m - 1, d + 6);
    return `${mon.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} – ${sun.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#e8f7f5", fontFamily: "'Nunito', sans-serif", color: "#1d4a45", padding: 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; }

        .header {
          background: linear-gradient(135deg, #5bbcb0 0%, #3da8c4 100%);
          padding: 30px 24px 22px;
        }
        .header-title {
          font-size: 32px;
          font-weight: 900;
          letter-spacing: -0.5px;
          margin: 0 0 4px;
          color: #fff;
        }
        .header-sub {
          font-size: 13px;
          color: #c8f0ec;
          letter-spacing: 0.5px;
          font-weight: 600;
        }

        .tabs { display: flex; border-bottom: 2px solid #c8ede9; background: #f2faf9; }
        .tab {
          padding: 16px 28px;
          font-family: 'Nunito', sans-serif;
          font-size: 14px;
          font-weight: 700;
          border: none;
          background: none;
          color: #8dcfca;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          margin-bottom: -2px;
          transition: all 0.2s;
        }
        .tab.active { color: #2aa398; border-bottom-color: #2aa398; }
        .tab:hover:not(.active) { color: #4db8b0; }

        .week-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 22px 24px 10px;
          background: #f2faf9;
        }
        .week-label { font-size: 17px; font-weight: 800; color: #1d4a45; }
        .week-sub { font-size: 13px; color: #8dcfca; font-weight: 600; margin-top: 3px; }
        .nav-btn {
          background: #d4f0ed;
          border: none;
          color: #2aa398;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          cursor: pointer;
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          font-weight: 700;
        }
        .nav-btn:hover { background: #a8e0da; color: #1d7a72; }

        .progress-bar { margin: 0 24px 14px; height: 8px; background: #c8ede9; border-radius: 8px; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 8px; transition: width 0.4s ease; background: linear-gradient(90deg, #3ecfbe, #3db8d4); }

        .days-grid { padding: 4px 24px 20px; display: flex; flex-direction: column; gap: 10px; }

        .day-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 18px;
          border-radius: 14px;
          background: #fff;
          border: 2px solid #d8f0ed;
          transition: all 0.2s;
          box-shadow: 0 2px 6px rgba(42,163,152,0.07);
        }
        .day-row.contract-day {
          border-color: #b0e8e0;
          background: linear-gradient(90deg, #f0fdfb 0%, #fff 100%);
        }
        .day-row.contract-day:focus-within {
          border-color: #2aa398;
          box-shadow: 0 0 0 4px #2aa39818;
        }

        .day-dot { width: 10px; height: 10px; border-radius: 50%; background: #d8f0ed; flex-shrink: 0; }
        .day-dot.contract { background: #5bbcb0; }
        .day-dot.worked { background: #2aa398; }

        .day-name {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #a8d8d4;
          text-transform: uppercase;
          width: 36px;
          flex-shrink: 0;
        }
        .day-name.contract { color: #2aa398; }

        .day-date { font-size: 15px; font-weight: 600; color: #5a9a94; flex: 1; }

        .day-input {
          background: #f0faf9;
          border: 2px solid #c8ede9;
          border-radius: 10px;
          color: #1d4a45;
          font-family: 'Nunito', sans-serif;
          font-size: 17px;
          font-weight: 700;
          width: 80px;
          padding: 8px 12px;
          text-align: right;
          transition: all 0.2s;
        }
        .day-input:focus {
          outline: none;
          border-color: #2aa398;
          background: #fff;
          box-shadow: 0 0 0 4px #2aa39818;
        }
        .day-input::placeholder { color: #b8deda; }
        .day-unit { font-size: 14px; color: #a8d8d4; width: 16px; font-weight: 700; }

        .summary-card {
          margin: 0 24px 24px;
          padding: 22px 20px;
          border-radius: 16px;
          background: #fff;
          border: 2px solid #d8f0ed;
          display: grid;
          grid-template-columns: 1fr 1px 1fr 1px 1fr;
          gap: 16px;
          align-items: center;
          box-shadow: 0 4px 14px rgba(42,163,152,0.10);
        }
        .stat { display: flex; flex-direction: column; gap: 5px; align-items: center; text-align: center; }
        .stat-label { font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; color: #a8d8d4; font-weight: 700; }
        .stat-value { font-size: 22px; font-weight: 900; }
        .stat-value.neutral { color: #1d4a45; }
        .stat-value.pos { color: #28b587; }
        .stat-value.neg { color: #e07a7a; }
        .divider { width: 1px; background: #d8f0ed; height: 44px; }

        .history-list { padding: 8px 24px 24px; display: flex; flex-direction: column; gap: 10px; }
        .history-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-radius: 14px;
          background: #fff;
          border: 2px solid #d8f0ed;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: 0 2px 6px rgba(42,163,152,0.07);
        }
        .history-row:hover { border-color: #5bbcb0; box-shadow: 0 4px 12px rgba(42,163,152,0.13); }
        .history-row.selected { border-color: #2aa398; background: #f0fdfb; }
        .history-week { font-size: 15px; color: #2a7a74; font-weight: 700; }
        .history-total { font-size: 13px; color: #8dcfca; font-weight: 600; margin-top: 2px; }
        .history-solde { font-size: 18px; font-weight: 900; }
        .history-cumul { font-size: 12px; color: #a8d8d4; margin-top: 3px; font-weight: 600; }
        .empty-history { text-align: center; padding: 56px 24px; color: #a8d8d4; font-size: 15px; font-weight: 600; }

        .week-badge {
          display: inline;
          color: #2aa398;
          font-size: 17px;
          font-weight: 800;
          margin-right: 6px;
        }
      `}</style>

      <div className="header">
        <div className="header-title">Julie · Heures</div>
        <div className="header-sub">Contrat 22h · Jeudi / Samedi / Dimanche</div>
      </div>

      <div className="tabs">
        <button className={`tab ${view === "semaine" ? "active" : ""}`} onClick={() => setView("semaine")}>Saisie semaine</button>
        <button className={`tab ${view === "historique" ? "active" : ""}`} onClick={() => setView("historique")}>Historique</button>
      </div>

      {view === "semaine" && (
        <>
          <div className="week-nav">
            <button className="nav-btn" onClick={prevWeek}>‹</button>
            <div style={{ textAlign: "center" }}>
              <div className="week-label">
                <span className="week-badge">S{getISOWeek(currentWeek)}</span> {fmtWeekRange(currentWeek)}
              </div>
            </div>
            <button className="nav-btn" onClick={nextWeek}>›</button>
          </div>

          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.min(100, (totalThisWeek / WEEKLY_BASE) * 100)}%` }} />
          </div>

          <div className="days-grid">
            {days.map((day, i) => {
              const contract = isContractDay(day);
              const val = getHours(currentWeek, i);
              const worked = parseFloat(val) > 0;
              return (
                <div key={i} className={`day-row ${contract ? "contract-day" : ""}`}>
                  <div className={`day-dot ${worked ? "worked" : contract ? "contract" : ""}`} />
                  <div className={`day-name ${contract ? "contract" : ""}`}>{DAY_NAMES[day.getDay()]}</div>
                  <div className="day-date">{day.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</div>
                  <input
                    className="day-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="0:00"
                    value={val}
                    onChange={e => setHours(currentWeek, i, e.target.value)}
                    onBlur={e => setHours(currentWeek, i, formatHM(e.target.value))}
                  />
                  <div className="day-unit">h</div>
                </div>
              );
            })}
          </div>

          <div className="summary-card">
            <div className="stat">
              <div className="stat-label">Travaillé</div>
              <div className="stat-value neutral">{decimalToHM(totalThisWeek)}<span style={{ fontSize: 22 }}>h</span></div>
            </div>
            <div className="divider" />
            <div className="stat">
              <div className="stat-label">Solde sem.</div>
              <div className={`stat-value ${soldeThisWeek > 0 ? "pos" : soldeThisWeek < 0 ? "neg" : "neutral"}`}>
                {soldeThisWeek > 0 ? "+" : ""}{decimalToHM(soldeThisWeek)}<span style={{ fontSize: 22 }}>h</span>
              </div>
            </div>
            <div className="divider" />
            <div className="stat">
              <div className="stat-label" style={{ whiteSpace: "nowrap" }}>Cumul total</div>
              <div className={`stat-value ${cumulNow > 0 ? "pos" : cumulNow < 0 ? "neg" : "neutral"}`}>
                {cumulNow > 0 ? "+" : ""}{decimalToHM(cumulNow)}<span style={{ fontSize: 22 }}>h</span>
              </div>
            </div>
          </div>
        </>
      )}

      {view === "historique" && (
        <div className="history-list">
          {sortedHistoryWeeks.length === 0 ? (
            <div className="empty-history">Aucune semaine enregistrée encore.<br />Commence par saisir tes heures !</div>
          ) : (
            sortedHistoryWeeks.map(wk => {
              const total = weekTotal(wk);
              const solde = weekSolde(wk);
              const cumul = cumulSolde(wk);
              return (
                <div
                  key={wk}
                  className={`history-row ${wk === currentWeek ? "selected" : ""}`}
                  onClick={() => { setCurrentWeek(wk); setView("semaine"); }}
                >
                  <div>
                    <div className="history-week">
                      <span style={{ background: "#d4f0ed", color: "#2aa398", fontSize: "15px", fontWeight: 800, marginRight: "6px" }}>S{getISOWeek(wk)}</span>{fmtWeekRange(wk)}
                    </div>
                    <div className="history-cumul">Cumul : {cumul > 0 ? "+" : ""}{decimalToHM(cumul)}h</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="history-solde" style={{ color: solde > 0 ? "#28b587" : solde < 0 ? "#e07a7a" : "#8dcfca" }}>
                      {solde > 0 ? "+" : ""}{decimalToHM(solde)}h
                    </div>
                    <div className="history-total">{decimalToHM(total)}h travaillé</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
