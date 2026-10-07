'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const NM = require('../model.js');

const T = '2026-10-07';
const row = (o) => Object.assign(NM.emptyRow(), o);

test('Felder entsprechen den Eingabespalten A–BC der Vorlage', () => {
  assert.equal(NM.FIELDS.length, 55);
  assert.equal(NM.FIELDS[0].col, 'A');
  assert.equal(NM.FIELDS.at(-1).col, 'BC');
  assert.equal(NM.FIELD.strategie.label, 'Strategievermerk (INTERN)');
});

test('Fristenampel wie Spalte BF', () => {
  const c = (o) => NM.compute(row(o), T).ampel;
  assert.equal(c({ ausfuehrungsbeginn: '2026-10-01' }), 'ROT: Ausführung ohne Ankündigung');
  assert.equal(c({ ausfuehrungsbeginn: '2026-10-20', angekuendigtAm: '2026-10-20' }), 'PRÜFEN: Ankündigung nicht vor Ausführungsbeginn');
  assert.equal(c({ ausfuehrungsbeginn: '2026-10-09' }), 'KRITISCH: höchstens 3 Tage');
  assert.equal(c({ ausfuehrungsbeginn: '2026-10-14' }), 'BALD: höchstens 7 Tage');
  assert.equal(c({ ausfuehrungsbeginn: '2026-11-30' }), 'OK');
  // Vertragliche Frist früher als Ausführungsbeginn: frühere zählt, überschritten
  assert.equal(c({ ausfuehrungsbeginn: '2026-11-30', fristVertrag: '2026-10-01' }), 'ROT: Frist überschritten');
  assert.equal(c({ ausfuehrungsbeginn: '2026-11-30', angekuendigtAm: '2026-09-01' }), '');
});

test('Forderungswert, Anerkennung, erbracht wie BG–BM', () => {
  const c1 = NM.compute(row({ vorabBewertung: 100000, leistungsstand: 50 }), T);
  assert.equal(c1.forderungswert, 100000);
  assert.equal(c1.nurVorab, true);
  assert.equal(c1.erbracht, 50000);
  assert.equal(c1.anerkennungPruefung, 'Nicht anerkannt');
  assert.equal(c1.erbrachtOhneBeleg, 50000);

  const c2 = NM.compute(row({ vorabBewertung: 100000, betragAngeboten: 120000, leistungsstand: 50,
    anerkennung: 'Grund und Höhe schriftlich anerkannt', anerkannterBetrag: 40000 }), T);
  assert.equal(c2.forderungswert, 120000);
  assert.equal(c2.anerkennungPruefung, 'PRÜFEN: Beleg, Datum oder Unterzeichner fehlt');
  assert.equal(c2.nichtBelegtRest, 120000);

  const c3 = NM.compute(row({ betragAngeboten: 120000, leistungsstand: 50, anerkennung: 'Grund und Höhe schriftlich anerkannt',
    anerkannterBetrag: 40000, anerkanntAm: '2026-09-01', anerkanntDurch: 'X, Projektleitung AG', anerkennungBeleg: 'Nachtragsvereinbarung' }), T);
  assert.equal(c3.anerkennungPruefung, 'Belegt');
  assert.equal(c3.nichtBelegtRest, 80000);
  assert.equal(c3.erbrachtOhneBeleg, 20000);

  assert.equal(NM.compute(row({ anerkennung: 'Nur mündlich zugesagt' }), T).anerkennungPruefung, 'Nicht schriftlich: keine Anerkennung');
});

test('Vorab-Zahlung: Fälligkeit 21 Tage oder vertragliche Frist', () => {
  assert.equal(NM.compute(row({ vorabBeantragtAm: '2026-09-20' }), T).vorabFaelligAm, '2026-10-11');
  assert.equal(NM.compute(row({ vorabBeantragtAm: '2026-09-20', zahlungsfristTage: 30 }), T).vorabFaelligAm, '2026-10-20');
  assert.equal(NM.compute(row({ unstrittig: 10000, vorabBezahlt: 4000 }), T).unstrittigOffen, 6000);
});

test('Übersicht: Beispielzeile zählt nicht, Prozentwerte nur mit Auftragssumme', () => {
  const rows = [
    row({ nr: 'BEISPIEL', vorabBewertung: 999999, status: 'Idee' }),
    row({ nr: 'N1', vorabBewertung: 100000, status: 'Angekündigt', leistungsstand: 20 }),
    row({ nr: 'N2', betragAngeboten: 200000, vorabBewertung: 150000, status: 'Eingereicht' }),
    row({ nr: 'N3', betragAngeboten: 50000, status: 'Abgelehnt' }),
  ];
  const o = NM.overview(rows, {}, T);
  assert.equal(o.anzahl, 3);
  assert.equal(o.total.forderungswert, 350000);
  assert.equal(o.total.nurVorab, 100000);
  assert.equal(o.umfang.volumen, 300000);
  assert.equal(o.umfang.volumenPct, null);
  assert.equal(o.umfang.erbracht, 20000);

  const o2 = NM.overview(rows, { auftragssumme: 2000000, warnschwelle: 15 }, T);
  assert.equal(o2.umfang.volumenPct, 0.15);
  assert.equal(o2.umfang.schwellenpruefung, 'SCHWELLE ERREICHT ODER ÜBERSCHRITTEN');
  assert.equal(o2.top5[0].r.nr, 'N2');
});

test('Fristenübersicht sortiert Rot vor Kritisch vor OK', () => {
  const rows = [
    row({ nr: 'OK', ausfuehrungsbeginn: '2026-12-01' }),
    row({ nr: 'K', ausfuehrungsbeginn: '2026-10-09' }),
    row({ nr: 'R', ausfuehrungsbeginn: '2026-10-01' }),
  ];
  assert.deepEqual(NM.fristen(rows, T).map((x) => x.r.nr), ['R', 'K', 'OK']);
});

test('Externe Aufstellung enthält nie Strategievermerk oder Vorab-Bewertung', () => {
  for (const k of NM.INTERNAL_KEYS) assert.ok(!NM.EXTERNAL_KEYS.includes(k), k);
  const r = row({ nr: 'N1', strategie: 'GEHEIM-STRATEGIE', vorabBewertung: 4711, herleitung: 'GEHEIM-HERLEITUNG' });
  const csv = NM.toCSV([NM.externalRow(r)], NM.EXTERNAL_KEYS);
  assert.ok(!csv.includes('GEHEIM'));
  assert.ok(!csv.includes('4711'));
  assert.ok(!csv.includes('Strategievermerk'));
});

test('CSV-Rundlauf im Format der Vorlage', () => {
  const r = row({ nr: 'N7', kurzbeschreibung: 'Text; mit "Anführung"\nund Zeilenumbruch', ausfuehrungsbeginn: '2026-12-07',
    vorabBewertung: 48500.5, leistungsstand: 35, status: 'Eingereicht' });
  const back = NM.fromCSV(NM.toCSV([r])).rows[0];
  assert.equal(back.nr, 'N7');
  assert.equal(back.kurzbeschreibung, r.kurzbeschreibung);
  assert.equal(back.ausfuehrungsbeginn, '2026-12-07');
  assert.equal(back.vorabBewertung, 48500.5);
  assert.equal(back.leistungsstand, 35);
  assert.equal(back.status, 'Eingereicht');
});

test('Ergänzungsbedarf und Eskalationshinweis', () => {
  const l = NM.luecken(row({ nr: 'N1', status: 'Angekündigt', ausfuehrungsbeginn: '2026-10-01' }), T);
  assert.ok(l.some((x) => x.startsWith('Anordnung belegen')));
  assert.ok(l.some((x) => x.startsWith('Euro-Bewertung fehlt')));
  assert.ok(l.some((x) => x.includes('gemeinsamen Aufmaß')));
  assert.ok(l.some((x) => x.startsWith('Strittig')));
  const c = NM.compute(row({ aufmassReaktion: 'AG verweigert' }), T);
  assert.ok(c.eskalation.some((x) => x.includes('AG verweigert')));
});
