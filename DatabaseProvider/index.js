"use strict";

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = exports.DatabaseConsumer = exports.DatabaseContext = exports.withDatabase = void 0;

var _react = _interopRequireDefault(require("react"));

var _Database = _interopRequireDefault(require("../Database"));

var _DatabaseContext = _interopRequireWildcard(require("./DatabaseContext"));

exports.DatabaseContext = _DatabaseContext.default;
exports.DatabaseConsumer = _DatabaseContext.DatabaseConsumer;

var _withDatabase = _interopRequireDefault(require("./withDatabase"));

exports.withDatabase = _withDatabase.default;

/**
 * Database provider to create the database context
 * to allow child components to consume the database without prop drilling
 */
function DatabaseProvider({
  children: children,
  database: database
}) {
  if (!(database instanceof _Database.default)) {
    throw new Error('You must supply a valid database prop to the DatabaseProvider');
  }

  return /*#__PURE__*/_react.default.createElement(_DatabaseContext.Provider, {
    value: database
  }, children);
}

var _default = DatabaseProvider;
exports.default = _default;