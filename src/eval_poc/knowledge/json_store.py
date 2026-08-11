"""Local JSON knowledge base with TF-IDF keyword retrieval (stdlib only)."""

from __future__ import annotations

import json
import math
import re
from collections import Counter
from pathlib import Path

from eval_poc.config import DATA_DIR
from eval_poc.models import Document, RetrievedChunk

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_STOPWORDS = frozenset(
    """a an the and or of to in for on is are was were be been do does did how what
    when where which who why my me i you your it its this that with from can cannot
    should must if not no yes at as by""".split()
)


def tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN_RE.findall(text.lower()) if t not in _STOPWORDS]


def load_documents(path: Path | None = None) -> list[Document]:
    """Load and validate the knowledge base. Fails fast on malformed data."""
    source = path or DATA_DIR / "knowledge_base.json"
    try:
        raw = json.loads(source.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise RuntimeError(f"Knowledge base missing at {source}") from error
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Knowledge base at {source} is not valid JSON: {error}") from error

    documents = [Document.model_validate(item) for item in raw.get("documents", [])]
    if not documents:
        raise RuntimeError(f"Knowledge base at {source} contains no documents")
    return documents


class JsonKeywordRetriever:
    """TF-IDF cosine ranking over a local JSON corpus.

    Deliberately dependency-free: swap this class for a ServiceNow or vector-DB
    client that satisfies the same `Retriever` protocol and nothing else changes.
    """

    def __init__(self, documents: list[Document]) -> None:
        self._documents = tuple(documents)
        self._doc_terms = tuple(self._terms_of(doc) for doc in self._documents)
        self._idf = self._build_idf(self._doc_terms)
        self._doc_vectors = tuple(self._vector(terms) for terms in self._doc_terms)

    @property
    def documents(self) -> tuple[Document, ...]:
        return self._documents

    @staticmethod
    def _terms_of(document: Document) -> Counter[str]:
        # Title and tags carry more signal than body text, so weight them up.
        text = " ".join(
            [document.title] * 3 + [" ".join(document.tags)] * 3 + [document.content]
        )
        return Counter(tokenize(text))

    @staticmethod
    def _build_idf(doc_terms: tuple[Counter[str], ...]) -> dict[str, float]:
        total = len(doc_terms)
        doc_freq: Counter[str] = Counter()
        for terms in doc_terms:
            doc_freq.update(terms.keys())
        return {
            term: math.log((total + 1) / (freq + 1)) + 1.0
            for term, freq in doc_freq.items()
        }

    def _vector(self, terms: Counter[str]) -> dict[str, float]:
        total = sum(terms.values()) or 1
        raw = {
            term: (count / total) * self._idf.get(term, 0.0)
            for term, count in terms.items()
        }
        norm = math.sqrt(sum(value * value for value in raw.values())) or 1.0
        return {term: value / norm for term, value in raw.items()}

    def search(self, query: str, top_k: int) -> list[RetrievedChunk]:
        query_vector = self._vector(Counter(tokenize(query)))
        if not query_vector:
            return []

        scored = [
            (self._cosine(query_vector, doc_vector), document)
            for doc_vector, document in zip(self._doc_vectors, self._documents)
        ]
        scored.sort(key=lambda pair: pair[0], reverse=True)

        return [
            RetrievedChunk(
                document_id=document.id,
                title=document.title,
                content=document.content,
                score=round(score, 4),
            )
            for score, document in scored[:top_k]
            if score > 0
        ]

    @staticmethod
    def _cosine(left: dict[str, float], right: dict[str, float]) -> float:
        smaller, larger = (left, right) if len(left) < len(right) else (right, left)
        return sum(value * larger.get(term, 0.0) for term, value in smaller.items())


def build_default_retriever() -> JsonKeywordRetriever:
    return JsonKeywordRetriever(load_documents())
