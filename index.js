var Hammer = require('hammerjs');
var PIXIMath = require('@pixi/math');

/**
 * @description
 * a instance helper to connect hammer to pixijs instances
 * @contructor
 */
var Connector = function(appView, interactionManager, preInitedHammer) {
	var self = this;
	var canvas = appView;

	this.config = {
		useOnlyFirstHitTest: true //only hittest on the first event then keep basing all further events off it
	}

	var handlers = {};

	self.interactionManager = interactionManager;

	self.updateCache(canvas);
	self._options = {};

	// hammer manager
	if(preInitedHammer){ self._mc = preInitedHammer; }
	else{ self._mc = new Hammer.Manager(canvas); }
	// console.log('_mc', self._mc);

	self.getPixiTarget = function(center){
		var newCenter = self.normalizePoint(center);
		return interactionManager.hitTest(newCenter);
	}

};

/**
 * Just prefix everything hammer-y with hammer- to avoid conflicts
 * @param  {[string]} eventName
 * @return {[string]}
 */
function decorateEvent(eventName){
	return "hammer-"+eventName;
}

/**
 * @description
 * get hammer manager
 */
Connector.prototype.getManager = function() {
	var self = this;
	return self._mc;
};

/**
 * @description
 *
 */
Connector.prototype.registerHandlerTypes = function(typesArray) {
	var self = this;

	var first;
	var firstTarget;

	self._mc.on("hammer.input", function(evt){
		if(evt.isFirst){
			first = evt;
			firstTarget = self.getPixiTarget(evt.center);
		}
		//not clearing these "might" be a problem
		else if(evt.isFinal){
			// first = null;
			// firstTarget = null;
		}
	});

	typesArray.forEach(function(type){
		self._mc.on(type, function(evt){
			if(self.config.useOnlyFirstHitTest){ var pixiTarget = firstTarget; }
			else{ var pixiTarget = self.getPixiTarget(evt.center); }
			if(pixiTarget){
				self.interactionManager.dispatchEvent(pixiTarget, decorateEvent(type), evt);
			}
		});
	});
};

/**
 * @description
 * destroy connector instance
 */
Connector.prototype.destroy = function() {
	var self = this;

	for (var key in self._mc.handlers) {
		self._mc.off(key, self._mc.handlers[key]);
	}

	self._mc.destroy();
	self._mc = null;
	self._listeners = {};
};

Connector.prototype.normalizePoint = function(dstPoint) {
	var pt = new PIXIMath.Point();
	this.interactionManager.mapPositionToPoint(pt, dstPoint.x, dstPoint.y);
	return pt;
}

/**
 * @description
 * recache the canvas bound. call this when the canvas size changed
 * @param {Element?} canvas
 */
Connector.prototype.updateCache = function(canvas) {
	// offset information of this canvas
	var bound = (canvas || this._mc.element).getBoundingClientRect();
	this._offset = {
		x: bound.left,
		y: bound.top
	};
}

module.exports = Connector;
