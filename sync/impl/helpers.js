"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.resolveConflict = resolveConflict;
exports.prepareCreateFromRaw = prepareCreateFromRaw;
exports.prepareUpdateFromRaw = prepareUpdateFromRaw;
exports.prepareMarkAsSynced = prepareMarkAsSynced;
exports.ensureSameDatabase = ensureSameDatabase;
exports.changeSetCount = exports.isChangeSetEmpty = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime/helpers/extends"));

var _fp = require("../../utils/fp");

var _common = require("../../utils/common");

var _RawRecord = require("../../RawRecord");

// Returns raw record with naive solution to a conflict based on local `_changed` field
// This is a per-column resolution algorithm. All columns that were changed locally win
// and will be applied on top of the remote version.
function resolveConflict(local, remote) {
  // We SHOULD NOT have a reference to a `deleted` record, but since it was locally
  // deleted, there's nothing to update, since the local deletion will still be pushed to the server -- return raw as is
  if ('deleted' === local._status) {
    return local;
  } // mutating code - performance-critical path


  var resolved = (0, _extends2.default)({}, local, remote, {
    id: local.id,
    _status: local._status,
    _changed: local._changed
  }); // Use local properties where changed

  local._changed.split(',').forEach(function (column) {
    resolved[column] = local[column];
  });

  return resolved;
}

function replaceRaw(record, dirtyRaw) {
  record._raw = (0, _RawRecord.sanitizedRaw)(dirtyRaw, record.collection.schema);
}

function prepareCreateFromRaw(collection, dirtyRaw) {
  // TODO: Think more deeply about this - it's probably unnecessary to do this check, since it would
  // mean malicious sync server, which is a bigger problem
  (0, _common.invariant)(!Object.prototype.hasOwnProperty.call(dirtyRaw, '__proto__'), 'Malicious dirtyRaw detected - contains a __proto__ key');
  var raw = Object.assign({}, dirtyRaw, {
    _status: 'synced',
    _changed: ''
  }); // faster than object spread

  return collection.prepareCreateFromDirtyRaw(raw);
}

function prepareUpdateFromRaw(record, updatedDirtyRaw, log, conflictResolver) {
  // Note COPY for log - only if needed
  var logConflict = log && !!record._raw._changed;
  var logLocal = logConflict ? (0, _extends2.default)({}, record._raw) : {};
  var logRemote = logConflict ? (0, _extends2.default)({}, updatedDirtyRaw) : {};
  var newRaw = resolveConflict(record._raw, updatedDirtyRaw);

  if (conflictResolver) {
    newRaw = conflictResolver(record.table, record._raw, updatedDirtyRaw, newRaw);
  } // $FlowFixMe


  return record.prepareUpdate(function () {
    replaceRaw(record, newRaw); // log resolved conflict - if any

    if (logConflict && log) {
      log.resolvedConflicts = log.resolvedConflicts || [];
      log.resolvedConflicts.push({
        local: logLocal,
        remote: logRemote,
        // $FlowFixMe
        resolved: (0, _extends2.default)({}, record._raw)
      });
    }
  });
}

function prepareMarkAsSynced(record) {
  var newRaw = Object.assign({}, record._raw, {
    _status: 'synced',
    _changed: ''
  }); // faster than object spread
  // $FlowFixMe

  return record.prepareUpdate(function () {
    replaceRaw(record, newRaw);
  });
}

function ensureSameDatabase(database, initialResetCount) {
  (0, _common.invariant)(database._resetCount === initialResetCount, "[Sync] Sync aborted because database was reset");
}

var isChangeSetEmpty = function (changeset) {
  return (0, _fp.values)(changeset).every(function ({
    created: created,
    updated: updated,
    deleted: deleted
  }) {
    return 0 === created.length + updated.length + deleted.length;
  });
};

exports.isChangeSetEmpty = isChangeSetEmpty;

var sum = function (xs) {
  return xs.reduce(function (a, b) {
    return a + b;
  }, 0);
};

var changeSetCount = function (changeset) {
  return sum((0, _fp.values)(changeset).map(function ({
    created: created,
    updated: updated,
    deleted: deleted
  }) {
    return created.length + updated.length + deleted.length;
  }));
};

exports.changeSetCount = changeSetCount;