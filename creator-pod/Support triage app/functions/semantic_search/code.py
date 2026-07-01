#input_type_name: SemanticSearchInput
#output_type_name: SemanticSearchResult
#function_name: semantic_search

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod
import json

class SemanticSearchInput(BaseModel):
    query_embedding: list[float]
    limit: int = 10
    threshold: float = 0.5

class SearchHit(BaseModel):
    id: str
    title: str
    content: str
    tags: list[str] | None = None
    source_type: str | None = None
    similarity: float

class SemanticSearchResult(BaseModel):
    hits: list[SearchHit]

def semantic_search(ctx: FunctionContext, data: SemanticSearchInput) -> SemanticSearchResult:
    pod = Pod.from_env()
    
    items = (pod.records.list("ideas", limit=1000)).to_dict().get("items", [])
    
    import numpy as np
    query_vec = np.array(data.query_embedding)
    q_norm = np.linalg.norm(query_vec)
    if q_norm > 0:
        query_vec = query_vec / q_norm
    
    scored = []
    for item in items:
        emb = item.get("embedding")
        if not emb:
            continue
        
        if isinstance(emb, str):
            try:
                emb = json.loads(emb)
            except (json.JSONDecodeError, TypeError):
                continue
        
        if not emb or not isinstance(emb, list):
            continue
        
        vec = np.array(emb)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
            sim = float(np.dot(query_vec, vec))
            if sim >= data.threshold:
                scored.append((sim, item))
    
    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:data.limit]
    
    hits = []
    for sim, item in top:
        tags_raw = item.get("tags")
        tags = None
        if isinstance(tags_raw, str):
            try:
                tags = json.loads(tags_raw)
            except (json.JSONDecodeError, TypeError):
                tags = [tags_raw]
        elif isinstance(tags_raw, list):
            tags = tags_raw
        
        hits.append(SearchHit(
            id=str(item["id"]),
            title=item.get("title", ""),
            content=item.get("content", ""),
            tags=tags,
            source_type=item.get("source_type"),
            similarity=round(sim, 4)
        ))
    
    return SemanticSearchResult(hits=hits)
