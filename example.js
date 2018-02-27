var PIXI = require('pixi.js');
var Connector = require('./index.js');

var app = new PIXI.Application(320, 400, {
  backgroundColor: 0x1099bb
});
document.body.appendChild(app.view);
app.view.style.position = "absolute";
app.view.style.top = "400px";




var world = new PIXI.Graphics();
world.beginFill(0xFF3300);
world.drawRect(0, 0, 1000, 1000);
world.interactive = true;
app.stage.addChild(world);

var container = new PIXI.Container();
container.hitArea = new PIXI.Rectangle(0,0, 320, 400);
container.interactive = true;
app.stage.addChild(container);


var rect = new PIXI.Graphics();
rect.beginFill(0x000000);
rect.drawRect(100, 100, 100, 100);
rect.interactive = true;
// rect.priority = 1;
app.stage.addChild(rect);

var rect2 = new PIXI.Graphics();
rect2.beginFill(0x0000FF);
rect2.drawRect(150, 50, 100, 100);
rect2.interactive = true;
// rect2.priority = 2;
app.stage.addChild(rect2);






/**
 * connect events
 */

 var hammertime = new Hammer.Manager(app.view, {
	recognizers: [
		[Hammer.Pinch],
		[Hammer.Pan],
		[Hammer.Tap, {event: 'doubletap', taps: 2, threshold: 7, posThreshold: 25}],
		[Hammer.Tap, {event: 'singletap', threshold: 7}],
		[Hammer.Press, {time: 333, threshold: 3}]
	]
 });
//advanced
var c = new Connector(app.view, app.renderer.plugins.interaction, hammertime);
//simple version
// var c = new Connector(app.view, app.renderer.plugins.interaction);
// c._mc.add( new Hammer.Tap() );


c.registerHandlerTypes(['tap', 'panstart', 'pan', 'panend', 'pinchstart', 'pinch', 'pinchend']);

rect.on('hammer-panstart', function(evt){
	console.log('rect1 panstart');
});
rect.on('hammer-pan', function(evt){
	console.log('rect1 pan');
});
rect.on('hammer-panend', function(evt){
	console.log('rect1 panend');
})

rect2.on('hammer-tap', function(evt){
	console.log('tap');
});

container.on('hammer-pinchstart', function(evt){
	console.log('pinchstart');
});
container.on('hammer-pinch', function(evt){
	console.log('pinch');
});
container.on('hammer-pinchend', function(evt){
	console.log('pinchend');
});
