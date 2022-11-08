"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

exports.__esModule = true;
exports.default = void 0;

var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));

var _initializerDefineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/initializerDefineProperty"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _applyDecoratedDescriptor2 = _interopRequireDefault(require("@babel/runtime/helpers/applyDecoratedDescriptor"));

var _initializerWarningHelper2 = _interopRequireDefault(require("@babel/runtime/helpers/initializerWarningHelper"));

var _allPromises = _interopRequireDefault(require("../utils/fp/allPromises"));

var _invariant = _interopRequireDefault(require("../utils/common/invariant"));

var _rx = require("../utils/rx");

var _Result = require("../utils/fp/Result");

var _subscriptions = require("../utils/subscriptions");

var _lazy = _interopRequireDefault(require("../decorators/lazy"));

var _subscribeToCount = _interopRequireDefault(require("../observation/subscribeToCount"));

var _subscribeToQuery = _interopRequireDefault(require("../observation/subscribeToQuery"));

var _subscribeToQueryWithColumns = _interopRequireDefault(require("../observation/subscribeToQueryWithColumns"));

var Q = _interopRequireWildcard(require("../QueryDescription"));

var _helpers = require("./helpers");

var _class, _descriptor, _descriptor2, _descriptor3, _class2, _temp;

var Query = (_class = (_temp = _class2 = /*#__PURE__*/function () {
  // Used by withObservables to differentiate between object types
  // Note: Don't use this directly, use Collection.query(...)
  function Query(collection, clauses) {
    (0, _initializerDefineProperty2.default)(this, "_cachedSubscribable", _descriptor, this);
    (0, _initializerDefineProperty2.default)(this, "_cachedCountSubscribable", _descriptor2, this);
    (0, _initializerDefineProperty2.default)(this, "_cachedCountThrottledSubscribable", _descriptor3, this);
    this.collection = collection;
    this._rawDescription = Q.buildQueryDescription(clauses);
    this.description = Q.queryWithoutDeleted(this._rawDescription);
  } // Creates a new Query that extends the clauses of this query


  var _proto = Query.prototype;

  _proto.extend = function extend(...clauses) {
    var {
      collection: collection
    } = this;
    var {
      where: where,
      sortBy: sortBy,
      take: take,
      skip: skip,
      joinTables: joinTables,
      nestedJoinTables: nestedJoinTables,
      lokiTransform: lokiTransform,
      sql: sql
    } = this._rawDescription;
    (0, _invariant.default)(!sql, 'Cannot extend an unsafe SQL query'); // TODO: Move this & tests to QueryDescription

    return new Query(collection, [Q.experimentalJoinTables(joinTables)].concat((0, _toConsumableArray2.default)(nestedJoinTables.map(function ({
      from: from,
      to: to
    }) {
      return Q.experimentalNestedJoin(from, to);
    })), (0, _toConsumableArray2.default)(where), (0, _toConsumableArray2.default)(sortBy), (0, _toConsumableArray2.default)(take ? [Q.take(take)] : []), (0, _toConsumableArray2.default)(skip ? [Q.skip(skip)] : []), (0, _toConsumableArray2.default)(lokiTransform ? [Q.unsafeLokiTransform(lokiTransform)] : []), clauses));
  };

  _proto.pipe = function pipe(transform) {
    return transform(this);
  } // Queries database and returns an array of matching records
  ;

  _proto.fetch = function fetch() {
    var _this = this;

    return (0, _Result.toPromise)(function (callback) {
      return _this.collection._fetchQuery(_this, callback);
    });
  };

  _proto.then = function then(onFulfill, onReject) {
    // $FlowFixMe
    return this.fetch().then(onFulfill, onReject);
  } // Emits an array of matching records, then emits a new array every time it changes
  ;

  _proto.observe = function observe() {
    var _this2 = this;

    return _rx.Observable.create(function (observer) {
      return _this2._cachedSubscribable.subscribe(function (records) {
        observer.next(records);
      });
    });
  } // Same as `observe()` but also emits the list when any of the records
  // on the list has one of `columnNames` chaged
  ;

  _proto.observeWithColumns = function observeWithColumns(columnNames) {
    var _this3 = this;

    return _rx.Observable.create(function (observer) {
      return _this3.experimentalSubscribeWithColumns(columnNames, function (records) {
        observer.next(records);
      });
    });
  } // Queries database and returns the number of matching records
  ;

  _proto.fetchCount = function fetchCount() {
    var _this4 = this;

    return (0, _Result.toPromise)(function (callback) {
      return _this4.collection._fetchCount(_this4, callback);
    });
  };

  // Emits the number of matching records, then emits a new count every time it changes
  // Note: By default, the Observable is throttled!
  _proto.observeCount = function observeCount(isThrottled = true) {
    var _this5 = this;

    return _rx.Observable.create(function (observer) {
      var subscribable = isThrottled ? _this5._cachedCountThrottledSubscribable : _this5._cachedCountSubscribable;
      return subscribable.subscribe(function (count) {
        observer.next(count);
      });
    });
  } // Queries database and returns an array with IDs of matching records
  ;

  _proto.fetchIds = function fetchIds() {
    var _this6 = this;

    return (0, _Result.toPromise)(function (callback) {
      return _this6.collection._fetchIds(_this6, callback);
    });
  } // Queries database and returns an array with unsanitized raw results
  // You MUST NOT mutate these objects!
  ;

  _proto.unsafeFetchRaw = function unsafeFetchRaw() {
    var _this7 = this;

    return (0, _Result.toPromise)(function (callback) {
      return _this7.collection._unsafeFetchRaw(_this7, callback);
    });
  };

  _proto.experimentalSubscribe = function experimentalSubscribe(subscriber) {
    return this._cachedSubscribable.subscribe(subscriber);
  };

  _proto.experimentalSubscribeWithColumns = function experimentalSubscribeWithColumns(columnNames, subscriber) {
    return (0, _subscribeToQueryWithColumns.default)(this, columnNames, subscriber);
  };

  _proto.experimentalSubscribeToCount = function experimentalSubscribeToCount(subscriber) {
    return this._cachedCountSubscribable.subscribe(subscriber);
  } // Marks as deleted all records matching the query
  ;

  _proto.markAllAsDeleted = function markAllAsDeleted() {
    return new Promise(function ($return, $error) {
      var records;
      return Promise.resolve(this.fetch()).then(function ($await_1) {
        try {
          records = $await_1;
          return Promise.resolve((0, _allPromises.default)(function (record) {
            return record.markAsDeleted();
          }, records)).then(function () {
            try {
              return $return();
            } catch ($boundEx) {
              return $error($boundEx);
            }
          }, $error);
        } catch ($boundEx) {
          return $error($boundEx);
        }
      }, $error);
    }.bind(this));
  } // Destroys all records matching the query
  ;

  _proto.destroyAllPermanently = function destroyAllPermanently() {
    return new Promise(function ($return, $error) {
      var records;
      return Promise.resolve(this.fetch()).then(function ($await_3) {
        try {
          records = $await_3;
          return Promise.resolve((0, _allPromises.default)(function (record) {
            return record.destroyPermanently();
          }, records)).then(function () {
            try {
              return $return();
            } catch ($boundEx) {
              return $error($boundEx);
            }
          }, $error);
        } catch ($boundEx) {
          return $error($boundEx);
        }
      }, $error);
    }.bind(this));
  } // MARK: - Internals
  ;

  // Serialized version of Query (e.g. for sending to web worker)
  _proto.serialize = function serialize() {
    var {
      table: table,
      description: description,
      associations: associations
    } = this;
    return {
      table: table,
      description: description,
      associations: associations
    };
  };

  (0, _createClass2.default)(Query, [{
    key: "count",
    get: function get() {
      var model = this;
      return {
        then: function then(onFulfill, onReject) {
          // $FlowFixMe
          return model.fetchCount().then(onFulfill, onReject);
        }
      };
    }
  }, {
    key: "modelClass",
    get: function get() {
      return this.collection.modelClass;
    }
  }, {
    key: "table",
    get: function get() {
      // $FlowFixMe
      return this.modelClass.table;
    }
  }, {
    key: "secondaryTables",
    get: function get() {
      return this.description.joinTables.concat(this.description.nestedJoinTables.map(function ({
        to: to
      }) {
        return to;
      }));
    }
  }, {
    key: "allTables",
    get: function get() {
      return [this.table].concat(this.secondaryTables);
    }
  }, {
    key: "associations",
    get: function get() {
      return (0, _helpers.getAssociations)(this.description, this.modelClass, this.collection.db);
    }
  }]);
  return Query;
}(), _class2._wmelonTag = 'query', _temp), (_descriptor = (0, _applyDecoratedDescriptor2.default)(_class.prototype, "_cachedSubscribable", [_lazy.default], {
  configurable: true,
  enumerable: true,
  writable: true,
  initializer: function initializer() {
    var _this8 = this;

    return new _subscriptions.SharedSubscribable(function (subscriber) {
      return (0, _subscribeToQuery.default)(_this8, subscriber);
    });
  }
}), _descriptor2 = (0, _applyDecoratedDescriptor2.default)(_class.prototype, "_cachedCountSubscribable", [_lazy.default], {
  configurable: true,
  enumerable: true,
  writable: true,
  initializer: function initializer() {
    var _this9 = this;

    return new _subscriptions.SharedSubscribable(function (subscriber) {
      return (0, _subscribeToCount.default)(_this9, false, subscriber);
    });
  }
}), _descriptor3 = (0, _applyDecoratedDescriptor2.default)(_class.prototype, "_cachedCountThrottledSubscribable", [_lazy.default], {
  configurable: true,
  enumerable: true,
  writable: true,
  initializer: function initializer() {
    var _this10 = this;

    return new _subscriptions.SharedSubscribable(function (subscriber) {
      return (0, _subscribeToCount.default)(_this10, true, subscriber);
    });
  }
})), _class);
exports.default = Query;