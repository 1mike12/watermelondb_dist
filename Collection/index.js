"use strict";

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _rx = require("../utils/rx");

var _invariant = _interopRequireDefault(require("../utils/common/invariant"));

var _deprecated = _interopRequireDefault(require("../utils/common/deprecated"));

var _noop = _interopRequireDefault(require("../utils/fp/noop"));

var _Result = require("../utils/fp/Result");

var _Query = _interopRequireDefault(require("../Query"));

var Q = _interopRequireWildcard(require("../QueryDescription"));

var _RecordCache = _interopRequireDefault(require("./RecordCache"));

var Collection = /*#__PURE__*/function () {
  // Emits event every time a record inside Collection changes or is deleted
  // (Use Query API to observe collection changes)
  function Collection(database, ModelClass) {
    var _this = this;

    this.changes = new _rx.Subject();
    this._subscribers = [];
    this.database = database;
    this.modelClass = ModelClass;
    this._cache = new _RecordCache.default(ModelClass.table, function (raw) {
      return new ModelClass(_this, raw);
    }, this);
  }

  var _proto = Collection.prototype;

  // Finds a record with the given ID
  // Promise will reject if not found
  _proto.find = function find(id) {
    return new Promise(function ($return) {
      var _this2 = this;

      return $return((0, _Result.toPromise)(function (callback) {
        return _this2._fetchRecord(id, callback);
      }));
    }.bind(this));
  } // Finds the given record and starts observing it
  // (with the same semantics as when calling `model.observe()`)
  ;

  _proto.findAndObserve = function findAndObserve(id) {
    var _this3 = this;

    return _rx.Observable.create(function (observer) {
      var unsubscribe = null;
      var unsubscribed = false;

      _this3._fetchRecord(id, function (result) {
        if (result.value) {
          var record = result.value;
          observer.next(record);
          unsubscribe = record.experimentalSubscribe(function (isDeleted) {
            if (!unsubscribed) {
              isDeleted ? observer.complete() : observer.next(record);
            }
          });
        } else {
          // $FlowFixMe
          observer.error(result.error);
        }
      });

      return function () {
        unsubscribed = true;
        unsubscribe && unsubscribe();
      };
    });
  } // Query records of this type
  ;

  _proto.query = function query(...clauses) {
    return new _Query.default(this, clauses);
  } // Creates a new record in this collection
  // Pass a function to set attributes of the record.
  //
  // Example:
  // collections.get(Tables.tasks).create(task => {
  //   task.name = 'Task name'
  // })
  ;

  _proto.create = function create(recordBuilder = _noop.default) {
    return new Promise(function ($return, $error) {
      var record;

      this.database._ensureInWriter("Collection.create()");

      record = this.prepareCreate(recordBuilder);
      return Promise.resolve(this.database.batch(record)).then(function () {
        try {
          return $return(record);
        } catch ($boundEx) {
          return $error($boundEx);
        }
      }, $error);
    }.bind(this));
  } // Prepares a new record in this collection
  // Use this to batch-create multiple records
  ;

  _proto.prepareCreate = function prepareCreate(recordBuilder = _noop.default) {
    // $FlowFixMe
    return this.modelClass._prepareCreate(this, recordBuilder);
  } // Prepares a new record in this collection based on a raw object
  // e.g. `{ foo: 'bar' }`. Don't use this unless you know how RawRecords work in WatermelonDB
  // this is useful as a performance optimization or if you're implementing your own sync mechanism
  ;

  _proto.prepareCreateFromDirtyRaw = function prepareCreateFromDirtyRaw(dirtyRaw) {
    // $FlowFixMe
    return this.modelClass._prepareCreateFromDirtyRaw(this, dirtyRaw);
  } // Prepares a disposable record in this collection based on a raw object, e.g. `{ foo: 'bar' }`.
  // Disposable records are read-only, cannot be saved in the database, updated, or deleted
  // they only exist for as long as you keep a reference to them in memory.
  // Don't use this unless you know how RawRecords work in WatermelonDB.
  // This is useful when you're adding online-only features to an otherwise offline-first app
  ;

  _proto.disposableFromDirtyRaw = function disposableFromDirtyRaw(dirtyRaw) {
    // $FlowFixMe
    return this.modelClass._disposableFromDirtyRaw(this, dirtyRaw);
  } // *** Implementation of Query APIs ***
  ;

  _proto.unsafeFetchRecordsWithSQL = function unsafeFetchRecordsWithSQL(sql) {
    if ('production' !== process.env.NODE_ENV) {
      (0, _deprecated.default)('Collection.unsafeFetchRecordsWithSQL()', 'Use .query(Q.unsafeSqlQuery(`select * from...`)).fetch() instead.');
    }

    return this.query(Q.unsafeSqlQuery(sql)).fetch();
  } // *** Implementation details ***
  ;

  // See: Query.fetch
  _proto._fetchQuery = function _fetchQuery(query, callback) {
    var _this4 = this;

    this.database.adapter.underlyingAdapter.query(query.serialize(), function (result) {
      return callback((0, _Result.mapValue)(function (rawRecords) {
        return _this4._cache.recordsFromQueryResult(rawRecords);
      }, result));
    });
  };

  _proto._fetchIds = function _fetchIds(query, callback) {
    this.database.adapter.underlyingAdapter.queryIds(query.serialize(), callback);
  };

  _proto._fetchCount = function _fetchCount(query, callback) {
    this.database.adapter.underlyingAdapter.count(query.serialize(), callback);
  };

  _proto._unsafeFetchRaw = function _unsafeFetchRaw(query, callback) {
    this.database.adapter.underlyingAdapter.unsafeQueryRaw(query.serialize(), callback);
  } // Fetches exactly one record (See: Collection.find)
  ;

  _proto._fetchRecord = function _fetchRecord(id, callback) {
    var _this5 = this;

    if ('string' !== typeof id) {
      callback({
        error: new Error("Invalid record ID ".concat(this.table, "#").concat(id))
      });
      return;
    }

    var cachedRecord = this._cache.get(id);

    if (cachedRecord) {
      callback({
        value: cachedRecord
      });
      return;
    }

    this.database.adapter.underlyingAdapter.find(this.table, id, function (result) {
      return callback((0, _Result.mapValue)(function (rawRecord) {
        (0, _invariant.default)(rawRecord, "Record ".concat(_this5.table, "#").concat(id, " not found"));
        return _this5._cache.recordFromQueryResult(rawRecord);
      }, result));
    });
  };

  _proto._applyChangesToCache = function _applyChangesToCache(operations) {
    var _this6 = this;

    operations.forEach(function ({
      record: record,
      type: type
    }) {
      if ('created' === type) {
        record._preparedState = null;

        _this6._cache.add(record);
      } else if ('destroyed' === type) {
        _this6._cache.delete(record);
      }
    });
  };

  _proto._notify = function _notify(operations) {
    this._subscribers.forEach(function collectionChangeNotifySubscribers([subscriber]) {
      subscriber(operations);
    });

    this.changes.next(operations);
    operations.forEach(function collectionChangeNotifyModels({
      record: record,
      type: type
    }) {
      if ('updated' === type) {
        record._notifyChanged();
      } else if ('destroyed' === type) {
        record._notifyDestroyed();
      }
    });
  };

  _proto.experimentalSubscribe = function experimentalSubscribe(subscriber, debugInfo) {
    var _this7 = this;

    var entry = [subscriber, debugInfo];

    this._subscribers.push(entry);

    return function () {
      var idx = _this7._subscribers.indexOf(entry);

      -1 !== idx && _this7._subscribers.splice(idx, 1);
    };
  };

  (0, _createClass2.default)(Collection, [{
    key: "db",
    get: function get() {
      return this.database;
    }
  }, {
    key: "table",
    get: function get() {
      // $FlowFixMe
      return this.modelClass.table;
    }
  }, {
    key: "schema",
    get: function get() {
      return this.database.schema.tables[this.table];
    }
  }]);
  return Collection;
}();

exports.default = Collection;