// src/components/App.tsx
import React, { useState } from 'react';
import ParticipantForm from './ParticipantForm';
import Game from './Game';
import History from './History';
import './App.css';

// 참가자 및 경주 결과 타입 정의
export interface Participant {
  name: string;
  animal: string;
}

// finishTime: 완주 시간(초)
export interface RaceResult {
  name: string;
  icon: string;
  finishTime: number;
}

const App: React.FC = () => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [raceHistory, setRaceHistory] = useState<RaceResult[][]>([]);
  const [isRaceStarted, setIsRaceStarted] = useState(false);
  const [raceResults, setRaceResults] = useState<RaceResult[] | null>(null);

  const addParticipant = (participant: Participant) => {
    setParticipants((prev) => [...prev, participant]);
  };

  const removeParticipant = (participantName: string) => {
    setParticipants((prev) => prev.filter(p => p.name !== participantName));
  };

  const startRace = () => {
    setIsRaceStarted(true);
    // 경주는 Game 컴포넌트에서 처리됩니다.
  };

  const handleRaceEnd = (results: RaceResult[]) => {
    setRaceResults(results);
    setRaceHistory((prev) => [results, ...prev].slice(0, 5));
    setIsRaceStarted(false);
  };

  return (
    <div className="app">
      <h1>Animal Race Game</h1>
      {!isRaceStarted ? (
        <>
          <ParticipantForm 
            participants={participants} 
            addParticipant={addParticipant} 
            removeParticipant={removeParticipant} 
          />
          <button onClick={startRace} disabled={participants.length === 0}>
            Start Race
          </button>
        </>
      ) : (
        <Game participants={participants} onRaceEnd={handleRaceEnd} />
      )}
      <History raceHistories={raceHistory} />
    </div>
  );
};

export default App;
