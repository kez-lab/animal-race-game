import React from 'react';
import { RaceResult } from './App';

interface RaceResultsProps {
  results: RaceResult[];
  onNewRace: () => void;
}

const RaceResults: React.FC<RaceResultsProps> = ({ results, onNewRace }) => {
  return (
    <div className="race-results">
      <h2>🏁 경주 결과</h2>
      <div className="results-container">
        {results.map((result, index) => (
          <div 
            key={result.name} 
            className={`result-item ${index === 0 ? 'winner' : ''}`}
          >
            <div className="rank">
              {index === 0 && <span className="crown">👑</span>}
              {index + 1}위
            </div>
            <div className="participant-info">
              <span className="animal">{result.icon}</span>
              <span className="name">{result.name}</span>
            </div>
            <div className="finish-time">
              {result.finishTime.toFixed(2)}초
            </div>
          </div>
        ))}
      </div>
      <button className="new-race-button" onClick={onNewRace}>
        새로운 경주 시작
      </button>
    </div>
  );
};

export default RaceResults; 