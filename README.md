# pixi-hammer

Connect [Hammer.js](http://hammerjs.github.io/) with [PixiJS](http://www.pixijs.com/).

Allow us to use `Hammer.js` gesture recognizer with `PixiJS` instance. 

## Install

TODO - put on npm
```sh
npm install pixi-hammer
```

## Usage

```js
var PIXI = require('pixi.js');
var Connector = require('pixi-hammer');

var app = new PIXI.Application(320, 400);
// initialize the Connector
var c = new Connector(app.view, app.renderer.plugins.interaction);

// assume we have a PIXI instance
var rect = new PIXI.Graphics();
rect.beginFill(0x000000);
rect.drawRect(100, 100, 100, 100);
app.stage.addChild(rect);

// listen hammer.js event from that instance
c.on('hammer-pinch', function(e){
  console.log('pinching on the rect!');
});
```

## How it works

A very light mapping to hammer. Defer to the pixi interactionManager as often as possible.

## TODO


## License

MIT
