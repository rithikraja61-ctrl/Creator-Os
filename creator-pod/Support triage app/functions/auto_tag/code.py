#input_type_name: AutoTagInput
#output_type_name: AutoTagResult
#function_name: auto_tag

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod
import json

class AutoTagInput(BaseModel):
    idea_id: str
    title: str
    content: str
    source_type: str = "manual"

class AutoTagResult(BaseModel):
    tags: list[str]
    ai_tags: dict

def auto_tag(ctx: FunctionContext, data: AutoTagInput) -> AutoTagResult:
    pod = Pod.from_env()
    
    text = f"{data.title} {data.content}".lower()
    tags = []
    
    topics = {
        "design": ["ui", "ux", "design", "interface", "figma", "sketch", "prototype", "wireframe", "visual"],
        "development": ["code", "api", "sdk", "backend", "frontend", "python", "javascript", "react", "database", "algorithm"],
        "product": ["product", "roadmap", "feature", "user story", "sprint", "backlog", "mvp", "pm"],
        "marketing": ["marketing", "seo", "content", "social", "campaign", "growth", "conversion", "analytics", "brand"],
        "business": ["startup", "revenue", "fundraising", "investor", "pitch", "business model", "saas", "b2b"],
        "writing": ["writing", "blog", "newsletter", "copy", "storytelling", "editing", "draft", "publish"],
        "ai": ["ai", "machine learning", "llm", "gpt", "neural", "deep learning", "nlp", "embedding", "vector"],
        "research": ["research", "study", "paper", "analysis", "survey", "data", "insight", "findings", "trend"],
        "personal": ["productivity", "workflow", "habit", "routine", "focus", "time", "organization", "goal"],
        "creative": ["creative", "idea", "inspiration", "concept", "vision", "brainstorm", "innovation"]
    }
    
    for topic, keywords in topics.items():
        for kw in keywords:
            if kw in text:
                tags.append(topic)
                break
    
    if not tags:
        source_map = {"bookmark": "reference", "screenshot": "visual", "tweet": "social", "pdf": "document", "url": "reference", "chat": "conversation"}
        inferred = source_map.get(data.source_type, "general")
        tags = [inferred]
    
    tags = list(set(tags))
    
    pod.records.update("ideas", data.idea_id, {
        "tags": json.dumps(tags),
        "ai_tags": json.dumps({"inferred_topics": tags, "source_type": data.source_type})
    })
    
    return AutoTagResult(tags=tags, ai_tags={"inferred_topics": tags, "source_type": data.source_type})
