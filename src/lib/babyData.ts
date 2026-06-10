export interface MilestoneInfo {
  monthMin: number;
  monthMax: number;
  title: string;
  description: string;
  type: 'motor' | 'social' | 'language' | 'cognitive';
  emoji: string;
}

export const developmentMilestones: MilestoneInfo[] = [
  { monthMin: 1, monthMax: 2, title: 'First smile', description: 'Baby smiles in response to your face or voice — a social smile!', type: 'social', emoji: '😊' },
  { monthMin: 1, monthMax: 2, title: 'Lifts head', description: 'During tummy time, baby can briefly lift their head.', type: 'motor', emoji: '💪' },
  { monthMin: 1, monthMax: 3, title: 'Tracks objects', description: 'Baby follows moving objects with their eyes.', type: 'cognitive', emoji: '👁️' },
  { monthMin: 2, monthMax: 4, title: 'Coos and gurgles', description: 'Baby makes vowel sounds and coos in response to you.', type: 'language', emoji: '💬' },
  { monthMin: 2, monthMax: 4, title: 'Recognizes faces', description: 'Baby recognizes familiar faces, especially mom and dad.', type: 'social', emoji: '🥰' },
  { monthMin: 3, monthMax: 5, title: 'Holds head steady', description: 'Baby can hold their head up without support.', type: 'motor', emoji: '🏆' },
  { monthMin: 3, monthMax: 5, title: 'Laughs out loud', description: 'Baby laughs for the first time — the most joyful sound!', type: 'social', emoji: '😂' },
  { monthMin: 3, monthMax: 5, title: 'Reaches for toys', description: 'Baby reaches out and bats at hanging toys.', type: 'motor', emoji: '🎯' },
  { monthMin: 4, monthMax: 6, title: 'Rolls over', description: 'Baby rolls from tummy to back (or back to tummy).', type: 'motor', emoji: '🔄' },
  { monthMin: 4, monthMax: 6, title: 'Grasps objects', description: 'Baby grasps and holds onto toys.', type: 'motor', emoji: '✋' },
  { monthMin: 5, monthMax: 7, title: 'Sits with support', description: 'Baby can sit upright when supported.', type: 'motor', emoji: '🪑' },
  { monthMin: 5, monthMax: 7, title: 'Recognizes own name', description: 'Baby turns toward you when you say their name.', type: 'language', emoji: '📢' },
  { monthMin: 6, monthMax: 8, title: 'Sits independently', description: 'Baby sits without any support — huge milestone!', type: 'motor', emoji: '🎉' },
  { monthMin: 6, monthMax: 8, title: 'Babbling begins', description: 'Baby babbles with consonant sounds like "ba ba" or "da da".', type: 'language', emoji: '🗣️' },
  { monthMin: 6, monthMax: 9, title: 'First solid foods', description: 'Baby starts exploring pureed foods.', type: 'motor', emoji: '🥣' },
  { monthMin: 7, monthMax: 9, title: 'Stranger anxiety', description: 'Baby becomes shy or upset around unfamiliar people.', type: 'social', emoji: '😟' },
  { monthMin: 7, monthMax: 10, title: 'Crawling', description: 'Baby starts to crawl or scoot around.', type: 'motor', emoji: '🐛' },
  { monthMin: 8, monthMax: 10, title: 'Pulls to stand', description: 'Baby pulls themselves up to a standing position.', type: 'motor', emoji: '🧗' },
  { monthMin: 8, monthMax: 10, title: 'Waves bye-bye', description: 'Baby waves goodbye when prompted.', type: 'social', emoji: '👋' },
  { monthMin: 9, monthMax: 11, title: 'Claps hands', description: 'Baby claps hands together, often with a big smile.', type: 'motor', emoji: '👏' },
  { monthMin: 9, monthMax: 11, title: 'Plays peek-a-boo', description: 'Baby enjoys games of peek-a-boo.', type: 'social', emoji: '🙈' },
  { monthMin: 9, monthMax: 11, title: 'Mama/Dada', description: 'Baby says "mama" and "dada" (with meaning!).', type: 'language', emoji: '👨‍👩‍👧' },
  { monthMin: 10, monthMax: 12, title: 'Points at objects', description: 'Baby points to things they want or find interesting.', type: 'language', emoji: '☝️' },
  { monthMin: 10, monthMax: 13, title: 'First steps', description: 'Baby takes their first independent steps — huge milestone!', type: 'motor', emoji: '🦶' },
  { monthMin: 11, monthMax: 13, title: 'First words', description: 'Baby says their first real words with meaning.', type: 'language', emoji: '💬' },
  { monthMin: 12, monthMax: 15, title: 'Walks independently', description: 'Baby walks without holding on to anything.', type: 'motor', emoji: '🚶' },
  { monthMin: 12, monthMax: 15, title: 'Uses objects purposefully', description: 'Baby stacks blocks, bangs toys, uses spoons.', type: 'cognitive', emoji: '🧱' },
  { monthMin: 14, monthMax: 17, title: 'Runs!', description: 'Baby starts running — a fast, wobbly, adorable trot!', type: 'motor', emoji: '🏃' },
  { monthMin: 15, monthMax: 18, title: '5+ words', description: 'Baby has a vocabulary of 5 or more clear words.', type: 'language', emoji: '📚' },
  { monthMin: 18, monthMax: 22, title: 'Pretend play', description: 'Baby starts pretend play — feeding dolls, pretending to cook.', type: 'cognitive', emoji: '🎭' },
  { monthMin: 18, monthMax: 22, title: '10+ words', description: 'Baby vocabulary grows to 10 or more words.', type: 'language', emoji: '📖' },
  { monthMin: 20, monthMax: 24, title: 'Two-word phrases', description: 'Baby combines words: "more milk", "mama up", "bye bye daddy".', type: 'language', emoji: '💬' },
  { monthMin: 22, monthMax: 26, title: '50+ words', description: 'Baby\'s vocabulary explodes to 50 or more words!', type: 'language', emoji: '🎤' },
];

export function getBabyAgeMonths(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  return Math.floor((today.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
}

export function getBabyAgeDisplay(birthDate: string): string {
  const birth = new Date(birthDate);
  const today = new Date();
  const totalDays = Math.floor((today.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));

  if (totalDays < 7) return `${totalDays} day${totalDays !== 1 ? 's' : ''} old`;
  if (totalDays < 30) {
    const weeks = Math.floor(totalDays / 7);
    return `${weeks} week${weeks !== 1 ? 's' : ''} old`;
  }

  const months = Math.floor(totalDays / 30.44);
  if (months < 24) return `${months} month${months !== 1 ? 's' : ''} old`;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) return `${years} year${years !== 1 ? 's' : ''} old`;
  return `${years}y ${remainingMonths}m old`;
}

export function getUpcomingMilestones(ageMonths: number): MilestoneInfo[] {
  return developmentMilestones
    .filter(m => m.monthMin >= ageMonths && m.monthMin <= ageMonths + 3)
    .slice(0, 4);
}

export function getCurrentStageMilestones(ageMonths: number): MilestoneInfo[] {
  return developmentMilestones
    .filter(m => ageMonths >= m.monthMin && ageMonths <= m.monthMax)
    .slice(0, 6);
}
