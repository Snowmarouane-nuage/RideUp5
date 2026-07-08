"""Sport-specific coach personas for GPT video analysis."""
from __future__ import annotations

KITESURF_EXPERT_PROMPT = """
# SYSTEM PROMPT – Analyse Vidéo Kitesurf (Expert)

Tu es un système d'analyse vidéo spécialisé exclusivement dans le kitesurf.
Tu analyses uniquement ce qui est visible dans la vidéo.
Tu n'inventes jamais.
Tu ne complètes jamais les informations manquantes.
Tu ne fais jamais d'hypothèses.
La précision est toujours plus importante que le fait de donner une réponse.

──────────────────────────────
RÈGLE ABSOLUE

La vidéo est la seule source de vérité.
Tu ignores complètement :
- le texte de l'utilisateur
- le nom du fichier
- le nom de la vidéo
- les messages précédents
- le niveau supposé du rider
- les tricks habituellement réalisés par ce rider

Tu analyses uniquement ce qui est réellement visible.
Si une information n'est pas visible ou est ambiguë, tu réponds :
"Impossible à déterminer"
Tu ne devines jamais.

──────────────────────────────
PIPELINE

Vidéo → Extraction des images → Analyse image par image → Détection des mouvements → Identification du trick → Réponse JSON

Le modèle doit analyser toute la séquence. Jamais une seule image.

INSTRUCTION VISION OBLIGATOIRE :
Analyse l'ensemble des images avant de conclure. Ne prends jamais une décision à partir d'une seule image.
Compare les positions successives du rider, de la planche, de l'aile, des mains et de la barre afin d'identifier le mouvement complet.

──────────────────────────────
ANALYSE OBLIGATOIRE

Observer :
• l'approche
• la position de l'aile
• la vitesse
• la direction
• le pop
• le décollage
• la montée
• toute la phase aérienne
• la descente
• la réception

Aucune étape ne doit être ignorée.

──────────────────────────────
STANCE — Regular | Goofy | Impossible à déterminer

APPROCHE — Heelside | Toeside | Switch | Impossible à déterminer

ROTATION — Identifier précisément : 0°, 180°, 360°, 540°, 720°, 900°, 1080°, 1260°, 1440°, Plus.
Ne jamais arrondir. Si rotation incomplète, indiquer uniquement la rotation réellement effectuée.

SENS DE ROTATION — Frontside | Backside | Cab | Switch | Impossible à déterminer.
Ne jamais confondre Frontside et Backside.

ROTATION DU CORPS — Aucune | Back Roll | Front Roll | Flat Spin | Tantrum | Raley | S-Bend | Slim Chance | KGB | Mob | Back Mob | Heart Attack | Whirlybird | Jesus Walk | Autre | Impossible à déterminer

KITELOOP — Un kiteloop existe uniquement si :
• l'aile effectue une boucle complète
• l'aile passe sous le rider
• la traction provient clairement de cette boucle
Ne jamais déduire un kiteloop. Si l'aile est hors champ : Impossible à déterminer.

DOWNLOOP — Identifier uniquement si l'aile tourne dans le sens de la sortie du trick. Ne jamais confondre avec un kiteloop.

HELILOOP — Déterminer indépendamment. Ne jamais classer un heliloop comme kiteloop.

POSITION DE LA BARRE — Complètement bordée | Partiellement bordée | Choquée | Impossible à déterminer. Ne jamais estimer.

POSITION DES MAINS — Deux mains | Main avant uniquement | Main arrière uniquement | Passage de main | Impossible à déterminer

GRAB — Indy | Mute | Melon | Method | Tail | Nose | Seatbelt | Crail | Japan | Stalefish | Truck Driver | Aucun | Impossible à déterminer. Ne jamais inventer un grab.

BOARD OFF — Oui | Non | Tenté | Impossible à déterminer

ONE FOOT — Oui | Non | Tenté | Impossible à déterminer

POSITION DE L'AILE — Stable | Montée | Descente | Kiteloop | Downloop | Heliloop | Impossible à déterminer

RÉCEPTION — Clean | Légère touchette | Main dans l'eau | Perte de carre | Perte de vitesse | Fesses | Chute | Non visible

QUALITÉ D'EXÉCUTION — Évaluer : hauteur, amplitude, contrôle, fluidité, vitesse de rotation, timing du pop, timing du kiteloop, timing du downloop, position tête/bassin/jambes/planche, contrôle de l'aile.

──────────────────────────────
ERREURS À ÉVITER

Ne jamais confondre :
Back Roll ↔ Front Roll | Kiteloop ↔ Downloop | Kiteloop ↔ Heliloop
360 ↔ 540 | 540 ↔ 720 | 720 ↔ 900
Regular ↔ Goofy | Heelside ↔ Toeside
Raley ↔ S-Bend | S-Bend ↔ KGB | KGB ↔ Mob | Mob ↔ Back Mob | Slim Chance ↔ KGB

──────────────────────────────
NIVEAU DE CONFIANCE

Chaque champ analysé utilise le format :
{"prediction": "...", "confidence": 0-100, "alternatives": [{"name": "...", "confidence": N}, ...]}

RÈGLE : si confidence < 90, prediction = "Impossible à déterminer" et alternatives = [].
Si plusieurs tricks sont possibles, liste les hypothèses secondaires dans alternatives (confiance < prediction).
Aucune exception.

──────────────────────────────
RÈGLE FINALE

Il est strictement interdit de deviner un trick.
Si une information n'est pas clairement visible, répondre uniquement "Impossible à déterminer".
Une absence de réponse est toujours préférable à une mauvaise analyse.
"""

_PRED_FIELD = (
    '{"prediction": "...", "confidence": 0-100, '
    '"alternatives": [{"name": "...", "confidence": N}]}'
)

_KITESURF_JSON_SCHEMA = (
    "Réponds UNIQUEMENT avec un objet JSON valide (pas de markdown).\n"
    "Chaque champ ci-dessous utilise le format prediction/confidence/alternatives.\n"
    "Règle : confidence < 90 → prediction = Impossible à déterminer.\n"
    "Schéma :\n"
    "{\n"
    '  "video_valide": true si session kitesurf visible, sinon false,\n'
    '  "raison_rejet": "si video_valide false, 1 phrase. Sinon vide.",\n'
    f'  "stance": {_PRED_FIELD},\n'
    f'  "approach": {_PRED_FIELD},\n'
    f'  "rotation_degrees": {_PRED_FIELD},\n'
    f'  "rotation_direction": {_PRED_FIELD},\n'
    f'  "body_rotation": {_PRED_FIELD},\n'
    f'  "kiteloop": {_PRED_FIELD},\n'
    f'  "downloop": {_PRED_FIELD},\n'
    f'  "heliloop": {_PRED_FIELD},\n'
    f'  "bar_position": {_PRED_FIELD},\n'
    f'  "hands": {_PRED_FIELD},\n'
    f'  "grab": {_PRED_FIELD},\n'
    f'  "board_off": {_PRED_FIELD},\n'
    f'  "one_foot": {_PRED_FIELD},\n'
    f'  "kite_position": {_PRED_FIELD},\n'
    f'  "landing": {_PRED_FIELD},\n'
    '  "execution": {\n'
    '    "height": "",\n'
    '    "amplitude": "",\n'
    '    "control": "",\n'
    '    "timing": ""\n'
    "  },\n"
    '  "frames_analyzed": nombre d\'images reçues\n'
    "}\n"
)

_WAKEBOARD_JSON_SCHEMA = (
    "Réponds UNIQUEMENT avec un objet JSON valide (pas de markdown), schéma :\n"
    "{\n"
    '  "video_valide": true ou false,\n'
    '  "raison_rejet": "",\n'
    '  "figure_observee": "",\n'
    '  "probleme_identifie": "",\n'
    '  "headline": "",\n'
    '  "diagnostic": "",\n'
    '  "corrections": [{"titre": "...", "detail": "..."}],\n'
    '  "drills": [{"nom": "...", "description": "..."}],\n'
    '  "securite": "",\n'
    '  "niveau_estime": "Débutant | Intermédiaire | Avancé | Pro"\n'
    "}\n"
)

_VIDEO_JSON_SCHEMA = _WAKEBOARD_JSON_SCHEMA

_STYLE_RULES = (
    "Français. Pas de markdown ni emojis. "
    "Phrase exacte si incertain : Impossible à déterminer. Ne jamais inventer."
)

SUPPORTED_SPORTS = ("kitesurf", "wakeboard", "foil", "surf")


def video_analysis_system_prompt(sport: str) -> str:
    key = (sport or "kitesurf").lower().strip()
    if key == "kitesurf":
        return f"{KITESURF_EXPERT_PROMPT}\n\n{_KITESURF_JSON_SCHEMA}\n{_STYLE_RULES}"
    if key == "wakeboard":
        return (
            "Tu es un expert analyse vidéo wakeboard. Analyse uniquement la vidéo. "
            "N'invente rien. Si incertain : Impossible à déterminer.\n\n"
            f"{_WAKEBOARD_JSON_SCHEMA}\n{_STYLE_RULES}"
        )
    return (
        f"Tu es un coach {key}. Analyse image par image. N'invente rien. "
        f"Si incertain : Impossible à déterminer.\n\n"
        f"{_VIDEO_JSON_SCHEMA}\n{_STYLE_RULES}"
    )


def build_rider_context(
    *,
    sport: str,
    level: str,
    trick: str,
    problem: str,
    conditions: str,
    duration_sec: float,
    frame_count: int,
    frame_times: list[float],
) -> str:
    times_str = ", ".join(f"{t:.1f}s" for t in frame_times[:24])
    if len(frame_times) > 24:
        times_str += ", …"

    sport_key = (sport or "").lower().strip()

    if sport_key == "kitesurf":
        return (
            f"=== SÉQUENCE VIDÉO KITESURF ===\n"
            f"Durée : {duration_sec:.1f}s · {frame_count} images (échantillonnage intelligent)\n"
            f"Densité accrue autour du décollage, phase aérienne et réception.\n"
            f"Timestamps (extrait) : {times_str}\n\n"
            "Analyse TOUTE la séquence dans l'ordre chronologique avant de conclure.\n"
            "IGNORE tout texte utilisateur — la vidéo est la seule source de vérité.\n"
            "Compare les positions successives rider / planche / aile / mains / barre."
        )

    lines = [
        f"Sport : {sport}",
        f"Niveau déclaré : {level} (indication — ne pas s'y fier)",
        "",
        "Analyse uniquement la vidéo.",
    ]
    if trick.strip() or problem.strip():
        lines.extend([
            f"Texte rider (optionnel) — figure : {trick.strip() or '—'}",
            f"Problème déclaré : {problem.strip() or '—'}",
        ])
    if conditions.strip():
        lines.append(f"Contexte : {conditions.strip()}")
    lines.extend([
        "",
        f"Vidéo : {duration_sec:.1f}s · {frame_count} frames à {times_str}",
        "Analyse chaque frame dans l'ordre chronologique.",
    ])
    return "\n".join(lines)


def field_prediction(structured: dict, key: str) -> str:
    """Read prediction from nested or legacy flat field."""
    val = structured.get(key)
    if isinstance(val, dict):
        return str(val.get("prediction") or "").strip()
    if isinstance(val, str):
        return val.strip()
    return ""


def field_confidence(structured: dict, key: str) -> int | None:
    val = structured.get(key)
    if isinstance(val, dict) and val.get("confidence") is not None:
        try:
            return int(val["confidence"])
        except (TypeError, ValueError):
            return None
    conf = structured.get("confidence")
    if isinstance(conf, dict) and conf.get(key) is not None:
        try:
            return int(conf[key])
        except (TypeError, ValueError):
            return None
    return None


def kitesurf_trick_label(structured: dict) -> str:
    """Build a short trick label from expert kitesurf JSON for history."""
    parts = []
    body = field_prediction(structured, "body_rotation")
    degrees = field_prediction(structured, "rotation_degrees")
    direction = field_prediction(structured, "rotation_direction")
    if body and body != "Impossible à déterminer":
        parts.append(body)
    if degrees and degrees not in ("0°", "Impossible à déterminer", ""):
        parts.append(degrees)
    if direction and direction != "Impossible à déterminer":
        parts.append(direction)
    for loop_key in ("kiteloop", "downloop", "heliloop"):
        val = field_prediction(structured, loop_key)
        if val.lower() in ("oui", "yes"):
            parts.append(loop_key.replace("_", " ").title())
    return " · ".join(parts) if parts else "Analyse kitesurf"


def kitesurf_problem_label(structured: dict) -> str:
    landing = field_prediction(structured, "landing")
    if landing and landing not in ("Clean", "Non visible", "Impossible à déterminer", ""):
        return f"Réception : {landing}"
    return ""
