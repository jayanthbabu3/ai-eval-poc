"""IT knowledge assistant: grounded generation over retrieved chunks."""

from __future__ import annotations

from eval_poc.assistants.registry import AssistantVersion
from eval_poc.knowledge.retriever import Retriever
from eval_poc.llm.groq_client import GroqClient
from eval_poc.models import Generation, RetrievedChunk


def build_context(chunks: list[RetrievedChunk]) -> str:
    if not chunks:
        return "NO MATCHING KNOWLEDGE BASE ARTICLES FOUND."
    return "\n\n".join(
        f"[{chunk.document_id}] {chunk.title}\n{chunk.content}" for chunk in chunks
    )


def build_user_prompt(question: str, chunks: list[RetrievedChunk]) -> str:
    return f"CONTEXT:\n{build_context(chunks)}\n\nUSER QUESTION:\n{question}"


class KnowledgeAssistant:
    """Phases 1 + 2: retrieve, then generate a grounded answer.

    Behaviour is entirely determined by the `AssistantVersion` handed in, which is
    what makes a V1-vs-V2 comparison a genuine A/B rather than a cosmetic label.
    """

    def __init__(
        self, retriever: Retriever, client: GroqClient, version: AssistantVersion
    ) -> None:
        self._retriever = retriever
        self._client = client
        self._version = version

    @property
    def version(self) -> AssistantVersion:
        return self._version

    def retrieve(self, question: str, min_score: float) -> list[RetrievedChunk]:
        chunks = self._retriever.search(question, self._version.top_k)
        return [chunk for chunk in chunks if chunk.score >= min_score]

    def answer(self, question: str, chunks: list[RetrievedChunk]) -> Generation:
        version = self._version
        result = self._client.complete(
            system=version.system_prompt,
            user=build_user_prompt(question, chunks),
            model=version.model,
            temperature=version.temperature,
            max_tokens=version.max_tokens,
        )
        return Generation(
            answer=result.text,
            model="offline-stub" if result.stubbed else version.model,
            latency_ms=result.latency_ms,
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            stubbed=result.stubbed,
            error=result.error,
        )

    def run(
        self, question: str, min_score: float = 0.0
    ) -> tuple[list[RetrievedChunk], Generation]:
        chunks = self.retrieve(question, min_score)
        return chunks, self.answer(question, chunks)
