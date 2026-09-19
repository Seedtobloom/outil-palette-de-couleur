/**
 * Thème de l'interface : clair, sombre, ou celui du système.
 *
 * ⚠ CE QUI NE BASCULE PAS — et c'est le point important.
 *
 * Dans un outil de couleur, passer toute la page en sombre change la
 * lecture des échantillons : un aplat clair paraît plus lumineux sur
 * fond noir, un aplat foncé se noie. La règle des deux zones (brief
 * §9.1) dit que tout échantillon se juge sur blanc, sans surface colorée
 * adjacente — un thème sombre qui repeindrait aussi la scène ferait
 * mentir l'outil sur ce qu'il est censé vérifier.
 *
 * Donc : le chrome s'assombrit (barre, panneaux, fond de page), la scène
 * d'évaluation reste blanche. C'est le comportement des plans de travail
 * d'Illustrator ou de Figma en interface sombre, pour exactement la même
 * raison. Le basculement est mis en œuvre par la classe `zone-evaluation`
 * dans `app.css`, qui rétablit les tokens clairs là où on juge.
 */
export type ModeTheme = 'clair' | 'sombre' | 'auto';

export const LIBELLES_THEME: Record<ModeTheme, string> = {
  clair: 'Clair',
  sombre: 'Sombre',
  auto: 'Système',
};

class Theme {
  mode = $state<ModeTheme>('auto');
  /** Ce que le système demande, quand le mode est « auto ». */
  #systemeSombre = $state(false);

  get effectif(): 'clair' | 'sombre' {
    if (this.mode === 'auto') return this.#systemeSombre ? 'sombre' : 'clair';
    return this.mode;
  }

  /** À brancher une fois au démarrage ; rend sa fonction de nettoyage. */
  ecoute(): () => void {
    if (typeof matchMedia !== 'function') return () => {};
    const mq = matchMedia('(prefers-color-scheme: dark)');
    this.#systemeSombre = mq.matches;
    const maj = (e: MediaQueryListEvent) => (this.#systemeSombre = e.matches);
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }

  /** Le bouton fait un aller-retour entre les deux modes explicites :
   *  « auto » se choisit dans l'aide, pas par un clic à l'aveugle. */
  bascule(): void {
    this.mode = this.effectif === 'sombre' ? 'clair' : 'sombre';
  }
}

export const theme = new Theme();
