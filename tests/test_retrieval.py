"""Phase 1 tests: the local JSON knowledge base and keyword retriever."""

from __future__ import annotations

import pytest

from eval_poc.knowledge.json_store import JsonKeywordRetriever, load_documents, tokenize
from eval_poc.knowledge.retriever import Retriever
from eval_poc.models import Document


@pytest.fixture(scope="module")
def retriever() -> JsonKeywordRetriever:
    return JsonKeywordRetriever(load_documents())


def test_knowledge_base_loads_and_validates() -> None:
    documents = load_documents()
    assert len(documents) >= 10
    assert all(isinstance(doc, Document) for doc in documents)
    assert len({doc.id for doc in documents}) == len(documents), "document ids must be unique"


def test_retriever_satisfies_protocol(retriever: JsonKeywordRetriever) -> None:
    assert isinstance(retriever, Retriever)


def test_tokenize_drops_stopwords_and_casing() -> None:
    assert tokenize("How do I reset THE password?") == ["reset", "password"]


@pytest.mark.parametrize(
    ("query", "expected_id"),
    [
        ("How do I get VPN access?", "KB-001"),
        ("password expiry rules", "KB-002"),
        ("is my laptop disk encrypted", "KB-004"),
        ("mailbox quota full", "KB-006"),
        ("severity 1 incident resolution target", "KB-009"),
        ("I received a phishing email", "KB-011"),
    ],
)
def test_top_hit_is_the_right_article(
    retriever: JsonKeywordRetriever, query: str, expected_id: str
) -> None:
    hits = retriever.search(query, top_k=3)
    assert hits, f"no hits for {query!r}"
    assert hits[0].document_id == expected_id


def test_results_are_ranked_and_capped(retriever: JsonKeywordRetriever) -> None:
    hits = retriever.search("vpn access approval", top_k=2)
    assert len(hits) <= 2
    assert hits == sorted(hits, key=lambda chunk: chunk.score, reverse=True)


def test_unrelated_query_scores_low(retriever: JsonKeywordRetriever) -> None:
    hits = retriever.search("annual leave booking policy", top_k=3)
    assert all(hit.score < 0.2 for hit in hits), "out-of-scope query must not match strongly"


def test_empty_query_returns_nothing(retriever: JsonKeywordRetriever) -> None:
    assert retriever.search("the and of", top_k=3) == []
