import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from recommender import recommend

app = FastAPI(
    title="Recomeço — API de Recomendação",
    description="Recomenda conteúdos educativos por similaridade textual. Não realiza avaliação clínica.",
    version="1.0.0"
)

origins_env = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [origin.strip() for origin in origins_env.split(",") if origin.strip()]
if not allowed_origins:
    allowed_origins = ["http://localhost:5500", "http://127.0.0.1:5500", "https://*.netlify.app"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://[a-zA-Z0-9-]+\.netlify\.app",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

class RecommendationRequest(BaseModel):
    query: str = Field(min_length=2, max_length=500)
    limit: int = Field(default=3, ge=1, le=8)

@app.get("/health")
def health():
    return {"status": "ok", "service": "recomeco-recommender"}

@app.post("/recommend")
def get_recommendations(payload: RecommendationRequest):
    try:
        results = recommend(payload.query, payload.limit)
        return {"query": payload.query, "recommendations": results, "method": "tfidf-cosine"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Não foi possível gerar recomendações.") from exc
