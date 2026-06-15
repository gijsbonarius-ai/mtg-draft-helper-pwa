import { useState } from 'react';
import type { GameState, PlayerKey } from '../lib/gameTypes';
import type { ParsedEffect } from '../lib/cardAutomation';
import { drawCard, adjustLife, addCounter, moveToGraveyard, exileCard, returnToHand, tapToggle, adjustPoison, createToken } from '../lib/gameLogic';

interface Props {
  cardName: string;
  effects: ParsedEffect[];
  state: GameState;
  me: PlayerKey;
  onApply: (newState: GameState) => void;
  onSkip: () => void;
}

interface CreatureTarget {
  uid: string;
  name: string;
  owner: PlayerKey;
  label: string;
}

export default function SpellEffectsModal({ cardName, effects, state, me, onApply, onSkip }: Props) {
  const opp: PlayerKey = me === 'player1' ? 'player2' : 'player1';

  const allCreatures: CreatureTarget[] = [
    ...state.players[me].battlefield.map(c => ({ uid: c.uid, name: c.name, owner: me, label: `${c.name} (yours)` })),
    ...state.players[opp].battlefield.map(c => ({ uid: c.uid, name: c.name, owner: opp, label: `${c.name} (opponent's)` })),
  ];

  const [checked, setChecked] = useState<boolean[]>(() => effects.map(() => true));
  const [creatureTargets, setCreatureTargets] = useState<(string | null)[]>(() =>
    effects.map(e =>
      ['choose_creature_any', 'choose_creature_self', 'choose_creature_opp'].includes(e.target)
        ? (allCreatures[0]?.uid ?? null)
        : null
    )
  );

  if (effects.length === 0) return null;

  const hasAuto = effects.some(e => e.type !== 'manual');

  function toggleCheck(i: number) {
    setChecked(prev => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  function setCreatureTarget(i: number, uid: string) {
    setCreatureTargets(prev => prev.map((v, idx) => (idx === i ? uid : v)));
  }

  function getCreatureOptions(effect: ParsedEffect): CreatureTarget[] {
    if (effect.target === 'choose_creature_self') return allCreatures.filter(c => c.owner === me);
    if (effect.target === 'choose_creature_opp') return allCreatures.filter(c => c.owner === opp);
    return allCreatures; // choose_creature_any
  }

  function handleApply() {
    let s = state;

    effects.forEach((effect, i) => {
      if (!checked[i]) return;
      const amount = effect.amount ?? 1;

      if (effect.type === 'draw') {
        if (effect.target === 'all_players') {
          for (let j = 0; j < amount; j++) {
            s = drawCard(s, me);
            s = drawCard(s, opp);
          }
        } else {
          for (let j = 0; j < amount; j++) {
            s = drawCard(s, me);
          }
        }
      } else if (effect.type === 'life_gain') {
        s = adjustLife(s, me, amount);
      } else if (effect.type === 'life_loss') {
        if (effect.target === 'self') {
          s = adjustLife(s, me, -amount);
        } else {
          // opp or all_opponents (2-player: same thing)
          s = adjustLife(s, opp, -amount);
        }
      } else if (effect.type === 'damage') {
        if (effect.target === 'opp' || effect.target === 'all_opponents') {
          s = adjustLife(s, opp, -amount);
        } else if (effect.target === 'choose') {
          // target player — treat as opponent
          s = adjustLife(s, opp, -amount);
        } else {
          // creature target
          const uid = creatureTargets[i];
          if (uid) {
            const owner = allCreatures.find(c => c.uid === uid)?.owner;
            if (owner) s = addCounter(s, owner, uid, -amount);
          }
        }
      } else if (effect.type === 'destroy_creature') {
        const uid = creatureTargets[i];
        if (uid) {
          const owner = allCreatures.find(c => c.uid === uid)?.owner;
          if (owner) s = moveToGraveyard(s, owner, uid);
        }
      } else if (effect.type === 'exile_creature') {
        const uid = creatureTargets[i];
        if (uid) {
          const owner = allCreatures.find(c => c.uid === uid)?.owner;
          if (owner) s = exileCard(s, owner, uid);
        }
      } else if (effect.type === 'plus_counter') {
        const uid = creatureTargets[i];
        if (uid) {
          const owner = allCreatures.find(c => c.uid === uid)?.owner;
          if (owner) s = addCounter(s, owner, uid, amount);
        }
      } else if (effect.type === 'minus_counter') {
        const uid = creatureTargets[i];
        if (uid) {
          const owner = allCreatures.find(c => c.uid === uid)?.owner;
          if (owner) s = addCounter(s, owner, uid, -amount);
        }
      } else if (effect.type === 'mill') {
        // Mill opponent by default
        const target = opp;
        const lib = s.players[target].library;
        const milled = lib.splice(0, amount);
        s = {
          ...s,
          players: {
            ...s.players,
            [target]: {
              ...s.players[target],
              library: lib,
              graveyard: [...s.players[target].graveyard, ...milled],
            },
          },
        };
      } else if (effect.type === 'bounce_creature') {
        const uid = creatureTargets[i];
        if (uid) {
          const owner = allCreatures.find(c => c.uid === uid)?.owner;
          if (owner) s = returnToHand(s, owner, uid);
        }
      } else if (effect.type === 'tap_creature') {
        const uid = creatureTargets[i];
        if (uid) {
          const owner = allCreatures.find(c => c.uid === uid)?.owner;
          const card = owner ? s.players[owner].battlefield.find(c => c.uid === uid) : undefined;
          if (owner && card && !card.tapped) s = tapToggle(s, owner, uid);
        }
      } else if (effect.type === 'poison') {
        s = adjustPoison(s, effect.target === 'self' ? me : opp, amount);
      } else if (effect.type === 'destroy_all_creatures') {
        (['player1', 'player2'] as PlayerKey[]).forEach(pk => {
          s.players[pk].battlefield.filter(c => !c.isLand).map(c => c.uid).forEach(uid => {
            s = moveToGraveyard(s, pk, uid);
          });
        });
      } else if (effect.type === 'create_token') {
        const name = effect.token ?? 'Token';
        for (let j = 0; j < amount; j++) s = createToken(s, me, name);
      }
    });

    onApply(s);
  }

  const needsCreature = (effect: ParsedEffect) =>
    ['choose_creature_any', 'choose_creature_self', 'choose_creature_opp'].includes(effect.target);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="panel max-w-md w-full mx-4 bg-[#0d0d12] rounded-2xl p-6 shadow-2xl border border-yellow-700/40">
        <h2 className="font-display text-gold font-bold text-xl mb-1">{hasAuto ? 'Auto-apply Effects' : 'Card Effects'}</h2>
        <p className="text-yellow-400 text-sm mb-4 font-semibold">{cardName}</p>

        <div className="flex flex-col gap-3 mb-6">
          {effects.map((effect, i) => {
            if (effect.type === 'manual') {
              return (
                <div key={i} className="rounded-lg border border-yellow-700/30 bg-yellow-900/10 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-yellow-600 mb-1">Resolve manually</p>
                  <p className="text-sm text-gray-200 whitespace-pre-line">{effect.oracle ?? effect.description}</p>
                </div>
              );
            }
            if (effect.type === 'scry') {
              return (
                <div key={i} className="rounded-lg border border-blue-700/30 bg-blue-900/10 px-3 py-2">
                  <p className="text-sm text-blue-200">🔮 {effect.description || `Scry ${effect.amount ?? 1}`}</p>
                  <p className="text-xs text-gray-400 mt-0.5">You'll choose the order after applying.</p>
                </div>
              );
            }
            const options = needsCreature(effect) ? getCreatureOptions(effect) : [];
            return (
              <div key={i} className="flex flex-col gap-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked[i]}
                    onChange={() => toggleCheck(i)}
                    className="w-4 h-4 accent-yellow-500"
                  />
                  <span className="text-sm text-gray-200">{effect.description}</span>
                </label>
                {needsCreature(effect) && checked[i] && (
                  <select
                    className="arena-input ml-6 text-sm"
                    value={creatureTargets[i] ?? ''}
                    onChange={e => setCreatureTarget(i, e.target.value)}
                    disabled={options.length === 0}
                  >
                    {options.length === 0 ? (
                      <option value="">No creatures</option>
                    ) : (
                      options.map(c => (
                        <option key={c.uid} value={c.uid}>{c.label}</option>
                      ))
                    )}
                  </select>
                )}
              </div>
            );
          })}
        </div>

        <div className={hasAuto ? 'grid grid-cols-2 gap-3' : ''}>
          {hasAuto && (
            <button
              onClick={handleApply}
              className="btn-gold font-bold py-3 rounded-xl text-sm"
            >
              Apply Selected
            </button>
          )}
          <button
            onClick={onSkip}
            className="btn-ghost font-bold py-3 rounded-xl text-sm w-full"
          >
            {hasAuto ? 'Skip All' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
