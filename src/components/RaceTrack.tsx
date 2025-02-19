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
  const finishLine = 95; // 결승선 위치 (%)
  const [runners, setRunners] = useState<RunnerState[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const completedRef = useRef<boolean>(false); // 완료 플래그

  // 레이스 시작 시 초기화
  useEffect(() => {
    if (raceInProgress) {
      // 더 정밀한 타이머 사용: performance.now()
      startTimeRef.current = performance.now();
      setRunners(
        participants.map(() => ({
          position: 0,
          speed: Math.random() * 4 + 1,
          finishTime: null,
        }))
      );
      intervalRef.current = setInterval(() => {
        setRunners(prevRunners =>
          prevRunners.map(runner => {
            if (runner.finishTime !== null) return runner;
            let newPosition = runner.position + runner.speed;
            let newSpeed = Math.random() * 4 + 1;
            let newFinishTime: number | null = runner.finishTime;
            if (newPosition >= finishLine) {
              newPosition = finishLine;
              // performance.now() 사용하여 정밀한 시간 측정 (초 단위로 변환)
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
      }, 200);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [raceInProgress, participants]);
  

  // 모든 참가자가 결승선에 도달했는지 확인 후 최종 결과 전달 (한 번만 호출)
  useEffect(() => {
    if (
      raceInProgress &&
      runners.length > 0 &&
      runners.every(runner => runner.finishTime !== null) &&
      !completedRef.current
    ) {
      completedRef.current = true; // 한 번만 실행되도록 설정
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
      {/* 결승선 표시 */}
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
            transition: 'left 0.2s linear',
            display: 'flex',
            alignItems: 'center',
            width: '150px',
          }}
        >
          <span style={{ marginRight: '8px', fontSize: '1.5rem' }}>
            {participant.animal}
          </span>
          <span>{participant.name}</span>
        </div>
      ))}
    </div>
  );
};

export default RaceTrack;
