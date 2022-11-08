"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.associations = associations;
exports.default = void 0;

var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _rx = require("../utils/rx");

var _invariant = _interopRequireDefault(require("../utils/common/invariant"));

var _deprecated = _interopRequireDefault(require("../utils/common/deprecated"));

var _ensureSync = _interopRequireDefault(require("../utils/common/ensureSync"));

var _fromPairs = _interopRequireDefault(require("../utils/fp/fromPairs"));

var _noop = _interopRequireDefault(require("../utils/fp/noop"));

var _Schema = require("../Schema");

var _RawRecord = require("../RawRecord");

var _helpers = require("../sync/helpers");

var _helpers2 = require("./helpers");

function associations(...associationList) {
  return (0, _fromPairs.default)(associationList);
}

var Model = /*#__PURE__*/function () {
  var _proto = Model.prototype;

  // Set this in concrete Models to the name of the database table
  // Set this in concrete Models to define relationships between different records
  // Used by withObservables to differentiate between object types
  _proto._getChanges = function _getChanges() {
    if (!this.__changes) {
      // initializing lazily - it has non-trivial perf impact on very large collections
      this.__changes = new _rx.BehaviorSubject(this);
    }

    return this.__changes;
  };

  // Modifies the model (using passed function) and saves it to the database.
  // Touches `updatedAt` if available.
  //
  // Example:
  // someTask.update(task => {
  //   task.name = 'New name'
  // })
  _proto.update = function update(recordUpdater = _noop.default) {
    return new Promise(function ($return, $error) {
      var record;

      this.db._ensureInWriter("Model.update()");

      record = this.prepareUpdate(recordUpdater);
      return Promise.resolve(this.db.batch(this)).then(function () {
        try {
          return $return(record);
        } catch ($boundEx) {
          return $error($boundEx);
        }
      }, $error);
    }.bind(this));
  } // Prepares an update to the database (using passed function).
  // Touches `updatedAt` if available.
  //
  // After preparing an update, you must execute it synchronously using
  // database.batch()
  ;

  _proto.prepareUpdate = function prepareUpdate(recordUpdater = _noop.default) {
    var _this = this;

    (0, _invariant.default)(!this._preparedState, "Cannot update a record with pending changes");

    this.__ensureNotDisposable("Model.prepareUpdate()");

    this._isEditing = true; // Touch updatedAt (if available)

    if ('updatedAt' in this) {
      this._setRaw((0, _Schema.columnName)('updated_at'), Date.now());
    } // Perform updates


    (0, _ensureSync.default)(recordUpdater(this));
    this._isEditing = false;
    this._preparedState = 'update'; // TODO: `process.nextTick` doesn't work on React Native
    // We could polyfill with setImmediate, but it doesn't have the same effect — test and enseure
    // it would actually work for this purpose

    if ('production' !== process.env.NODE_ENV && 'undefined' !== typeof process && process && process.nextTick) {
      process.nextTick(function () {
        (0, _invariant.default)('update' !== _this._preparedState, "record.prepareUpdate was called on ".concat(_this.table, "#").concat(_this.id, " but wasn't sent to batch() synchronously -- this is bad!"));
      });
    }

    return this;
  };

  _proto.prepareMarkAsDeleted = function prepareMarkAsDeleted() {
    (0, _invariant.default)(!this._preparedState, "Cannot mark a record with pending changes as deleted");

    this.__ensureNotDisposable("Model.prepareMarkAsDeleted()");

    this._raw._status = 'deleted';
    this._preparedState = 'markAsDeleted';
    return this;
  };

  _proto.prepareDestroyPermanently = function prepareDestroyPermanently() {
    (0, _invariant.default)(!this._preparedState, "Cannot destroy permanently a record with pending changes");

    this.__ensureNotDisposable("Model.prepareDestroyPermanently()");

    this._raw._status = 'deleted';
    this._preparedState = 'destroyPermanently';
    return this;
  } // Marks this record as deleted (will be permanently deleted after sync)
  // Note: Use this only with Sync
  ;

  _proto.markAsDeleted = function markAsDeleted() {
    return new Promise(function ($return, $error) {
      this.db._ensureInWriter("Model.markAsDeleted()");

      this.__ensureNotDisposable("Model.markAsDeleted()");

      return Promise.resolve(this.db.batch(this.prepareMarkAsDeleted())).then(function () {
        try {
          return $return();
        } catch ($boundEx) {
          return $error($boundEx);
        }
      }, $error);
    }.bind(this));
  } // Pernamently removes this record from the database
  // Note: Don't use this when using Sync
  ;

  _proto.destroyPermanently = function destroyPermanently() {
    return new Promise(function ($return, $error) {
      this.db._ensureInWriter("Model.destroyPermanently()");

      this.__ensureNotDisposable("Model.destroyPermanently()");

      return Promise.resolve(this.db.batch(this.prepareDestroyPermanently())).then(function () {
        try {
          return $return();
        } catch ($boundEx) {
          return $error($boundEx);
        }
      }, $error);
    }.bind(this));
  };

  _proto.experimentalMarkAsDeleted = function experimentalMarkAsDeleted() {
    return new Promise(function ($return, $error) {
      var _this$db, children;

      this.db._ensureInWriter("Model.experimental_markAsDeleted()");

      this.__ensureNotDisposable("Model.experimentalMarkAsDeleted()");

      return Promise.resolve((0, _helpers2.fetchDescendants)(this)).then(function ($await_4) {
        try {
          children = $await_4;
          children.forEach(function (model) {
            return model.prepareMarkAsDeleted();
          });
          return Promise.resolve((_this$db = this.db).batch.apply(_this$db, (0, _toConsumableArray2.default)(children).concat([this.prepareMarkAsDeleted()]))).then(function () {
            try {
              return $return();
            } catch ($boundEx) {
              return $error($boundEx);
            }
          }, $error);
        } catch ($boundEx) {
          return $error($boundEx);
        }
      }.bind(this), $error);
    }.bind(this));
  };

  _proto.experimentalDestroyPermanently = function experimentalDestroyPermanently() {
    return new Promise(function ($return, $error) {
      var _this$db2, children;

      this.db._ensureInWriter("Model.experimental_destroyPermanently()");

      this.__ensureNotDisposable("Model.experimentalDestroyPermanently()");

      return Promise.resolve((0, _helpers2.fetchDescendants)(this)).then(function ($await_6) {
        try {
          children = $await_6;
          children.forEach(function (model) {
            return model.prepareDestroyPermanently();
          });
          return Promise.resolve((_this$db2 = this.db).batch.apply(_this$db2, (0, _toConsumableArray2.default)(children).concat([this.prepareDestroyPermanently()]))).then(function () {
            try {
              return $return();
            } catch ($boundEx) {
              return $error($boundEx);
            }
          }, $error);
        } catch ($boundEx) {
          return $error($boundEx);
        }
      }.bind(this), $error);
    }.bind(this));
  } // *** Observing changes ***
  // Returns an observable that emits `this` upon subscription and every time this record changes
  // Emits `complete` if this record is destroyed
  ;

  _proto.observe = function observe() {
    (0, _invariant.default)('create' !== this._preparedState, "Cannot observe uncommitted record");
    return this._getChanges();
  } // *** Implementation details ***
  ;

  // See: Database.batch()
  // To be used by Model @writer methods only!
  // TODO: protect batch,callWriter,... from being used outside a @reader/@writer
  _proto.batch = function batch(...records) {
    var _this$db3;

    return (_this$db3 = this.db).batch.apply(_this$db3, records);
  } // To be used by Model @writer methods only!
  ;

  _proto.callWriter = function callWriter(action) {
    return this.db._workQueue.subAction(action);
  } // To be used by Model @writer/@reader methods only!
  ;

  _proto.callReader = function callReader(action) {
    return this.db._workQueue.subAction(action);
  } // To be used by Model @writer/@reader methods only!
  ;

  _proto.subAction = function subAction(action) {
    if ('production' !== process.env.NODE_ENV) {
      (0, _deprecated.default)('Model.subAction()', 'Use .callWriter() / .callReader() instead.');
    }

    return this.db._workQueue.subAction(action);
  };

  // Don't use this directly! Use `collection.create()`
  function Model(collection, raw) {
    this._isEditing = false;
    this._preparedState = null;
    this.__changes = null;
    this._subscribers = [];
    this.collection = collection;
    this._raw = raw;
  }

  Model._prepareCreate = function _prepareCreate(collection, recordBuilder) {
    var record = new this(collection, // sanitizedRaw sets id
    (0, _RawRecord.sanitizedRaw)((0, _helpers2.createTimestampsFor)(this.prototype), collection.schema));
    record._preparedState = 'create';
    record._isEditing = true;
    (0, _ensureSync.default)(recordBuilder(record));
    record._isEditing = false;
    return record;
  };

  Model._prepareCreateFromDirtyRaw = function _prepareCreateFromDirtyRaw(collection, dirtyRaw) {
    var record = new this(collection, (0, _RawRecord.sanitizedRaw)(dirtyRaw, collection.schema));
    record._preparedState = 'create';
    return record;
  };

  Model._disposableFromDirtyRaw = function _disposableFromDirtyRaw(collection, dirtyRaw) {
    var record = new this(collection, (0, _RawRecord.sanitizedRaw)(dirtyRaw, collection.schema));
    record._raw._status = 'disposable';
    return record;
  };

  _proto.experimentalSubscribe = function experimentalSubscribe(subscriber, debugInfo) {
    var _this2 = this;

    var entry = [subscriber, debugInfo];

    this._subscribers.push(entry);

    return function () {
      var idx = _this2._subscribers.indexOf(entry);

      -1 !== idx && _this2._subscribers.splice(idx, 1);
    };
  };

  _proto._notifyChanged = function _notifyChanged() {
    this._getChanges().next(this);

    this._subscribers.forEach(function ([subscriber]) {
      subscriber(false);
    });
  };

  _proto._notifyDestroyed = function _notifyDestroyed() {
    this._getChanges().complete();

    this._subscribers.forEach(function ([subscriber]) {
      subscriber(true);
    });
  };

  _proto._getRaw = function _getRaw(rawFieldName) {
    return this._raw[rawFieldName];
  };

  _proto._setRaw = function _setRaw(rawFieldName, rawValue) {
    this.__ensureCanSetRaw();

    var valueBefore = this._raw[rawFieldName];
    (0, _RawRecord.setRawSanitized)(this._raw, rawFieldName, rawValue, this.collection.schema.columns[rawFieldName]);

    if (valueBefore !== this._raw[rawFieldName] && 'create' !== this._preparedState) {
      (0, _helpers.setRawColumnChange)(this._raw, rawFieldName);
    }
  } // Please don't use this unless you really understand how Watermelon Sync works, and thought long and
  // hard about risks of inconsistency after sync
  ;

  _proto._dangerouslySetRawWithoutMarkingColumnChange = function _dangerouslySetRawWithoutMarkingColumnChange(rawFieldName, rawValue) {
    this.__ensureCanSetRaw();

    (0, _RawRecord.setRawSanitized)(this._raw, rawFieldName, rawValue, this.collection.schema.columns[rawFieldName]);
  };

  _proto.__ensureCanSetRaw = function __ensureCanSetRaw() {
    this.__ensureNotDisposable("Model._setRaw()");

    (0, _invariant.default)(this._isEditing, 'Not allowed to change record outside of create/update()');
    (0, _invariant.default)(!this._getChanges().isStopped && 'deleted' !== this._raw._status, 'Not allowed to change deleted records');
  };

  _proto.__ensureNotDisposable = function __ensureNotDisposable(debugName) {
    (0, _invariant.default)('disposable' !== this._raw._status, "".concat(debugName, " cannot be called on a disposable record"));
  };

  (0, _createClass2.default)(Model, [{
    key: "id",
    get: function get() {
      return this._raw.id;
    }
  }, {
    key: "syncStatus",
    get: function get() {
      return this._raw._status;
    }
  }, {
    key: "collections",
    get: // Collections of other Models in the same domain as this record
    function get() {
      return this.database.collections;
    }
  }, {
    key: "database",
    get: function get() {
      return this.collection.database;
    }
  }, {
    key: "db",
    get: function get() {
      return this.collection.database;
    }
  }, {
    key: "asModel",
    get: function get() {
      return this;
    }
  }, {
    key: "table",
    get: function get() {
      return this.constructor.table;
    }
  }]);
  return Model;
}();

exports.default = Model;
Model.associations = {};
Model._wmelonTag = 'model';