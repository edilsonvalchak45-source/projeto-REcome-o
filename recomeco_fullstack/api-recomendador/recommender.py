from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

CONTENT = [
    {
        "id": "familia",
        "title": "Orientação para familiares",
        "category": "Família",
        "description": "Informações sobre conversa respeitosa, limites e apoio a quem cuida.",
        "text": "família familiares conversa acolhimento limites apoio emocional grupos codependência"
    },
    {
        "id": "servicos",
        "title": "Como encontrar serviços de saúde",
        "category": "Serviços",
        "description": "Entenda como localizar UBS, CAPS e CAPS AD nos canais oficiais.",
        "text": "CAPS CAPS AD SUS unidade básica saúde atendimento rede pública tratamento serviços"
    },
    {
        "id": "autocuidado",
        "title": "Pequenos passos de autocuidado",
        "category": "Bem-estar",
        "description": "Ideias simples para incluir pausas, apoio e descanso na rotina.",
        "text": "autocuidado rotina descanso respiração rede confiança bem-estar saúde emocional"
    },
    {
        "id": "informacao",
        "title": "Informação sobre dependência e cuidado",
        "category": "Informação",
        "description": "Conteúdo educativo sobre cuidado, prevenção e busca de orientação.",
        "text": "informação educativa prevenção dependência substâncias cuidado saúde orientação"
    },
    {
        "id": "grupos",
        "title": "Grupos de apoio e mútua ajuda",
        "category": "Rede de apoio",
        "description": "Conheça a proposta dos grupos e confirme reuniões diretamente com as organizações.",
        "text": "grupos apoio reuniões familiares comunidade acolhimento mútua ajuda encontros"
    },
    {
        "id": "acolhimento",
        "title": "Como iniciar uma conversa acolhedora",
        "category": "Acolhimento",
        "description": "Sugestões gerais para conversar sem julgamento e respeitar limites.",
        "text": "acolhimento conversa escuta respeito julgamento apoio pessoa família"
    }
]

_vectorizer = TfidfVectorizer(strip_accents="unicode", lowercase=True, ngram_range=(1, 2))
_matrix = _vectorizer.fit_transform([item["text"] for item in CONTENT])

def recommend(query: str, limit: int = 3):
    query_vector = _vectorizer.transform([query])
    scores = cosine_similarity(query_vector, _matrix).ravel()
    ranked = sorted(enumerate(scores), key=lambda pair: pair[1], reverse=True)
    results = []
    for index, score in ranked[:limit]:
        item = CONTENT[index]
        results.append({
            "id": item["id"],
            "title": item["title"],
            "category": item["category"],
            "description": item["description"],
            "score": round(float(score), 4)
        })
    return results
