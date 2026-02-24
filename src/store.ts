import { create } from 'zustand';
import { nanoid } from 'nanoid';

interface Stone {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
}

interface Enemy {
  id: string;
  position: [number, number, number];
  health: number;
}

interface Effect {
  id: string;
  position: [number, number, number];
  type: 'impact' | 'blood' | 'smoke' | 'flash';
  createdAt: number;
}

interface GameState {
  health: number;
  score: number;
  isPaused: boolean;
  isDodging: boolean;
  isStarted: boolean;
  stones: Stone[];
  enemies: Enemy[];
  effects: Effect[];
  takeDamage: (amount: number) => void;
  damageEnemy: (id: string, amount: number) => void;
  addScore: (amount: number) => void;
  togglePause: () => void;
  setDodging: (dodging: boolean) => void;
  startGame: () => void;
  reset: () => void;
  shootStone: (position: [number, number, number], velocity: [number, number, number]) => void;
  removeStone: (id: string) => void;
  spawnEnemy: (position: [number, number, number]) => void;
  removeEnemy: (id: string) => void;
  addEffect: (position: [number, number, number], type: 'impact' | 'blood' | 'smoke' | 'flash') => void;
  removeEffect: (id: string) => void;
}

export const useStore = create<GameState>((set) => ({
  health: 100,
  score: 0,
  isPaused: false,
  isDodging: false,
  isStarted: false,
  stones: [],
  enemies: [],
  effects: [],
  takeDamage: (amount) => set((state) => ({ health: Math.max(0, state.health - amount) })),
  damageEnemy: (id, amount) => set((state) => ({
    enemies: state.enemies.map((e) => e.id === id ? { ...e, health: e.health - amount } : e)
  })),
  addScore: (amount) => set((state) => ({ score: state.score + amount })),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  setDodging: (dodging) => set({ isDodging: dodging }),
  startGame: () => set({ isStarted: true, health: 100, score: 0, isPaused: false, stones: [], enemies: [], effects: [] }),
  reset: () => set({ health: 100, score: 0, isPaused: false, isDodging: false, isStarted: false, stones: [], enemies: [], effects: [] }),
  shootStone: (position, velocity) => set((state) => ({
    stones: [...state.stones, { id: nanoid(), position, velocity }]
  })),
  removeStone: (id) => set((state) => ({
    stones: state.stones.filter((s) => s.id !== id)
  })),
  spawnEnemy: (position) => set((state) => ({
    enemies: [...state.enemies, { id: nanoid(), position, health: 30 }]
  })),
  removeEnemy: (id) => set((state) => ({
    enemies: state.enemies.filter((e) => e.id !== id)
  })),
  addEffect: (position, type) => set((state) => ({
    effects: [...state.effects, { id: nanoid(), position, type, createdAt: Date.now() }]
  })),
  removeEffect: (id) => set((state) => ({
    effects: state.effects.filter((e) => e.id !== id)
  })),
}));
