// src/components/History.tsx
import React from 'react';
import { RaceResult } from './App';

interface HistoryProps {
  raceHistories: RaceResult[][];
}

const History: React.FC<HistoryProps> = ({ raceHistories }) => {
  if (raceHistories.length === 0) return null;

  return (
    <div className="history-section">
      <h2 className="history-title">경주 기록</h2>
      <div className="history-list">
        {raceHistories.map((results, raceIndex) => (
          <div key={raceIndex} className="history-item">
            <h3 className="race-number">Race #{raceHistories.length - raceIndex}</h3>
            <div className="results-list">
              {results.map((result, position) => (
                <div
                  key={result.name}
                  className={`result-item ${position === 0 ? 'winner' : ''}`}
                >
                  <div className="position">
                    {position === 0 && <span className="crown">👑</span>}
                    {position + 1}위
                  </div>
                  <div className="participant-info">
                    <span className="animal">{result.icon}</span>
                    <span className="name">{result.name}</span>
                  </div>
                  <div className="time">
                    {result.finishTime.toFixed(2)}초
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default History;
