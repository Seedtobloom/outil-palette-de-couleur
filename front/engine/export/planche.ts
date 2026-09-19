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

export function exportPlancheSvg(
  entrees: readonly EntreePlanche[],
  options: { titre?: string; date?: string } = {},
): string {
  const titre = options.titre ?? 'Nuancier';
  const date = options.date ?? new Date().toISOString().slice(0, 10);
  const hauteur = H_ENTETE + entrees.length * H_LIGNE + H_PIED;
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

  l.push(
    `<text x="${MARGE}" y="${hauteur - 26}" font-size="11" fill="#8a8178">Vérification des critères d’accessibilité liés à la couleur (WCAG 2.2). Ne constitue pas un audit complet.</text>`,
  );
  l.push('</svg>');
  return l.join('\n');
}
