const { Socket } = require("net");
const { TelnetMixin, MoleculerTelnet, OPTIONS } = require("./index");
const { ServiceBroker } = require("moleculer");
const { EventEmitter } = require("events");
const {
  TelnetOptionHandler,
  COMMANDS,
  extractTelnetCommands,
} = require("./index");

class DoTTYPE {
  match(sequence) {
    return (
      sequence[0] === COMMANDS.IAC &&
      sequence[1] === COMMANDS.DO &&
      sequence[2] === OPTIONS.TTYPE
    );
  }

  handle(client, sequence) {
    client.socket.write(
      Buffer.from([COMMANDS.IAC, COMMANDS.WILL, OPTIONS.TTYPE])
    );
  }
}

class DontTTYPE {
  match(sequence) {
    return (
      sequence[0] === COMMANDS.IAC &&
      sequence[1] === COMMANDS.DONT &&
      sequence[2] === OPTIONS.TTYPE
    );
  }

  handle(client, sequence) {
    client.socket.write(
      Buffer.from([COMMANDS.IAC, COMMANDS.WONT, OPTIONS.TTYPE])
    );
  }
}

class WontTTYPE {
  match(sequence) {
    return (
      sequence[0] === COMMANDS.IAC &&
      sequence[1] === COMMANDS.DO &&
      sequence[2] === OPTIONS.TTYPE
    );
  }

  handle(client, sequence) {
    client.socket.write(
      Buffer.from([COMMANDS.IAC, COMMANDS.WONT, OPTIONS.TTYPE])
    );
  }
}

class SendTTYPE {
  match(sequence) {
    return (
      sequence[0] === COMMANDS.IAC &&
      sequence[1] === COMMANDS.SB &&
      sequence[2] === OPTIONS.TTYPE &&
      sequence[3] === COMMANDS.SEND
    );
  }

  handle(client, sequence) {
    client.socket.write(
      Buffer.from([
        COMMANDS.IAC,
        COMMANDS.SB,
        OPTIONS.TTYPE,
        COMMANDS.IS,
        ...Buffer.from("test"),
        COMMANDS.IAC,
        COMMANDS.SE,
      ])
    );
  }
}

class WillCharset {
  match(sequence) {
    return (
      sequence[0] === COMMANDS.IAC &&
      sequence[1] === COMMANDS.WILL &&
      sequence[2] === OPTIONS.CHARSET
    );
  }

  handle(client, sequence) {
    client.socket.write(
      Buffer.from([COMMANDS.IAC, COMMANDS.DO, OPTIONS.CHARSET])
    );
  }
}

class DontCharset {
  match(sequence) {
    return (
      sequence[0] === COMMANDS.IAC &&
      sequence[1] === COMMANDS.WILL &&
      sequence[2] === OPTIONS.CHARSET
    );
  }

  handle(client, sequence) {
    client.socket.write(
      Buffer.from([COMMANDS.IAC, COMMANDS.DONT, OPTIONS.CHARSET])
    );
  }
}

class RequestCharset {
  match(sequence) {
    return (
      sequence[0] === COMMANDS.IAC &&
      sequence[1] === COMMANDS.SB &&
      sequence[2] === OPTIONS.CHARSET &&
      sequence[3] === COMMANDS.REQUEST
    );
  }

  handle(client, sequence) {
    let charset = "";

    for (let i = 4; i < sequence.length - 2; i++) {
      charset += String.fromCharCode(sequence[i]);
    }

    client.socket.write(
      Buffer.from([
        COMMANDS.IAC,
        COMMANDS.SB,
        OPTIONS.CHARSET,
        COMMANDS.ACCEPTED,
        COMMANDS.SPACE,
        ...Buffer.from(charset.trim()),
        COMMANDS.IAC,
        COMMANDS.SE,
      ])
    );
  }
}

class TelnetClient {
  constructor(negotiations) {
    this.socket = new Socket();
    this.connected = new Promise((resolve) => {
      this.socket.on("connect", () => {
        resolve();
      });
    });

    this.socket.connect(2323, "127.0.0.1");

    this.socket.on("data", (data) => {
      this.handleData(data);
    });

    this.negotiations = negotiations || [];
  }

  handleData(data) {
    const commands = extractTelnetCommands(data);

    for (const command of commands) {
      for (const negotiation of this.negotiations) {
        if (negotiation.match(command)) {
          negotiation.handle(this, command);
        }
      }
    }
  }
}

const TelnetService = {
  name: "telnet",
  mixins: [MoleculerTelnet],
  created() {
    this.negotiations = {};
    this.emitter = new EventEmitter();
    this.negotiationsComplete = new Promise((resolve) => {
      this.emitter.on("negotiationsComplete", resolve);
    });
    this.connected = new Promise((resolve) => {
      this.emitter.on("connected", resolve);
    });
    this.listening = new Promise((resolve) => {
      this.emitter.on("listening", resolve);
    });
  },
  actions: {
    onServerListening: {
      hooks: {
        after(ctx) {
          this.emitter.emit("listening");
        },
      },
    },
    onServerConnection: {
      hooks: {
        after(ctx) {
          this.emitter.emit("connected");
        },
      },
    },
  },
  events: {
    "telnet.ttype.set"() {
      this.negotiations.ttype = true;
      this.checkForNegotiations();
    },
    "telnet.ttype.disabled"() {
      this.negotiations.ttype = true;
      this.checkForNegotiations();
    },
    "telnet.charset.set"() {
      this.negotiations.charset = true;
      this.checkForNegotiations();
    },
  },
  methods: {
    checkForNegotiations() {
      if (
        ((this.settings.ttype && this.negotiations.ttype) ||
          !this.settings.ttype) &&
        ((this.settings && this.negotiations.charset) || !this.settings.charset)
      ) {
        this.emitter.emit("negotiationsComplete");
      }
    },
  },
};

describe("moleculer-telnet", () => {
  describe("extractTelnetCommands", () => {
    const commands = Buffer.from([
      COMMANDS.IAC,
      COMMANDS.DO,
      OPTIONS.TTYPE,
      COMMANDS.IAC,
      COMMANDS.SB,
      OPTIONS.TTYPE,
      COMMANDS.IS,
      ...Buffer.from("TEST"),
      COMMANDS.IAC,
      COMMANDS.SE,
      COMMANDS.IAC,
      COMMANDS.WILL,
      OPTIONS.TTYPE,
    ]);

    describe("as buffer", () => {
      it("should extract telnet commands", () => {
        const cmds = extractTelnetCommands(commands);

        expect(cmds.length).toBe(3);
        expect(cmds[0]).toEqual([COMMANDS.IAC, COMMANDS.DO, OPTIONS.TTYPE]);

        expect(cmds[1]).toEqual([
          COMMANDS.IAC,
          COMMANDS.SB,
          OPTIONS.TTYPE,
          COMMANDS.IS,
          ...Buffer.from("TEST"),
          COMMANDS.IAC,
          COMMANDS.SE,
        ]);

        expect(cmds[2]).toEqual([COMMANDS.IAC, COMMANDS.WILL, OPTIONS.TTYPE]);
      });
    });
  });

  describe("client connection", () => {
    let client;
    let broker;
    let telnetService;
    let telnetConnection;
    let connection;

    beforeEach(async () => {
      broker = new ServiceBroker({
        logger: "Console",
        logLevel: "debug",
        transporter: "fake",
      });

      await broker.start();
    });

    afterEach(async () => {
      await broker.stop();
    });

    describe("ttype", () => {
      describe("enabled", () => {
        describe("client supports", () => {
          beforeEach(async () => {
            telnetService = broker.createService({
              name: "telnet",
              mixins: [TelnetService],
              settings: {
                ttype: true,
              },
            });
            await telnetService.listening;

            client = new TelnetClient([new DoTTYPE(), new SendTTYPE()]);

            await telnetService.connected;
            await telnetService.negotiationsComplete;
            await client.connected;

            telnetConnection = Object.values(telnetService.connections)[0];
          });

          it("should attempt to determine the terminal type", async () => {
            const ttype = telnetConnection.metadata.ttype;

            expect(ttype).toBe("test");
          });
        });

        describe("client does not support", () => {
          beforeEach(async () => {
            telnetService = broker.createService({
              name: "telnet",
              mixins: [TelnetService],
              settings: {
                ttype: true,
              },
            });
            await telnetService.listening;

            client = new TelnetClient([new WontTTYPE()]);

            await telnetService.connected;
            await telnetService.negotiationsComplete;
            await client.connected;

            telnetConnection = Object.values(telnetService.connections)[0];
          });

          it("should not attempt to determine the terminal type", async () => {
            const ttype = telnetConnection.metadata.ttype;

            expect(ttype).toEqual("generic");
            expect(telnetConnection.metadata.ttypeEnabled).toBe(false);
          });
        });

        describe("connection default metadata", () => {
          beforeEach(async () => {
            telnetService = broker.createService({
              name: "telnet",
              mixins: [TelnetService],
              settings: {
                ttype: true,
              },
            });
            await telnetService.listening;

            client = new TelnetClient();

            await client.connected;
            await telnetService.connected;

            telnetConnection = Object.values(telnetService.connections)[0];
          });

          it("should not attempt to determine the terminal type", async () => {
            const ttype = telnetConnection.metadata.ttype;

            expect(ttype).toEqual("generic");
            expect(telnetConnection.metadata.ttypeEnabled).toBe(false);
          });
        });

        describe("disabled", () => {
          beforeEach(async () => {
            telnetService = broker.createService({
              name: "telnet",
              mixins: [TelnetService],
              settings: {
                ttype: false,
              },
            });
            await telnetService.listening;

            client = new TelnetClient([new DontTTYPE(), new SendTTYPE()]);

            await telnetService.connected;
            await telnetService.negotiationsComplete;
            await client.connected;

            telnetConnection = Object.values(telnetService.connections)[0];
          });

          it("should not attempt to determine the terminal type", async () => {
            const ttype = telnetConnection.metadata.ttype;

            expect(ttype).toEqual("generic");
          });
        });
      });

      describe("charset", () => {
        describe("enabled", () => {
          describe("client supports", () => {
            beforeEach(async () => {
              telnetService = broker.createService({
                name: "telnet",
                mixins: [TelnetService],
                settings: {
                  charset: "UTF-8",
                },
              });
              await telnetService.listening;

              client = new TelnetClient([
                new WillCharset(),
                new RequestCharset(),
              ]);

              await telnetService.connected;
              await telnetService.negotiationsComplete;
              await client.connected;

              telnetConnection = Object.values(telnetService.connections)[0];
            });

            it("should attempt to determine the charset", async () => {
              const charset = telnetConnection.metadata.charset;

              expect(charset).toBe("UTF-8");
            });
          });

          describe("client does not support", () => {
            beforeEach(async () => {
              telnetService = broker.createService({
                name: "telnet",
                mixins: [TelnetService],
                settings: {
                  charset: "UTF-8",
                },
              });
              await telnetService.listening;

              client = new TelnetClient([new DontCharset()]);

              await telnetService.connected;
              await telnetService.negotiationsComplete;
              await client.connected;

              telnetConnection = Object.values(telnetService.connections)[0];
            });

            it("should not attempt to determine the charset", async () => {
              const charset = telnetConnection.metadata.charset;

              expect(charset).toEqual("ascii");
            });
          });

          describe("connection default metadata", () => {
            beforeEach(async () => {
              telnetService = broker.createService({
                name: "telnet",
                mixins: [TelnetService],
                settings: {
                  charset: "UTF-8",
                },
              });
              await telnetService.listening;

              client = new TelnetClient();

              await client.connected;
              await telnetService.connected;

              telnetConnection = Object.values(telnetService.connections)[0];
            });

            it("should not attempt to determine the charset", async () => {
              const charset = telnetConnection.metadata.charset;

              expect(charset).toEqual("ascii");
            });
          });
        });

        describe("disabled", () => {
          beforeEach(async () => {
            telnetService = broker.createService({
              name: "telnet",
              mixins: [TelnetService],
              settings: {
                charset: false,
              },
            });
            await telnetService.listening;

            client = new TelnetClient([
              new DontCharset(),
              new RequestCharset(),
            ]);

            await telnetService.connected;
            await client.connected;

            telnetConnection = Object.values(telnetService.connections)[0];
          });

          it("should not attempt to determine the charset", async () => {
            const charset = telnetConnection.metadata.charset;

            expect(charset).toEqual("ascii");
          });
        });
      });
    });
  });
});
