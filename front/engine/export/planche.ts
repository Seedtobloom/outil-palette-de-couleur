/**
 * Planche du nuancier, en SVG.
 *
 * C'est la pièce qu'on envoie au client ou qu'on glisse dans un dossier
 * de marque : une couleur par ligne, son nom, ses valeurs, et — c'est là
 * que cet outil se distingue — ses deux contrastes de référence, sur
 * blanc et sur noir, avec le verdict écrit en toutes lettres.
 *
 * SVG plutôt que PNG parce que la fonction reste pure et testable, que
 * le texte reste sélectionnable et que l'interface peut la rasteriser en
 * PNG si besoin. Fond blanc, aucune surface colorée adjacente aux
 * échantillons : la planche respecte la règle des deux zones (brief §9.1)
 * comme le reste de l'outil.
 */
import { formatOklch, parseToOklch } from '../color/space';
import { contrastRatio } from '../contrast/wcag';

export type EntreePlanche = { hex: string; label: string };

/**
 * Une association validée : un texte sur un fond, avec son ratio.
 *
 * C'est le livrable qui manquait. Retenir des associations à l'étape
 * Contraste demandait un vrai travail de décision — et ce travail ne
 * ressortait nulle part : il ne servait qu'à ouvrir la suite du
 * parcours. Ici, il devient la seconde moitié de la planche : « ce
 * texte sur ce fond, 8,98:1, AA ». C'est exactement la ligne qu'on
 * donne à une personne qui intègre.
 */
export type AssociationPlanche = {
  texte: { hex: string; label: string };
  fond: { hex: string; label: string };
};

const LARGEUR = 960;
const MARGE = 48;
const H_ENTETE = 124;
const H_LIGNE = 96;
const H_PIED = 64;

/** `&` et `<` dans un nom de couleur ne doivent pas casser le fichier. */
function echappe(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Tronqué vers le bas : 4,497 n'est pas 4,5, et ne passe donc pas AA. */
function ratio(a: string, b: string): string {
  return (Math.floor(contrastRatio(a, b) * 100) / 100).toFixed(2).replace('.', ',');
}

/** Le verdict en toutes lettres, seuils WCAG 2.2 SC 1.4.3. */
function verdict(valeur: number): string {
  if (valeur >= 7) return 'AAA';
  if (valeur >= 4.5) return 'AA';
  if (valeur >= 3) return 'grand texte';
  return 'décoratif';
}

const H_SECTION = 62;
const H_ASSOC = 76;

export function exportPlancheSvg(
  entrees: readonly EntreePlanche[],
  options: {
    titre?: string;
    date?: string;
    associations?: readonly AssociationPlanche[];
  } = {},
): string {
  const titre = options.titre ?? 'Nuancier';
  const date = options.date ?? new Date().toISOString().slice(0, 10);
  const associations = options.associations ?? [];
  const hauteur =
    H_ENTETE +
    entrees.length * H_LIGNE +
    (associations.length > 0 ? H_SECTION + associations.length * H_ASSOC : 0) +
    H_PIED;
  const l: string[] = [];

  l.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGEUR}" height="${hauteur}" viewBox="0 0 ${LARGEUR} ${hauteur}" font-family="Inter Tight, Inter, system-ui, sans-serif">`,
  );
  l.push(`<rect width="${LARGEUR}" height="${hauteur}" fill="#ffffff"/>`);

  // En-tête
  l.push(
    `<text x="${MARGE}" y="66" font-family="Alegreya, Georgia, serif" font-size="34" fill="#1c1205">${echappe(titre)}</text>`,
  );
  l.push(
    `<text x="${MARGE}" y="92" font-size="13" fill="#6b6259">${entrees.length} couleur${entrees.length > 1 ? 's' : ''} · ${echappe(date)} · contrastes WCAG 2.2</text>`,
  );
  l.push(
    `<line x1="${MARGE}" y1="${H_ENTETE - 12}" x2="${LARGEUR - MARGE}" y2="${H_ENTETE - 12}" stroke="#e5e0d8" stroke-width="1"/>`,
  );

  entrees.forEach((e, i) => {
    const y = H_ENTETE + i * H_LIGNE;
    const oklch = parseToOklch(e.hex);
    const surBlanc = contrastRatio(e.hex, '#ffffff');
    const surNoir = contrastRatio(e.hex, '#000000');

    // Échantillon : un filet gris, jamais une ombre — une ombre
    // fausserait la lecture du bord de l'aplat.
    l.push(
      `<rect x="${MARGE}" y="${y}" width="72" height="72" rx="10" fill="${echappe(e.hex)}" stroke="#d9d3ca" stroke-width="1"/>`,
    );
    l.push(
      `<text x="${MARGE + 92}" y="${y + 26}" font-size="17" font-weight="500" fill="#1c1205">${echappe(e.label)}</text>`,
    );
    l.push(
      `<text x="${MARGE + 92}" y="${y + 48}" font-size="13" fill="#6b6259" letter-spacing="0.4">${echappe(e.hex.toUpperCase())}</text>`,
    );
    if (oklch) {
      l.push(
        `<text x="${MARGE + 92}" y="${y + 68}" font-size="12" fill="#8a8178">${echappe(formatOklch(oklch))}</text>`,
      );
    }
    // Colonne des contrastes, alignée à droite.
    const xc = LARGEUR - MARGE;
    l.push(
      `<text x="${xc}" y="${y + 30}" font-size="13" fill="#1c1205" text-anchor="end">sur blanc ${ratio(e.hex, '#ffffff')}:1 · ${verdict(surBlanc)}</text>`,
    );
    l.push(
      `<text x="${xc}" y="${y + 52}" font-size="13" fill="#1c1205" text-anchor="end">sur noir ${ratio(e.hex, '#000000')}:1 · ${verdict(surNoir)}</text>`,
    );
    l.push(
      `<line x1="${MARGE}" y1="${y + 84}" x2="${xc}" y2="${y + 84}" stroke="#f0ece5" stroke-width="1"/>`,
    );
  });

  // — Les associations validées —
  if (associations.length > 0) {
    const y0 = H_ENTETE + entrees.length * H_LIGNE;
    l.push(
      `<text x="${MARGE}" y="${y0 + 28}" font-family="Alegreya, Georgia, serif" font-size="20" fill="#1c1205">Associations validées</text>`,
    );
    l.push(
      `<text x="${MARGE}" y="${y0 + 48}" font-size="12" fill="#6b6259">Les duos texte / fond retenus, avec leur contraste mesuré.</text>`,
    );

    associations.forEach((a, i) => {
      const y = y0 + H_SECTION + i * H_ASSOC;
      // ⚠ Surtout pas `ratio` : ce nom est déjà celui de la fonction de
      // formatage du module, et la variable la masquerait.
      const valeur = contrastRatio(a.texte.hex, a.fond.hex);
      const large = LARGEUR - MARGE * 2;

      // Le duo est rendu en conditions réelles : c'est la seule façon
      // de vérifier d'un coup d'œil que la ligne dit vrai.
      l.push(
        `<rect x="${MARGE}" y="${y}" width="${Math.round(large * 0.55)}" height="56" rx="10" fill="${echappe(a.fond.hex)}" stroke="#d9d3ca" stroke-width="1"/>`,
      );
      l.push(
        `<text x="${MARGE + 16}" y="${y + 25}" font-size="16" font-weight="600" fill="${echappe(a.texte.hex)}">Titre lisible</text>`,
      );
      l.push(
        `<text x="${MARGE + 16}" y="${y + 44}" font-size="12" fill="${echappe(a.texte.hex)}">Exemple de texte courant sur ce fond.</text>`,
      );

      const xd = MARGE + Math.round(large * 0.55) + 20;
      l.push(
        `<text x="${xd}" y="${y + 22}" font-size="13" fill="#1c1205">${echappe(a.texte.label)} sur ${echappe(a.fond.label)}</text>`,
      );
      l.push(
        `<text x="${xd}" y="${y + 42}" font-size="12" fill="#6b6259" letter-spacing="0.3">${echappe(a.texte.hex.toUpperCase())} · ${echappe(a.fond.hex.toUpperCase())}</text>`,
      );
      l.push(
        `<text x="${LARGEUR - MARGE}" y="${y + 32}" font-size="15" font-weight="600" fill="#1c1205" text-anchor="end">${ratio(a.texte.hex, a.fond.hex)}:1 · ${verdict(valeur)}</text>`,
      );
    });
  }

  l.push(
    `<text x="${MARGE}" y="${hauteur - 26}" font-size="11" fill="#8a8178">Vérification des critères d’accessibilité liés à la couleur (WCAG 2.2). Ne constitue pas un audit complet.</text>`,
  );
  l.push('</svg>');
  return l.join('\n');
}
