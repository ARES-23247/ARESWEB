# BUZZELLO board sizes

Classic has 61 cells (radius 4); Large has 91 (radius 5). Both retain the
alternating six-piece opening, open center, Yellow first move, six-direction
flanking, and existing pass/game-over rules. The physical versions use the same
1.3-inch pieces. Users choose the size before choosing a mode. Classic remains
the default, including requests from older clients that omit boardSize.

POST /api/buzzello/games, /matchmaking, and /matchmaking/team accept an optional
boardSize of exactly 61 or 91. Other values are rejected. Invite joining always
adopts the stored match's size. Classic and Large use separate matchmaking slots.
Stored board length selects the server rules and action/history limits; no
existing Classic state or move indices are migrated. API transport limits allow
indices 0–90 and versions 1–86, with stricter board-specific validation afterward.
The AI worker and fallback both select their rules from the actual board length.

Release the server before the frontend so Large creation is supported when the
selector becomes visible. Existing Classic matches remain readable. Older
clients that receive a Large invitation must reload the site to use that edition.
No production data migration or rule-permission change is required.
