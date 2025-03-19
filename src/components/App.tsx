// src/components/App.tsx
import React, { useState } from 'react';
import ParticipantForm from './ParticipantForm';
import Game from './Game';
import History from './History';
import RaceResults from './RaceResults';
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
  const [currentResults, setCurrentResults] = useState<RaceResult[] | null>(null);

  const addParticipant = (participant: Participant) => {
    setParticipants((prev) => [...prev, participant]);
  };

  const removeParticipant = (participantName: string) => {
    setParticipants((prev) => prev.filter(p => p.name !== participantName));
  };

  const startRace = () => {
    setIsRaceStarted(true);
    setCurrentResults(null);
  };

  const handleRaceEnd = (results: RaceResult[]) => {
    console.log('Race ended with results:', results); // 디버깅용 로그
    setCurrentResults(results);
    setRaceHistory((prev) => [results, ...prev].slice(0, 5));
    setIsRaceStarted(false);
  };

  const startNewRace = () => {
    setCurrentResults(null);
  };

  console.log('Current state:', { // 디버깅용 로그
    isRaceStarted,
    hasCurrentResults: currentResults !== null,
    participantsCount: participants.length
  });

  return (
    <div className="app">
      <h1>🏃‍♂️ 동물 레이스 게임 🏃‍♀️</h1>
      {!isRaceStarted && !currentResults && (
        <>
          <ParticipantForm 
            participants={participants} 
            addParticipant={addParticipant} 
            removeParticipant={removeParticipant} 
          />
          <button 
            onClick={startRace} 
            disabled={participants.length < 2}
            className="start-race-button"
          >
            {participants.length < 2 
              ? '최소 2명의 참가자가 필요합니다' 
              : '경주 시작!'}
          </button>
        </>
      )}
      
      {isRaceStarted && (
        <Game 
          participants={participants} 
          onRaceEnd={handleRaceEnd} 
        />
      )}

      {currentResults && !isRaceStarted && (
        <RaceResults 
          results={currentResults} 
          onNewRace={startNewRace} 
        />
      )}

      {raceHistory.length > 0 && <History raceHistories={raceHistory} />}
    </div>
  );
};

export default App;
