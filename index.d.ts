declare module "moleculer-telnet" {
  import { TMoleculerTCPSettings } from "moleculer-tcp";
  import { Service } from "moleculer";

  /**
   * The COMMANDS object is a map of the Telnet commands that are supported by the Moleculer Telnet service. The keys are
   * the name of the command and the values are the command codes.
   */
  interface ICOMMANDS {
    SE: 240;
    NOP: 241;
    AYT: 246;
    SB: 250;
    WILL: 251;
    WONT: 252;
    DO: 253;
    DONT: 254;
    IAC: 255;
    IS: 0;
    SEND: 1;
    INFO: 2;
    REJECTED: 3;
    REQUEST: 1;
    SPACE: 32;
    ACCEPTED: 2;
  }

  export const COMMANDS: ICOMMANDS;

  /**
   * The OPTIONS object is a map of the Telnet options that are supported by the Moleculer Telnet service. The keys are the
   * name of the option and the values are the option codes.
   */
  interface IOPTIONS {
    ECHO: 1;
    SUPPRESS_GO_AHEAD: 3;
    NAWS: 31;
    CHARSET: 42;
    TTYPE: 24;
  }

  export const OPTIONS: IOPTIONS;

  /**
   * The Moleculer Telnet service settings.
   */
  export interface TMoleculerTelnetSettings extends TMoleculerTCPSettings {
    /**
     * Enable the TTYPE telnet option. Defaults to `null`
     */
    ttype?: boolean;

    /**
     * Enable the CHARSET telnet option. Defaults to `null`
     */
    charset?: boolean;
  }

  /**
   * A TelnetOptionHandler is a class that handles a specific Telnet option. The TelnetOptionHandler class is responsible
   * for sending the appropriate Telnet commands to the client in response to the client's Telnet commands.
   */
  export class TelnetOptionHandler {
    /**
     * Returns true if this class handles the specified Telnet option.
     * @param sequence the sequence of Telnet commands that were received from the client.
     */
    match(sequence: Buffer): boolean;

    /**
     * Handles the specified Telnet option if it was matched by the `match` method.
     * @param id the ID of the Telnet connection.
     * @param service the Moleculer Telnet service.
     * @param sequence the sequence of Telnet commands that were received from the client.
     */
    async handle(id: string, service: Service, sequence: Buffer): Promise<void>;
  }

  /**
   * The parameters used for the Telnet connection callbacks.
   */
  export type { ISocketActionParams } from "moleculer-tcp";

  /**
   * The parameters for the `socketWrite` action.
   */
  export type { IWriteActionParams } from "moleculer-tcp";

  /**
   * The parameters for the `mergeMetadata` action.
   */
  export type { IMergeMetadataActionParams } from "moleculer-tcp";

  /**
   * The parameters for the `setMetadata` action.
   */
  export type { ISetMetadataActionParams } from "moleculer-tcp";

  /**
   * The `getMetadata` action parameters.
   */
  export type { IGetMetadataActionParams } from "moleculer-tcp";

  /**
   * The parameters for the `getAllMetadata` action.
   */
  export type { IGetAllMetadataActionParams } from "moleculer-tcp";

  /**
   * The parameters for the `deleteMetadata` action.
   */
  export type { IDeleteMetadataActionParams } from "moleculer-tcp";

  /**
   * The parameters for the `onSocketData` action.
   */
  export type { IOnSocketDataActionParams } from "moleculer-tcp";

  export class MoleculerTelnet<
    S extends TMoleculerTelnetSettings
  > extends Service<S> {}
}
