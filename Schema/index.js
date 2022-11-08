"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.tableName = tableName;
exports.columnName = columnName;
exports.appSchema = appSchema;
exports.validateColumnSchema = validateColumnSchema;
exports.tableSchema = tableSchema;

var _invariant = _interopRequireDefault(require("../utils/common/invariant"));

// NOTE: Only require files needed (critical path on web)
function tableName(name) {
  return name;
}

function columnName(name) {
  return name;
}

function appSchema({
  version: version,
  tables: tableList,
  unsafeSql: unsafeSql
}) {
  if ('production' !== process.env.NODE_ENV) {
    (0, _invariant.default)(0 < version, "Schema version must be greater than 0");
  }

  var tables = tableList.reduce(function (map, table) {
    if ('production' !== process.env.NODE_ENV) {
      (0, _invariant.default)('object' === typeof table && table.name, "Table schema must contain a name");
    }

    map[table.name] = table;
    return map;
  }, {});
  return {
    version: version,
    tables: tables,
    unsafeSql: unsafeSql
  };
}

var validateName = function (name) {
  if ('production' !== process.env.NODE_ENV) {
    (0, _invariant.default)(!['id', '_changed', '_status', 'local_storage'].includes(name.toLowerCase()), "Invalid column or table name '".concat(name, "' - reserved by WatermelonDB"));

    var checkName = require('../utils/fp/checkName').default;

    checkName(name);
  }
};

function validateColumnSchema(column) {
  if ('production' !== process.env.NODE_ENV) {
    (0, _invariant.default)(column.name, "Missing column name");
    validateName(column.name);
    (0, _invariant.default)(['string', 'boolean', 'number'].includes(column.type), "Invalid type ".concat(column.type, " for column '").concat(column.name, "' (valid: string, boolean, number)"));

    if ('created_at' === column.name || 'updated_at' === column.name) {
      (0, _invariant.default)('number' === column.type && !column.isOptional, "".concat(column.name, " must be of type number and not optional"));
    }

    if ('last_modified' === column.name) {
      (0, _invariant.default)('number' === column.type, "For compatibility reasons, column last_modified must be of type 'number', and should be optional");
    }
  }
}

function tableSchema({
  name: name,
  columns: columnArray,
  unsafeSql: unsafeSql
}) {
  if ('production' !== process.env.NODE_ENV) {
    (0, _invariant.default)(name, "Missing table name in schema");
    validateName(name);
  }

  var columns = columnArray.reduce(function (map, column) {
    if ('production' !== process.env.NODE_ENV) {
      validateColumnSchema(column);
    }

    map[column.name] = column;
    return map;
  }, {});
  return {
    name: name,
    columns: columns,
    columnArray: columnArray,
    unsafeSql: unsafeSql
  };
}