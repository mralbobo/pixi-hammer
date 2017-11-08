var _ = require('lodash');
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
    e = Connector.normalizePointer(e, self._offset.x, self._offset.y);
    // sugar sub method to ending propagations
    e.end = self._mc.stop.bind(self._mc, true);
    var y = _.sortBy(
      self._listeners[e.type],
      _.partial(_.get, _, 'instance.priority', -1)
    );

    // check hitArea or just using native `containsPoint`
    var target = _.findLast(y, function(listener) {
      if (!self.isHitable(listener.instance)) {
        return false;
      }

      if (listener.instance.hitArea) {
        listener.instance.worldTransform.applyInverse(
          e.center,
          self._tempPoint
        );
        return _.invoke(
          listener.instance.hitArea,
          'containsPoint',
          self._tempPoint
        );
      } else {
        return _.invoke(listener.instance, 'containsPoint', e.center);
      }
    });
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
  if (_.isUndefined(callback)) {
    callback = option;
    option = undefined;
  }

  var l = (self._listeners[event] = self._listeners[event] || []);
  var keys = ['priority', 'instance', 'callback'];

  // set options for recoginzers
  if (option) {
    var optionKey = _.includes(event, '-')
      ? _.first(_.split(event, '-'))
      : self.getRecognizerType(event);
    _.set(self._options, optionKey, option);
  }

  // set listeners for events
  var info = _.zipObject(keys, [
    _.get(instance, 'priority', 0),
    instance,
    callback
  ]);
  var sortedIndex = _.sortedIndexBy(l, info, 'priority');
  self._listeners[event] = _.concat(
    _.slice(l, 0, sortedIndex),
    info,
    _.slice(l, sortedIndex, _.size(l))
  );

  // for event added after `start` and dint have reusable recognizer
  if (
    self._isStart &&
    !_.isEqual(event, 'hammer.input') &&
    !self._mc.get(event)
  ) {
    if (self.isCustomEvent(event)) {
      self.createCustomRecognizer(event);
    } else {
      self.createRecognizer(self.getRecognizerType(event));
    }
    if (!_.has(self._mc.handlers, event)) {
      self._mc.on(event, self._handler);
      // run related dependencies stack again
      _.chain(self._dependencies)
        .filter(_.partial(_.includes, _, event))
        .each(_.bind(_.spread(self.setDependency), self))
        .value();
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

  // initialize normal recognizers
  _.chain(self._listeners)
    .keys()
    .reject(self.isCustomEvent)
    // return the valid name of recognizer constructor
    .map(_.bind(self.getRecognizerType, self))
    .compact()
    .uniq()
    .each(_.bind(self.createRecognizer, self))
    .value();

  // initialize custom recognizers
  _.chain(self._listeners)
    .keys()
    .filter(self.isCustomEvent)
    .groupBy(self.getCustomName)
    .each(_.bind(self.createCustomRecognizer, self))
    .value();

  // run the dependecies stack
  _.each(self._dependencies, _.bind(_.spread(self.setDependency), self));

  _.each(self._listeners, function(callbacks, type) {
    // listen to events
    self._mc.on(type, self._handler);
  });
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
  var base = self.isCustomEvent(event)
    ? _.chain(event)
        .split('-')
        .last()
        .value()
    : event;
  return _.find(
    self.C.recognizers,
    _.unary(_.partial(_.startsWith, _.upperFirst(base)))
  );
};

/**
 * @description
 * check the target event is custom event or not
 * @param {String} event
 */
Connector.prototype.isCustomEvent = function(event) {
  return _.includes(event, '-');
};

/**
 * @description
 * get the custom name of custom event
 * @param {String} event
 */
Connector.prototype.getCustomName = function(event) {
  return _.first(_.split(event, '-'));
};

/**
 * @description
 * create normal recognizer and add to manager
 * @param {String} recognizerType
 */
Connector.prototype.createRecognizer = function(recognizerType) {
  var self = this;
  var opt = _.get(self._options, recognizerType, {});
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
  var recognizerType = self.getRecognizerType(_.first(event));
  var customName = self.getCustomName(event);

  var opt = _.get(self._options, customName, {});

  self._mc.add(
    new global.Hammer[recognizerType](
      _.assign(opt, {
        event: _.join([customName, _.lowerFirst(recognizerType)], '-')
      })
    )
  );
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
  if (_.isEmpty(instance.parent) && !_.isEqual(instance.name, 'stage')) {
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
  _.each(self._listeners, function(callbacks, type) {
    self._mc.off(type, self._handler);
  });
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
  offsetX = offsetX || 0;
  offsetY = offsetY || 0;
  var normalized = _.cloneDeep(e);

  normalized.center.x = (e.center.x - offsetX);
  normalized.center.y = (e.center.y - offsetY);

  return normalized;
}

module.exports = Connector;