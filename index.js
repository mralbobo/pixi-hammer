var Hammer = require('hammerjs');

/**
 * @description
 * a instance helper to connect hammer to pixijs instances
 * @contructor
 */
var Connector = function(app) {
  var self = this;
  var canvas = app.view;
  var stage = app.stage;

  // some constant
  self.C = {
    recognizers: ['Pan', 'Pinch', 'Press', 'Rotate', 'Swipe', 'Tap']
  };

  stage.name = 'stage';

  // offset information of this canvas
  var bound = canvas.getBoundingClientRect();

  self._offset = {
    x: bound.left,
    y: bound.top
  };

  // listeners with a pair of key(instance's name) and
  self._listeners = {};
  self._options = {};
  self._dependencies = [];
  self._isStart = false;

  // hammer manager
  self._mc = new Hammer.Manager(canvas);

  // a temp point ref
  self._tempPoint = {
    x: 0,
    y: 0
  };

  // private handler for every hammer event
  self._handler = function(e) {
    Connector.normalizePointer(e, self._offset.x, self._offset.y);
    // sugar sub method to ending propagations
    e.end = self._mc.stop.bind(self._mc, true);
    
    var y = self._listeners[e.type].sort(function(a, b) {
      return (a.instance.priority || -1) > (b.instance.priority || -1)
    });
    
    // check hitArea or just using native `containsPoint`
    var target;
    for (var i = y.length - 1; i >= 0; i--) {
      var listener = y[i];
      if (!self.isHitable(listener.instance)) {
        continue;
      }

      if (listener.instance.hitArea) {
        listener.instance.worldTransform.applyInverse(e.center, self._tempPoint);
        if (listener.instance.hitArea.containsPoint(self._tempPoint)) {
          target = listener;
          break;
        } else {
          continue;
        }
      } else {
        if (listener.instance.containsPoint(e.center)) {
          target = listener;
          break;
        } else {
          continue;
        }
      }
    }
    target && target.callback.call(target.instance, e);
  };
};

/**
 * @description
 * listen normal hammer event on a pixijs instance
 * - normal event -> listen(ins, 'panmove'[, option], callback)
 * - custom event -> listen(ins, 'zoomPan-panmove'[, option], callback)
 * caution: the real custom recognizer base name is 'zoomPan-pan'
 *          but we can share same recoginer by using 'zoomPan-panstart', 'zoomPan-panmove' etc
 *
 * @param {PIXI.DisplayObject} instance
 * @param {String} event - hammerjs event name, could be prefix with custom name. Exp: <zoomPan->panmove
 * @param {Object?} option - option to initialize with. Same recognizer only allow once.
 * @param {Function} callback
 */
Connector.prototype.listen = function(instance, event, option, callback) {
  var self = this;
  if (callback === undefined) {
    callback = option;
    option = undefined;
  }

  var l = (self._listeners[event] = self._listeners[event] || []);

  // set options for recoginzers
  if (option) {
    var optionKey = event.includes('-') ? event.split('-')[0] : self.getRecognizerType(event);
    self._options[optionKey] = option;
  }

  // set listeners for events
  var info = {
    priority: instance.priority || 0,
    instance: instance,
    callback: callback
  };
  
  var sortedIndex = l.length;
  for (var i = 0; i < l.length; i++) {
    if (l[i].priority >= info.priority) {
      sortedIndex = i;
      break;
    }
  }
  self._listeners[event] = [].concat(l.slice(0, sortedIndex)).concat(info).concat(l.slice(sortedIndex, l.length));

  // for event added after `start` and dint have reusable recognizer
  if (self._isStart && event !== 'hammer.input' && !self._mc.get(event)) {
    if (self.isCustomEvent(event)) {
      self.createCustomRecognizer(event);
    } else {
      self.createRecognizer(self.getRecognizerType(event));
    }
    if (!self._mc.handlers[event]) {
      self._mc.on(event, self._handler);
      // run related dependencies stack again
      self._dependencies
        .filter(function(dep) {
          return dep.includes(event);
        })
        .forEach(function(dep) {
          self.setDependency.apply(self, dep);
        });
    }
  }
};

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
 * start binding event listener
 */
Connector.prototype.start = function() {
  var self = this;
  self._isStart = true;

  var temp = [];
  for (var key in self._listeners) {
    if (self.isCustomEvent(key)) {
      // initialize custom recognizers
      var customName = self.getCustomName(key);
      if (!temp.includes(customName)) {
        temp.push(customName);
        self.createCustomRecognizer(key);
      }
    } else {
      // initialize normal recognizers
      var type = self.getRecognizerType(key);
      self.createRecognizer(type);
    }
  }

  // run the dependecies stack
  self._dependencies.forEach(function(dep) {
    self.setDependency.apply(self, dep);
  });

  for (var key in self._listeners) {
    // listen to events
    self._mc.on(key, self._handler);
  }
};

/**
 * @description
 * wrapper to call `recognizeWith|requireFailure` methods of `target` base on `baseTarget`
 * cache and run if this is called before `this.start`
 *
 * @param {String} target
 * @param {String} baseTarget
 */
Connector.prototype.setDependency = function(method, target, baseTarget) {
  var self = this;
  if (self._isStart) {
    var t = self._mc.get(target);
    var b = self._mc.get(baseTarget);
    // skip silently if recognizer is not found
    t && b && t[method](b);
  } else {
    self._dependencies.push([method, target, baseTarget]);
  }
};

/**
 * @description
 * get the recognizer type name from a string
 * @param {String} event
 */
Connector.prototype.getRecognizerType = function(event) {
  var self = this;
  var base = self.isCustomEvent(event) ? event.split('-').pop() : event;

  return self.C.recognizers.find(function(reg) {
    var name = base[0].toUpperCase() + base.slice(1);
    return reg.indexOf(name) === 0;
  });
};

/**
 * @description
 * check the target event is custom event or not
 * @param {String} event
 */
Connector.prototype.isCustomEvent = function(event) {
  return event.includes('-');
};

/**
 * @description
 * get the custom name of custom event
 * @param {String} event
 */
Connector.prototype.getCustomName = function(event) {
  return event.split('-').shift();
};

/**
 * @description
 * create normal recognizer and add to manager
 * @param {String} recognizerType
 */
Connector.prototype.createRecognizer = function(recognizerType) {
  var self = this;
  var opt = self._options[recognizerType] || {};
  self._mc.add(new global.Hammer[recognizerType](opt));
};

/**
 * @description
 * create custom recognizer and add to manager
 * this is base on event name
 * @param {String} event
 */
Connector.prototype.createCustomRecognizer = function(event) {
  var self = this;
  var recognizerType = self.getRecognizerType(event);
  var customName = self.getCustomName(event);

  var opt = {};
  for (var key in self._options[customName]) {
    opt[key] = self._options[customName][key];
  }
  opt.event = [customName, recognizerType.toLowerCase()].join('-');

  self._mc.add(new global.Hammer[recognizerType](opt));
};

/**
 * @description
 * determine if the instance is fulfill the hitable check
 * false check:
 * - if instance has lost its parent but this instance is not 'stage'
 * - if instance visible is set to false
 * - if instance hitable is set to false
 *
 * @param {PIXI.DisplayObject} instance
 * @returns {Boolean}
 */
Connector.prototype.isHitable = function(instance) {
  var self = this;

  if (!instance.visible) {
    return false;
  }
  if (!instance.parent && instance.name !== 'stage') {
    return false;
  }
  if (instance.hitable === false) {
    return false;
  }
  if (instance.parent) {
    return self.isHitable(instance.parent);
  }
  return true;
};

/**
 * @description
 * destroy connector instance
 */
Connector.prototype.destroy = function() {
  var self = this;
  
  for (var key in self._listeners) {
    self._mc.off(key, self._handler);
  }
  self._mc.destroy();
  self._mc = null;
  self._listeners = {};
};

/**
 * @description
 * normalize coordinate of cursor from DOM to stage
 *
 * @param {Event} e - event object of hammerjs
 * @param {Number} offsetX - left offset from the DOM
 * @param {Number} offsetY - top offset from the DOM
 */
Connector.normalizePointer = function(e, offsetX, offsetY) {
  e.center.x = (e.center.x - offsetX || 0);
  e.center.y = (e.center.y - offsetY || 0);
}

module.exports = Connector;