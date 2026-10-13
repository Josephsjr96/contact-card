"""
Poetic feature analysis, ported from the original Tkinter research
application so the inference service can attach the same rhyme/meter/
metaphor signal to every translation it returns.

As noted in that project's RESEARCH NOTES: these are heuristic
pattern-matchers (a handful of suffixes and a short metaphor lexicon per
language), useful as a prototyping signal, not yet validated against
expert-annotated poetry. Treat `poetic_score` as a rough proxy, not ground
truth, until that validation happens.
"""
import re
from typing import Dict, List

try:
    import syllables
except ImportError:  # pragma: no cover - optional dependency
    syllables = None

RHYME_PATTERNS = {
    "persian": {
        "an": re.compile(r"\w+ان$"),
        "ash": re.compile(r"\w+اش$"),
    },
    "german": {
        "en": re.compile(r"\w+en$", re.IGNORECASE),
        "ung": re.compile(r"\w+ung$", re.IGNORECASE),
        "keit": re.compile(r"\w+keit$", re.IGNORECASE),
        "heit": re.compile(r"\w+heit$", re.IGNORECASE),
    },
    "polish": {
        "anie": re.compile(r"\w+anie$", re.IGNORECASE),
        "enie": re.compile(r"\w+enie$", re.IGNORECASE),
        "osc": re.compile(r"\w+o[śs][ćc]$", re.IGNORECASE),
        "ami": re.compile(r"\w+ami$", re.IGNORECASE),
        "al_il": re.compile(r"\w+[ai][łl]$", re.IGNORECASE),
    },
}

METAPHORS = {
    "persian": ["گل", "بلبل", "شمع", "پروانه", "سرو", "چشم", "لب", "دل", "آتش", "آب", "باد", "خاک"],
    "german": ["rose", "nachtigall", "kerze", "schmetterling", "seele", "herz", "feuer", "wasser", "wind", "erde"],
    "polish": ["róża", "słowik", "świeca", "motyl", "serce", "dusza", "ogień", "woda", "wiatr", "ziemia", "łza", "gwiazda"],
}

PERSIAN_VOWELS = {"ا", "و", "ی"}
POLISH_VOWELS = set("aąeęioóuyAĄEĘIOÓUY")


def _count_syllables(word: str, language: str) -> int:
    try:
        if language == "persian":
            return sum(1 for ch in word if ch in PERSIAN_VOWELS) or 1
        if language == "polish":
            return sum(1 for ch in word if ch in POLISH_VOWELS) or 1
        if syllables:
            return syllables.estimate(word)
        return max(1, len(word) // 3)
    except Exception:
        return max(1, len(word) // 3)


def _lines_rhyme(line1: str, line2: str, language: str) -> bool:
    words1, words2 = line1.strip().split(), line2.strip().split()
    if not words1 or not words2:
        return False
    last1, last2 = words1[-1].lower(), words2[-1].lower()
    if last1 == last2:
        return True
    patterns = RHYME_PATTERNS.get(language, {})
    for pattern in patterns.values():
        if pattern.match(last1) and pattern.match(last2):
            return True
    return False


def _detect_metaphors(text: str, language: str) -> List[str]:
    lexicon = METAPHORS.get(language, [])
    lowered = text.lower()
    return [m for m in lexicon if m in lowered or m in text]


def analyze(text: str, language: str) -> Dict:
    """Return rhyme scheme, average syllables/line, metaphors, and a rough poetic score."""
    lines = [l for l in text.strip().split("\n") if l.strip()]
    words = text.split()

    rhyme_pairs = 0
    for i in range(len(lines)):
        for j in range(i + 1, min(i + 3, len(lines))):
            if _lines_rhyme(lines[i], lines[j], language):
                rhyme_pairs += 1

    syllable_counts = [_count_syllables(w, language) for w in words] or [0]
    avg_syllables = sum(syllable_counts) / len(syllable_counts)

    metaphors_found = _detect_metaphors(text, language)

    rhyme_density = rhyme_pairs / max(1, len(lines))
    metaphor_density = len(metaphors_found) / max(1, len(words)) * 10
    poetic_score = min(1.0, 0.5 * min(1.0, rhyme_density) + 0.5 * min(1.0, metaphor_density))

    return {
        "language": language,
        "line_count": len(lines),
        "rhyming_pairs": rhyme_pairs,
        "avg_syllables_per_word": round(avg_syllables, 2),
        "metaphors_found": metaphors_found,
        "poetic_score": round(poetic_score, 3),
    }
