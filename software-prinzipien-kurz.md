# Software-Prinzipien

> Der Mensch definiert den Vertrag. Die Maschine füllt die Implementierung.

## Kernregeln

- Types vor Code. Definiere alle Datenmodelle und Signaturen, bevor du eine Zeile Logik schreibst.
- Don't Complect. Halte Dinge getrennt: Domain, Repository, Service, API — eine Datei, eine Wahrheit.
- Illegal States unmöglich machen. Keine Validierung verstreut — Value Objects an der Grenze.
- Parse at Boundary. Validierung einmal, an der Systemgrenze. Nie tiefer. Vertraue danach den Typen.
- Immutability als Default. Frozen Dataclasses, `frozenset`, `dataclasses.replace()` — keine versteckte Mutation.
- Sonderfälle eliminieren, nicht verwalten. Bessere Datenstruktur schlägt mehr If-Statements.
- Make it Work → Right → Fast. Sequenziell. Nie gleichzeitig. Premature Optimization ist der Feind.

## Entwicklungsreihenfolge

1. Alle Domain-Typen definieren (Cherny)
2. Repository-Protocol/Interface — kein konkreter State
3. Einfachste Implementierung die funktioniert (Beck)
4. Saubere Trennung, Error-Handling, Parse at Boundary (Hickey/King)
5. Performance — erst messen, dann optimieren (Beck)

## Was automatisch folgt

Wenn diese Prinzipien eingehalten werden, entstehen Secure Coding, Clean Code und DRY ohne expliziten Aufwand.
