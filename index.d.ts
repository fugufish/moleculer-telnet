declare module "moleculer-telnet" {
  import { TMoleculerTCPSettings } from "moleculer-tcp";
  import { Service } from "moleculer";

  /**
   * The Moleculer Telnet service settings.
   */
  export interface TMoleculerTelnetSettings extends TMoleculerTCPSettings {
    /**
     * The port that the TCP server will listen on. Defaults to `8181`
     */

    port?: number;

    /**
     * The host that the TCP server will listen on. Defaults to `127.0.0.1`
     */
    host?: string;
  }

  export default class MoleculerTCP<
    S extends TMoleculerTelnetSettings
  > extends Service<S> {}
}
