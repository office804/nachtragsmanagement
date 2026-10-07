# Nachtragsmanagement

Schlanke Web-App zur Steuerung von Nachträgen nach VOB/B (AG z. B. DB InfraGO AG). Keine Installation, kein Server, keine Zugangsdaten.

## Starten

`index.html` im Browser öffnen. Die Daten liegen nur im `localStorage` dieses Browsers.

## Grundsätze

- **Die Excel-Nachtragsliste bleibt die einzige Quelle der Wahrheit.** Die App liest und schreibt deren Spaltenformat (Eingabespalten A–BC) als CSV. Formelspalten BD–BM und das Blatt „Übersicht“ rechnet die App mit derselben Logik nach.
- Reihenfolge in jeder Ansicht: Fristen, dann Anerkennung des Vergütungsanspruchs, dann Nachtragsumfang.
- Strategievermerk und Vorab-Bewertung sind intern: im Formular standardmäßig ausgeblendet und in der „Aufstellung für den AG“ nie enthalten (durch Test abgesichert).
- Die App bewertet nichts rechtlich. Ergänzungsbedarf und Eskalationshinweise sind Vorschläge; Freigabe, Versand und Eskalation entscheiden Menschen.

## Ansichten

| Ansicht | Inhalt |
|---|---|
| Übersicht | Fristen, Anerkennung, Nachtragsumfang in % der Auftragssumme, Volumen nach Status, Vorab-Zahlungen, Handlungsbedarf (wie Blatt „Übersicht“) |
| Fristen | Offene Nachträge nach Fristenampel (ROT, PRÜFEN, KRITISCH, BALD), Nachfassen fällig |
| Nachtragsliste | Alle Nachträge, Formular mit allen Spalten, Kennzahlen und Ergänzungsbedarf je Nachtrag |
| Übergabe GL | Textentwurf für die monatliche Übergabe an die Geschäftsleitung (kopieren oder als Textdatei speichern) |
| Projekt & Daten | Vorhaben, Auftragssumme, Warnschwelle; CSV/JSON-Import und -Export |

## Excel-Rundlauf

1. Nachtragsliste in Excel öffnen, Blatt „Nachtragsliste“ als „CSV UTF-8“ speichern.
2. In der App unter „Projekt & Daten“ importieren (Zuordnung über die Spaltenüberschrift).
3. Nach der Bearbeitung „Nachtragsliste CSV (intern, vollständig)“ exportieren und in die Excel-Liste übernehmen.

## Tests

```
node --test tests/*.test.js
```
