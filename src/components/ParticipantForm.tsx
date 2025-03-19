// src/components/ParticipantForm.tsx
import React, { useState } from 'react';
import { Participant } from './App';

interface ParticipantFormProps {
  participants: Participant[];
  addParticipant: (participant: Participant) => void;
  removeParticipant: (name: string) => void;
}

const ANIMAL_OPTIONS = [
  { value: '🐎', label: '말' },
  { value: '🐅', label: '호랑이' },
  { value: '🐇', label: '토끼' },
  { value: '🦊', label: '여우' },
  { value: '🦘', label: '캥거루' },
  { value: '🦌', label: '사슴' },
  { value: '🐆', label: '치타' },
  { value: '🦒', label: '기린' },
];

const getRandomAnimal = () => {
  return ANIMAL_OPTIONS[Math.floor(Math.random() * ANIMAL_OPTIONS.length)].value;
};

const ParticipantForm: React.FC<ParticipantFormProps> = ({
  participants,
  addParticipant,
  removeParticipant,
}) => {
  const [name, setName] = useState('');
  const [animal, setAnimal] = useState('random');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('이름을 입력해주세요');
      return;
    }

    if (participants.some(p => p.name === name)) {
      setError('이미 존재하는 이름입니다');
      return;
    }

    if (participants.length >= 15) {
      setError('최대 15명까지만 참가할 수 있습니다');
      return;
    }

    const selectedAnimal = animal === 'random' ? getRandomAnimal() : animal;
    addParticipant({ name: name.trim(), animal: selectedAnimal });
    setName('');
    setAnimal('random');
    setError('');
  };

  return (
    <div className="participant-form">
      <h2>참가자 등록</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">이름</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="참가자 이름을 입력하세요"
            maxLength={10}
          />
        </div>
        <div className="form-group">
          <label htmlFor="animal">동물 선택</label>
          <select
            id="animal"
            value={animal}
            onChange={(e) => setAnimal(e.target.value)}
          >
            <option value="random">🎲 랜덤 선택</option>
            {ANIMAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value} {option.label}
              </option>
            ))}
          </select>
        </div>
        {error && <div className="error-message">{error}</div>}
        <button type="submit">참가자 추가</button>
      </form>

      <div className="participants-list">
        {participants.map((participant) => (
          <div key={participant.name} className="participant-card">
            <div className="participant-info">
              <span className="participant-animal">{participant.animal}</span>
              <span className="participant-name">{participant.name}</span>
            </div>
            <button
              className="remove-button"
              onClick={() => removeParticipant(participant.name)}
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ParticipantForm;
