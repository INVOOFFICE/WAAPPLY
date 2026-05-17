/** Visa chance evaluator: entry point, GAS‑powered analysis, and result rendering. */
import { analyserDossierViaGAS } from './api.js';
import { svgBag, svgCoin, svgStamp, svgBank, svgPin } from './icons.js';

const SIT_LABELS = {
  cdi:'CDI', cdd:'CDD', independant:'Indépendant', etudiant:'Étudiant',
  retraite:'Retraité', 'sans-emploi':'Sans emploi'
};
const ICONS = [svgBag, svgCoin, svgStamp, svgBank, svgPin];

const COUNTRY = {
  france: { name:'France', rate:68, base:6, eurDay:50, minBal:30000, delay:'15-30 jours ouvrés', center:'VFS Global (Casablanca/Rabat)', specifics:['Réservation hôtel NON remboursable exigée (Airbnb refusé depuis janv 2025)','Lettre de motivation obligatoire pour les primo-demandeurs'] },
  espagne: { name:'Espagne', rate:72, base:8, eurDay:50, minBal:20000, delay:'10-15 jours ouvrés (récemment réduit à Rabat)', center:'BLS International (Casablanca, Rabat, Marrakech, Fès, Tanger)', specifics:['Extrait bancaire des 3 derniers mois obligatoire','Réservation hôtel confirmée ou invitation notariée si hébergé'] },
  italie: { name:'Italie', rate:74, base:9, eurDay:50, minBal:25000, delay:'15-20 jours ouvrés', center:'VFS Global', specifics:['Nouveau formulaire harmonisé UE en vigueur depuis 2025','Attestation d\'hébergement ou réservation confirmée exigée'] },
  allemagne: { name:'Allemagne', rate:70, base:7, eurDay:50, minBal:28000, delay:'10-20 jours ouvrés', center:'VFS Global', specifics:['Très rigoureux sur les justificatifs financiers','RDV difficiles — prévoir 6 à 8 semaines à l\'avance','Lettre d\'invitation très scrutée si hébergé'] },
  portugal: { name:'Portugal', rate:76, base:10, eurDay:50, minBal:20000, delay:'10-15 jours ouvrés', center:'VFS Global (nouveaux créneaux Casablanca 2025)', specifics:['Le plus accessible pour les Marocains en 2025','Peu de refus sur les primo-demandeurs'] },
  'pays-bas': { name:'Pays-Bas', rate:65, base:4, eurDay:50, minBal:28000, delay:'15-20 jours ouvrés', center:'VFS Global', specifics:['Dossier financier très scruté','Extrait bancaire 6 mois recommandé'] },
  autre: { name:'Ce pays', rate:68, base:5, eurDay:50, minBal:25000, delay:'15-30 jours ouvrés', center:'le centre de dépôt habilité', specifics:[] }
};

function validerFormulaire() {
  const fields = [
    { id:'pays',         label:'Pays de destination' },
    { id:'type-visa',    label:'Type de visa' },
    { id:'situation',    label:'Situation professionnelle' },
    { id:'revenu',       label:'Revenu mensuel' },
    { id:'historique',   label:'Historique Schengen' },
    { id:'solde',        label:'Solde bancaire' },
    { id:'liens',        label:'Liens avec le Maroc' },
  ];

  let valid = true;
  document.querySelectorAll('.error-msg').forEach(e => e.remove());
  document.querySelectorAll('.field.error').forEach(e => e.classList.remove('error'));

  for (const f of fields) {
    const el = document.getElementById(f.id);
    if (!el.value) {
      el.classList.add('error');
      const wrap = el.closest('.form-group') || el.parentElement;
      const msg = document.createElement('div');
      msg.className = 'error-msg';
      msg.textContent = 'Ce champ est obligatoire';
      wrap.appendChild(msg);
      valid = false;
    }
  }
  return valid;
}

export async function calculer() {
  if (!validerFormulaire()) {
    const btn = document.querySelector('.eval-actions .btn-gold');
    btn.style.animation = 'shake .4s ease';
    setTimeout(() => btn.style.animation = '', 400);
    return;
  }

  const pays     = document.getElementById('pays').value;
  const typeVisa = document.getElementById('type-visa').value;
  const sit      = document.getElementById('situation').value;
  const revenu   = parseInt(document.getElementById('revenu').value) || 0;
  const hist     = document.getElementById('historique').value;
  const solde    = parseInt(document.getElementById('solde').value) || 0;
  const liens    = document.getElementById('liens').value;

  document.getElementById('loader').classList.add('on');

  const gasPayload = {
    pays,
    motif: typeVisa,
    profession: sit,
    documents: [],
    informations: `Revenu: ${revenu} MAD mensuel. Historique Schengen: ${hist}. Solde bancaire: ${solde} MAD. Liens avec le Maroc: ${liens}.`
  };

  const gasPromise = analyserDossierViaGAS(gasPayload)
    .then(data => gasToInternal(data))
    .catch(err => { console.warn('[Evaluator] GAS a échoué:', err); return null; });

  const timeout = new Promise(resolve => setTimeout(() => resolve('timeout'), 3000));
  const winner = await Promise.race([gasPromise, timeout]);

  const result = (winner === 'timeout')
    ? localScore({ pays, typeVisa, sit, revenu, hist, solde, liens })
    : (winner || localScore({ pays, typeVisa, sit, revenu, hist, solde, liens }));

  document.getElementById('loader').classList.remove('on');
  showResult(result);
}

/* ── Convertit la réponse GAS vers le format interne ── */
function gasToInternal(data) {
  const pct = data.score || 0;
  let verdict, vcls, barColor;
  if (pct >= 72) { verdict = data.verdict || 'Dossier solide'; vcls = 'v-high'; barColor = 'linear-gradient(90deg, #1abc9c, #2DD496)'; }
  else if (pct >= 48) { verdict = data.verdict || 'Dossier moyen'; vcls = 'v-mid'; barColor = 'linear-gradient(90deg, #e67e22, #FF8C42)'; }
  else { verdict = data.verdict || 'À renforcer'; vcls = 'v-low'; barColor = 'linear-gradient(90deg, #c0392b, #FF5A5A)'; }

  const cells = [];
  (data.points_forts || []).forEach((pf, i) => {
    cells.push({ icon: ICONS[i % ICONS.length](), label: 'Point fort ' + (i + 1), val: pf, cls: 'ok' });
  });
  (data.points_faibles || []).forEach((pf, i) => {
    cells.push({ icon: ICONS[(i + 2) % ICONS.length](), label: 'Point faible ' + (i + 1), val: pf, cls: 'bad' });
  });

  const tips = [...(data.recommandations || [])];
  if (data.delai_conseille) tips.push('Délai conseillé : ' + data.delai_conseille);

  return { pct, verdict, vcls, barColor, cells, tips };
}

function showResult(r) {
  try {
    document.getElementById('res-pct').textContent = (r.pct || 0) + '%';
    const vEl = document.getElementById('res-verdict');
    vEl.textContent = r.verdict || 'Non disponible';
    vEl.className = 'result-verdict ' + (r.vcls || 'v-low');
    document.getElementById('res-bar').style.background = r.barColor || 'linear-gradient(90deg, var(--accent), var(--accent-2))';

    document.getElementById('res-grid').innerHTML = (r.cells || []).map(c => `
      <div class="result-cell">
        <div class="cell-icon ci-${c.cls || 'mid'}">${c.icon || svgBag()}</div>
        <div class="cell-info">
          <div class="cell-label">${c.label || ''}</div>
          <div class="cell-value cv-${c.cls || 'mid'}">${c.val || ''}</div>
        </div>
      </div>
    `).join('');

    document.getElementById('res-tips').innerHTML = (r.tips || ['Aucun conseil disponible']).map((t, i) => `
      <div class="tip-row"><span class="tip-num">${i + 1}</span><span>${t}</span></div>
    `).join('');

    const el = document.getElementById('result');
    el.style.display = 'block';
    setTimeout(() => { document.getElementById('res-bar').style.width = (r.pct || 0) + '%'; }, 80);
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) {
    console.error('[Evaluator] Erreur affichage:', e);
  }
}

/* ── Fallback local si GAS est injoignable ── */
function localScore({ pays, typeVisa: tv, sit, revenu: rev, hist, solde, liens }) {
  const c = COUNTRY[pays] || COUNTRY.autre;
  let s = c.base;
  const tips = [];
  const cells = [];
  const sitLabel = SIT_LABELS[sit] || sit;

  const sitMap = { cdi:15, retraite:12, independant:8, cdd:6, etudiant:4, 'sans-emploi':-5 };
  s += sitMap[sit] || 0;

  if (sit === 'cdi' || sit === 'retraite') {
    cells.push({ icon: svgBag(), label: 'Emploi', val: sitLabel + ' ✓', cls: 'ok' });
  } else if (sit === 'sans-emploi') {
    cells.push({ icon: svgBag(), label: 'Emploi', val: 'Sans emploi', cls: 'bad' });
    tips.push("Sans emploi : un sponsor notarié (lettre d'invitation + relevés bancaires du garant) est obligatoire. Consultez un conseiller avant dépôt.");
  } else if (sit === 'etudiant') {
    cells.push({ icon: svgBag(), label: 'Emploi', val: 'Étudiant', cls: 'mid' });
    tips.push("Étudiant : joignez lettre de l'établissement, certificat de scolarité, et justificatif du sponsor financier (parent) avec ses relevés bancaires.");
  } else if (sit === 'independant') {
    cells.push({ icon: svgBag(), label: 'Emploi', val: 'Indépendant', cls: 'mid' });
    tips.push("Indépendant : registre de commerce (RC), déclarations fiscales 2 ans, et relevés bancaires PRO + perso 6 mois. Ajoutez une lettre explicative sur votre activité.");
  } else if (sit === 'cdd') {
    cells.push({ icon: svgBag(), label: 'Emploi', val: 'CDD', cls: 'mid' });
    tips.push("CDD : joignez votre contrat de travail + 3 derniers bulletins de paie + attestation employeur récente (moins de 3 mois).");
  }

  if (rev >= 15000) { s += 15; cells.push({ icon: svgCoin(), label: 'Revenus', val: rev.toLocaleString() + ' MAD', cls: 'ok' }); }
  else if (rev >= 8000) { s += 10; cells.push({ icon: svgCoin(), label: 'Revenus', val: rev.toLocaleString() + ' MAD', cls: 'mid' }); tips.push("Revenus corrects. Pour un dossier solide, visez 15 000 MAD/mois. Joignez 6 mois de relevés bancaires."); }
  else if (rev >= 6000) { s += 5; cells.push({ icon: svgCoin(), label: 'Revenus', val: rev.toLocaleString() + ' MAD', cls: 'mid' }); tips.push("Revenus minimum. Renforcez avec 6 mois de relevés et un solde d'épargne confortable."); }
  else if (rev > 0) { s += 0; cells.push({ icon: svgCoin(), label: 'Revenus', val: rev.toLocaleString() + ' MAD', cls: 'bad' }); tips.push("Revenus sous le seuil de crédibilité. Envisagez un garant ou sponsor."); }
  else { cells.push({ icon: svgCoin(), label: 'Revenus', val: 'Non renseigné', cls: 'bad' }); tips.push("Revenus non renseignés : indiquez toutes vos sources."); }

  if (hist === 'oui-ok') { s += 18; cells.push({ icon: svgStamp(), label: 'Historique', val: 'Positif ✓', cls: 'ok' }); }
  else if (hist === 'non') { s += 5; cells.push({ icon: svgStamp(), label: 'Historique', val: 'Premier visa', cls: 'mid' }); tips.push("Primo-demandeur : constituez un dossier exemplaire avec une lettre de motivation très détaillée."); tips.push("Assurance voyage 30 000€ minimum OBLIGATOIRE."); }
  else { s -= 20; cells.push({ icon: svgStamp(), label: 'Historique', val: 'Refus antérieur', cls: 'bad' }); tips.push("Refus antérieur : mentionnez-LE. Adressez les motifs explicitement dans votre lettre."); tips.push("Attendez 3 à 6 mois minimum avant de redéposer."); }

  const minReq = c.minBal;
  if (solde >= minReq) { s += 12; cells.push({ icon: svgBank(), label: 'Solde bancaire', val: solde.toLocaleString() + ' MAD', cls: 'ok' }); }
  else if (solde >= 5000) { s += 6; cells.push({ icon: svgBank(), label: 'Solde bancaire', val: solde.toLocaleString() + ' MAD', cls: 'mid' }); tips.push(`Solde sous le recommandé pour ${c.name} (${minReq.toLocaleString()} MAD). Fournissez 6 mois d'historique.`); }
  else { cells.push({ icon: svgBank(), label: 'Solde bancaire', val: solde.toLocaleString() + ' MAD', cls: 'bad' }); tips.push(`Solde insuffisant. Pour ${c.name} : seuil recommandé ${minReq.toLocaleString()} MAD.`); }

  if (liens === 'forts') { s += 15; cells.push({ icon: svgPin(), label: 'Liens Maroc', val: 'Forts ✓', cls: 'ok' }); }
  else if (liens === 'moyens') { s += 8; cells.push({ icon: svgPin(), label: 'Liens Maroc', val: 'Moyens', cls: 'mid' }); tips.push("Liens moyens : renforcez avec acte de propriété, contrat de bail, acte de mariage."); }
  else if (liens === 'faibles') { s += 2; cells.push({ icon: svgPin(), label: 'Liens Maroc', val: 'Faibles', cls: 'bad' }); tips.push("Liens faibles : joignez tout justificatif d'attache."); }
  else { s -= 10; cells.push({ icon: svgPin(), label: 'Liens Maroc', val: 'Aucun lien', cls: 'bad' }); tips.push("Absence de liens : dossier très scruté. Consultez un conseiller."); }

  cells.push({ icon: svgStamp(), label: 'Pays', val: c.name + ' (' + c.rate + '%)', cls: c.rate >= 72 ? 'ok' : (c.rate >= 68 ? 'mid' : 'bad') });
  s += Math.round((c.rate - 65) * 1.2);
  tips.push(`${c.name} — délai : ${c.delay}. via ${c.center}.`);
  c.specifics.forEach(sp => tips.push(sp));
  if (tv === 'tourisme') tips.push("Assurance voyage 30 000€ obligatoire. Réservation transport + hébergement exigés.");
  tips.push("Passeport valide 3 mois après retour + 2 pages vierges. Photos 35×45mm fond blanc.");

  s = Math.min(96, Math.max(8, s));
  let verdict, vcls, barColor;
  if (s >= 72) { verdict = 'Dossier solide'; vcls = 'v-high'; barColor = 'linear-gradient(90deg, #1abc9c, #2DD496)'; }
  else if (s >= 48) { verdict = 'Dossier moyen'; vcls = 'v-mid'; barColor = 'linear-gradient(90deg, #e67e22, #FF8C42)'; }
  else { verdict = 'À renforcer'; vcls = 'v-low'; barColor = 'linear-gradient(90deg, #c0392b, #FF5A5A)'; }

  return { pct: s, verdict, vcls, barColor, cells, tips };
}
