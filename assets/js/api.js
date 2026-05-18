/** GAS proxy client — API key is secured server-side, never exposed in frontend. */
const GAS_URL = 'https://script.google.com/macros/s/AKfycbziWhpEWrDo-nhMvRYkM8ldYQT5tJRCDlTTVlw_08djgkYCNCcAYAGMK4s4gLyygHIR/exec';

export async function analyserDossierViaGAS(payload, signal) {
  console.log('[API] Envoi à GAS avec:', payload);

  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action:       'analyse_dossier',
      pays:         payload.pays         || '',
      motif:        payload.motif        || '',
      profession:   payload.profession   || '',
      documents:    payload.documents    || [],
      informations: payload.informations || '',
    }),
    signal,
  });

  console.log('[API] Statut réponse GAS:', response.status);

  if (!response.ok) throw new Error('Erreur réseau : ' + response.status);

  const json = await response.json();
  console.log('[API] Réponse GAS brute:', json);

  if (!json.ok) throw new Error(json.error || 'Erreur GAS');

  return json.data;
  // Retourne : { score, verdict, points_forts, points_faibles,
  //              recommandations, delai_conseille, analyse_at }
}
