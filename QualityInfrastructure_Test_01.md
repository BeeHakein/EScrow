# Quality Infrastructure Blueprint — Claude Code

**Version:** Test 01  
**Datum:** April 2026  
**Basis:** Technical Research Report "Agentisches Software-Engineering mit Claude Code" + Diskurs-Erweiterungen

---

## Zweck

Dieses Dokument dient als **Bootstrap-Input für Session 1** eines neuen Projekts. Claude Code liest es einmalig und generiert daraus die komplette Qualitätsinfrastruktur: CLAUDE.md, Skills, Hooks, Git-Strategie und Workflow-Patterns. Nach der Bootstrap-Session wird dieses Dokument nicht mehr benötigt — das Wissen lebt dann in der Projektinfrastruktur.

---

## Teil 1: Kernprinzipien (aus dem Research Report)

### Drei Axiome

1. **Kontextökonomie als primäre Optimierungsvariable:** Jede Design-Entscheidung dient dem Ziel, dem Agenten maximal frischen, relevanten Kontext bei minimalem Token-Overhead zu liefern. Skills statt MCP für statisches Wissen, `/clear` statt Auto-Compaction, fokussierte CLAUDE.md statt umfassendes Manual.

2. **Determinismus als Überlegenheitsprinzip:** Was garantiert passieren muss (Formatting, Tests, Security-Checks, Commit-Blockierung), gehört in Hooks mit Exit-2-Semantik — nicht in probabilistische LLM-Instruktionen.

3. **Fresh-Context-Präferenz:** Claude entdeckt State effektiver aus dem Dateisystem als aus kompaktierter Konversationshistorie. Der Zyklus `Commit → /clear → neuer Task` ist robuster als akkumulierende Long-Running-Sessions.

### CLAUDE.md — Design-Regeln

- Maximal **30 Zeilen**, imperativ formuliert
- Unter **150 Instruktionen** bleiben (Claudes System-Prompt beansprucht bereits ~50)
- Drei Kategorien: WAS (Tech-Stack, Struktur), WARUM (Zweck, Konventionen), WIE (Build, Test, Verifikation)
- Keine Code-Style-Guidelines (Aufgabe des Linters)
- Keine @-File-Imports (Token-Overhead)
- Negation immer mit Alternative: "Never X, prefer Y"
- Lebendiges Dokument: Nach jeder Korrektur aktualisieren lassen

### Kontext-Management

- `/compact` manuell bei **50%** Kontextfüllung
- `/clear` bei **70%** Kontextfüllung
- Ab **85%** steigen Halluzinationsraten signifikant
- State immer ins Dateisystem externalisieren, nie in der Session akkumulieren

### Modellstrategie

- **Sonnet 4.6** als Default (Daily Driver, ~$3/$15 per MTok)
- **Opus 4.6** nur für Architektur, Multi-File-Refactors, Security-Reviews (~$15/$75 per MTok)
- **Haiku 4.5** für Subagent-Tasks, Quick-Fixes, Formatting (~$0.80/$4 per MTok)
- **opusplan** (Hybrid) für komplexe Features: Plant mit Opus, Executed mit Sonnet (~40% günstiger)

---

## Teil 2: Erweiterte Quality-Patterns (über den Report hinaus)

### Pattern A — Meta-Learning über Sessions hinweg

**Problem:** Claude lernt nichts von Session zu Session. Fresh-Context löst Degradation, wirft aber Gelerntes weg.

**Lösung:** Automatisierter Feedback-Loop via Hooks.

**Implementierung:**
- **Stop-Hook / SessionEnd-Hook:** Spawnt Haiku-Subagent am Session-Ende
- Subagent scannt Conversation nach: Korrekturen, Fehlversuche, wiederholte Patterns
- Ergebnis wird in `/.claude/lessons-learned.md` geschrieben (strukturiert, datiert, kategorisiert)
- **SessionStart-Hook:** Liest relevante Einträge aus `lessons-learned.md` und injiziert sie als stdout-Kontext
- Effekt: Das System baut sich ein kumulatives Gedächtnis auf, ohne Kontext zu belasten

**Erwartete Wirkung:** Wiederkehrende Fehler werden eliminiert. Über 10+ Sessions entsteht ein projektspezifisches Regelwerk, das kein Mensch hätte manuell schreiben müssen.

---

### Pattern B — Context-Aware Skill Routing

**Problem:** Skill-Aktivierung basiert auf Description-Matching (quasi Keyword-Suche). Kein intelligentes Routing.

**Lösung:** Vorgelagerter Intent-Classifier als Orchestrator.

**Implementierung:**
- **UserPromptSubmit-Hook** (Prompt-Hook-Handler via Haiku)
- Klassifiziert eingehenden Prompt nach: Task-Typ, Komplexität, betroffene Bereiche
- Injiziert je nach Klassifikation:
  - Passenden Skill-Aufruf
  - Modellwechsel (z.B. automatisch Opus bei erkanntem Architektur-Task)
  - Plan-Mode-Zwang bei komplexen Tasks
  - Relevante Lessons-Learned-Einträge

**Kosten:** Haiku-Call pro Prompt, ~0.1-0.2 Cent. Vernachlässigbar.

**Erwartete Wirkung:** Claude arbeitet von Turn 1 mit der optimalen Konfiguration, ohne dass der Entwickler manuell Skills laden, Modelle wechseln oder Plan Mode aktivieren muss.

---

### Pattern C — Git-basierte Co-Change-Analyse

**Problem:** Implizite Abhängigkeiten zwischen Dateien sind nirgends dokumentiert. Claude ändert Datei A, vergisst aber Datei B.

**Lösung:** Skill mit Shell-Script, der Git-History analysiert.

**Implementierung:**
- Skill mit eingebettetem Script: `git log --name-only --pretty=format:'' | sort | uniq -c | sort -rn`
- Identifiziert Dateien, die in >70% der Fälle zusammen geändert werden
- Generiert daraus Regeln: "Wenn du X änderst, prüfe immer auch Y und Z"
- Regeln werden als eigenständige Datei (z.B. `/.claude/co-change-rules.md`) persistiert
- Kann periodisch oder bei Projektstart aktualisiert werden

**Erwartete Wirkung:** Reduziert inkonsistente Teiländerungen signifikant, besonders bei gewachsenen Codebases.

---

### Pattern D — Adversarial TDD (Test-Driven Agent Workflow)

**Problem:** Wenn derselbe kognitive Prozess Tests und Implementierung schreibt, sind die Tests biased — sie testen was der Code tut, nicht was er tun sollte.

**Lösung:** Drei separate Subagents mit adversarialer Struktur.

**Implementierung:**
- **Spec-Agent** (read-only): Liest Feature-Beschreibung / Issue, schreibt Tests mit Edge Cases und Acceptance Criteria. Hat keinen Zugriff auf bestehende Implementierung.
- **Codegen-Agent** (edit-fähig): Implementiert gegen die Tests. Beschränkt auf `src/` und `tests/`. Darf keine Tests ändern.
- **Review-Agent** (read-only): Prüft Konsistenz zwischen Tests, Implementierung und bestehender Architektur. Kann Veto einlegen.

**Orchestrierung:** Via Task-Tool, bis zu 10 parallele Subagents möglich. Definierbar als Skill oder Custom Slash Command.

**Erwartete Wirkung:** Fängt die 1,75× erhöhte Logikfehlerrate ab, die der Research Report für KI-generierten Code identifiziert. Tests werden zu echten Qualitäts-Gates statt zu Alibi-Coverage.

---

### Pattern E — Semantischer Background-Review

**Problem:** Hooks prüfen heute syntaktische Sachen (Tests laufen, Format stimmt). Logische und architekturelle Inkonsistenzen werden nicht erkannt.

**Lösung:** Kontinuierlicher, automatischer Code-Review als Background-Prozess.

**Implementierung:**
- **PostToolUse-Hook** auf `Write` und `Edit`
- Spawnt Haiku-Prompt-Hook nach jeder Dateiänderung
- Prompt: "Ist diese Änderung konsistent mit der Architektur in CLAUDE.md? Bricht sie bestehende Patterns? Gibt es offensichtliche Logikfehler?"
- Exit 0: Okay, weiter
- Exit 2: Widerspruch erkannt, Änderung blockiert mit Begründung

**Kosten:** ~0.2 Cent pro Check. Bei 50 Writes pro Session: ~10 Cent.

**Erwartete Wirkung:** Fängt architekturelle Drift in Echtzeit ab, bevor sie sich über mehrere Dateien akkumuliert.

---

## Teil 3: Hook-Katalog (Priorität)

### Prio 1 — Obligatorisch

| Hook | Event | Funktion | Exit-Code |
|------|-------|----------|-----------|
| Security-Firewall | PreToolUse (Bash) | Blockiert `rm -rf /`, `git push --force main`, `sudo rm`, `chmod 777` | Exit 2 |
| Test-Gate vor Commit | PreToolUse (git commit) | Prüft ob Tests bestanden, blockiert sonst | Exit 2 |
| Auto-Format | PostToolUse (Write/Edit) | Prettier/gofmt nach jeder Änderung | Exit 0 |

### Prio 2 — Empfohlen

| Hook | Event | Funktion | Exit-Code |
|------|-------|----------|-----------|
| Permission-Auto-Grant | PermissionRequest | Sichere Befehle auto-genehmigen (`npm test`, `prettier`, `git status`) | Exit 0 |
| Context-Re-Injection | SessionStart | Injiziert kritische Regeln nach Compaction | Exit 0 |
| Lessons-Learned Capture | Stop / SessionEnd | Extrahiert Korrekturen und Fehler in `lessons-learned.md` | Exit 0 |

### Prio 3 — Advanced

| Hook | Event | Funktion | Exit-Code |
|------|-------|----------|-----------|
| Intent-Classifier | UserPromptSubmit | Klassifiziert Prompt, routet Skills/Modelle | Exit 0 |
| Semantischer Review | PostToolUse (Write/Edit) | Haiku-basierter Architektur-Check | Exit 0/2 |
| Stop-Verifikation | Stop | Prüft ob alle Tasks erledigt und Tests gelaufen | Exit 0/2 |

---

## Teil 4: Skill-Struktur

### Empfohlene Skills

| Skill | Trigger | Inhalt | Token-Overhead |
|-------|---------|--------|----------------|
| `hook-patterns` | "Hook", "Automation", "Quality Gate" | Hook-Templates, Exit-Code-Referenz, Anti-Patterns | ~30 Tokens (Metadata) |
| `subagent-orchestration` | "Parallel", "Subagent", "Delegation" | Master-Clone vs. Lead-Specialist, 3-Agent-Pattern | ~30 Tokens (Metadata) |
| `git-workflow` | "Branch", "Worktree", "Commit", "PR" | Worktree-Setup, Commit-Conventions, CI/CD-Integration | ~30 Tokens (Metadata) |
| `co-change-rules` | Automatisch bei Edit/Write | Projektspezifische Abhängigkeitsregeln aus Git-Analyse | ~30 Tokens (Metadata) |
| `tdd-workflow` | "Test", "TDD", "Feature implementieren" | Adversarial-TDD-Pattern, Spec-Agent-Prompts | ~30 Tokens (Metadata) |

---

## Teil 5: Anti-Pattern Quick Reference

| # | Anti-Pattern | Stattdessen |
|---|-------------|-------------|
| 1 | Kontextfenster bis zum Limit füllen | `/compact` bei 50%, `/clear` bei 70% |
| 2 | Auto-Compaction vertrauen | `/clear` + State im Dateisystem |
| 3 | Mega-Task-Prompts | Tasks auf 5–10-Minuten-Schritte aufbrechen |
| 4 | Zu viele MCP-Server | Max 2–3, nur bei Live-Datenbedarf |
| 5 | Korrektur-Loop statt Neustart | Nach 2 Fehlversuchen: `/clear` + besserer Prompt |
| 6 | Opus für alle Tasks | Sonnet als Default, Opus nur für Architektur |
| 7 | Code ohne Verifikation shippen | Tests obligatorisch — KI-Code ist kein Endprodukt |
| 8 | Legacy-Projekt ohne Onboarding | 3-Schritt: Analyse → Konventionen → Änderungen |

---

## Teil 6: Bootstrap-Anweisung

### Prompt für Session 1:

```
Lies dieses Dokument vollständig. Basierend auf den beschriebenen Prinzipien, Patterns und Strukturen:

1. Erstelle eine CLAUDE.md (max. 30 Zeilen, imperativ, fokussiert)
2. Erstelle die Skill-Dateien unter .claude/skills/
3. Erstelle die Hook-Konfigurationen (Prio 1 zuerst, dann Prio 2)
4. Richte die Git-Strategie ein (Branching, Worktrees, Commit-Conventions)
5. Erstelle eine initiale lessons-learned.md Struktur
6. Erstelle die co-change-rules.md Struktur (wird nach erster Git-Analyse befüllt)

Danach beschreibe ich dir das eigentliche Projekt.
```

---

## Erwartete Ergebnisse nach Bootstrap

- **Korrektur-Runden pro Task:** 1–3 (statt 5–8 ohne Infrastruktur)
- **Token-Reduktion:** ~40–50% gegenüber unoptimiertem Workflow
- **Logikfehler:** Signifikant reduziert durch Adversarial TDD + semantischen Background-Review
- **Lerneffekt über Sessions:** Kumulativ durch Meta-Learning-Hook
- **Entwickler-Overhead:** Minimal — Hooks und Skills arbeiten automatisch im Hintergrund
