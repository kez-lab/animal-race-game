// src/components/Game.tsx
import React, { useState } from 'react';
import { Participant, RaceResult } from './App';
import RaceTrack from './RaceTrack';

interface GameProps {
  participants: Participant[];
  onRaceEnd: (results: RaceResult[]) => void;
}

const Game: React.FC<GameProps> = ({ participants, onRaceEnd }) => {
  const [raceInProgress, setRaceInProgress] = useState<boolean>(false);
  const [results, setResults] = useState<RaceResult[]>([]);

  const startRace = () => {
    setRaceInProgress(true);
    setResults([]); // 이전 결과 초기화
  };

  // RaceTrack에서 레이스 완료 시 호출하는 콜백
  const handleRaceComplete = (finalResults: RaceResult[]) => {
    setResults(finalResults);
    setRaceInProgress(false);
    onRaceEnd(finalResults);
  };

  return (
    <div className="game-container">
      <RaceTrack
        participants={participants}
        raceInProgress={raceInProgress}
        onRaceComplete={handleRaceComplete}
      />
      {results.length > 0 && (
        <div className="results">
          <h2>Race Results</h2>
          <ul>
            {results.map((result, index) => (
              <li key={index}>
                {result.name} - {index + 1} place (Time: {result.finishTime.toFixed(2)}s)
              </li>
            ))}
          </ul>
        </div>
      )}
      <button onClick={startRace} disabled={raceInProgress}>
        Start Race
      </button>
    </div>
  );
};

export default Game;
