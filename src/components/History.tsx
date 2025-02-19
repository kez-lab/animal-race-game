// src/components/History.tsx
import React from 'react';
import { RaceResult } from './App';

interface HistoryProps {
  raceHistories: RaceResult[][];
}

const History: React.FC<HistoryProps> = ({ raceHistories }) => {
  if (!raceHistories || raceHistories.length === 0) {
    return <div>No race history available</div>;
  }

  // raceHistories 배열의 첫 5개 항목 사용 (최신순으로 정렬되어 있다고 가정)
  const slicedData = raceHistories.slice(0, 5);

  return (
    <div className="history">
      <h2>Race History</h2>
      <ul>
        {slicedData.map((race, raceIndex) => (
          <li key={raceIndex}>
            <h3>Race {raceIndex + 1}</h3>
            <ul>
              {race.map((result, idx) => (
                <li key={idx}>
                  {result.name} {result.icon} - Time: {result.finishTime.toFixed(5)}s
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default History;
