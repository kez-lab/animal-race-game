// src/components/Game.tsx
import React, { useState } from 'react';
import { Participant, RaceResult } from './App';
import RaceTrack from './RaceTrack';

interface GameProps {
  participants: Participant[];
  onRaceEnd: (results: RaceResult[]) => void;
}

const Game: React.FC<GameProps> = ({ participants, onRaceEnd }) => {
  const [isRacing, setIsRacing] = useState(true);

  const handleRaceComplete = (results: RaceResult[]) => {
    console.log('Race completed in Game component:', results); // 디버깅용 로그
    setIsRacing(false);
    // 결과를 즉시 전달하되, 화면 전환을 위한 약간의 지연 추가
    setTimeout(() => {
      onRaceEnd(results);
    }, 500);
  };

  return (
    <div className="game">
      <RaceTrack
        participants={participants}
        raceInProgress={isRacing}
        onRaceComplete={handleRaceComplete}
      />
    </div>
  );
};

export default Game;
