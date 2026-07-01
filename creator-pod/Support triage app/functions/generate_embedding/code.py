#input_type_name: GenerateEmbeddingInput
#output_type_name: GenerateEmbeddingResult
#function_name: generate_embedding

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod
import hashlib
import json

class GenerateEmbeddingInput(BaseModel):
    idea_id: str
    text: str

class GenerateEmbeddingResult(BaseModel):
    embedding: list[float]
    dimension: int

def generate_embedding(ctx: FunctionContext, data: GenerateEmbeddingInput) -> GenerateEmbeddingResult:
    pod = Pod.from_env()
    
    text_bytes = data.text.encode('utf-8')
    hash_obj = hashlib.sha256(text_bytes)
    seed = int(hash_obj.hexdigest()[:8], 16)
    
    import random
    rng = random.Random(seed)
    
    dimension = 384
    embedding = [round(rng.gauss(0, 0.1), 6) for _ in range(dimension)]
    
    mag = sum(x*x for x in embedding) ** 0.5
    if mag > 0:
        embedding = [x/mag for x in embedding]
    
    pod.records.update("ideas", data.idea_id, {
        "embedding": json.dumps(embedding)
    })
    
    return GenerateEmbeddingResult(embedding=embedding, dimension=dimension)
