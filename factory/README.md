# The Bridle software factory

A work item is a **card**: one markdown file in `factory/cards/`. Cards move along one **line** of
stations, left to right. Each station is worked by a Claude Code **subagent** that reads the card, does
its one job, writes its section of the card, and reports progress to the Bridle Build Monitor.
The `/factory` skill is the foreman: it moves one card one station at a time and spawns the station's agent.

```
 backlog ──▶ spec ──▶ plan ──▶ build ──▶ test ──▶ review ──▶ ship
 (planned)  you +    factory-  factory-  factory-  factory-   commit
            Claude   planner   builder   tester    reviewer
```

- The line, its workers, and each station's exit criteria: `factory/line.md`.
- A card's frontmatter holds its state (`station`, `status`, `history`); its body holds one section per station.
- Moving a card (`tools/monitor/card.py move <id> <station>`) rewrites the frontmatter and emits a `card.move`
  event, so the monitor's **Factory** view shows the board, each card's station track, and the planned order.

## Watch it

Open the monitor (`.bridle/monitor.json` has the link) and pick **Factory**:
the board shows every card at its station; the *Planned progression* strip shows the order cards will run in
(dependencies first; "next up" is the first unblocked card); select a card to see when it reached each station.
The "Working now" strip at the top of every view shows the station agent on the card, its step, its progress, how
long it has been quiet, and its last tool calls; the times tick every second. The artifact lags the files by one
mirror pass (a few seconds plus one Claude turn); for a sub-second view run `python3 tools/monitor/serve.py` and
open `http://127.0.0.1:8787/`.

## Use it

```
/factory status            board summary and next up
/factory new P1-07 "Short title" --phase P1 --order 7 --deps P1-02
/factory run P1-07         spec → plan → build → test → review → ship, one station at a time
/factory next              run the next-up card
```

A review FAIL or a failing test sends the card back to **build** once, with the findings as the note.
Nothing ships without: tests passing, review PASS, all card sections filled, and a commit named after the card.
