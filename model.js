/*
 * Nachtragsmanagement – Fachlogik ohne Oberfläche.
 * Felder und Berechnungen entsprechen der Excel-Vorlage "Nachtragsliste"
 * (Eingabespalten A–BC, Formelspalten BD–BM, Blatt "Übersicht").
 * Läuft im Browser (window.NM) und in Node (require) für Tests.
 */
(function (root) {
  'use strict';

  const STATUS = ['Idee', 'Angekündigt', 'Angebot in Arbeit', 'Eingereicht', 'In Verhandlung', 'Beauftragt', 'Abgelehnt', 'Streitig'];
  const GRUNDLAGE = ['§ 2 Abs. 5 VOB/B (Änderung/Anordnung)', '§ 2 Abs. 6 VOB/B (zusätzliche Leistung)', '§ 6 VOB/B (Behinderung)', 'Sonstige (siehe Kurzbeschreibung)'];
  const BEWERTUNGSBASIS = ['Grobschätzung', 'Erfahrungswert', 'Kalkulation (Urkalkulation)', 'Nachunternehmerangebot', 'Angebot erstellt'];
  const LEISTUNGSBASIS = ['Schätzung Bauleitung', 'Einseitiges Aufmaß', 'Gemeinsames Aufmaß anerkannt', 'Leistungsmeldung / Abschlagsrechnung'];
  const AUFMASS_REAKTION = ['Nicht angefordert', 'Aufforderung versandt', 'Termin vereinbart', 'Termin wahrgenommen', 'AG nicht erschienen', 'AG verweigert', 'Keine Reaktion'];
  const AUFMASS_STAND = ['Nicht erstellt', 'Erstellt (nicht vorgelegt)', 'Vorgelegt', 'Teilweise anerkannt', 'Anerkannt'];
  const ZULASSUNG = ['Nicht geprüft', 'Alle nachgewiesen', 'Teilweise nachgewiesen', 'Nicht nachgewiesen', 'Zulassung im Einzelfall erforderlich', 'Zulassung im Einzelfall beantragt', 'Zulassung im Einzelfall erteilt', 'Nicht erforderlich'];
  const ANERKENNUNG = ['Nicht anerkannt', 'Anerkennung angefragt', 'Nur mündlich zugesagt', 'Dem Grunde nach schriftlich anerkannt', 'Grund und Höhe schriftlich anerkannt', 'Teilweise anerkannt', 'Unter Vorbehalt anerkannt', 'Abgelehnt'];
  const JA_NEIN = ['Ja', 'Nein'];

  // Gruppen für das Bearbeitungsformular, in der Reihenfolge Fristen → Anerkennung → Umfang.
  const GROUPS = [
    ['stamm', 'Stammdaten'],
    ['fristen', 'Fristen'],
    ['anerkennung', 'Anerkennung des Vergütungsanspruchs'],
    ['umfang', 'Leistungsstand und Umfang'],
    ['bewertung', 'Bewertung in Euro'],
    ['aufmass', 'Gemeinsames Aufmaß'],
    ['baustoffe', 'Baustoffe und Zulassungen'],
    ['vorab', 'Unstrittige Vorab-Zahlung'],
    ['verfolgen', 'Verfolgen und Ergänzen'],
    ['intern', 'Intern (nie an den AG)'],
    ['protokoll', 'Freigabe, Übergabe, Änderung'],
  ];

  // key, Spalte, Überschrift laut Vorlage, Typ, Gruppe, Optionen, intern
  const FIELDS = [
    ['nr', 'A', 'Nr.', 'text', 'stamm'],
    ['vorhaben', 'B', 'Vorhaben', 'text', 'stamm'],
    ['kurzbeschreibung', 'C', 'Kurzbeschreibung', 'textarea', 'stamm'],
    ['grundlage', 'D', 'Grundlage', 'select', 'stamm', GRUNDLAGE],
    ['anordnung', 'E', 'Anordnung (wer / wann / wie, Beleg)', 'textarea', 'stamm'],
    ['ausfuehrungsbeginn', 'F', 'Ausführungsbeginn', 'date', 'fristen'],
    ['leistungsstand', 'G', 'Leistungsstand Nachtragsleistung (% erbracht)', 'percent', 'umfang'],
    ['leistungsstandVom', 'H', 'Leistungsstand vom', 'date', 'umfang'],
    ['leistungsstandBasis', 'I', 'Basis des Leistungsstands', 'select', 'umfang', LEISTUNGSBASIS],
    ['fristVertrag', 'J', 'Vertragliche Frist Ankündigung (falls abweichend)', 'date', 'fristen'],
    ['angekuendigtAm', 'K', 'Angekündigt am', 'date', 'fristen'],
    ['angebotGeplant', 'L', 'Angebot geplant für', 'date', 'fristen'],
    ['eingereichtAm', 'M', 'Eingereicht am', 'date', 'fristen'],
    ['vorabBewertung', 'N', 'Vorab-Bewertung (€ netto)', 'money', 'bewertung', null, true],
    ['bewertungsbasis', 'O', 'Bewertungsbasis', 'select', 'bewertung', BEWERTUNGSBASIS, true],
    ['herleitung', 'P', 'Herleitung / Annahmen der Bewertung', 'textarea', 'bewertung', null, true],
    ['bewertungVom', 'Q', 'Bewertung vom', 'date', 'bewertung', null, true],
    ['betragAngeboten', 'R', 'Betrag angeboten (€ netto)', 'money', 'bewertung'],
    ['betragBeauftragt', 'S', 'Betrag beauftragt (€ netto)', 'money', 'bewertung'],
    ['aufmassAufforderungAm', 'T', 'Schriftliche Aufforderung zum gemeinsamen Aufmaß am', 'date', 'aufmass'],
    ['aufmassTermin', 'U', 'Aufmaßtermin (vorgeschlagen / stattgefunden)', 'date', 'aufmass'],
    ['aufmassReaktion', 'V', 'Gemeinsames Aufmaß / Leistungsfeststellung: Reaktion AG', 'select', 'aufmass', AUFMASS_REAKTION],
    ['aufmassReaktionBeleg', 'W', 'Beleg Aufforderung und Reaktion (Schreiben, Zugang, Zeugen, Protokoll)', 'textarea', 'aufmass'],
    ['aufmassStand', 'X', 'Aufmaß-Stand (Anerkennung durch AG-Bauüberwachung)', 'select', 'aufmass', AUFMASS_STAND],
    ['aufmassAnerkanntAm', 'Y', 'Aufmaß anerkannt am', 'date', 'aufmass'],
    ['aufmassBeleg', 'Z', 'Aufmaß-Beleg (anerkannt durch wen, Dokument)', 'textarea', 'aufmass'],
    ['baustoffe', 'AA', 'Verwendete Baustoffe / Produkte (Bezeichnung, Hersteller, Charge)', 'textarea', 'baustoffe'],
    ['regelwerk', 'AB', 'Maßgebliche DBS / TL / weitere Vorgaben (laut Vertrag)', 'textarea', 'baustoffe'],
    ['zulassungsstand', 'AC', 'Zulassungsstand Baustoffe (DB / EBA)', 'select', 'baustoffe', ZULASSUNG],
    ['nachweise', 'AD', 'Nachweise (HPQ, EBA-Zulassung, DB-Freigabe, Prüfzeugnis, Lieferschein)', 'textarea', 'baustoffe'],
    ['zieAntragAm', 'AE', 'Antrag Zulassung im Einzelfall am', 'date', 'baustoffe'],
    ['unstrittig', 'AF', 'Unstrittiger Betrag (€ netto)', 'money', 'vorab'],
    ['unstrittigBegruendung', 'AG', 'Begründung unstrittiger Betrag', 'textarea', 'vorab'],
    ['vorabBeantragtAm', 'AH', 'Vorab-Zahlung beantragt am', 'date', 'vorab'],
    ['zahlungsfristTage', 'AI', 'Zahlungsfrist in Tagen (falls abweichend von 21)', 'number', 'vorab'],
    ['vorabBezahlt', 'AJ', 'Vorab-Zahlung bezahlt (€ netto)', 'money', 'vorab'],
    ['vorabBezahltAm', 'AK', 'Vorab-Zahlung bezahlt am', 'date', 'vorab'],
    ['status', 'AL', 'Status', 'select', 'stamm', STATUS],
    ['anerkennung', 'AM', 'Anerkennung Vergütungsanspruch durch AG (schriftlich)', 'select', 'anerkennung', ANERKENNUNG],
    ['anerkanntAm', 'AN', 'Anerkannt am', 'date', 'anerkennung'],
    ['anerkanntDurch', 'AO', 'Anerkannt durch (Name, Funktion, Vertretungsbefugnis)', 'text', 'anerkennung'],
    ['anerkennungBeleg', 'AP', 'Beleg der Anerkennung (Dokument, Datum, Unterschrift)', 'text', 'anerkennung'],
    ['anerkannterBetrag', 'AQ', 'Anerkannter Betrag (€ netto)', 'money', 'anerkennung'],
    ['anerkennungVorbehalte', 'AR', 'Umfang / Vorbehalte der Anerkennung', 'textarea', 'anerkennung'],
    ['strategie', 'AS', 'Strategievermerk (INTERN)', 'textarea', 'intern', null, true],
    ['naechsterSchritt', 'AT', 'Nächster Schritt', 'text', 'verfolgen'],
    ['verantwortlich', 'AU', 'Verantwortlich', 'text', 'verfolgen'],
    ['letzteReaktion', 'AV', 'Letzte Reaktion Auftraggeber (Datum, Inhalt)', 'textarea', 'verfolgen'],
    ['nachfassenAm', 'AW', 'Nachfassen am', 'date', 'verfolgen'],
    ['ergaenzungsbedarf', 'AX', 'Ergänzungsbedarf / offene Unterlagen', 'textarea', 'verfolgen'],
    ['interneFreigabe', 'AY', 'Interne Freigabe (Datum)', 'date', 'protokoll'],
    ['uebergabeGL', 'AZ', 'Übergabe an Geschäftsleitung (Datum)', 'date', 'protokoll'],
    ['eskalationRA', 'BA', 'Eskalation Rechtsabteilung', 'select', 'protokoll', JA_NEIN],
    ['geaendertVon', 'BB', 'Geändert von', 'text', 'protokoll'],
    ['geaendertAm', 'BC', 'Geändert am', 'date', 'protokoll'],
  ].map(([key, col, label, type, group, options, internal]) => ({ key, col, label, type, group, options: options || null, internal: !!internal }));

  const FIELD = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

  // Felder, die nie in eine Ausgabe an den AG gehören (Grundprinzip 3).
  const INTERNAL_KEYS = FIELDS.filter((f) => f.internal).map((f) => f.key);

  // ---------- Hilfsfunktionen ----------

  const isEmpty = (v) => v === undefined || v === null || v === '';
  const num = (v) => (isEmpty(v) ? null : Number(v));

  function todayISO(d) {
    const x = d || new Date();
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  }

  // Tage zwischen zwei ISO-Daten (b - a), unabhängig von Zeitzone.
  function daysBetween(a, b) {
    const pa = Date.UTC(...a.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)));
    const pb = Date.UTC(...b.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)));
    return Math.round((pb - pa) / 86400000);
  }

  function addDays(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    return todayISO(new Date(y, m - 1, d + n));
  }

  const isExample = (r) => String(r.nr || '').trim().toUpperCase() === 'BEISPIEL';

  // ---------- Formelspalten BD–BM ----------

  const ANERKANNT_SCHRIFTLICH = ['Grund und Höhe schriftlich anerkannt', 'Dem Grunde nach schriftlich anerkannt', 'Teilweise anerkannt', 'Unter Vorbehalt anerkannt'];

  function compute(r, today) {
    const t = today || todayISO();
    const c = {};

    // BD Späteste Ankündigung
    const F = r.ausfuehrungsbeginn, J = r.fristVertrag;
    c.spaetesteAnkuendigung = isEmpty(F) && isEmpty(J) ? null : isEmpty(J) ? F : isEmpty(F) ? J : (F < J ? F : J);

    // BE Tage bis Frist
    c.tageBisFrist = !c.spaetesteAnkuendigung || !isEmpty(r.angekuendigtAm) ? null : daysBetween(t, c.spaetesteAnkuendigung);

    // BF Fristenampel
    if (isEmpty(r.angekuendigtAm) && !isEmpty(F) && F <= t) c.ampel = 'ROT: Ausführung ohne Ankündigung';
    else if (!isEmpty(r.angekuendigtAm) && !isEmpty(F) && r.angekuendigtAm >= F) c.ampel = 'PRÜFEN: Ankündigung nicht vor Ausführungsbeginn';
    else if (c.tageBisFrist === null) c.ampel = '';
    else if (c.tageBisFrist < 0) c.ampel = 'ROT: Frist überschritten';
    else if (c.tageBisFrist <= 3) c.ampel = 'KRITISCH: höchstens 3 Tage';
    else if (c.tageBisFrist <= 7) c.ampel = 'BALD: höchstens 7 Tage';
    else c.ampel = 'OK';
    c.ampelKlasse = c.ampel ? c.ampel.split(':')[0] : '';

    // BG Forderungswert
    c.forderungswert = !isEmpty(r.betragAngeboten) ? num(r.betragAngeboten) : !isEmpty(r.vorabBewertung) ? num(r.vorabBewertung) : null;
    c.nurVorab = isEmpty(r.betragAngeboten) && !isEmpty(r.vorabBewertung);

    // BH Unstrittig, noch nicht bezahlt
    c.unstrittigOffen = isEmpty(r.unstrittig) ? null : num(r.unstrittig) - (num(r.vorabBezahlt) || 0);

    // BI Vorab-Zahlung fällig am
    c.vorabFaelligAm = isEmpty(r.vorabBeantragtAm) ? null : addDays(r.vorabBeantragtAm, isEmpty(r.zahlungsfristTage) ? 21 : num(r.zahlungsfristTage));

    // BJ Anerkennung: Belegprüfung
    const AM = r.anerkennung;
    if (isEmpty(AM)) c.anerkennungPruefung = 'Anerkennung nicht erfasst';
    else if (ANERKANNT_SCHRIFTLICH.includes(AM)) {
      c.anerkennungPruefung = isEmpty(r.anerkennungBeleg) || isEmpty(r.anerkanntAm) || isEmpty(r.anerkanntDurch)
        ? 'PRÜFEN: Beleg, Datum oder Unterzeichner fehlt' : 'Belegt';
    } else if (AM === 'Nur mündlich zugesagt') c.anerkennungPruefung = 'Nicht schriftlich: keine Anerkennung';
    else if (AM === 'Abgelehnt') c.anerkennungPruefung = 'Abgelehnt';
    else c.anerkennungPruefung = 'Nicht anerkannt';

    const belegtBetrag = c.anerkennungPruefung === 'Belegt' && !isEmpty(r.anerkannterBetrag) ? num(r.anerkannterBetrag) : 0;
    c.belegtAnerkannt = c.anerkennungPruefung === 'Belegt' ? num(r.anerkannterBetrag) || 0 : 0;

    // BK Nicht belegt anerkannter Rest
    c.nichtBelegtRest = c.forderungswert === null ? null : c.forderungswert - belegtBetrag;

    // BL Erbrachte Nachtragsleistung (Leistungsstand wird in Prozent 0–100 geführt)
    c.erbracht = c.forderungswert === null || isEmpty(r.leistungsstand) ? null : c.forderungswert * num(r.leistungsstand) / 100;

    // BM davon ohne belegt anerkannten Betrag
    c.erbrachtOhneBeleg = c.erbracht === null ? null : Math.max(0, c.erbracht - belegtBetrag);

    // Nächste harte Frist für die Sortierung der Fristenübersicht
    c.offen = r.status !== 'Beauftragt' && r.status !== 'Abgelehnt';
    c.nachfassenFaellig = !isEmpty(r.nachfassenAm) && r.nachfassenAm <= t && c.offen;

    // Eskalationskriterien (Modus 9), soweit aus der Liste erkennbar
    const esk = [];
    if (r.status === 'Streitig') esk.push('Status Streitig');
    if (AM === 'Abgelehnt') esk.push('Vergütungsanspruch abgelehnt');
    if (c.ampelKlasse === 'ROT' || c.ampelKlasse === 'PRÜFEN') esk.push('Ankündigungsfrist möglicherweise versäumt');
    if (['AG verweigert', 'AG nicht erschienen'].includes(r.aufmassReaktion)) esk.push('Gemeinsames Aufmaß: ' + r.aufmassReaktion);
    if (r.zulassungsstand === 'Zulassung im Einzelfall erforderlich' || r.zulassungsstand === 'Nicht nachgewiesen') esk.push('Baustoff-Zulassung: ' + r.zulassungsstand);
    c.eskalation = esk;

    return c;
  }

  // ---------- Ergänzungsbedarf (Modus 4, "Ergänzen") ----------
  // Schlägt Lücken vor. Eingetragen wird nur, was der Nutzer bestätigt.

  function luecken(r, today) {
    const t = today || todayISO();
    const c = compute(r, t);
    const begonnen = !isEmpty(r.ausfuehrungsbeginn) && r.ausfuehrungsbeginn <= t;
    const l = [];
    if (isEmpty(r.anordnung)) l.push('Anordnung belegen (wer, wann, wie, Beleg)');
    if (isEmpty(r.grundlage)) l.push('Einordnung § 2 Abs. 5 / Abs. 6 VOB/B bestätigen');
    if (isEmpty(r.angekuendigtAm) && r.status !== 'Idee') l.push('Datum der schriftlichen Ankündigung fehlt');
    if (isEmpty(r.angekuendigtAm) && r.status === 'Idee' && !isEmpty(r.ausfuehrungsbeginn)) l.push('Ankündigung vor Ausführungsbeginn erforderlich');
    if (isEmpty(r.ausfuehrungsbeginn) && isEmpty(r.fristVertrag)) l.push('Ausführungsbeginn oder vertragliche Frist fehlt (keine Fristenampel)');
    if (c.forderungswert === null) l.push('Euro-Bewertung fehlt (Vorab-Bewertung)');
    if (!isEmpty(r.vorabBewertung) && isEmpty(r.herleitung)) l.push('Herleitung der Vorab-Bewertung fehlt');
    if (!isEmpty(r.vorabBewertung) && isEmpty(r.bewertungsbasis)) l.push('Bewertungsbasis fehlt');
    if (begonnen && isEmpty(r.leistungsstand) && r.status !== 'Abgelehnt') l.push('Ausführung begonnen: Leistungsstand in % mit Datum und Basis erfassen');
    if (!isEmpty(r.leistungsstand) && (isEmpty(r.leistungsstandVom) || isEmpty(r.leistungsstandBasis))) l.push('Leistungsstand ohne Datum oder Basis');
    if (c.anerkennungPruefung.startsWith('PRÜFEN')) l.push('Anerkennung: Beleg, Datum oder Unterzeichner fehlt');
    if (r.anerkennung === 'Nur mündlich zugesagt') l.push('Mündliche Zusage schriftlich bestätigen lassen');
    if (['Nicht anerkannt', ''].includes(r.anerkennung || '') && ['Eingereicht', 'In Verhandlung'].includes(r.status)) l.push('Schriftliche Anerkennung oder Beauftragung anfordern');
    if (begonnen && ['Nicht angefordert', ''].includes(r.aufmassReaktion || '')) l.push('AG schriftlich zum gemeinsamen Aufmaß auffordern');
    if (!isEmpty(r.aufmassAufforderungAm) && isEmpty(r.aufmassReaktionBeleg)) l.push('Beleg für Aufmaß-Aufforderung und Reaktion fehlt');
    if (r.aufmassStand === 'Anerkannt' && (isEmpty(r.aufmassAnerkanntAm) || isEmpty(r.aufmassBeleg))) l.push('Aufmaß-Anerkennung ohne Datum oder Beleg');
    if (['', 'Nicht geprüft'].includes(r.zulassungsstand || '') && !['Idee', 'Abgelehnt'].includes(r.status)) l.push('Baustoff-Zulassung nach DB-Regelwerk prüfen');
    if (r.zulassungsstand === 'Nicht erforderlich' && isEmpty(r.nachweise)) l.push('"Nicht erforderlich" ohne Begründung im Nachweis-Feld');
    if (!isEmpty(r.unstrittig) && c.forderungswert !== null && num(r.unstrittig) > c.forderungswert) l.push('Unstrittiger Betrag übersteigt den Forderungswert');
    if (!isEmpty(r.unstrittig) && isEmpty(r.unstrittigBegruendung)) l.push('Begründung des unstrittigen Betrags fehlt');
    if (c.eskalation.length && isEmpty(r.uebergabeGL)) l.push('Strittig: Übergabe an Geschäftsleitung vor Eskalation');
    if (r.eskalationRA === 'Ja' && isEmpty(r.uebergabeGL)) l.push('Eskalation Rechtsabteilung ohne vorherige Übergabe an Geschäftsleitung');
    return l;
  }

  // ---------- Fristenübersicht (Modus 3) ----------

  const AMPEL_RANG = { ROT: 0, 'PRÜFEN': 1, KRITISCH: 2, BALD: 3, OK: 4, '': 5 };

  function fristen(rows, today) {
    const t = today || todayISO();
    return rows
      .filter((r) => !isExample(r))
      .map((r) => ({ r, c: compute(r, t) }))
      .filter(({ r, c }) => c.offen || c.ampelKlasse === 'ROT')
      .sort((a, b) => {
        const d = AMPEL_RANG[a.c.ampelKlasse] - AMPEL_RANG[b.c.ampelKlasse];
        if (d) return d;
        const fa = a.c.spaetesteAnkuendigung || '9999', fb = b.c.spaetesteAnkuendigung || '9999';
        return fa < fb ? -1 : fa > fb ? 1 : 0;
      });
  }

  // ---------- Übersicht (Blatt "Übersicht") ----------

  function overview(rows, settings, today) {
    const t = today || todayISO();
    const list = rows.filter((r) => !isExample(r) && !isEmpty(r.nr)).map((r) => ({ r, c: compute(r, t) }));
    const s = settings || {};
    const summe = num(s.auftragssumme);
    const schwelle = num(s.warnschwelle);
    const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);
    const count = (pred) => list.filter(pred).length;

    const perStatus = STATUS.map((st) => {
      const xs = list.filter((x) => x.r.status === st);
      return {
        status: st,
        anzahl: xs.length,
        forderungswert: sum(xs, (x) => x.c.forderungswert),
        nurVorab: sum(xs, (x) => (x.c.nurVorab ? num(x.r.vorabBewertung) : 0)),
        beauftragt: sum(xs, (x) => num(x.r.betragBeauftragt)),
      };
    });
    const total = perStatus.reduce((a, p) => ({
      anzahl: a.anzahl + p.anzahl, forderungswert: a.forderungswert + p.forderungswert,
      nurVorab: a.nurVorab + p.nurVorab, beauftragt: a.beauftragt + p.beauftragt,
    }), { anzahl: 0, forderungswert: 0, nurVorab: 0, beauftragt: 0 });
    const by = (st) => perStatus.find((p) => p.status === st);

    const volumen = sum(list.filter((x) => x.r.status !== 'Abgelehnt'), (x) => x.c.forderungswert);
    const belegt = sum(list, (x) => x.c.belegtAnerkannt);
    const erbracht = sum(list, (x) => x.c.erbracht);
    const erbrachtOhneBeleg = sum(list, (x) => x.c.erbrachtOhneBeleg);
    const pct = (v) => (summe ? v / summe : null);
    const erbrachtNurSchaetzung = sum(list.filter((x) => x.r.leistungsstandBasis === 'Schätzung Bauleitung' || isEmpty(x.r.leistungsstandBasis)), (x) => x.c.erbracht);

    let schwellenpruefung = 'keine Schwelle gesetzt';
    if (schwelle !== null) schwellenpruefung = !summe ? 'Auftragssumme fehlt' : (volumen / summe * 100 >= schwelle ? 'SCHWELLE ERREICHT ODER ÜBERSCHRITTEN' : 'unter der Schwelle');

    const unstrittig = sum(list, (x) => num(x.r.unstrittig));
    const bezahlt = sum(list, (x) => num(x.r.vorabBezahlt));
    const uberfaellig = list.filter((x) => !isEmpty(x.r.vorabBeantragtAm) && x.c.vorabFaelligAm < t && (num(x.r.unstrittig) || 0) > (num(x.r.vorabBezahlt) || 0));

    const V = (x) => x.r.aufmassReaktion;
    const AC = (x) => x.r.zulassungsstand;
    const ST = (x) => x.r.status;
    const offen = (x) => ST(x) !== 'Beauftragt' && ST(x) !== 'Abgelehnt';
    const aufmassProblem = (x) => ['AG verweigert', 'AG nicht erschienen', 'Keine Reaktion'].includes(V(x));

    const handlungsbedarf = [
      ['Rot: Frist überschritten / Ausführung ohne Ankündigung', count((x) => x.c.ampelKlasse === 'ROT'), 'fristen'],
      ['Prüfen: Ankündigung nicht vor Ausführungsbeginn', count((x) => x.c.ampelKlasse === 'PRÜFEN'), 'fristen'],
      ['Kritisch: Frist in höchstens 3 Tagen', count((x) => x.c.ampelKlasse === 'KRITISCH'), 'fristen'],
      ['Bald: Frist in höchstens 7 Tagen', count((x) => x.c.ampelKlasse === 'BALD'), 'fristen'],
      ['Nachfassen fällig (Termin erreicht, noch offen)', count((x) => x.c.nachfassenFaellig), 'verfolgen'],
      ['Ergänzungsbedarf offen (noch offene Nachträge)', count((x) => !isEmpty(x.r.ergaenzungsbedarf) && offen(x)), 'verfolgen'],
      ['Ohne Euro-Bewertung (noch offene Nachträge)', count((x) => isEmpty(x.r.vorabBewertung) && isEmpty(x.r.betragAngeboten) && offen(x)), 'bewertung'],
      ['Eingereicht oder weiter, aber ohne interne Freigabe', count((x) => ['Eingereicht', 'In Verhandlung', 'Beauftragt'].includes(ST(x)) && isEmpty(x.r.interneFreigabe)), 'protokoll'],
      ['Gemeinsames Aufmaß: AG verweigert / nicht erschienen / keine Reaktion', count(aufmassProblem), 'aufmass'],
      ['… davon ohne schriftliche Aufforderung erfasst', count((x) => aufmassProblem(x) && isEmpty(x.r.aufmassAufforderungAm)), 'aufmass'],
      ['Aufforderung zum Aufmaß erfasst, aber ohne Beleg', count((x) => !isEmpty(x.r.aufmassAufforderungAm) && isEmpty(x.r.aufmassReaktionBeleg)), 'aufmass'],
      ['Aufmaß (teilweise) anerkannt, unstrittiger Betrag nicht beziffert', count((x) => ['Anerkannt', 'Teilweise anerkannt'].includes(x.r.aufmassStand) && isEmpty(x.r.unstrittig)), 'vorab'],
      ['Unstrittiger Betrag ohne anerkanntes Aufmaß (prüfen)', count((x) => !isEmpty(x.r.unstrittig) && !['Anerkannt', 'Teilweise anerkannt'].includes(x.r.aufmassStand)), 'vorab'],
      ['Unstrittiger Betrag beziffert, Vorab-Zahlung nicht beantragt', count((x) => !isEmpty(x.r.unstrittig) && isEmpty(x.r.vorabBeantragtAm)), 'vorab'],
      ['Vorab-Zahlung überfällig', uberfaellig.length, 'vorab'],
      ['Baustoffe: Zulassung nicht oder nur teilweise nachgewiesen', count((x) => ['Nicht nachgewiesen', 'Teilweise nachgewiesen'].includes(AC(x))), 'baustoffe'],
      ['Zulassung im Einzelfall erforderlich oder beantragt, nicht erteilt', count((x) => ['Zulassung im Einzelfall erforderlich', 'Zulassung im Einzelfall beantragt'].includes(AC(x))), 'baustoffe'],
      ['Baustoff-Zulassung noch nicht geprüft (Angebot bis Streitig)', count((x) => ['Angebot in Arbeit', 'Eingereicht', 'In Verhandlung', 'Streitig'].includes(ST(x)) && (isEmpty(AC(x)) || AC(x) === 'Nicht geprüft')), 'baustoffe'],
      ['Unstrittiger Betrag, Baustoff-Zulassung nicht abschließend nachgewiesen', count((x) => !isEmpty(x.r.unstrittig) && !['Alle nachgewiesen', 'Zulassung im Einzelfall erteilt', 'Nicht erforderlich'].includes(AC(x))), 'baustoffe'],
      ['Anerkennung eingetragen, aber Beleg, Datum oder Unterzeichner fehlt', count((x) => x.c.anerkennungPruefung.startsWith('PRÜFEN')), 'anerkennung'],
      ['Vergütungsanspruch nur mündlich zugesagt', count((x) => x.r.anerkennung === 'Nur mündlich zugesagt'), 'anerkennung'],
      ['Status Beauftragt, aber keine belegte schriftliche Anerkennung', count((x) => ST(x) === 'Beauftragt' && x.c.anerkennungPruefung !== 'Belegt'), 'anerkennung'],
      ['Eingereicht oder in Verhandlung, Anerkennungsstatus nicht erfasst', count((x) => ['Eingereicht', 'In Verhandlung'].includes(ST(x)) && isEmpty(x.r.anerkennung)), 'anerkennung'],
      ['Ausführung begonnen, Leistungsstand nicht erfasst', count((x) => !isEmpty(x.r.ausfuehrungsbeginn) && x.r.ausfuehrungsbeginn <= t && isEmpty(x.r.leistungsstand) && ST(x) !== 'Abgelehnt'), 'umfang'],
      ['Streitig, aber noch keine Übergabe an Geschäftsleitung', count((x) => ST(x) === 'Streitig' && isEmpty(x.r.uebergabeGL)), 'protokoll'],
      ['Eskalation Rechtsabteilung = Ja, aber ohne Übergabe an Geschäftsleitung', count((x) => x.r.eskalationRA === 'Ja' && isEmpty(x.r.uebergabeGL)), 'protokoll'],
    ].map(([label, anzahl, group]) => ({ label, anzahl, group }));

    return {
      stichtag: t,
      anzahl: list.length,
      perStatus,
      total,
      offenesVolumen: total.forderungswert - by('Beauftragt').forderungswert - by('Abgelehnt').forderungswert,
      offenNurVorab: total.nurVorab - by('Beauftragt').nurVorab - by('Abgelehnt').nurVorab,
      beauftragt: total.beauftragt,
      anerkennung: {
        belegt,
        rest: sum(list, (x) => x.c.nichtBelegtRest),
        nurMuendlich: count((x) => x.r.anerkennung === 'Nur mündlich zugesagt'),
        ohneVollstBeleg: count((x) => x.c.anerkennungPruefung.startsWith('PRÜFEN')),
      },
      umfang: {
        auftragssumme: summe,
        volumen, volumenPct: pct(volumen),
        belegt, belegtPct: pct(belegt),
        erbracht, erbrachtPct: pct(erbracht),
        erbrachtOhneBeleg, erbrachtOhneBelegPct: pct(erbrachtOhneBeleg),
        erbrachtNurSchaetzung,
        schwelle, schwellenpruefung,
      },
      vorab: { unstrittig, bezahlt, offen: unstrittig - bezahlt, ueberfaellig: uberfaellig.length },
      handlungsbedarf,
      top5: list.filter((x) => x.r.status !== 'Abgelehnt' && x.c.forderungswert !== null)
        .sort((a, b) => b.c.forderungswert - a.c.forderungswert).slice(0, 5),
      streitig: list.filter((x) => x.c.eskalation.length),
    };
  }

  // ---------- Externe Aufstellung (an den AG) ----------
  // Nur Felder, die ohnehin gegenüber dem AG bekannt oder belegbar sind.
  // Strategievermerk und Vorab-Bewertung sind ausgeschlossen (Grundprinzip 3).
  const EXTERNAL_KEYS = ['nr', 'vorhaben', 'kurzbeschreibung', 'grundlage', 'anordnung', 'angekuendigtAm', 'eingereichtAm',
    'betragAngeboten', 'aufmassAufforderungAm', 'aufmassTermin', 'aufmassStand', 'aufmassAnerkanntAm', 'baustoffe', 'regelwerk', 'nachweise', 'unstrittig', 'vorabBeantragtAm'];

  function externalRow(r) {
    const out = {};
    for (const k of EXTERNAL_KEYS) if (!INTERNAL_KEYS.includes(k)) out[k] = r[k];
    return out;
  }

  // ---------- CSV im Spaltenformat der Excel-Vorlage ----------

  const SEP = ';';

  function fmtCsvValue(f, v) {
    if (isEmpty(v)) return '';
    if (f.type === 'date') { const [y, m, d] = v.split('-'); return `${d}.${m}.${y}`; }
    if (f.type === 'percent') return String(Number(v) / 100).replace('.', ',');
    if (f.type === 'money' || f.type === 'number') return String(v).replace('.', ',');
    return String(v);
  }

  function csvEscape(s) {
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCSV(rows, keys) {
    const fields = keys ? keys.map((k) => FIELD[k]) : FIELDS;
    const head = fields.map((f) => csvEscape(f.label)).join(SEP);
    const body = rows.map((r) => fields.map((f) => csvEscape(fmtCsvValue(f, r[f.key]))).join(SEP));
    return '\ufeff' + [head, ...body].join('\r\n') + '\r\n';
  }

  function parseCSV(text) {
    const t = text.replace(/^\ufeff/, '');
    const sep = t.split(/\r?\n/)[0].includes(';') ? ';' : ',';
    const rows = []; let row = []; let cell = ''; let q = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (q) {
        if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && t[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
  }

  function parseValue(f, s) {
    const v = s.trim();
    if (v === '') return '';
    if (f.type === 'date') {
      let m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[1]}-${m[2]}-${m[3]}` : v;
    }
    if (['money', 'number', 'percent'].includes(f.type)) {
      const pctSign = v.includes('%');
      let n = v.replace(/[%€\s]/g, '');
      if (n.includes(',')) n = n.replace(/\./g, '').replace(',', '.');
      const x = Number(n);
      if (Number.isNaN(x)) return v;
      if (f.type === 'percent') return pctSign || x > 1 ? x : Math.round(x * 10000) / 100;
      return x;
    }
    return v;
  }

  // Formelspalten BD–BM der Vorlage: werden beim Import ignoriert und hier neu berechnet.
  const FORMULA_LABELS = ['Späteste Ankündigung', 'Tage bis Frist', 'Fristenampel', 'Forderungswert (€ netto)',
    'Unstrittig, noch nicht bezahlt (€ netto)', 'Vorab-Zahlung fällig am', 'Anerkennung: Belegprüfung',
    'Nicht belegt anerkannter Rest (€ netto)', 'Erbrachte Nachtragsleistung (€ netto)', 'davon ohne belegt anerkannten Betrag (€ netto)'];

  // Ordnet Spalten über die Überschrift zu (wie in der Vorlage). Unbekannte Spalten werden ignoriert.
  function fromCSV(text) {
    const [head, ...data] = parseCSV(text);
    if (!head) return { rows: [], unbekannt: [] };
    const byLabel = Object.fromEntries(FIELDS.map((f) => [f.label.toLowerCase(), f]));
    const map = head.map((h) => byLabel[h.trim().toLowerCase()] || null);
    const unbekannt = head.filter((h, i) => !map[i] && h.trim() !== '' && !FORMULA_LABELS.includes(h.trim()));
    const rows = data.map((cells) => {
      const r = {};
      map.forEach((f, i) => { if (f) r[f.key] = parseValue(f, cells[i] || ''); });
      return r;
    }).filter((r) => !isEmpty(r.nr));
    return { rows, unbekannt };
  }

  function emptyRow() {
    const r = {};
    for (const f of FIELDS) r[f.key] = '';
    r.status = 'Idee';
    r.anerkennung = 'Nicht anerkannt';
    r.aufmassReaktion = 'Nicht angefordert';
    r.aufmassStand = 'Nicht erstellt';
    r.zulassungsstand = 'Nicht geprüft';
    r.eskalationRA = 'Nein';
    return r;
  }

  const NM = {
    STATUS, ANERKENNUNG, GROUPS, FIELDS, FIELD, INTERNAL_KEYS, EXTERNAL_KEYS,
    compute, luecken, fristen, overview, externalRow, toCSV, fromCSV, parseCSV, emptyRow, isExample, todayISO, daysBetween, addDays,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = NM;
  else root.NM = NM;
})(typeof window !== 'undefined' ? window : globalThis);
