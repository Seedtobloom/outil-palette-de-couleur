/**
 * Mémoire locale : retrouver son travail en revenant sur l'outil.
 *
 * Tout reste dans le navigateur — aucune donnée ne part sur un serveur.
 * Le partage de palette, lui, est explicite et passe par un bouton.
 *
 * Trois précautions :
 *
 * 1. la clé est VERSIONNÉE. Le jour où la forme du nuancier change, une
 *    sauvegarde ancienne est ignorée plutôt que relue de travers ;
 * 2. la relecture est défensive champ par champ. Un `localStorage`
 *    bricolé à la main, une extension curieuse, une version future : rien
 *    de tout cela ne doit pouvoir faire planter l'ouverture ;
 * 3. un lien de partage (`?p=…`) l'emporte sur la sauvegarde locale.
 *    Quelqu'un qui ouvre un lien veut voir CETTE palette, pas la sienne.
 */
import { settings, type PaletteEntry } from './state.svelte';
import { parcours } from './parcours.svelte';
import { theme, type ModeTheme } from './theme.svelte';

const CLE = 'nuancier.atelier.v1';

type Sauvegarde = {
  version: 1;
  quand: string;
  reglages: Record<string, unknown>;
  etape: number;
  maxAtteint: number;
  theme: ModeTheme;
};

/** Un hex acceptable — on ne réinjecte pas n'importe quoi dans le moteur. */
const HEX = /^#[0-9a-fA-F]{6}$/;

function couleursValides(brut: unknown): PaletteEntry[] | null {
  if (!Array.isArray(brut)) return null;
  const out: PaletteEntry[] = [];
  for (const e of brut) {
    if (typeof e !== 'object' || e === null) continue;
    const { id, hex, label, verrou } = e as Record<string, unknown>;
    if (typeof id !== 'string' || typeof hex !== 'string' || !HEX.test(hex)) continue;
    out.push({
      id,
      hex,
      label: typeof label === 'string' ? label : 'Couleur',
      verrou: verrou === true,
    });
  }
  return out;
}

export function sauvegarde(): void {
  try {
    const charge: Sauvegarde = {
      version: 1,
      quand: new Date().toISOString(),
      // `settings` est un objet réactif : JSON.stringify lit au travers
      // du proxy, ce qui évite d'avoir à le déproxifier d'abord.
      reglages: settings as unknown as Record<string, unknown>,
      etape: parcours.index,
      maxAtteint: parcours.maxAtteint,
      theme: theme.mode,
    };
    localStorage.setItem(CLE, JSON.stringify(charge));
  } catch {
    // Navigation privée, quota plein, stockage refusé : on continue sans
    // mémoire plutôt que d'interrompre le travail en cours.
  }
}

/** Vrai si une séance précédente a été retrouvée et rechargée. */
export function restaure(): boolean {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return false;
    const charge = JSON.parse(brut) as Partial<Sauvegarde>;
    if (charge.version !== 1 || typeof charge.reglages !== 'object' || !charge.reglages) {
      return false;
    }

    const reglages = charge.reglages as Record<string, unknown>;
    const couleurs = couleursValides(reglages.colors);
    // On ne recopie que les clés qu'on connaît déjà : une sauvegarde
    // ancienne ne doit pas pouvoir injecter un champ inattendu.
    for (const cle of Object.keys(settings) as (keyof typeof settings)[]) {
      if (cle === 'colors') continue;
      const valeur = reglages[cle];
      if (valeur === undefined) continue;
      if (typeof valeur !== typeof settings[cle]) continue;
      (settings as Record<string, unknown>)[cle] = valeur;
    }
    if (couleurs) settings.colors = couleurs;

    if (typeof charge.theme === 'string' && ['clair', 'sombre', 'auto'].includes(charge.theme)) {
      theme.mode = charge.theme;
    }
    if (typeof charge.maxAtteint === 'number') {
      parcours.maxAtteint = Math.max(0, Math.floor(charge.maxAtteint));
    }
    if (typeof charge.etape === 'number') {
      parcours.va(Math.max(0, Math.floor(charge.etape)));
    }
    return (couleurs?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

export function efface(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* rien à faire */
  }
}
