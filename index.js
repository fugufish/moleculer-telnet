const { Errors } = require("moleculer");
const MoleculerTCP = require("moleculer-tcp");

const COMMANDS = {
  SE: 240, // end of subnegotiation parameters
  NOP: 241, // no operation
  AYT: 246, // are you there?
  SB: 250, // subnegotiation
  WILL: 251, // will
  WONT: 252, // wont
  DO: 253, // do
  DONT: 254, // dont
  IAC: 255,
  IS: 0,
  SEND: 1,
  INFO: 2,
  REJECTED: 3,
  REQUEST: 1,
  SPACE: 32,
  ACCEPTED: 2,
};

const OPTIONS = {
  ECHO: 1, // http://tools.ietf.org/html/rfc857
  SUPPRESS_GO_AHEAD: 3, // http://tools.ietf.org/html/rfc858
  NAWS: 31, // http://tools.ietf.org/html/rfc1073
  CHARSET: 42, // http://tools.ietf.org/html/rfc2066
  TTYPE: 24, // http://tools.ietf.org/html/rfc1091
};

/**
 * The TelnetOptionHandler clas is used to define how a particular telnet option is handled by the service. To add
 * custom handling for a particular option, create a new class that extends TelnetOptionHandler and override the
 * `match` method with a function that returns true if the option is supported by the handler.
 *
 * Then override the `handle` method to define how the option is handled. The `handle` method is passed the
 * `id` of the connection, the Moleculer Service Broker, the settings object, and the telnet sequence that was received
 * as a buffer.
 *
 * Existing handlers can be overridden by adding a new handler with the same class name. Handlers with differing names
 * but returning `true` for the same `match` function will be called in addition to any existing matching handlers.
 */
class TelnetOptionHandler {
  /**
   * The `match` method is used to determine if the handler supports the option that was received. The `match`
   * method is passed the telnet sequence that was received as a buffer. It should return true if the handler
   * supports the option.
   *
   * @param sequence{Buffer} The telnet sequence that was received.
   * @returns {boolean}
   */
  match(sequence) {
    return false;
  }

  /**
   * The `handle` method is used to handle the option that was received. The `handle` method is passed the `id`
   * of the connection, the Moleculer Service Broker, and the telnet sequence that was received as a buffer.
   *
   * @param id{string} The id of the connection.
   * @param service{Service} The Moleculer Service Broker.
   * @param sequence{Buffer} The telnet sequence that was received.
   * @returns {Promise<void>}
   */
  async handle(id, service, sequence) {}
}

class WillTTYPEOptionHandler extends TelnetOptionHandler {
  match(sequence) {
    return (
      sequence[0] === COMMANDS.IAC &&
      sequence[1] === COMMANDS.WILL &&
      sequence[2] === OPTIONS.TTYPE
    );
  }

  async handle(id, service, sequence) {
    await service.actions.setMetadata({
      id,
      key: "ttypeEnabled",
      value: true,
    });
    await service.broker.emit("telnet.ttype.enabled", { id });

    return service.actions.sendTelnetSequence({
      id,
      sequence: [
        COMMANDS.IAC,
        COMMANDS.SB,
        OPTIONS.TTYPE,
        COMMANDS.SEND,
        COMMANDS.IAC,
        COMMANDS.SE,
      ],
    });
  }
}

class WontTTYPEOptionHandler extends TelnetOptionHandler {
  match(sequence) {
    return sequence[0] === COMMANDS.IAC && sequence[1] === COMMANDS.WONT;
  }

  async handle(id, service, sequence) {
    const option = sequence[1];

    await service.actions.setMetadata({
      id,
      key: "ttypeEnabled",
      value: false,
    });
    await service.broker.emit("telnet.ttype.disabled", { id });
  }
}

class TTYPEOption extends TelnetOptionHandler {
  match(sequence) {
    return (
      sequence[0] === COMMANDS.IAC &&
      sequence[1] === COMMANDS.SB &&
      sequence[2] === OPTIONS.TTYPE
    );
  }

  async handle(id, service, sequence) {
    let ttype = "";

    for (let i = 3; i < sequence.length - 2; i++) {
      ttype += String.fromCharCode(sequence[i]);
    }

    ttype = ttype.slice(1, ttype.length).trim();

    await service.actions.setMetadata({ id, key: "ttype", value: ttype });

    return service.broker.emit("telnet.ttype.set", { id, ttype });
  }
}

class DoCharsetOptionHandler extends TelnetOptionHandler {
  match(sequence) {
    return (
      sequence[0] === COMMANDS.IAC &&
      sequence[1] === COMMANDS.DO &&
      sequence[2] === OPTIONS.CHARSET
    );
  }

  async handle(id, service, sequence) {
    const charset = service.settings.charset;

    return service.actions.sendTelnetSequence({
      id,
      sequence: [
        COMMANDS.IAC,
        COMMANDS.SB,
        OPTIONS.CHARSET,
        COMMANDS.REQUEST,
        COMMANDS.SPACE,
        ...Buffer.from(charset),
        COMMANDS.IAC,
        COMMANDS.SE,
      ],
    });
  }
}

class AcceptCharsetOptionHandler extends TelnetOptionHandler {
  match(sequence) {
    return (
      sequence[0] === COMMANDS.IAC &&
      sequence[1] === COMMANDS.SB &&
      sequence[2] === OPTIONS.CHARSET &&
      sequence[3] === COMMANDS.ACCEPTED
    );
  }

  async handle(id, service, sequence) {
    await service.actions.setMetadata({
      id,
      key: "charset",
      value: service.settings.charset,
    });

    return service.broker.emit("telnet.charset.set", {
      id,
      charset: service.settings.charset,
    });
  }
}

class RejectCharsetOptionHandler extends TelnetOptionHandler {
  match(sequence) {
    return (
      sequence[0] === COMMANDS.IAC &&
      sequence[1] === COMMANDS.SB &&
      sequence[2] === COMMANDS.REJECTED &&
      sequence[3] === OPTIONS.CHARSET
    );
  }

  async handle(id, service, sequence) {
    await service.actions.setMetadata({
      id,
      key: "charset",
      value: "ascii",
    });

    return service.broker.emit("telnet.charset.set", { id, charset: "ascii" });
  }
}

class DontCharsetOptionHandler extends TelnetOptionHandler {
  match(sequence) {
    return (
      sequence[0] === COMMANDS.IAC &&
      sequence[1] === COMMANDS.DONT &&
      sequence[2] === OPTIONS.CHARSET
    );
  }

  async handle(id, service, sequence) {
    const option = sequence[1];

    await service.actions.setMetadata({
      id,
      key: "charset",
      value: "ascii",
    });
  }
}

class WillEchoOptionHandler extends TelnetOptionHandler {
  match(sequence) {
    return (
      sequence[0] === COMMANDS.IAC &&
      sequence[1] === COMMANDS.WILL &&
      sequence[2] === OPTIONS.ECHO
    );
  }

  async handle(id, service, sequence) {
    const option = sequence[1];

    await service.actions.setMetadata({
      id,
      key: "echoEnabled",
      value: true,
    });
    await service.broker.emit("telnet.echo.enabled", { id });
  }
}

class WontEchoOptionHandler extends TelnetOptionHandler {
  match(sequence) {
    return sequence[0] === COMMANDS.IAC && sequence[1] === COMMANDS.WONT;
  }

  async handle(id, service, sequence) {
    const option = sequence[1];

    await service.actions.setMetadata({
      id,
      key: "echoEnabled",
      value: false,
    });
    await service.broker.emit("telnet.echo.disabled", { id });
  }
}

/**
 * The MoleculerTelnet service implements a Telnet server. This service mixes in the [MoleculerTCP](https://github.com/fugufish/moleculer-tcp) service
 * and extends it with Telnet-specific functionality.
 *
 * ## Telnet Options
 * The MoleculerTelnet service supports several Telnet options:
 *
 * * **TTYPE** - The TTYPE option allows the server to request the client's terminal type. If client responds with the
 * terminal type and will be stored in the connection's metadata.
 *
 * * **CHARSET** - The server can utilize either ASCII or UTF-8 encoding. The server will request the client to respect
 * the encoding and the client will respond with the encoding it will use. The encoding will be stored in the connection's
 * metadata. If the client does not respond, teh encoding will default to ASCII.
 *
 * * **ECHO** - The server can request that the client echo not characters. This is useful for password entry.
 *
 * **NAWS** - The server can request the client's window size. If the client responds with the window size, it will be
 * stored in the connection's metadata. When NAWS is enabled the client will typically send a window size update
 * whenever the window size changes.
 *
 * ### Adding Support for Additional Telnet Options
 * Additional Telnet options can be added by extending the {@link `TelnetOptionHandler`} class and adding the handler to the
 * service by calling the `telnet.addOptionHandler` method. When a Telnet command is received, it will be checked against
 * the existing registered handlers. If a handler is found, it will be executed. If no handler is found, the command will
 * be ignored.
 *
 * ## Settings
 * The MoleculerTelnet service mixes in the [MoleculerTCP](https://github.com/fugufish/moleculer-tcp) service. It supports
 * all the settings of the MoleculerTCP service. In addition, it supports the following settings:
 *
 * | Property | Type | Default | Environment Variable | Description |
 * | -------- | ---- | ------- | -------------------- | ----------- |
 * | `ttype` | `Boolean` | `true` | N/A | Whether to enable the TTYPE option. |
 * | `charset` | `String` | `null` | N/A | The charset to use. If not set this will default to ASCII. |
 *
 * ## Actions
 * The MoleculerTelnet service mixes in the [MoleculerTCP](https://github.com/fugufish/moleculer-tcp) service. It supports
 * all the actions of the MoleculerTCP service. In addition, it supports the following actions:
 *
 * | Name | Parameters | Visibility |Description |
 * | ---- | ---------- | ---------- | ---------- |
 * | `sendTelnetSequence` | `id: string`, `sequence: Array<number>` | public | Sends a Telnet sequence to the client. |
 * | `sendDo` | `id: string`, `option: number` | public | Sends a DO Telnet command to the client. |
 * | `sendDont` | `id: string`, `option: number` | public | Sends a DONT Telnet command to the client. |
 * | `registerTelnetOptionHandler` | `handler: TelnetOptionHandler` | protected | Registers a Telnet option handler. |
 */
const MoleculerTelnet = {
  actions: {
    handleTelnetCommand: {
      visibility: "private",
      params: {
        id: "string",
        command: "any",
      },
      async handler(ctx) {
        const { id, command } = ctx.params;

        for (let handler of Object.values(this.optionHandlers)) {
          if (handler.match(command)) {
            await handler.handle(id, this, command);
          }
        }
      },
    },

    onServerConnection: {
      hooks: {
        async after(ctx) {
          const id = ctx.params.id;

          // send the initial telnet commands
          await this.actions.setMetadata({
            id,
            key: "charset",
            value: "ascii",
          });
          await this.negotiateTelnetOptions(id);
        },
      },
    },

    onSocketData: {
      hooks: {
        // capture the socket data and parse it into telnet events and prevent further processing
        async before(ctx) {
          let { id, data } = ctx.params;

          const commands = extractTelnetCommands(data);

          if (commands.length > 0) {
            for (let command of commands) {
              this.actions.handleTelnetCommand({ id, command });
            }

            // prevent further processing
            throw new Error("telnet command");
          }
        },
        error(ctx, err) {
          // handle the socket command error
          if (err.message === "telnet command") {
            this.logger.debug(
              "connection: " +
                ctx.params.id +
                " received telnet command. preventing further processing"
            );
            return Promise.resolve();
          }

          throw err;
        },
      },
    },

    registerTelnetOptionHandler: {
      params: {
        handler: "any",
      },
      visibility: "protected",
      handler(ctx) {
        // raise an error if the handler is not a descendent of TelnetOptionHandler
        if (
          !Object.prototype.isPrototypeOf(
            ctx.params.handler,
            TelnetOptionHandler
          )
        ) {
          throw new Errors.MoleculerError(
            "handler must be a TelnetOptionHandler, got " + ctx.params.handler,
            500,
            "ERR_INVALID_HANDLER"
          );
        }

        const h = new ctx.params.handler();
        this.optionHandlers[ctx.params.handler.name] = h;
        this.logger.info(
          "registered telnet option handler: " + ctx.params.handler.name
        );
      },
    },

    sendDo: {
      params: {
        id: "string",
        option: "number",
      },
      async handler(ctx) {
        return this.actions.sendTelnetSequence({
          id: ctx.params.id,
          sequence: [COMMANDS.IAC, COMMANDS.DO, ctx.params.option],
        });
      },
    },

    sendDont: {
      params: {
        id: "string",
        option: "number",
      },
      async handler(ctx) {
        return this.actions.sendTelnetSequence({
          id: ctx.params.id,
          sequence: [COMMANDS.IAC, COMMANDS.DONT, ctx.params.option],
        });
      },
    },

    sendTelnetSequence: {
      params: {
        id: "string",
        sequence: "array",
      },
      async handler(ctx) {
        const data = Buffer.from(ctx.params.sequence);

        return this.actions.socketWrite({ id: ctx.params.id, data });
      },
    },

    sendWill: {
      params: {
        id: "string",
        option: "number",
      },
      async handler(ctx) {
        return this.actions.sendTelnetSequence({
          id: ctx.params.id,
          sequence: [COMMANDS.IAC, COMMANDS.WILL, ctx.params.option],
        });
      },
    },
  },

  async created() {
    this.optionHandlers = {};
  },

  async started() {
    this.actions.registerTelnetOptionHandler({ handler: TTYPEOption });
    this.actions.registerTelnetOptionHandler({
      handler: WillTTYPEOptionHandler,
    });
    this.actions.registerTelnetOptionHandler({
      handler: WontTTYPEOptionHandler,
    });
    this.actions.registerTelnetOptionHandler({
      handler: WillEchoOptionHandler,
    });
    this.actions.registerTelnetOptionHandler({
      handler: WontEchoOptionHandler,
    });

    this.actions.registerTelnetOptionHandler({
      handler: DoCharsetOptionHandler,
    });

    this.actions.registerTelnetOptionHandler({
      handler: DontCharsetOptionHandler,
    });

    this.actions.registerTelnetOptionHandler({
      handler: AcceptCharsetOptionHandler,
    });

    this.actions.registerTelnetOptionHandler({
      handler: RejectCharsetOptionHandler,
    });

    this.logger.info("telnet settings :", this.settings);
  },

  methods: {
    negotiateTelnetOptions(id, data) {
      this.logger.debug("connection: ", id, " negotiating telnet options");
      if (this.settings.ttype) {
        this.logger.debug("connection: ", id, " asking to enable ttype");
        this.actions.sendDo({ id, option: OPTIONS.TTYPE });
      } else {
        this.logger.debug("connection: ", id, " asking to disable ttype");
        this.actions.sendDont({ id, option: OPTIONS.TTYPE });
      }

      if (this.settings.charset) {
        this.logger.debug("connection: ", id, " asking to enable charset");
        this.actions.sendWill({ id, option: OPTIONS.CHARSET });
      }
    },
  },

  mixins: [MoleculerTCP],

  name: "telnet",

  settings: {
    charset: "UTF-8",
    ttype: true,
    get port() {
      return process.env.MOLECULER_TCP_PORT || 2323;
    },
  },
};

/**
 * @private
 *
 * @param {Buffer | string} data
 */

function extractTelnetCommands(data) {
  if (data[0] === COMMANDS.IAC) {
    const commands = [];

    let isSubnegotiation = false;
    let sequence = [];

    for (let i = 0; i < data.length; i++) {
      switch (data[i]) {
        case COMMANDS.IAC:
          if (sequence.length > 0 && !isSubnegotiation) {
            commands.push(sequence);
            sequence = [data[i]];
          } else {
            sequence.push(data[i]);
          }

          break;
        case COMMANDS.SB:
          sequence.push(data[i]);
          isSubnegotiation = true;
          break;
        case COMMANDS.SE:
          sequence.push(data[i]);
          isSubnegotiation = false;
          commands.push(sequence);
          sequence = [];
          break;
        default:
          sequence.push(data[i]);

          if (i === data.length - 1) {
            commands.push(sequence);
          }
      }
    }
    return commands;
  } else {
    return [];
  }
}

module.exports = {
  MoleculerTelnet,
  TelnetOptionHandler,
  extractTelnetCommands,
  COMMANDS,
  OPTIONS,
};
