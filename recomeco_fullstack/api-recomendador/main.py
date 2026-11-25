from dotenv import load_dotenv
import os
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from recommender import recommend

load_dotenv()

app = FastAPI(
    title="Recomeço - API de Recomendação e Chat",
    description="Recomenda conteúdos educativos e oferece suporte via chat. Não realiza avaliação clínica.",
    version="1.1.0",
)

# Libera o acesso de qualquer origem (Live Server, Netlify Dev, produção)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializa o cliente do Gemini usando a variável GEMINI_API_KEY do arquivo .env
gemini_api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=gemini_api_key) if gemini_api_key else None


class RecommendationRequest(BaseModel):
    query: str = Field(min_length=2, max_length=500)
    limit: int = Field(default=3, ge=1, le=8)


class ChatRequest(BaseModel):
    message: Optional[str] = Field(default=None, max_length=2000)
    prompt: Optional[str] = Field(default=None, max_length=2000)

    def get_user_text(self) -> str:
        text = (self.message or self.prompt or "").strip()
        if not text:
            raise ValueError("A mensagem não pode estar vazia.")
        return text


def format_recommendations_context(recommendations: list) -> str:
    if not recommendations:
        return "Nenhuma orientação específica cadastrada encontrada para este termo."

    lines = []
    for rec in recommendations:
        if isinstance(rec, dict):
            title = rec.get("title") or rec.get("titulo") or "Orientação"
            desc = rec.get("description") or rec.get("descricao") or rec.get("content") or ""
            lines.append(f"- {title}: {desc}".strip())
        else:
            lines.append(f"- {str(rec)}")
    return "\n".join(lines)


def generate_gemini_reply(user_message: str, system_instruction: str) -> str:
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=0.7,
        max_output_tokens=650,
    )

    # Tenta o modelo solicitado e faz fallback automático caso o 1.5 esteja descontinuado (404)
    models_to_try = ["gemini-2.5-flash", "gemini-2.5-flash"]
    last_error = None

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=user_message,
                config=config,
            )
            if response and response.text:
                return response.text.strip()
        except Exception as exc:
            last_error = exc
            if "404" in str(exc) or "not found" in str(exc).lower():
                continue
            raise exc

    if last_error:
        raise last_error

    return (
        "Estou aqui para ouvir e apoiar você. Buscar ajuda é um passo muito importante — "
        "considere conversar com alguém de confiança ou procurar uma UBS ou CAPS AD da sua região."
    )


@app.get("/")
def root():
    return {
        "service": "recomeco-api",
        "status": "online",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "recomeco-api",
        "gemini_configured": bool(client),
    }


@app.post("/recommend")
def get_recommendations(payload: RecommendationRequest):
    try:
        results = recommend(payload.query, payload.limit)
        return {
            "query": payload.query,
            "recommendations": results,
            "method": "tfidf-cosine",
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail="Não foi possível gerar recomendações."
        ) from exc


@app.post("/chat")
def chat_endpoint(payload: ChatRequest):
    if not client:
        raise HTTPException(
            status_code=500,
            detail="Chave GEMINI_API_KEY não configurada no arquivo .env.",
        )

    try:
        user_message = payload.get_user_text()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # 1. Busca orientações na base local de recomendação (sem travar o chat se falhar)
    try:
        recommendations = recommend(user_message, limit=3)
    except Exception:
        recommendations = []

    context_str = format_recommendations_context(recommendations)

    # 2. Monta a instrução de conversa acolhedora + base educativa
    system_instruction = (
        "Você é o Assistente Recomeço, um apoiador acolhedor, empático e humano da plataforma Recomeço, "
        "voltada ao apoio na recuperação de dependência química e orientação familiar.\n"
        "Diretrizes de conversa:\n"
        "- Inicie acolhendo o sentimento ou a iniciativa da pessoa com respeito e sem julgamentos.\n"
        "- Dê passos práticos e encorajadores (como conversar com familiares de confiança, buscar apoio profissional, "
        "grupos de mútua ajuda e serviços gratuitos do SUS como UBS e CAPS AD).\n"
        "- Incorpore naturalmente as orientações da base da plataforma listadas abaixo, sem apenas colar uma lista fria.\n"
        "- Termine com uma pergunta aberta e gentil para continuar a conversa e entender melhor como ajudar.\n"
        "- Nunca faça diagnósticos médicos ou prescrições de medicamentos.\n\n"
        f"Orientações da base Recomeço relacionadas ao assunto:\n{context_str}"
    )

    try:
        reply_text = generate_gemini_reply(user_message, system_instruction)
        return {
            "reply": reply_text,
            "response": reply_text,
            "recommendations": recommendations,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao comunicar com o Gemini: {str(exc)}",
        ) from exc