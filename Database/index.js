"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.setExperimentalAllowsFatalError = setExperimentalAllowsFatalError;
exports.default = void 0;

var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _rx = require("../utils/rx");

var _common = require("../utils/common");

var _fp = require("../utils/fp");

var _compat = _interopRequireDefault(require("../adapters/compat"));

var _CollectionMap = _interopRequireDefault(require("./CollectionMap"));

var _WorkQueue = _interopRequireDefault(require("./WorkQueue"));

var experimentalAllowsFatalError = false;

function setExperimentalAllowsFatalError() {
  experimentalAllowsFatalError = true;
}

var Database = /*#__PURE__*/function () {
  // (experimental) if true, Database is in a broken state and should not be used anymore
  function Database(options) {
    this._workQueue = new _WorkQueue.default(this);
    this._isBroken = false;
    this._subscribers = [];
    this._resetCount = 0;
    this._isBeingReset = false;
    var {
      adapter: adapter,
      modelClasses: modelClasses
    } = options;

    if ('production' !== process.env.NODE_ENV) {
      (0, _common.invariant)(adapter, "Missing adapter parameter for new Database()");
      (0, _common.invariant)(modelClasses && Array.isArray(modelClasses), "Missing modelClasses parameter for new Database()"); // $FlowFixMe

      false === options.actionsEnabled && (0, _common.invariant)(false, 'new Database({ actionsEnabled: false }) is no longer supported');
      true === options.actionsEnabled && _common.logger.warn('new Database({ actionsEnabled: true }) option is unnecessary (actions are always enabled)');
    }

    this.adapter = new _compat.default(adapter);
    this.schema = adapter.schema;
    this.collections = new _CollectionMap.default(this, modelClasses);
  }

  var _proto = Database.prototype;

  _proto.get = function get(tableName) {
    return this.collections.get(tableName);
  };

  // Executes multiple prepared operations
  // (made with `collection.prepareCreate` and `record.prepareUpdate`)
  // Note: falsy values (null, undefined, false) passed to batch are just ignored
  _proto.batch = function batch(...records) {
    return new Promise(function ($return, $error) {
      var _this, actualRecords, batchOperations, changeNotifications, affectedTables, changeNotificationsEntries, databaseChangeNotifySubscribers;

      _this = this;

      if (!Array.isArray(records[0])) {
        // $FlowFixMe
        return $return(this.batch(records));
      }

      (0, _common.invariant)(1 === records.length, 'batch should be called with a list of models or a single array');
      actualRecords = records[0];

      this._ensureInWriter("Database.batch()"); // performance critical - using mutations


      batchOperations = [];
      changeNotifications = {};
      actualRecords.forEach(function (record) {
        if (!record) {
          return;
        }

        var preparedState = record._preparedState;

        if (!preparedState) {
          (0, _common.invariant)('disposable' !== record._raw._status, "Cannot batch a disposable record");
          throw new Error("Cannot batch a record that doesn't have a prepared create/update/delete");
        }

        var raw = record._raw;
        var {
          id: id
        } = raw; // faster than Model.id

        var {
          table: table
        } = record.constructor; // faster than Model.table

        var changeType;

        if ('update' === preparedState) {
          batchOperations.push(['update', table, raw]);
          changeType = 'updated';
        } else if ('create' === preparedState) {
          batchOperations.push(['create', table, raw]);
          changeType = 'created';
        } else if ('markAsDeleted' === preparedState) {
          batchOperations.push(['markAsDeleted', table, id]);
          changeType = 'destroyed';
        } else if ('destroyPermanently' === preparedState) {
          batchOperations.push(['destroyPermanently', table, id]);
          changeType = 'destroyed';
        } else {
          (0, _common.invariant)(false, 'bad preparedState');
        }

        if ('create' !== preparedState) {
          // We're (unsafely) assuming that batch will succeed and removing the "pending" state so that
          // subsequent changes to the record don't trip up the invariant
          // TODO: What if this fails?
          record._preparedState = null;
        }

        if (!changeNotifications[table]) {
          changeNotifications[table] = [];
        }

        changeNotifications[table].push({
          record: record,
          type: changeType
        });
      });
      return Promise.resolve(this.adapter.batch(batchOperations)).then(function () {
        try {
          affectedTables = Object.keys(changeNotifications);
          changeNotificationsEntries = Object.entries(changeNotifications);
          changeNotificationsEntries.forEach(function (notification) {
            var [table, changeSet] = notification;

            _this.collections.get(table)._applyChangesToCache(changeSet);
          });

          databaseChangeNotifySubscribers = function ([tables, subscriber]) {
            if (tables.some(function (table) {
              return affectedTables.includes(table);
            })) {
              subscriber();
            }
          };

          this._subscribers.forEach(databaseChangeNotifySubscribers);

          changeNotificationsEntries.forEach(function (notification) {
            var [table, changeSet] = notification;

            _this.collections.get(table)._notify(changeSet);
          });
          return $return(undefined); // shuts up flow
        } catch ($boundEx) {
          return $error($boundEx);
        }
      }.bind(this), $error);
    }.bind(this));
  } // Enqueues a Writer - a block of code that, when it's running, has a guarantee that no other Writer
  // is running at the same time.
  // All actions that modify the database (create, update, delete) must be performed inside of a Writer block
  // See docs for more details and practical guide
  ;

  _proto.write = function write(work, description) {
    return this._workQueue.enqueue(work, description, true);
  } // Enqueues a Reader - a block of code that, when it's running, has a guarantee that no Writer
  // is running at the same time (therefore, the database won't be modified for the duration of Reader's work)
  // See docs for more details and practical guide
  ;

  _proto.read = function read(work, description) {
    return this._workQueue.enqueue(work, description, false);
  };

  _proto.action = function action(work, description) {
    if ('production' !== process.env.NODE_ENV) {
      (0, _common.deprecated)('Database.action()', 'Use Database.write() instead.');
    }

    return this._workQueue.enqueue(work, "".concat(description || 'unnamed', " (legacy action)"), true);
  } // Emits a signal immediately, and on change in any of the passed tables
  ;

  _proto.withChangesForTables = function withChangesForTables(tables) {
    var _this2 = this;

    var changesSignals = tables.map(function (table) {
      return _this2.collections.get(table).changes;
    });
    return _rx.merge.apply(void 0, (0, _toConsumableArray2.default)(changesSignals)).pipe((0, _rx.startWith)(null));
  };

  // Notifies `subscriber` on change in any of passed tables (only a signal, no change set)
  _proto.experimentalSubscribe = function experimentalSubscribe(tables, subscriber, debugInfo) {
    var _this3 = this;

    if (!tables.length) {
      return _fp.noop;
    }

    var entry = [tables, subscriber, debugInfo];

    this._subscribers.push(entry);

    return function () {
      var idx = _this3._subscribers.indexOf(entry);

      -1 !== idx && _this3._subscribers.splice(idx, 1);
    };
  };

  // Resets database - permanently destroys ALL records stored in the database, and sets up empty database
  //
  // NOTE: This is not 100% safe automatically and you must take some precautions to avoid bugs:
  // - You must NOT hold onto any Database objects. DO NOT store or cache any records, collections, anything
  // - You must NOT observe any record or collection or query
  // - You SHOULD NOT have any pending (queued) Actions. Pending actions will be aborted (will reject with an error).
  //
  // It's best to reset your app to an empty / logged out state before doing this.
  //
  // Yes, this sucks and there should be some safety mechanisms or warnings. Please contribute!
  _proto.unsafeResetDatabase = function unsafeResetDatabase() {
    return new Promise(function ($return, $error) {
      var $Try_1_Finally = function ($Try_1_Exit) {
        return function ($Try_1_Value) {
          try {
            this._isBeingReset = false;
            return $Try_1_Exit && $Try_1_Exit.call(this, $Try_1_Value);
          } catch ($boundEx) {
            return $error($boundEx);
          }
        }.bind(this);
      }.bind(this);

      var adapter, ErrorAdapter;

      this._ensureInWriter("Database.unsafeResetDatabase()");

      var $Try_1_Post = function () {
        try {
          return $return();
        } catch ($boundEx) {
          return $error($boundEx);
        }
      };

      var $Try_1_Catch = function ($exception_2) {
        try {
          throw $exception_2;
        } catch ($boundEx) {
          return $Try_1_Finally($error)($boundEx);
        }
      };

      try {
        this._isBeingReset = true; // First kill actions, to ensure no more traffic to adapter happens

        this._workQueue._abortPendingWork(); // Kill ability to call adapter methods during reset (to catch bugs if someone does this)


        ({
          adapter: adapter
        } = this);
        ErrorAdapter = require('../adapters/error').default;
        this.adapter = new ErrorAdapter(); // Check for illegal subscribers

        if (this._subscribers.length) {
          // TODO: This should be an error, not a console.log, but actually useful diagnostics are necessary for this to work, otherwise people will be confused
          // eslint-disable-next-line no-console
          console.log("Application error! Unexpected ".concat(this._subscribers.length, " Database subscribers were detected during database.unsafeResetDatabase() call. App should not hold onto subscriptions or Watermelon objects while resetting database.")); // eslint-disable-next-line no-console

          console.log(this._subscribers);
          this._subscribers = [];
        } // Clear the database


        return Promise.resolve(adapter.unsafeResetDatabase()).then(function () {
          try {
            // Only now clear caches, since there may have been queued fetches from DB still bringing in items to cache
            Object.values(this.collections.map).forEach(function (collection) {
              // $FlowFixMe
              collection._cache.unsafeClear();
            }); // Restore working Database

            this._resetCount += 1;
            this.adapter = adapter;
            return $Try_1_Finally($Try_1_Post)();
          } catch ($boundEx) {
            return $Try_1_Catch($boundEx);
          }
        }.bind(this), $Try_1_Catch);
      } catch ($exception_2) {
        $Try_1_Catch($exception_2)
      }
    }.bind(this));
  };

  _proto._ensureInWriter = function _ensureInWriter(diagnosticMethodName) {
    (0, _common.invariant)(this._workQueue.isWriterRunning, "".concat(diagnosticMethodName, " can only be called from inside of a Writer. See docs for more details."));
  } // (experimental) puts Database in a broken state
  // TODO: Not used anywhere yet
  ;

  _proto._fatalError = function _fatalError(error) {
    if (!experimentalAllowsFatalError) {
      _common.logger.warn('Database is now broken, but experimentalAllowsFatalError has not been enabled to do anything about it...');

      return;
    }

    this._isBroken = true;

    _common.logger.error('Database is broken. App must be reloaded before continuing.'); // TODO: Passing this to an adapter feels wrong, but it's tricky.
    // $FlowFixMe


    if (this.adapter.underlyingAdapter._fatalError) {
      // $FlowFixMe
      this.adapter.underlyingAdapter._fatalError(error);
    }
  };

  (0, _createClass2.default)(Database, [{
    key: "localStorage",
    get: function get() {
      if (!this._localStorage) {
        var LocalStorageClass = require('./LocalStorage').default;

        this._localStorage = new LocalStorageClass(this);
      }

      return this._localStorage;
    }
  }]);
  return Database;
}();

exports.default = Database;