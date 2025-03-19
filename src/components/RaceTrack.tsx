// src/components/RaceTrack.tsx (일부 수정 예시)
import React, { useEffect, useState, useRef } from 'react';
import { Participant, RaceResult } from './App';

interface RunnerState {
  position: number;
  speed: number;
  finishTime: number | null;
  lane: number;
  obstacle: boolean;
  currentRank?: number;
}

interface RaceTrackProps {
  participants: Participant[];
  raceInProgress: boolean;
  onRaceComplete: (results: RaceResult[]) => void;
}

const RaceTrack: React.FC<RaceTrackProps> = ({
  participants,
  raceInProgress,
  onRaceComplete,
}) => {
  const finishLine = 90;
  const [runners, setRunners] = useState<RunnerState[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const completedRef = useRef<boolean>(false);

  // 레이스 초기화
  useEffect(() => {
    if (raceInProgress) {
      completedRef.current = false;
      setCountdown(3);

      // 카운트다운
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            startRace();
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(countdownInterval);
      };
    }
  }, [raceInProgress]);

  const calculateRanks = (currentRunners: RunnerState[]) => {
    // 완주한 선수들의 순위를 먼저 결정
    const finishedRunners = currentRunners
      .map((r, index) => ({ ...r, originalIndex: index }))
      .filter(r => r.finishTime !== null)
      .sort((a, b) => (a.finishTime ?? 0) - (b.finishTime ?? 0));

    // 아직 달리고 있는 선수들의 순위를 결정
    const runningRunners = currentRunners
      .map((r, index) => ({ ...r, originalIndex: index }))
      .filter(r => r.finishTime === null)
      .sort((a, b) => b.position - a.position);

    // 최종 순위 배열 생성
    const rankedRunners = [...finishedRunners, ...runningRunners];
    
    // 원래 배열 순서로 다시 정렬하되, 순위 정보 포함
    return currentRunners.map((runner, i) => {
      const rankedRunner = rankedRunners.find(r => r.originalIndex === i);
      return {
        ...runner,
        currentRank: rankedRunner ? rankedRunners.indexOf(rankedRunner) + 1 : i + 1
      };
    });
  };

  const startRace = () => {
    startTimeRef.current = performance.now();
    
    // 각 참가자에게 레인 할당
    const lanes = Array.from({ length: participants.length }, (_, i) => i);
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }

    setRunners(
      participants.map((_, index) => ({
        position: 0,
        speed: 0.2 + Math.random() * 0.2, // 초기 속도 범위 조정
        finishTime: null,
        lane: lanes[index],
        obstacle: Math.random() > 0.7,
        currentRank: index + 1
      }))
    );

    intervalRef.current = setInterval(() => {
      setRunners((prevRunners) => {
        const updatedRunners = prevRunners.map((runner) => {
          if (runner.finishTime !== null) return runner;

          let speedMultiplier = runner.obstacle ? 0.7 : 1;
          
          // 속도 변동성 증가
          // 기존 속도에서 -50%에서 +50% 사이의 큰 변화를 줌
          let randomVariation = (Math.random() * 2 - 1) * 0.5; // -0.5에서 0.5 사이의 값
          let newSpeed = runner.speed * (1 + randomVariation);
          
          // 속도 범위 제한 - 너무 빠르거나 느려지지 않도록
          newSpeed = Math.max(0.05, Math.min(0.6, newSpeed));
          
          let newPosition = runner.position + (newSpeed * speedMultiplier);
          let newFinishTime: number | null = runner.finishTime;

          if (newPosition >= finishLine) {
            newPosition = finishLine;
            newFinishTime = (performance.now() - startTimeRef.current) / 1000;
            newSpeed = 0;
          }

          return {
            ...runner,
            position: newPosition,
            speed: newSpeed,
            finishTime: newFinishTime,
          };
        });

        return calculateRanks(updatedRunners);
      });
    }, 50); // 업데이트 간격 유지
  };

  // 레이스 종료 체크
  useEffect(() => {
    const checkRaceCompletion = () => {
      if (
        raceInProgress &&
        runners.length > 0 &&
        runners.every((runner) => runner.finishTime !== null) &&
        !completedRef.current
      ) {
        completedRef.current = true;
        
        // 인터벌 정리
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // 결과 정렬 및 전달
        const results: RaceResult[] = runners
          .map((runner, index) => ({
            name: participants[index].name,
            icon: participants[index].animal,
            finishTime: runner.finishTime ?? 0,
          }))
          .sort((a, b) => a.finishTime - b.finishTime);

        // 즉시 결과 전달
        onRaceComplete(results);
      }
    };

    checkRaceCompletion();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [runners, raceInProgress, participants, onRaceComplete]);

  return (
    <div className="race-track-container">
      {countdown !== null && (
        <div className="countdown">
          <div className="countdown-number">{countdown}</div>
        </div>
      )}
      <div className="race-track">
        {/* 배경 레인 */}
        {Array.from({ length: participants.length }).map((_, index) => (
          <div
            key={`lane-${index}`}
            className="race-lane"
            style={{
              position: 'absolute',
              top: `${index * 40}px`,
              left: 0,
              right: 0,
              height: '40px',
              backgroundColor: index % 2 === 0 ? '#f8f9fa' : '#e9ecef',
              borderBottom: '1px solid #dee2e6',
            }}
          />
        ))}

        {/* 결승선 */}
        <div className="finish-line" />

        {/* 참가자들 */}
        {participants.map((participant, index) => {
          const runner = runners[index];
          if (!runner) return null;

          return (
            <div
              key={participant.name}
              className="race-lane-container"
              style={{
                position: 'absolute',
                top: `${runner.lane * 40}px`,
                left: 0,
                right: 0,
                height: '40px',
              }}
            >
              <div
                className="race-participant"
                style={{
                  position: 'absolute',
                  left: `${runner.position}%`,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              >
                <div className="participant-rank-container">
                  <div className="participant-rank">
                    {runner.currentRank}위
                  </div>
                  <div className="participant-animal">
                    {participant.animal}
                  </div>
                </div>
              </div>
              <div className="participant-name" style={{ position: 'absolute', left: '10px', top: '5px' }}>
                {participant.name}
              </div>
              {runner.obstacle && (
                <span
                  className="obstacle"
                  style={{
                    position: 'absolute',
                    left: '40%',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                >
                  🌳
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RaceTrack;
