[![Moleculer logo](http://moleculer.services/images/banner.png)](https://github.com/moleculerjs/moleculer)

# Telnet Gateway Provider for the [Moleculer Framwork](https://moleculer.services/)

## Features

* Clustered server mode
* TTYPE negotiation

## Install

```
$ npm install moleculer-telnet
```

## Usage

```js
const Telnet = require("moleculer-telnet");

module.exports = {
    name: "telnet",
    mixins: [Telnet],
    settings: {
        port: 3000,
        host: "localhost",
    }
}
```

## Settings

This service mixin also mixes in the [MoleculerTCP]() service, and supports all of the settings supported by that service. In addition to the MoleculerTCP settings the following settings are also available:

* `ttype` if set to `true`, the server will attempt to discover the clients Terminal type.
* `broadcastTelnetNegotiations` if set to `true` will globally broadcast when a connection sends a telnet negotiation option. This allows other services to handle telnet option data sent from a client.

## Actions

In addition to the actions provided by MoleculerTCP mixin, the following actions are made available:

### `extractSubData`

Extracts data from a subnegotiation string. This is useful, for example to get the terminal type when a TTYPE subnegotion event is broadcast.

#### Parameters


| Property | Type     | Description                                                        |
| -------- | -------- | ------------------------------------------------------------------ |
| `data`   | `string` | The dot notated telnet sequence data. Example:`IAC.SB.TTYPE.IS...` |

## Events

In addition to the events provided by the MoleculerTCP mixin, the following events are broadcast:
