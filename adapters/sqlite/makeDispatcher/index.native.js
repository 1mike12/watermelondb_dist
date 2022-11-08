"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.getDispatcherType = getDispatcherType;
exports.makeDispatcher = void 0;

var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));

var _reactNative = require("react-native");

var _common = require("../../../utils/common");

var _Result = require("../../../utils/fp/Result");

/* eslint-disable global-require */
var {
  DatabaseBridge: DatabaseBridge
} = _reactNative.NativeModules;

var SqliteNativeModulesDispatcher = /*#__PURE__*/function () {
  function SqliteNativeModulesDispatcher(tag) {
    this._tag = tag;

    if ('production' !== process.env.NODE_ENV) {
      (0, _common.invariant)(DatabaseBridge, "NativeModules.DatabaseBridge is not defined! This means that you haven't properly linked WatermelonDB native module. Refer to docs for more details");
    }
  }

  var _proto = SqliteNativeModulesDispatcher.prototype;

  _proto.call = function call(name, _args, callback) {
    var methodName = name;
    var args = _args;

    if ('batch' === methodName && DatabaseBridge.batchJSON) {
      methodName = 'batchJSON';
      args = [JSON.stringify(args[0])];
    }

    (0, _Result.fromPromise)(DatabaseBridge[methodName].apply(DatabaseBridge, [this._tag].concat((0, _toConsumableArray2.default)(args))), callback);
  };

  return SqliteNativeModulesDispatcher;
}();

var SqliteJsiDispatcher = /*#__PURE__*/function () {
  // debug hook for NT use
  function SqliteJsiDispatcher(dbName, usesExclusiveLocking) {
    this._db = global.nativeWatermelonCreateAdapter(dbName, usesExclusiveLocking);

    this._unsafeErrorListener = function () {};
  }

  var _proto2 = SqliteJsiDispatcher.prototype;

  _proto2.call = function call(name, _args, callback) {
    var methodName = name;
    var args = _args;

    if ('query' === methodName && !global.HermesInternal) {
      // NOTE: compressing results of a query into a compact array makes querying 15-30% faster on JSC
      // but actually 9% slower on Hermes (presumably because Hermes has faster C++ JSI and slower JS execution)
      methodName = 'queryAsArray';
    } else if ('batch' === methodName) {
      methodName = 'batchJSON';
      args = [JSON.stringify(args[0])];
    } else if ('provideSyncJson' === methodName) {
      (0, _Result.fromPromise)(DatabaseBridge.provideSyncJson.apply(DatabaseBridge, (0, _toConsumableArray2.default)(args)), callback);
      return;
    }

    try {
      var method = this._db[methodName];

      if (!method) {
        throw new Error("Cannot run database method ".concat(method, " because database failed to open. ").concat(Object.keys(this._db).join(',')));
      }

      var result = method.apply(void 0, (0, _toConsumableArray2.default)(args)); // On Android, errors are returned, not thrown - see DatabaseInstallation.cpp

      if (result instanceof Error) {
        throw result;
      } else {
        if ('queryAsArray' === methodName) {
          result = require('./decodeQueryResult').default(result);
        }

        callback({
          value: result
        });
      }
    } catch (error) {
      this._unsafeErrorListener(error);

      callback({
        error: error
      });
    }
  };

  return SqliteJsiDispatcher;
}();

var makeDispatcher = function (type, tag, dbName, usesExclusiveLocking) {
  return 'jsi' === type ? new SqliteJsiDispatcher(dbName, usesExclusiveLocking) : new SqliteNativeModulesDispatcher(tag);
};

exports.makeDispatcher = makeDispatcher;

var initializeJSI = function () {
  if (global.nativeWatermelonCreateAdapter) {
    return true;
  }

  if (DatabaseBridge.initializeJSI) {
    try {
      DatabaseBridge.initializeJSI();
      return !!global.nativeWatermelonCreateAdapter;
    } catch (e) {
      _common.logger.error('[SQLite] Failed to initialize JSI');

      _common.logger.error(e);
    }
  }

  return false;
};

function getDispatcherType(options) {
  if (options.jsi) {
    if (initializeJSI()) {
      return 'jsi';
    }

    _common.logger.warn("JSI SQLiteAdapter not available\u2026 falling back to asynchronous operation. This will happen if you're using remote debugger, and may happen if you forgot to recompile native app after WatermelonDB update");
  }

  return 'asynchronous';
}