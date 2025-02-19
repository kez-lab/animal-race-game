// src/components/RaceTrack.tsx (일부 수정 예시)
import React, { useEffect, useState, useRef } from 'react';
import { Participant, RaceResult } from './App';

interface RunnerState {
  position: number;
  speed: number;
  finishTime: number | null;
}

interface RaceTrackProps {
  participants: Participant[];
  raceInProgress: boolean;
  onRaceComplete: (results: RaceResult[]) => void;
}

const RaceTrack: React.FC<RaceTrackProps> = ({ participants, raceInProgress, onRaceComplete }) => {
  const finishLine = 95;
  const [runners, setRunners] = useState<RunnerState[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const completedRef = useRef<boolean>(false);

  useEffect(() => {
    if (raceInProgress) {
      completedRef.current = false;
      startTimeRef.current = performance.now();
      setRunners(
        participants.map(() => ({
          position: 0,
          // 낮은 속도 범위: 0.5 ~ 2.5
          speed: Math.random() * 2 + 0.5,
          finishTime: null,
        }))
      );
      // 업데이트 간격을 300ms로 설정
      intervalRef.current = setInterval(() => {
        setRunners(prevRunners =>
          prevRunners.map(runner => {
            if (runner.finishTime !== null) return runner;
            let newPosition = runner.position + runner.speed;
            // 감속 효과: 결승선에 가까워질수록 속도를 줄임
            let newSpeed = (Math.random() * 2 + 0.5);
            let newFinishTime: number | null = runner.finishTime;
            if (newPosition >= finishLine) {
              newPosition = finishLine;
              newFinishTime = (performance.now() - startTimeRef.current) / 1000;
              newSpeed = 0;
            }
            return {
              position: newPosition,
              speed: newSpeed,
              finishTime: newFinishTime,
            };
          })
        );
      }, 300);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [raceInProgress, participants]);

  useEffect(() => {
    if (
      raceInProgress &&
      runners.length > 0 &&
      runners.every(runner => runner.finishTime !== null) &&
      !completedRef.current
    ) {
      completedRef.current = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      const results: RaceResult[] = participants.map((participant, i) => ({
        name: participant.name,
        icon: participant.animal,
        finishTime: runners[i].finishTime ?? 0,
      }));
      results.sort((a, b) => a.finishTime - b.finishTime);
      timeoutRef.current = setTimeout(() => {
        onRaceComplete(results);
      }, 0);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [runners, raceInProgress, participants, onRaceComplete]);

  return (
    <div
      className="race-track"
      style={{
        position: 'relative',
        height: `${participants.length * 60}px`,
        border: '1px solid #000',
        marginBottom: '20px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `${finishLine}%`,
          top: 0,
          bottom: 0,
          width: '5px',
          backgroundColor: 'red',
        }}
      />
      {participants.map((participant, index) => (
        <div
          key={index}
          className="race-participant"
          style={{
            position: 'absolute',
            left: `${runners[index]?.position ?? 0}%`,
            top: `${index * 60 + 10}px`,
            transition: 'left 0.3s linear',
            display: 'flex',
            alignItems: 'center',
            width: '150px',
          }}
        >
          <span style={{ marginRight: '8px', fontSize: '1.5rem' }}>{participant.animal}</span>
          <span>{participant.name}</span>
        </div>
      ))}
    </div>
  );
};

export default RaceTrack;
