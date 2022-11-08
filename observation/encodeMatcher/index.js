"use strict";

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = encodeMatcher;

var _allPass = _interopRequireDefault(require("../../utils/fp/allPass"));

var _anyPass = _interopRequireDefault(require("../../utils/fp/anyPass"));

var _invariant = _interopRequireDefault(require("../../utils/common/invariant"));

var _operators = _interopRequireDefault(require("./operators"));

var _canEncode = _interopRequireWildcard(require("./canEncode"));

/* eslint-disable no-use-before-define */
var encodeWhereDescription = function (description) {
  return function (rawRecord) {
    var left = rawRecord[description.left];
    var {
      comparison: comparison
    } = description;
    var operator = _operators.default[comparison.operator];
    var compRight = comparison.right;
    var right; // TODO: What about `undefined`s ?

    if (compRight.value !== undefined) {
      right = compRight.value;
    } else if (compRight.values) {
      right = compRight.values;
    } else if (compRight.column) {
      right = rawRecord[compRight.column];
    } else {
      throw new Error('Invalid comparisonRight');
    }

    return operator(left, right);
  };
};

var encodeWhere = function (where) {
  switch (where.type) {
    case 'where':
      return encodeWhereDescription(where);

    case 'and':
      return (0, _allPass.default)(where.conditions.map(encodeWhere));

    case 'or':
      return (0, _anyPass.default)(where.conditions.map(encodeWhere));

    case 'on':
      throw new Error('Illegal Q.on found -- nested Q.ons require explicit Q.experimentalJoinTables declaration');

    default:
      throw new Error("Illegal clause ".concat(where.type));
  }
};

var encodeConditions = function (conditions) {
  return (0, _allPass.default)(conditions.map(encodeWhere));
};

function encodeMatcher(query) {
  (0, _invariant.default)((0, _canEncode.default)(query), _canEncode.forbiddenError);
  return encodeConditions(query.where);
}