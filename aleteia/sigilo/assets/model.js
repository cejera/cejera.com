(function (root) {
  'use strict';
  const GROUPS = Object.freeze(['AIQY', 'BJRZ', 'CKS', 'DLT', 'EMU', 'FNV', 'GOW', 'HPX']);
  const ELEMENTS = Object.freeze(['Vida', 'Fogo', 'Terra', 'Água', 'Ar', 'Energia', 'Sol', 'Tempo']);
  const RUNE_FILES = Object.freeze(['vida', 'fogo', 'terra', 'agua', 'ar', 'energia', 'sol', 'tempo']);
  const FORMATS = Object.freeze({ square: [1600, 1600], landscape: [1920, 1080], portrait: [1080, 1920] });
  const PHASES = Object.freeze([
    { title: 'Normalizando a intenção.', duration: 900 },
    { title: 'Retirando letras repetidas.', duration: 1400 },
    { title: 'Numerando no ciclo de oito.', duration: 1100 },
    { title: 'Traçando a sequência sobre o septagrama.', duration: 2600 },
    { title: 'Retirando a matriz do campo.', duration: 800 },
    { title: 'Delimitando o domínio.', duration: 800 },
    { title: 'Acrescentando a contenção.', duration: 800 },
    { title: 'Inscrevendo os sete caracteres.', duration: 1700 }
  ]);
  function normalize(text) { return String(text).normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^A-Z]/g, ''); }
  function graphemes(text) {
    const normalized = String(text).normalize('NFC');
    if (typeof Intl.Segmenter === 'function') return [...new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }).segment(normalized)].map(item => item.segment);
    return normalized.match(/[^\p{M}]\p{M}*/gu) || [];
  }
  function numberFor(letter) { return (letter.charCodeAt(0) - 65) % 8 + 1; }
  function resolveKey(text) {
    const glyphs = graphemes(text);
    if (/\s|\p{Cc}/u.test(text) || glyphs.some(g => !/[^\p{M}\p{Cf}]/u.test(g))) throw new Error('Use sete caracteres visíveis, sem espaços ou controles.');
    if (glyphs.length !== 7) throw new Error(`A palavra-chave precisa de exatamente 7 caracteres. Você informou ${glyphs.length}.`);
    return { text: String(text).normalize('NFC'), glyphs };
  }
  function matrix() {
    return Array.from({ length: 8 }, (_, index) => {
      const number = index + 1;
      if (number === 8) return { number, name: ELEMENTS[index], rune: RUNE_FILES[index], x: 0, y: 0 };
      const angle = -Math.PI / 2 + (number % 7) / 7 * Math.PI * 2;
      return { number, name: ELEMENTS[index], rune: RUNE_FILES[index], x: Math.cos(angle) * 207, y: Math.sin(angle) * 207 };
    });
  }
  function build(rawIntention, rawKey, options = {}) {
    if (String(rawIntention).length > 240) throw new Error('Use uma intenção de até 240 caracteres.');
    const normalized = normalize(rawIntention);
    if (!normalized) throw new Error('Escreva uma intenção com letras. Números e pontuação não formam o traçado.');
    const seen = new Set();
    const tokens = [...normalized].map((letter, index) => {
      const duplicate = seen.has(letter); seen.add(letter);
      const vowel = Boolean(options.removeVowels && 'AEIOU'.includes(letter));
      return { letter, index, duplicate, vowel, kept: !duplicate && !vowel, number: numberFor(letter) };
    });
    const letters = tokens.filter(t => t.kept).map(t => t.letter);
    if (!letters.length) throw new Error('A redução ficou vazia. Mantenha as vogais ou reformule a intenção.');
    const key = resolveKey(rawKey);
    const nodes = matrix();
    const numbers = letters.map(numberFor);
    const points = numbers.map(n => ({ ...nodes[n - 1] }));
    const direction = options.direction || 'clockwise', facing = options.facing || 'inward';
    if (!['clockwise', 'counterclockwise'].includes(direction) || !['inward', 'outward', 'upright'].includes(facing)) throw new Error('Orientação da chave não reconhecida.');
    return { normalized, tokens, letters, numbers, points, nodes, key, direction, facing, removeVowels: Boolean(options.removeVowels) };
  }
  function timeline(elapsed) {
    let offset = 0;
    for (let i = 0; i < PHASES.length; i++) {
      if (elapsed < offset + PHASES[i].duration) return { phase: i, progress: Math.max(0, (elapsed - offset) / PHASES[i].duration), totalProgress: Math.max(0, elapsed / totalDuration()) };
      offset += PHASES[i].duration;
    }
    return { phase: 8, progress: 1, totalProgress: 1 };
  }
  function totalDuration() { return PHASES.reduce((sum, p) => sum + p.duration, 0); }
  const api = Object.freeze({ GROUPS, ELEMENTS, RUNE_FILES, FORMATS, PHASES, normalize, graphemes, numberFor, resolveKey, matrix, build, timeline, totalDuration });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SigillumModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
