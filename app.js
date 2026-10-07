/* Nachtragsmanagement – Oberfläche. Fachlogik in model.js (NM). */
(function () {
  'use strict';

  const KEY = 'nachtragsmanagement.v1';
  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const pctFmt = new Intl.NumberFormat('de-DE', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const money = (v) => (v === null || v === undefined || v === '' ? '–' : eur.format(v));
  const pct = (v) => (v === null || v === undefined ? 'Auftragssumme fehlt' : pctFmt.format(v));
  const datum = (iso) => (iso ? iso.split('-').reverse().join('.') : '–');

  // ---------- Speicher ----------

  let state = { settings: { auftraggeber: 'DB InfraGO AG' }, rows: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) { /* ohne Speicher weiterarbeiten */ }
  state.settings = state.settings || {};
  state.rows = state.rows || [];

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { alert('Speichern im Browser nicht möglich. Bitte Daten exportieren.'); }
  }

  const today = () => NM.todayISO();

  // ---------- Navigation ----------

  let view = 'uebersicht';
  try { view = sessionStorage.getItem(KEY + '.view') || view; } catch (e) { /* egal */ }

  function show(v) {
    view = v;
    try { sessionStorage.setItem(KEY + '.view', v); } catch (e) { /* egal */ }
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    document.querySelectorAll('.view').forEach((s) => { s.hidden = s.id !== 'view-' + v; });
    render();
  }
  $('#tabs').addEventListener('click', (e) => { if (e.target.dataset.view) show(e.target.dataset.view); });

  function render() {
    $('#kopf-vorhaben').textContent = [state.settings.vorhaben, state.settings.auftraggeber].filter(Boolean).join(' · ');
    ({ uebersicht: renderUebersicht, fristen: renderFristen, liste: renderListe, uebergabe: renderUebergabe, einstellungen: renderEinstellungen })[view]();
  }

  const ampel = (c) => (c.ampel ? `<span class="pill a-${esc(c.ampelKlasse)}">${esc(c.ampel)}</span>` : '');
  const fwert = (c) => (c.forderungswert === null ? '<span class="warn">ohne Bewertung</span>' : money(c.forderungswert) + (c.nurVorab ? ' <small class="muted">(nur Vorab)</small>' : ''));

  // ---------- Übersicht ----------

  function renderUebersicht() {
    const o = NM.overview(state.rows, state.settings, today());
    const u = o.umfang;
    const hb = (g) => o.handlungsbedarf.filter((h) => g.includes(h.group));
    const hbList = (items) => `<ul class="hb">${items.map((h) => `<li class="${h.anzahl ? '' : 'zero'}">${h.anzahl ? `<strong>${h.anzahl}</strong>` : '0'} · ${esc(h.label)}</li>`).join('')}</ul>`;

    $('#view-uebersicht').innerHTML = `
      <h2>Übersicht <small class="muted">Stand ${datum(o.stichtag)}, ${o.anzahl} Nachträge</small></h2>
      ${o.anzahl === 0 ? `<div class="card">Noch keine Nachträge. <button id="u-neu" class="primary">Nachtrag anlegen</button> oder Nachtragsliste unter „Projekt &amp; Daten“ importieren.</div>` : ''}
      <div class="grid">
        <div class="card">
          <h3>1. Fristen</h3>
          ${hbList(hb(['fristen', 'verfolgen']))}
        </div>
        <div class="card">
          <h3>2. Anerkennung des Vergütungsanspruchs</h3>
          <div class="kpi">${money(o.anerkennung.belegt)} <small>schriftlich anerkannt und belegt</small></div>
          <div>${money(o.anerkennung.rest)} Forderungswert ohne belegte Anerkennung</div>
          ${hbList(hb(['anerkennung']))}
        </div>
        <div class="card">
          <h3>3. Nachtragsumfang</h3>
          ${u.auftragssumme ? '' : '<p class="warn">Ursprüngliche Auftragssumme fehlt. Ohne sie keine Prozentwerte.</p>'}
          <table>
            <tr><td>Erbracht</td><td class="num">${money(u.erbracht)}</td><td class="num"><strong>${pct(u.erbrachtPct)}</strong></td></tr>
            <tr><td>Nachtragsvolumen gesamt</td><td class="num">${money(u.volumen)}</td><td class="num">${pct(u.volumenPct)}</td></tr>
            <tr><td>Schriftlich anerkannt, belegt</td><td class="num">${money(u.belegt)}</td><td class="num">${pct(u.belegtPct)}</td></tr>
            <tr><td>Erbracht ohne belegt anerkannten Betrag</td><td class="num">${money(u.erbrachtOhneBeleg)}</td><td class="num">${pct(u.erbrachtOhneBelegPct)}</td></tr>
          </table>
          <p class="muted">Bezug: ${money(u.auftragssumme)} ursprüngliche Auftragssumme. Erbracht nur aus Schätzung oder ohne Basis: ${money(u.erbrachtNurSchaetzung)}.</p>
          <p>Schwellenprüfung: <span class="${u.schwellenpruefung.startsWith('SCHWELLE') ? 'warn' : ''}">${esc(u.schwellenpruefung)}</span>${u.schwelle !== null ? ` (${u.schwelle} %)` : ''}</p>
          ${hbList(hb(['umfang']))}
        </div>
      </div>
      <div class="card">
        <h3>Volumen nach Status (€ netto)</h3>
        <div class="tbl-wrap"><table>
          <tr><th>Status</th><th class="num">Anzahl</th><th class="num">Forderungswert</th><th class="num">davon nur Vorab-Bewertung</th><th class="num">Beauftragt</th></tr>
          ${o.perStatus.map((p) => `<tr><td>${esc(p.status)}</td><td class="num">${p.anzahl}</td><td class="num">${money(p.forderungswert)}</td><td class="num">${money(p.nurVorab)}</td><td class="num">${money(p.beauftragt)}</td></tr>`).join('')}
          <tr><th>Summe</th><th class="num">${o.total.anzahl}</th><th class="num">${money(o.total.forderungswert)}</th><th class="num">${money(o.total.nurVorab)}</th><th class="num">${money(o.total.beauftragt)}</th></tr>
        </table></div>
        <p>Offenes Volumen (ohne Beauftragt und Abgelehnt): <strong>${money(o.offenesVolumen)}</strong>, davon nur Vorab-Bewertung ${money(o.offenNurVorab)}.</p>
      </div>
      <div class="grid">
        <div class="card">
          <h3>Vorab-Zahlungen und Aufmaß</h3>
          <p>Unstrittig ${money(o.vorab.unstrittig)} · bezahlt ${money(o.vorab.bezahlt)} · offen ${money(o.vorab.offen)}</p>
          ${hbList(hb(['vorab', 'aufmass']))}
        </div>
        <div class="card">
          <h3>Baustoffe, Bewertung, Freigabe, Eskalation</h3>
          ${hbList(hb(['baustoffe', 'bewertung', 'protokoll']))}
        </div>
      </div>`;
    const b = $('#u-neu'); if (b) b.onclick = () => openEditor(null);
  }

  // ---------- Fristen ----------

  function renderFristen() {
    const fr = NM.fristen(state.rows, today());
    const nach = state.rows.filter((r) => !NM.isExample(r)).map((r) => ({ r, c: NM.compute(r, today()) })).filter((x) => x.c.nachfassenFaellig);
    $('#view-fristen').innerHTML = `
      <h2>Fristen <small class="muted">nach nächster harter Frist, Überfälliges zuerst</small></h2>
      <div class="card tbl-wrap"><table>
        <tr><th>Ampel</th><th>Nr.</th><th>Kurzbeschreibung</th><th>Frist Ankündigung</th><th class="num">Tage</th><th>Status</th><th class="num">Forderungswert</th><th>Anerkennung</th><th>Letzte AG-Reaktion</th><th>Nächster Schritt</th><th>Verantwortlich</th></tr>
        ${fr.map(({ r, c }) => `<tr class="click" data-nr="${esc(r.nr)}">
          <td>${ampel(c) || '<span class="muted">angekündigt</span>'}</td><td>${esc(r.nr)}</td><td>${esc(r.kurzbeschreibung)}</td>
          <td>${datum(c.spaetesteAnkuendigung)}</td><td class="num">${c.tageBisFrist ?? ''}</td><td>${esc(r.status)}</td>
          <td class="num">${fwert(c)}</td><td>${esc(r.anerkennung)}</td><td>${esc(r.letzteReaktion)}</td><td>${esc(r.naechsterSchritt)}</td><td>${esc(r.verantwortlich)}</td></tr>`).join('') || '<tr><td colspan="11" class="muted">Keine offenen Nachträge.</td></tr>'}
      </table></div>
      <h3>Nachfassen fällig</h3>
      <div class="card tbl-wrap"><table>
        <tr><th>Nr.</th><th>Kurzbeschreibung</th><th>Nachfassen am</th><th>Status</th><th>Letzte AG-Reaktion</th><th>Nächster Schritt</th><th>Verantwortlich</th></tr>
        ${nach.map(({ r }) => `<tr class="click" data-nr="${esc(r.nr)}"><td>${esc(r.nr)}</td><td>${esc(r.kurzbeschreibung)}</td><td>${datum(r.nachfassenAm)}</td><td>${esc(r.status)}</td><td>${esc(r.letzteReaktion)}</td><td>${esc(r.naechsterSchritt)}</td><td>${esc(r.verantwortlich)}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Nichts fällig.</td></tr>'}
      </table></div>`;
    bindRowClicks('#view-fristen');
  }

  // ---------- Liste ----------

  let filter = { status: '', q: '' };

  function renderListe() {
    const q = filter.q.toLowerCase();
    const rows = state.rows.filter((r) => (!filter.status || r.status === filter.status) &&
      (!q || [r.nr, r.kurzbeschreibung, r.verantwortlich, r.naechsterSchritt].join(' ').toLowerCase().includes(q)));
    $('#view-liste').innerHTML = `
      <div class="toolbar">
        <button id="l-neu" class="primary">Neuer Nachtrag</button>
        <select id="l-status" style="width:auto"><option value="">Alle Status</option>${NM.STATUS.map((s) => `<option ${s === filter.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
        <input id="l-q" placeholder="Suche Nr., Text, Verantwortlich" value="${esc(filter.q)}" style="max-width:280px">
        <span class="spacer"></span><span class="muted">${rows.length} von ${state.rows.length}</span>
      </div>
      <div class="card tbl-wrap"><table>
        <tr><th>Nr.</th><th>Kurzbeschreibung</th><th>Status</th><th>Fristenampel</th><th>Anerkennung (Beleg)</th><th class="num">Forderungswert</th><th class="num">Leistungsstand</th><th class="num">Erbracht</th><th>Verantwortlich</th></tr>
        ${rows.map((r) => { const c = NM.compute(r, today()); return `<tr class="click" data-nr="${esc(r.nr)}">
          <td>${esc(r.nr)}${NM.isExample(r) ? ' <small class="muted">(zählt nicht)</small>' : ''}</td><td>${esc(r.kurzbeschreibung)}</td><td>${esc(r.status)}</td><td>${ampel(c)}</td>
          <td>${esc(c.anerkennungPruefung)}</td><td class="num">${fwert(c)}</td><td class="num">${r.leistungsstand !== '' && r.leistungsstand != null ? esc(r.leistungsstand) + ' %' : ''}</td>
          <td class="num">${c.erbracht === null ? '' : money(c.erbracht)}</td><td>${esc(r.verantwortlich)}</td></tr>`; }).join('') || '<tr><td colspan="9" class="muted">Keine Einträge.</td></tr>'}
      </table></div>`;
    $('#l-neu').onclick = () => openEditor(null);
    $('#l-status').onchange = (e) => { filter.status = e.target.value; renderListe(); };
    $('#l-q').oninput = (e) => { filter.q = e.target.value; const pos = e.target.selectionStart; renderListe(); const i = $('#l-q'); i.focus(); i.setSelectionRange(pos, pos); };
    bindRowClicks('#view-liste');
  }

  function bindRowClicks(scope) {
    document.querySelectorAll(scope + ' tr.click').forEach((tr) => { tr.onclick = () => openEditor(tr.dataset.nr); });
  }

  // ---------- Editor ----------

  let editing = null; // Index in state.rows oder -1 für neu

  function fieldHtml(f, v) {
    const id = 'f-' + f.key;
    let input;
    if (f.type === 'select') input = `<select id="${id}" name="${f.key}"><option value=""></option>${f.options.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else if (f.type === 'textarea') input = `<textarea id="${id}" name="${f.key}">${esc(v)}</textarea>`;
    else if (f.type === 'date') input = `<input type="date" id="${id}" name="${f.key}" value="${esc(v)}">`;
    else if (['money', 'number', 'percent'].includes(f.type)) input = `<input type="number" step="${f.type === 'money' ? '0.01' : '1'}" ${f.type === 'percent' ? 'min="0" max="100"' : ''} id="${id}" name="${f.key}" value="${esc(v)}">`;
    else input = `<input type="text" id="${id}" name="${f.key}" value="${esc(v)}">`;
    const label = f.type === 'percent' ? f.label.replace('(% erbracht)', '(% erbracht, 0–100)') : f.label;
    return `<label class="f"><span>${f.col} · ${esc(label)}</span>${input}</label>`;
  }

  function formRow() {
    const r = {};
    for (const f of NM.FIELDS) {
      const el = $('#f-' + f.key);
      if (!el) continue;
      const v = el.value.trim();
      r[f.key] = ['money', 'number', 'percent'].includes(f.type) && v !== '' ? Number(v) : v;
    }
    return r;
  }

  function renderEditorInfo() {
    const r = formRow();
    const c = NM.compute(r, today());
    $('#editor-kennzahlen').innerHTML = `
      <span>Späteste Ankündigung: <strong>${datum(c.spaetesteAnkuendigung)}</strong></span>
      <span>${ampel(c) || 'Ampel: –'}</span>
      <span>Anerkennung: <strong>${esc(c.anerkennungPruefung)}</strong></span>
      <span>Forderungswert: <strong>${c.forderungswert === null ? '–' : money(c.forderungswert)}</strong>${c.nurVorab ? ' (nur Vorab)' : ''}</span>
      <span>Erbracht: ${c.erbracht === null ? '–' : money(c.erbracht)}</span>
      <span>Unstrittig offen: ${c.unstrittigOffen === null ? '–' : money(c.unstrittigOffen)}</span>
      <span>Vorab fällig: ${datum(c.vorabFaelligAm)}</span>`;
    const l = NM.luecken(r, today());
    const esk = c.eskalation.length ? `<p class="warn">Strittig, Übergabe an Geschäftsleitung vor Eskalation empfohlen (${esc(c.eskalation.join('; '))}).</p>` : '';
    $('#editor-luecken').innerHTML = esk + (l.length ? `<ul class="luecken"><li><strong>Ergänzungsbedarf (Vorschlag):</strong></li>${l.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  }

  function openEditor(nr) {
    editing = nr === null ? -1 : state.rows.findIndex((r) => String(r.nr) === String(nr));
    const r = editing === -1 ? Object.assign(NM.emptyRow(), { vorhaben: state.settings.vorhaben || '' }) : state.rows[editing];
    $('#editor-titel').textContent = editing === -1 ? 'Neuer Nachtrag' : `Nachtrag ${r.nr}`;
    $('#editor-loeschen').hidden = editing === -1;
    renderEditor(r);
    if (!$('#editor').open) $('#editor').showModal();
  }

  function renderEditor(r) {
    const zeigeIntern = $('#zeige-intern').checked;
    $('#editor-felder').innerHTML = NM.GROUPS.map(([g, titel]) => {
      const fs = NM.FIELDS.filter((f) => f.group === g);
      const body = fs.map((f) => (f.internal && !zeigeIntern ? `<input type="hidden" id="f-${f.key}" value="${esc(r[f.key] ?? '')}">` : fieldHtml(f, r[f.key] ?? ''))).join('');
      const versteckt = fs.filter((f) => f.internal).length;
      if (!zeigeIntern && versteckt === fs.length) return body;
      const note = !zeigeIntern && versteckt ? '<p class="muted" style="margin:6px 0 0">Interne Felder ausgeblendet.</p>' : '';
      return `<fieldset class="${zeigeIntern && versteckt ? 'intern' : ''}"><legend>${esc(titel)}</legend><div class="fields">${body}</div>${note}</fieldset>`;
    }).join('');
    $('#editor-felder').oninput = renderEditorInfo;
    renderEditorInfo();
  }

  // Formularstand beim Umschalten behalten
  $('#zeige-intern').addEventListener('change', () => { if ($('#editor').open) renderEditor(formRow()); });

  $('#editor-abbrechen').onclick = () => { $('#editor').close(); editing = null; };

  $('#editor-loeschen').onclick = () => {
    const r = state.rows[editing];
    if (!confirm(`Nachtrag ${r.nr} aus diesem Browser löschen? Die Excel-Nachtragsliste bleibt unberührt.`)) return;
    state.rows.splice(editing, 1);
    save(); $('#editor').close(); editing = null; render();
  };

  $('#editor-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const r = formRow();
    if (!r.nr) { alert('Nr. fehlt.'); return; }
    const dup = state.rows.findIndex((x) => String(x.nr) === String(r.nr));
    if (dup !== -1 && dup !== editing) { alert(`Nr. ${r.nr} gibt es schon.`); return; }
    if (!state.settings.bearbeiter) {
      const n = prompt('Name oder Kürzel für „Geändert von“:');
      if (n) { state.settings.bearbeiter = n.trim(); }
    }
    r.geaendertVon = state.settings.bearbeiter || r.geaendertVon || '';
    r.geaendertAm = today();
    if (editing === -1) state.rows.push(r); else state.rows[editing] = Object.assign({}, state.rows[editing], r);
    save(); $('#editor').close(); editing = null; render();
  });

  // ---------- Übergabe an die Geschäftsleitung ----------

  function uebergabeText() {
    const s = state.settings;
    const o = NM.overview(state.rows, s, today());
    const u = o.umfang;
    const hb = o.handlungsbedarf.filter((h) => h.anzahl);
    const L = [];
    L.push(`Übergabe an die Geschäftsleitung – ${s.vorhaben || '[FEHLT: Vorhaben]'}, AG ${s.auftraggeber || '[FEHLT: Auftraggeber]'}`);
    L.push(`Stand ${datum(o.stichtag)}. INTERN, nicht an den AG.`);
    L.push('');
    L.push('Volumen (netto)');
    L.push(`- Forderungswert gesamt ${money(o.total.forderungswert)}, davon nur Vorab-Bewertung ${money(o.total.nurVorab)}`);
    L.push(`- Beauftragt ${money(o.beauftragt)}, offen ${money(o.offenesVolumen)}`);
    L.push('');
    L.push(`Nachtragsumfang (Stand ${datum(o.stichtag)})`);
    if (!u.auftragssumme) L.push('- [FEHLT: ursprüngliche Auftragssumme] – keine Prozentwerte');
    L.push(`- Erbracht ${money(u.erbracht)} = ${pct(u.erbrachtPct)} der ursprünglichen Auftragssumme ${money(u.auftragssumme)}`);
    L.push(`- Nachtragsvolumen gesamt ${money(u.volumen)} = ${pct(u.volumenPct)}`);
    L.push(`- Erbracht ohne belegt anerkannten Betrag ${money(u.erbrachtOhneBeleg)} = ${pct(u.erbrachtOhneBelegPct)}; davon nur aus Schätzung ${money(u.erbrachtNurSchaetzung)}`);
    L.push(`- Schwellenprüfung: ${u.schwellenpruefung}${u.schwelle !== null ? ` (${u.schwelle} %)` : ''}`);
    L.push('');
    L.push('Anerkennung des Vergütungsanspruchs');
    L.push(`- Schriftlich anerkannt und belegt ${money(o.anerkennung.belegt)}; Rest ohne belegte Anerkennung ${money(o.anerkennung.rest)}`);
    L.push(`- Nur mündlich zugesagt: ${o.anerkennung.nurMuendlich}; Anerkennung ohne vollständigen Beleg: ${o.anerkennung.ohneVollstBeleg}`);
    L.push('');
    L.push('Vorab-Zahlungen');
    L.push(`- Unstrittig ${money(o.vorab.unstrittig)}, bezahlt ${money(o.vorab.bezahlt)}, offen ${money(o.vorab.offen)}, überfällig: ${o.vorab.ueberfaellig}`);
    L.push('');
    L.push('Handlungsbedarf');
    if (!hb.length) L.push('- keiner erfasst');
    hb.forEach((h) => L.push(`- ${h.anzahl} × ${h.label}`));
    L.push('');
    L.push('Größte Nachträge (Top 5 nach Wert)');
    if (!o.top5.length) L.push('- keine');
    o.top5.forEach(({ r, c }) => L.push(`- ${r.nr} ${r.kurzbeschreibung || ''}: ${r.status}, ${money(c.forderungswert)}${c.nurVorab ? ` (Vorab, ${r.bewertungsbasis || 'Basis fehlt'})` : ' (angeboten)'}; nächster Schritt: ${r.naechsterSchritt || '[FEHLT]'}`));
    L.push('');
    L.push('Streitige oder kritische Nachträge');
    if (!o.streitig.length) L.push('- keine');
    o.streitig.forEach(({ r, c }) => L.push(`- ${r.nr} ${r.kurzbeschreibung || ''}: ${c.eskalation.join('; ')}. Übergabe GL: ${r.uebergabeGL ? datum(r.uebergabeGL) : 'noch nicht'}`));
    L.push('');
    L.push('Entscheidungsbedarf');
    L.push('- [vom Nachtragsmanager zu ergänzen]');
    return L.join('\n');
  }

  function renderUebergabe() {
    const t = uebergabeText();
    $('#view-uebergabe').innerHTML = `
      <div class="toolbar">
        <h2 style="margin:0">Übergabe an die Geschäftsleitung</h2><span class="spacer"></span>
        <button id="g-copy">Kopieren</button><button id="g-print">Drucken</button>
      </div>
      <p class="muted">Entwurf zur Freigabe. Monatlich vor der Abschlagsrechnung und immer vor einer Eskalation an die Rechtsabteilung. Datum je Nachtrag in „Übergabe an Geschäftsleitung“ eintragen.</p>
      <div class="card"><pre class="bericht">${esc(t)}</pre></div>`;
    $('#g-copy').onclick = () => navigator.clipboard.writeText(t).then(() => alert('Kopiert.'), () => alert('Kopieren nicht möglich.'));
    $('#g-print').onclick = () => window.print();
  }

  // ---------- Projekt & Daten ----------

  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function renderEinstellungen() {
    const s = state.settings;
    const inp = (k, label, type, extra) => `<label class="f"><span>${label}</span><input data-s="${k}" type="${type || 'text'}" value="${esc(s[k] ?? '')}" ${extra || ''}></label>`;
    $('#view-einstellungen').innerHTML = `
      <h2>Projekt &amp; Daten</h2>
      <div class="card">
        <h3>Projekt</h3>
        <div class="fields">
          ${inp('vorhaben', 'Vorhaben')}
          ${inp('auftraggeber', 'Auftraggeber')}
          ${inp('auftragssumme', 'Ursprüngliche Auftragssumme (€ netto, ohne Nachträge)', 'number', 'step="0.01"')}
          ${inp('auftragssummeQuelle', 'Quelle der Auftragssumme (Dokument, Datum)')}
          ${inp('warnschwelle', 'Warnschwelle Nachtragsvolumen (% der Auftragssumme, optional)', 'number', 'step="0.1"')}
          ${inp('vertragsbedingungen', 'Besondere / Zusätzliche Vertragsbedingungen (Dokument)')}
          ${inp('bearbeiter', 'Mein Name / Kürzel (für „Geändert von“)')}
        </div>
        <p class="muted">Ohne Auftragssumme keine Prozentwerte. Eine Warnschwelle nur nach Vorgabe eintragen; die rechtliche Relevanz klärt die Rechtsabteilung.</p>
      </div>
      <div class="card">
        <h3>Import</h3>
        <p>CSV im Spaltenformat der Nachtragsliste (Excel: „Speichern unter → CSV UTF-8“) oder JSON-Sicherung dieser App. Spalten werden über die Überschrift zugeordnet, Formelspalten ignoriert.</p>
        <div class="toolbar">
          <input type="file" id="d-file" accept=".csv,.json,text/csv,application/json" style="max-width:340px">
          <label class="toggle"><input type="checkbox" id="d-ersetzen"> Bestand ersetzen (sonst nach Nr. zusammenführen)</label>
        </div>
      </div>
      <div class="card">
        <h3>Export</h3>
        <div class="toolbar">
          <button id="d-csv">Nachtragsliste CSV (intern, vollständig)</button>
          <button id="d-csv-ext">Aufstellung für den AG (CSV, ohne interne Felder)</button>
          <button id="d-json">JSON-Sicherung</button>
        </div>
        <p class="muted">Die interne CSV enthält Strategievermerke und Vorab-Bewertungen und darf nicht an den AG. Die AG-Aufstellung lässt Strategievermerk, Vorab-Bewertung, Bewertungsbasis und Herleitung weg und ist ein Entwurf zur Freigabe.</p>
      </div>
      <div class="card">
        <h3>Daten in diesem Browser</h3>
        <div class="toolbar">
          <button id="d-beispiel">Beispiel-Nachtrag laden</button>
          <button id="d-leeren" class="danger">Alle Daten in diesem Browser löschen</button>
        </div>
        <p class="muted">Der Beispiel-Nachtrag hat die Nr. BEISPIEL und zählt nicht in der Übersicht. Er ist frei erfunden.</p>
      </div>`;

    document.querySelectorAll('[data-s]').forEach((el) => {
      el.onchange = () => {
        const v = el.value.trim();
        s[el.dataset.s] = el.type === 'number' && v !== '' ? Number(v) : v;
        save(); $('#kopf-vorhaben').textContent = [s.vorhaben, s.auftraggeber].filter(Boolean).join(' · ');
      };
    });

    $('#d-file').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const text = await file.text();
      let rows = []; let info = '';
      try {
        if (file.name.toLowerCase().endsWith('.json')) {
          const data = JSON.parse(text);
          rows = data.rows || [];
          if (data.settings && confirm('Projektangaben aus der Sicherung übernehmen?')) state.settings = data.settings;
        } else {
          const res = NM.fromCSV(text);
          rows = res.rows;
          if (res.unbekannt.length) info = `\nNicht zugeordnete Spalten (ignoriert): ${res.unbekannt.slice(0, 12).join(', ')}${res.unbekannt.length > 12 ? ' …' : ''}`;
        }
      } catch (err) { alert('Datei nicht lesbar: ' + err.message); return; }
      const ersetzen = $('#d-ersetzen').checked;
      if (!confirm(`${rows.length} Nachträge gefunden. ${ersetzen ? 'Bestand ersetzen' : 'Nach Nr. zusammenführen'}?${info}`)) return;
      if (ersetzen) state.rows = rows;
      else rows.forEach((r) => {
        const i = state.rows.findIndex((x) => String(x.nr) === String(r.nr));
        if (i === -1) state.rows.push(r); else state.rows[i] = Object.assign({}, state.rows[i], r);
      });
      save(); show('liste');
    };

    const stamp = () => today();
    $('#d-csv').onclick = () => download(`nachtragsliste-${stamp()}.csv`, NM.toCSV(state.rows), 'text/csv;charset=utf-8');
    $('#d-csv-ext').onclick = () => {
      const rows = state.rows.filter((r) => !NM.isExample(r)).map(NM.externalRow);
      download(`nachtraege-aufstellung-ag-ENTWURF-${stamp()}.csv`, NM.toCSV(rows, NM.EXTERNAL_KEYS), 'text/csv;charset=utf-8');
    };
    $('#d-json').onclick = () => download(`nachtragsmanagement-sicherung-${stamp()}.json`, JSON.stringify(state, null, 2), 'application/json');
    $('#d-beispiel').onclick = () => {
      if (state.rows.some(NM.isExample)) { alert('Beispiel ist schon vorhanden.'); return; }
      state.rows.push(Object.assign(NM.emptyRow(), {
        nr: 'BEISPIEL', vorhaben: 'Streckenerneuerung Musterstrecke (Beispiel)',
        kurzbeschreibung: 'Zusätzlicher Bodenaustausch km 12,4–12,9 wegen Schadstoffbefund',
        grundlage: '§ 2 Abs. 6 VOB/B (zusätzliche Leistung)', anordnung: 'AG-Bauüberwachung, Aktennotiz vom 21.09.2026',
        ausfuehrungsbeginn: '2026-12-07', angekuendigtAm: '2026-09-25', angebotGeplant: '2026-11-27',
        vorabBewertung: 48500, bewertungsbasis: 'Grobschätzung',
        herleitung: 'ca. 1.250 m³ × 38,80 €/m³ (Annahme: Einheitspreis angelehnt an Urkalkulation, Menge geschätzt); Entsorgung nicht enthalten',
        bewertungVom: '2026-09-25', status: 'Angekündigt',
        baustoffe: 'Ersatzboden Körnung 0/45, Lieferant Muster GmbH (Beispiel)', regelwerk: 'laut Vertrag / LV-Vorbemerkungen prüfen (Beispiel, keine Vorgabe)',
        strategie: 'Bündelung mit Nachtrag Entwässerung; vor Abschlagsrechnung 12/2026 einreichen',
        naechsterSchritt: 'Mengenermittlung ergänzen, Angebot vorbereiten', verantwortlich: 'Bauleitung',
        letzteReaktion: 'AG-Bauüberwachung fordert Nachweis Schadstoffgutachten (Mail vom 24.09.2026)',
        nachfassenAm: '2026-10-06', ergaenzungsbedarf: 'Laborgutachten, Mengenermittlung km 12,4–12,9',
        geaendertVon: 'Beispiel', geaendertAm: '2026-09-29',
      }));
      save(); show('liste');
    };
    $('#d-leeren').onclick = () => {
      if (!confirm('Alle Nachträge und Projektangaben in diesem Browser löschen? Vorher exportieren. Die Excel-Nachtragsliste bleibt unberührt.')) return;
      if (!confirm('Wirklich löschen?')) return;
      state = { settings: { auftraggeber: 'DB InfraGO AG' }, rows: [] };
      save(); render();
    };
  }

  show(view);
})();
