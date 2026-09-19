/**
 * Le Worker Cloudflare de Nuancier.
 *
 * Il ne fait plus qu'une chose : servir l'application. Il a porté une
 * petite API de partage de palettes (sauvegarde d'une recette dans KV,
 * relecture par identifiant) ; les liens de partage ont été retirés de
 * l'outil, et l'API avec eux.
 *
 * Tout le calcul colorimétrique a toujours vécu dans le navigateur :
 * rien de ce que la graphiste manipule ne transite par ce Worker, et
 * aucune donnée n'est stockée côté serveur.
 */
export interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
