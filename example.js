var PIXI = require('pixi.js');
var Connector = require('./index.js');

var app = new PIXI.Application(320, 400, {
  backgroundColor: 0x1099bb
});
document.body.appendChild(app.view);

var world = new PIXI.Graphics();
world.beginFill(0xFF3300);
world.drawRect(0, 0, 1000, 1000);
app.stage.addChild(world);

var rect = new PIXI.Graphics();
rect.beginFill(0x000000);
rect.drawRect(100, 100, 100, 100);
app.stage.addChild(rect);

/**
 * connect events
 */
var c = new Connector(app);

c.listen(world, 'pan', function(e) {
  console.log('panning on the world!');
});

c.listen(rect, 'tap', function(e) {
  console.log('tapping on the rect!');
});

c.start();