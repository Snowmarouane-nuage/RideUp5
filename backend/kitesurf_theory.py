"""Repères techniques kitesurf pour l'analyse vidéo (théorie réelle, pas générique)."""

KITESURF_ANALYSIS_FRAMEWORK = """
CADRE TECHNIQUE KITESURF (à appliquer sur chaque frame, dans l'ordre chronologique) :

1) PHASE DE LA MANŒUVRE
   - Approche (vitesse, edge, kite bas/haut ?)
   - Charge / pop (flexion jambes, appui rail, timing kite monte)
   - Décollage (extension, départ de rotation)
   - Apex / air time (position kite, barre, regard)
   - Rotation éventuelle (axe épaules-hanches, spotting)
   - Réception (kite bas ou redescente, absorption jambes, board flat)

2) RIDER (corps)
   - Stance : regular/goofy si visible, poids avant/arrière, hanches ouvertes/fermées
   - Edge : talon ou toe-side, rail engagé ou plat
   - Barre : bras tendus ou tuck, barre près du corps ou sheet out
   - Regard : vers kite, vers board ou vers spot d'atterrissage
   - Erreurs classiques : kite trop haut au pop, pas assez d'edge, rotation des bras seuls, atterrissage raide

3) KITE / VOILE (pilotage)
   - Position dans la fenêtre : 9h-10h-11h-12h-1h-2h-3h (approximatif selon angle caméra)
   - Mouvement : envoi (steering up), zenith, redescente, loop, stall
   - Tension des lignes : slack vs power
   - Timing kite-rider : le kite doit souvent passer zenith AVANT ou PENDANT le pop selon la figure

4) BOARD
   - Angle au décollage, board off, grab, atterrissage nose/tail first

5) THÉORIE PAR FAMILLE DE FIGURES
   - Jump / pop : edge fort → kite monte → extension → kite redescend pour réception
   - Backroll / front roll : pop + rotation épaules + spotting 180° avant de compléter
   - Raley / kiteloop : commitment, kite loop timing, réception downwind
   - Transition / jibe : kite passe autre côté, changement de pieds, body position
   - Wave / surf : ligne sur la vague, bottom turn, kite bas

RÈGLE D'OR : ne devine pas une figure si les images ne la montrent pas clairement.
Compare TOUJOURS ce que le rider DIT avoir tenté avec ce que tu VOIS réellement.
"""

KITE_TRAJECTORY_ANALYSIS = """
ANALYSE OBLIGATOIRE DU MOUVEMENT DE LA VOILE (frame par frame, ordre chronologique) :

Tu DOIS suivre la trajectoire de l'aile sur TOUTES les frames visibles. La voile est souvent aussi importante que le rider.

1) LIRE LA TRAJECTOIRE
   - Position dans la fenêtre : 9h → 10h → 11h → 12h (zenith) → 1h → 2h → 3h (approximatif selon angle caméra)
   - Sens de rotation de l'aile si loop : horaire ou anti-horaire vu du rider
   - Vitesse du steering : envoi progressif, pull agressif, stall, relance

2) IDENTIFIER LE TYPE DE MANŒUVRE KITE (si visible)
   - KITELOOP (loop classique / back loop kite) : l'aile monte (souvent zenith), puis fait une boucle COMPLÈTE au-dessus du rider
     (passe derrière / au-dessus), regénère de la puissance en bas de loop. Souvent lié à backroll, raley, kiteloop jump.
   - DOWNLOOP : l'aile part haut (zenith ou 11h-1h), puis descend en arc vers le BAS / avant du rider (côté downwind),
     traverse la fenêtre vers l'autre côté SANS remonter en loop complet au-dessus. Transition, landing downloop, downloop turn.
   - CONTRALOOP (front loop kite / loop avant) : loop dans le sens OPPOSÉ au loop habituel du rider, souvent initié
     depuis une position haute, trajectoire avant-downwind puis remontée. À ne pas confondre avec un simple send + redescente.
   - SEND + REDESCENTE (pas un loop) : montée vers zenith puis redescente contrôlée sans boucle complète.
   - AUCUN LOOP : pilotage classique (figure 8, stationnaire, jump sans loop).

3) TIMING RIDER ↔ VOILE (critique pour loops)
   - Pop / décollage : le kite est-il encore en montée, au zenith, ou déjà en descente ?
   - Pendant l'air : où est l'aile pendant la rotation du rider ? (slack = loop trop tard ou sheet out)
   - Réception : l'aile est-elle basse (réception douce), en train de boucler (risque de chute violente), ou déjà relancée ?

4) ERREURS VOILE FRÉQUENTES (à signaler si visibles)
   - Loop trop tard → slack lignes, chute sur le dos, kite tombe derrière
   - Loop incomplet → manque de commitment steering, réception sans puissance
   - Downloop trop tôt / trop serré → perte de tension, rider tombe avant
   - Confusion kiteloop vs downloop : vérifie si l'aile repasse AU-DESSUS du rider (kiteloop) ou descend seulement en arc (downloop)
   - Sheet in/out mal calé pendant le loop

5) DANS LE JSON
   - Remplis analyse_voile.type_manoeuvre : kiteloop | downloop | contraloop | send_redescente | aucun_loop | indetermine
   - Décris la trajectoire chronologiquement dans analyse_voile.trajectoire
   - Si tu vois un loop, nomme-le explicitement dans figure_observee (ex: « kiteloop backroll », « downloop transition »)

RÈGLE : si les frames montrent clairement un loop, tu DOIS l'identifier et l'analyser — ne le réduis pas à « kite haut » ou « pilotage ».
"""
