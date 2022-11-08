"use strict";

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = applyRemoteChanges;

var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));

var _extends2 = _interopRequireDefault(require("@babel/runtime/helpers/extends"));

var _fp = require("../../utils/fp");

var _splitEvery = _interopRequireDefault(require("../../utils/fp/splitEvery"));

var _allPromisesObj = _interopRequireDefault(require("../../utils/fp/allPromisesObj"));

var _common = require("../../utils/common");

var Q = _interopRequireWildcard(require("../../QueryDescription"));

var _Schema = require("../../Schema");

var _helpers = require("./helpers");

var idsForChanges = function ({
  created: created,
  updated: updated,
  deleted: deleted
}) {
  var ids = [];
  created.forEach(function (record) {
    ids.push(record.id);
  });
  updated.forEach(function (record) {
    ids.push(record.id);
  });
  return ids.concat(deleted);
};

var fetchRecordsForChanges = function (collection, changes) {
  var ids = idsForChanges(changes);

  if (ids.length) {
    return collection.query(Q.where((0, _Schema.columnName)('id'), Q.oneOf(ids))).fetch();
  }

  return Promise.resolve([]);
};

var findRecord = function (id, list) {
  // perf-critical
  for (var i = 0, len = list.length; i < len; i += 1) {
    if (list[i]._raw.id === id) {
      return list[i];
    }
  }

  return null;
};

function recordsToApplyRemoteChangesTo(collection, changes) {
  return new Promise(function ($return, $error) {
    var database, table, deletedIds, records, locallyDeletedIds;
    ({
      database: database,
      table: table
    } = collection);
    ({
      deleted: deletedIds
    } = changes);
    return Promise.resolve(Promise.all([fetchRecordsForChanges(collection, changes), database.adapter.getDeletedRecords(table)])).then(function ($await_1) {
      try {
        [records, locallyDeletedIds] = $await_1;
        return $return((0, _extends2.default)({}, changes, {
          records: records,
          locallyDeletedIds: locallyDeletedIds,
          recordsToDestroy: records.filter(function (record) {
            return deletedIds.includes(record.id);
          }),
          deletedRecordsToDestroy: locallyDeletedIds.filter(function (id) {
            return deletedIds.includes(id);
          })
        }));
      } catch ($boundEx) {
        return $error($boundEx);
      }
    }, $error);
  });
}

function validateRemoteRaw(raw) {
  // TODO: I think other code is actually resilient enough to handle illegal _status and _changed
  // would be best to change that part to a warning - but tests are needed
  (0, _common.invariant)(raw && 'object' === typeof raw && 'id' in raw && !('_status' in raw || '_changed' in raw), "[Sync] Invalid raw record supplied to Sync. Records must be objects, must have an 'id' field, and must NOT have a '_status' or '_changed' fields");
}

function prepareApplyRemoteChangesToCollection(collection, recordsToApply, sendCreatedAsUpdated, log, conflictResolver) {
  var {
    database: database,
    table: table
  } = collection;
  var {
    created: created,
    updated: updated,
    recordsToDestroy: deleted,
    records: records,
    locallyDeletedIds: locallyDeletedIds
  } = recordsToApply; // if `sendCreatedAsUpdated`, server should send all non-deleted records as `updated`
  // log error if it doesn't — but disable standard created vs updated errors

  if (sendCreatedAsUpdated && created.length) {
    (0, _common.logError)("[Sync] 'sendCreatedAsUpdated' option is enabled, and yet server sends some records as 'created'");
  }

  var recordsToBatch = []; // mutating - perf critical
  // Insert and update records

  created.forEach(function (raw) {
    validateRemoteRaw(raw);
    var currentRecord = findRecord(raw.id, records);

    if (currentRecord) {
      (0, _common.logError)("[Sync] Server wants client to create record ".concat(table, "#").concat(raw.id, ", but it already exists locally. This may suggest last sync partially executed, and then failed; or it could be a serious bug. Will update existing record instead."));
      recordsToBatch.push((0, _helpers.prepareUpdateFromRaw)(currentRecord, raw, log, conflictResolver));
    } else if (locallyDeletedIds.includes(raw.id)) {
      (0, _common.logError)("[Sync] Server wants client to create record ".concat(table, "#").concat(raw.id, ", but it already exists locally and is marked as deleted. This may suggest last sync partially executed, and then failed; or it could be a serious bug. Will delete local record and recreate it instead.")); // Note: we're not awaiting the async operation (but it will always complete before the batch)

      database.adapter.destroyDeletedRecords(table, [raw.id]);
      recordsToBatch.push((0, _helpers.prepareCreateFromRaw)(collection, raw));
    } else {
      recordsToBatch.push((0, _helpers.prepareCreateFromRaw)(collection, raw));
    }
  });
  updated.forEach(function (raw) {
    validateRemoteRaw(raw);
    var currentRecord = findRecord(raw.id, records);

    if (currentRecord) {
      recordsToBatch.push((0, _helpers.prepareUpdateFromRaw)(currentRecord, raw, log, conflictResolver));
    } else if (!locallyDeletedIds.includes(raw.id)) {
      // Record doesn't exist (but should) — just create it
      sendCreatedAsUpdated || (0, _common.logError)("[Sync] Server wants client to update record ".concat(table, "#").concat(raw.id, ", but it doesn't exist locally. This could be a serious bug. Will create record instead. If this was intentional, please check the flag sendCreatedAsUpdated in https://nozbe.github.io/WatermelonDB/Advanced/Sync.html#additional-synchronize-flags"));
      recordsToBatch.push((0, _helpers.prepareCreateFromRaw)(collection, raw));
    }
  });
  deleted.forEach(function (record) {
    // $FlowFixMe
    recordsToBatch.push(record.prepareDestroyPermanently());
  });
  return recordsToBatch;
}

var getAllRecordsToApply = function (db, remoteChanges) {
  return (0, _allPromisesObj.default)((0, _fp.pipe)((0, _fp.filterObj)(function (_changes, tableName) {
    var collection = db.get(tableName);

    if (!collection) {
      _common.logger.warn("You are trying to sync a collection named ".concat(tableName, ", but it does not exist. Will skip it (for forward-compatibility). If this is unexpected, perhaps you forgot to add it to your Database constructor's modelClasses property?"));
    }

    return !!collection;
  }), (0, _fp.mapObj)(function (changes, tableName) {
    return recordsToApplyRemoteChangesTo(db.get(tableName), changes);
  }))(remoteChanges));
};

var destroyAllDeletedRecords = function (db, recordsToApply) {
  var promises = (0, _fp.toPairs)(recordsToApply).map(function ([tableName, {
    deletedRecordsToDestroy: deletedRecordsToDestroy
  }]) {
    return deletedRecordsToDestroy.length ? db.adapter.destroyDeletedRecords(tableName, deletedRecordsToDestroy) : null;
  });
  return Promise.all(promises);
};

var applyAllRemoteChanges = function (db, recordsToApply, sendCreatedAsUpdated, log, conflictResolver) {
  var allRecords = [];
  (0, _fp.toPairs)(recordsToApply).forEach(function ([tableName, records]) {
    allRecords.push.apply(allRecords, (0, _toConsumableArray2.default)(prepareApplyRemoteChangesToCollection(db.get(tableName), records, sendCreatedAsUpdated, log, conflictResolver)));
  });
  return db.batch(allRecords);
}; // See _unsafeBatchPerCollection - temporary fix


var unsafeApplyAllRemoteChangesByBatches = function (db, recordsToApply, sendCreatedAsUpdated, log, conflictResolver) {
  var promises = [];
  (0, _fp.toPairs)(recordsToApply).forEach(function ([tableName, records]) {
    var preparedModels = prepareApplyRemoteChangesToCollection(db.collections.get(tableName), records, sendCreatedAsUpdated, log, conflictResolver);
    var batches = (0, _splitEvery.default)(5000, preparedModels).map(function (recordBatch) {
      return db.batch(recordBatch);
    });
    promises.push.apply(promises, (0, _toConsumableArray2.default)(batches));
  });
  return Promise.all(promises);
};

function applyRemoteChanges(db, remoteChanges, sendCreatedAsUpdated, log, conflictResolver, _unsafeBatchPerCollection) {
  return new Promise(function ($return, $error) {
    var recordsToApply;
    return Promise.resolve(getAllRecordsToApply(db, remoteChanges)).then(function ($await_2) {
      try {
        recordsToApply = $await_2;
        return Promise.resolve(Promise.all([destroyAllDeletedRecords(db, recordsToApply), _unsafeBatchPerCollection ? unsafeApplyAllRemoteChangesByBatches(db, recordsToApply, sendCreatedAsUpdated, log, conflictResolver) : applyAllRemoteChanges(db, recordsToApply, sendCreatedAsUpdated, log, conflictResolver)])).then(function () {
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
  });
}