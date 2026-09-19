/**
 * Export ASE — Adobe Swatch Exchange.
 *
 * C'est le format qui compte vraiment pour une graphiste : un double-clic
 * et le nuancier apparaît dans Illustrator, InDesign et Photoshop, avec
 * les noms qu'elle a donnés. Aucune des alternatives (copier des hex un
 * par un, capture d'écran de la planche) ne fait ça.
 *
 * Le format n'est pas documenté officiellement par Adobe ; il est stable
 * et connu depuis CS2. Structure :
 *
 *   'ASEF'              signature, 4 octets
 *   u16 u16             version majeure = 1, mineure = 0
 *   u32                 nombre de blocs
 *   [blocs]
 *
 * Un bloc de couleur :
 *
 *   u16 = 0x0001        type « entrée de couleur »
 *   u32                 longueur des données qui suivent
 *   u16                 longueur du nom, en unités UTF-16, terminateur compris
 *   UTF-16BE            le nom, terminé par un caractère nul
 *   'RGB '              modèle colorimétrique, 4 octets
 *   f32 f32 f32         composantes 0–1, big-endian
 *   u16 = 2             « normal » (0 = global, 1 = ton direct)
 *
 * Tout est BIG-ENDIAN, y compris les flottants et l'UTF-16 — c'est le
 * piège classique de ce format.
 *
 * ⚠ Les valeurs écrites sont les composantes sRGB de la couleur. Adobe
 * les interprétera dans l'espace de travail du document : le nuancier est
 * exact en RVB, et une conversion CMJN reste soumise au profil ICC du
 * document (même réserve que l'estimation d'encrage, brief §8).
 */
import { hexToRgb255 } from '../color/space';

const TYPE_COULEUR = 0x0001;
const TYPE_GROUPE_DEBUT = 0xc001;
const TYPE_GROUPE_FIN = 0xc002;
/** 0 = global, 1 = ton direct, 2 = normal. */
const COULEUR_NORMALE = 2;

/** Octets d'un nom : longueur UTF-16 (nul compris) + le nom en UTF-16BE. */
function nomEnOctets(nom: string): Uint8Array {
  // Le nom est codé en unités UTF-16 : un emoji compte pour deux. On
  // passe donc par la chaîne telle quelle, sans compter les points de code.
  const unites = nom.length + 1; // + terminateur nul
  const out = new Uint8Array(2 + unites * 2);
  const vue = new DataView(out.buffer);
  vue.setUint16(0, unites, false);
  for (let i = 0; i < nom.length; i++) {
    vue.setUint16(2 + i * 2, nom.charCodeAt(i), false);
  }
  vue.setUint16(2 + nom.length * 2, 0, false); // terminateur
  return out;
}

function blocCouleur(nom: string, hex: string): Uint8Array {
  const octetsNom = nomEnOctets(nom);
  // Une couleur illisible est exportée en noir plutôt que de faire
  // échouer tout le fichier : la graphiste verra le problème dans
  // Illustrator, elle ne perdra pas les trente autres couleurs.
  const [r, g, b] = hexToRgb255(hex) ?? [0, 0, 0];
  const tailleDonnees = octetsNom.length + 4 + 12 + 2;
  const out = new Uint8Array(6 + tailleDonnees);
  const vue = new DataView(out.buffer);
  vue.setUint16(0, TYPE_COULEUR, false);
  vue.setUint32(2, tailleDonnees, false);
  out.set(octetsNom, 6);
  let p = 6 + octetsNom.length;
  out.set([0x52, 0x47, 0x42, 0x20], p); // 'RGB '
  p += 4;
  vue.setFloat32(p, r / 255, false);
  vue.setFloat32(p + 4, g / 255, false);
  vue.setFloat32(p + 8, b / 255, false);
  vue.setUint16(p + 12, COULEUR_NORMALE, false);
  return out;
}

function blocGroupeDebut(nom: string): Uint8Array {
  const octetsNom = nomEnOctets(nom);
  const out = new Uint8Array(6 + octetsNom.length);
  const vue = new DataView(out.buffer);
  vue.setUint16(0, TYPE_GROUPE_DEBUT, false);
  vue.setUint32(2, octetsNom.length, false);
  out.set(octetsNom, 6);
  return out;
}

function blocGroupeFin(): Uint8Array {
  const out = new Uint8Array(6);
  new DataView(out.buffer).setUint16(0, TYPE_GROUPE_FIN, false);
  return out;
}

/**
 * Construit le fichier. Les couleurs sont rangées dans un groupe portant
 * le nom de la palette : c'est ce qui les fait arriver ensemble dans le
 * panneau Nuancier d'Illustrator au lieu de se disperser parmi celles du
 * document.
 */
export function exportAse(
  entrees: readonly { hex: string; label: string }[],
  nomPalette = 'Nuancier',
  // Le tampon est annoncé comme un ArrayBuffer simple : sans ça, le type
  // rendu reste `ArrayBufferLike` et n'est pas accepté par `Blob`.
): Uint8Array<ArrayBuffer> {
  const blocs: Uint8Array[] = [blocGroupeDebut(nomPalette)];
  for (const e of entrees) blocs.push(blocCouleur(e.label || 'Sans nom', e.hex));
  blocs.push(blocGroupeFin());

  const taille = 12 + blocs.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(taille);
  const vue = new DataView(out.buffer);
  out.set([0x41, 0x53, 0x45, 0x46], 0); // 'ASEF'
  vue.setUint16(4, 1, false);
  vue.setUint16(6, 0, false);
  vue.setUint32(8, blocs.length, false);
  let p = 12;
  for (const b of blocs) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}
