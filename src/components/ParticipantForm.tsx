import React, { useState } from 'react';
import { Participant } from './App';

interface ParticipantFormProps {
  participants: Participant[];
  addParticipant: (participant: Participant) => void;
  removeParticipant: (participantName: string) => void;
}

const animals = ['🐶', '🐱', '🐰', '🐢', '🐴'];

const ParticipantForm: React.FC<ParticipantFormProps> = ({ participants, addParticipant, removeParticipant }) => {
  const [name, setName] = useState('');
  // 기본 선택값은 "random"으로 고정 (메뉴에는 "Random Animal"이 표시됨)
  const [selectedAnimal, setSelectedAnimal] = useState('random');

  const handleAddParticipant = () => {
    if (!name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }
    // 이름 중복 체크 (대소문자 구분 없이)
    if (participants.some(p => p.name.toLowerCase() === name.trim().toLowerCase())) {
      alert('이미 존재하는 이름입니다. 다른 이름을 입력해주세요.');
      return;
    }
    // selectedAnimal 값이 "random"이면 실제 랜덤 동물을 할당
    const animalToAssign =
      selectedAnimal === 'random'
        ? animals[Math.floor(Math.random() * animals.length)]
        : selectedAnimal;
    addParticipant({ name: name.trim(), animal: animalToAssign });
    setName('');
    // 다시 기본값으로 "random" 설정
    setSelectedAnimal('random');
  };

  const handleRemoveParticipant = (index: number) => {
    removeParticipant(participants[index].name);
  };

  return (
    <div className="participant-form">
      <h2>Join the Race</h2>
      <input
        type="text"
        placeholder="Enter your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <select
        value={selectedAnimal}
        onChange={(e) => setSelectedAnimal(e.target.value)}
      >
        <option value="random">Random Animal</option>
        {animals.map((animal, idx) => (
          <option key={idx} value={animal}>
            {animal}
          </option>
        ))}
      </select>
      <button onClick={handleAddParticipant}>Add Participant</button>
      <ul>
        {participants.map((participant, index) => (
          <li key={index}>
            {participant.name} ({participant.animal})
            <button onClick={() => handleRemoveParticipant(index)}>Remove</button>
          </li>
        ))}
      </ul>
      {participants.length < 1 && <p>At least one participant is required.</p>}
    </div>
  );
};

export default ParticipantForm;
