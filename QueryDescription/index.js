"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.eq = eq;
exports.notEq = notEq;
exports.gt = gt;
exports.gte = gte;
exports.weakGt = weakGt;
exports.lt = lt;
exports.lte = lte;
exports.oneOf = oneOf;
exports.notIn = notIn;
exports.between = between;
exports.like = like;
exports.notLike = notLike;
exports.sanitizeLikeString = sanitizeLikeString;
exports.includes = includes;
exports.column = column;
exports.where = where;
exports.unsafeSqlExpr = unsafeSqlExpr;
exports.unsafeLokiExpr = unsafeLokiExpr;
exports.unsafeLokiTransform = unsafeLokiTransform;
exports.and = and;
exports.or = or;
exports.sortBy = sortBy;
exports.take = take;
exports.skip = skip;
exports.experimentalJoinTables = experimentalJoinTables;
exports.experimentalNestedJoin = experimentalNestedJoin;
exports.unsafeSqlQuery = unsafeSqlQuery;
exports.buildQueryDescription = buildQueryDescription;
exports.queryWithoutDeleted = queryWithoutDeleted;
exports.on = exports.desc = exports.asc = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime/helpers/extends"));

var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));

var _fp = require("../utils/fp");

var _invariant = _interopRequireDefault(require("../utils/common/invariant"));

var _logger = _interopRequireDefault(require("../utils/common/logger"));

var _checkName = _interopRequireDefault(require("../utils/fp/checkName"));

var _deepFreeze = _interopRequireDefault(require("../utils/common/deepFreeze"));

var _Schema = require("../Schema");

/* eslint-disable no-use-before-define */
// don't import whole `utils` to keep worker size small
var asc = 'asc';
exports.asc = asc;
var desc = 'desc';
exports.desc = desc;
var columnSymbol = Symbol('Q.column');
var comparisonSymbol = Symbol('QueryComparison'); // Note: These operators are designed to match SQLite semantics
// to ensure that iOS, Android, web, and Query observation yield exactly the same results
//
// - `true` and `false` are equal to `1` and `0`
//   (JS uses true/false, but SQLite uses 1/0)
// - `null`, `undefined`, and missing fields are equal
//   (SQLite queries return null, but newly created records might lack fields)
// - You can only compare columns to values/other columns of the same type
//   (e.g. string to int comparisons are not allowed)
// - numeric comparisons (<, <=, >, >=, between) with null on either side always return false
//   e.g. `null < 2 == false`
// - `null` on the right-hand-side of IN/NOT IN is not allowed
//   e.g. `Q.in([null, 'foo', 'bar'])`
// - `null` on the left-hand-side of IN/NOT IN will always return false
//   e.g. `null NOT IN (1, 2, 3) == false`

function _valueOrColumn(arg) {
  if (null === arg || 'object' !== typeof arg) {
    (0, _invariant.default)(arg !== undefined, 'Cannot compare to undefined in a Query. Did you mean null?');
    return {
      value: arg
    };
  }

  if ('string' === typeof arg.column) {
    (0, _invariant.default)(arg.type === columnSymbol, 'Invalid { column: } object passed to Watermelon query. You seem to be passing unsanitized user data to Query builder!');
    return {
      column: arg.column
    };
  }

  throw new Error("Invalid value passed to query");
} // Equals (weakly)
// Note:
// - (null == undefined) == true
// - (1 == true) == true
// - (0 == false) == true


function eq(valueOrColumn) {
  return {
    operator: 'eq',
    right: _valueOrColumn(valueOrColumn),
    type: comparisonSymbol
  };
} // Not equal (weakly)
// Note:
// - (null != undefined) == false
// - (1 != true) == false
// - (0 != false) == false


function notEq(valueOrColumn) {
  return {
    operator: 'notEq',
    right: _valueOrColumn(valueOrColumn),
    type: comparisonSymbol
  };
} // Greater than (SQLite semantics)
// Note:
// - (5 > null) == false


function gt(valueOrColumn) {
  return {
    operator: 'gt',
    right: _valueOrColumn(valueOrColumn),
    type: comparisonSymbol
  };
} // Greater than or equal (SQLite semantics)
// Note:
// - (5 >= null) == false


function gte(valueOrColumn) {
  return {
    operator: 'gte',
    right: _valueOrColumn(valueOrColumn),
    type: comparisonSymbol
  };
} // Greater than (JavaScript semantics)
// Note:
// - (5 > null) == true


function weakGt(valueOrColumn) {
  return {
    operator: 'weakGt',
    right: _valueOrColumn(valueOrColumn),
    type: comparisonSymbol
  };
} // Less than (SQLite semantics)
// Note:
// - (null < 5) == false


function lt(valueOrColumn) {
  return {
    operator: 'lt',
    right: _valueOrColumn(valueOrColumn),
    type: comparisonSymbol
  };
} // Less than or equal (SQLite semantics)
// Note:
// - (null <= 5) == false


function lte(valueOrColumn) {
  return {
    operator: 'lte',
    right: _valueOrColumn(valueOrColumn),
    type: comparisonSymbol
  };
} // Value in a set (SQLite IN semantics)
// Note:
// - `null` in `values` is not allowed!


function oneOf(values) {
  (0, _invariant.default)(Array.isArray(values), "argument passed to oneOf() is not an array");
  Object.freeze(values); // even in production, because it's an easy mistake to make

  return {
    operator: 'oneOf',
    right: {
      values: values
    },
    type: comparisonSymbol
  };
} // Value not in a set (SQLite NOT IN semantics)
// Note:
// - `null` in `values` is not allowed!
// - (null NOT IN (1, 2, 3)) == false


function notIn(values) {
  (0, _invariant.default)(Array.isArray(values), "argument passed to notIn() is not an array");
  Object.freeze(values); // even in production, because it's an easy mistake to make

  return {
    operator: 'notIn',
    right: {
      values: values
    },
    type: comparisonSymbol
  };
} // Number is between two numbers (greater than or equal left, and less than or equal right)


function between(left, right) {
  (0, _invariant.default)('number' === typeof left && 'number' === typeof right, 'Values passed to Q.between() are not numbers');
  return {
    operator: 'between',
    right: {
      values: [left, right]
    },
    type: comparisonSymbol
  };
}

function like(value) {
  (0, _invariant.default)('string' === typeof value, 'Value passed to Q.like() is not a string');
  return {
    operator: 'like',
    right: {
      value: value
    },
    type: comparisonSymbol
  };
}

function notLike(value) {
  (0, _invariant.default)('string' === typeof value, 'Value passed to Q.notLike() is not a string');
  return {
    operator: 'notLike',
    right: {
      value: value
    },
    type: comparisonSymbol
  };
}

var nonLikeSafeRegexp = /[^a-zA-Z0-9]/g;

function sanitizeLikeString(value) {
  (0, _invariant.default)('string' === typeof value, 'Value passed to Q.sanitizeLikeString() is not a string');
  return value.replace(nonLikeSafeRegexp, '_');
}

function includes(value) {
  (0, _invariant.default)('string' === typeof value, 'Value passed to Q.includes() is not a string');
  return {
    operator: 'includes',
    right: {
      value: value
    },
    type: comparisonSymbol
  };
}

function column(name) {
  (0, _invariant.default)('string' === typeof name, 'Name passed to Q.column() is not a string');
  return {
    column: (0, _checkName.default)(name),
    type: columnSymbol
  };
}

function _valueOrComparison(arg) {
  if (null === arg || 'object' !== typeof arg) {
    return _valueOrComparison(eq(arg));
  }

  (0, _invariant.default)(arg.type === comparisonSymbol, 'Invalid Comparison passed to Query builder. You seem to be passing unsanitized user data to Query builder!');
  var {
    operator: operator,
    right: right
  } = arg;
  return {
    operator: operator,
    right: right
  };
}

function where(left, valueOrComparison) {
  return {
    type: 'where',
    left: (0, _checkName.default)(left),
    comparison: _valueOrComparison(valueOrComparison)
  };
}

function unsafeSqlExpr(sql) {
  if ('production' !== process.env.NODE_ENV) {
    (0, _invariant.default)('string' === typeof sql, 'Value passed to Q.unsafeSqlExpr is not a string');
  }

  return {
    type: 'sql',
    expr: sql
  };
}

function unsafeLokiExpr(expr) {
  if ('production' !== process.env.NODE_ENV) {
    (0, _invariant.default)(expr && 'object' === typeof expr && !Array.isArray(expr), 'Value passed to Q.unsafeLokiExpr is not an object');
  }

  return {
    type: 'loki',
    expr: expr
  };
}

function unsafeLokiTransform(fn) {
  return {
    type: 'lokiTransform',
    function: fn
  };
}

var acceptableClauses = ['where', 'and', 'or', 'on', 'sql', 'loki'];

var isAcceptableClause = function (clause) {
  return acceptableClauses.includes(clause.type);
};

var validateConditions = function (clauses) {
  if ('production' !== process.env.NODE_ENV) {
    (0, _invariant.default)(clauses.every(isAcceptableClause), 'Q.and(), Q.or(), Q.on() can only contain: Q.where, Q.and, Q.or, Q.on, Q.unsafeSqlExpr, Q.unsafeLokiExpr clauses');
  }
};

function and(...clauses) {
  validateConditions(clauses);
  return {
    type: 'and',
    conditions: clauses
  };
}

function or(...clauses) {
  validateConditions(clauses);
  return {
    type: 'or',
    conditions: clauses
  };
}

function sortBy(sortColumn, sortOrder = asc) {
  (0, _invariant.default)('asc' === sortOrder || 'desc' === sortOrder, "Invalid sortOrder argument received in Q.sortBy (valid: asc, desc)");
  return {
    type: 'sortBy',
    sortColumn: (0, _checkName.default)(sortColumn),
    sortOrder: sortOrder
  };
}

function take(count) {
  (0, _invariant.default)('number' === typeof count, 'Value passed to Q.take() is not a number');
  return {
    type: 'take',
    count: count
  };
}

function skip(count) {
  (0, _invariant.default)('number' === typeof count, 'Value passed to Q.skip() is not a number');
  return {
    type: 'skip',
    count: count
  };
} // Note: we have to write out three separate meanings of OnFunction because of a Babel bug
// (it will remove the parentheses, changing the meaning of the flow type)


// Use: on('tableName', 'left_column', 'right_value')
// or: on('tableName', 'left_column', gte(10))
// or: on('tableName', where('left_column', 'value')))
// or: on('tableName', or(...))
// or: on('tableName', [where(...), where(...)])
var on = function (table, leftOrClauseOrList, valueOrComparison) {
  if ('string' === typeof leftOrClauseOrList) {
    (0, _invariant.default)(valueOrComparison !== undefined, 'illegal `undefined` passed to Q.on');
    return on(table, [where(leftOrClauseOrList, valueOrComparison)]);
  }

  var clauseOrList = leftOrClauseOrList;

  if (Array.isArray(clauseOrList)) {
    var conditions = clauseOrList;
    validateConditions(conditions);
    return {
      type: 'on',
      table: (0, _checkName.default)(table),
      conditions: conditions
    };
  } else if (clauseOrList && 'and' === clauseOrList.type) {
    return on(table, clauseOrList.conditions);
  }

  return on(table, [clauseOrList]);
};

exports.on = on;

function experimentalJoinTables(tables) {
  (0, _invariant.default)(Array.isArray(tables), 'experimentalJoinTables expected an array');
  return {
    type: 'joinTables',
    tables: tables.map(_checkName.default)
  };
}

function experimentalNestedJoin(from, to) {
  return {
    type: 'nestedJoinTable',
    from: (0, _checkName.default)(from),
    to: (0, _checkName.default)(to)
  };
}

function unsafeSqlQuery(sql, values = []) {
  if ('production' !== process.env.NODE_ENV) {
    (0, _invariant.default)('string' === typeof sql, 'Value passed to Q.unsafeSqlQuery is not a string');
    (0, _invariant.default)(Array.isArray(values), 'Placeholder values passed to Q.unsafeSqlQuery are not an array');
  }

  return {
    type: 'sqlQuery',
    sql: sql,
    values: values
  };
}

var syncStatusColumn = (0, _Schema.columnName)('_status');

var extractClauses = function (clauses) {
  var query = {
    where: [],
    joinTables: [],
    nestedJoinTables: [],
    sortBy: []
  };
  clauses.forEach(function (clause) {
    var _query$joinTables;

    var {
      type: type
    } = clause;

    switch (type) {
      case 'where':
      case 'and':
      case 'or':
      case 'sql':
      case 'loki':
        query.where.push(clause);
        break;

      case 'on':
        // $FlowFixMe
        query.joinTables.push(clause.table);
        query.where.push(clause);
        break;

      case 'sortBy':
        query.sortBy.push(clause);
        break;

      case 'take':
        // $FlowFixMe
        query.take = clause.count;
        break;

      case 'skip':
        // $FlowFixMe
        query.skip = clause.count;
        break;

      case 'joinTables':
        // $FlowFixMe
        (_query$joinTables = query.joinTables).push.apply(_query$joinTables, (0, _toConsumableArray2.default)(clause.tables));

        break;

      case 'nestedJoinTable':
        // $FlowFixMe
        query.nestedJoinTables.push({
          from: clause.from,
          to: clause.to
        });
        break;

      case 'lokiTransform':
        // $FlowFixMe
        query.lokiTransform = clause.function;
        break;

      case 'sqlQuery':
        // $FlowFixMe
        query.sql = clause;

        if ('production' !== process.env.NODE_ENV) {
          (0, _invariant.default)(clauses.every(function (_clause) {
            return ['sqlQuery', 'joinTables', 'nestedJoinTable'].includes(_clause.type);
          }), 'Cannot use Q.unsafeSqlQuery with other clauses, except for Q.experimentalJoinTables and Q.experimentalNestedJoin (Did you mean Q.unsafeSqlExpr?)');
        }

        break;

      default:
        throw new Error('Invalid Query clause passed');
    }
  });
  query.joinTables = (0, _fp.unique)(query.joinTables); // In the past, multiple separate top-level Q.ons were the only supported syntax and were automatically merged per-table to produce optimal code
  // We used to have a special case to avoid regressions, but it added complexity and had a side effect of rearranging the query suboptimally
  // We won't support this anymore, but will warn about suboptimal queries
  // TODO: Remove after 2022-01-01

  if ('production' !== process.env.NODE_ENV) {
    var onsEncountered = {};
    query.where.forEach(function (clause) {
      if ('on' === clause.type) {
        var table = clause.table;

        if (onsEncountered[table]) {
          _logger.default.warn("Found multiple Q.on('".concat(table, "', ...) clauses in a query. This is a performance bug - use a single Q.on('").concat(table, "', [condition1, condition1]) to produce a better performing query"));
        }

        onsEncountered[table] = true;
      }
    });
  } // $FlowFixMe: Flow is too dumb to realize that it is valid


  return query;
};

function buildQueryDescription(clauses) {
  var query = extractClauses(clauses);

  if ('production' !== process.env.NODE_ENV) {
    (0, _invariant.default)(!(query.skip && !query.take), 'cannot skip without take');
    (0, _deepFreeze.default)(query);
  }

  return query;
}

var whereNotDeleted = where(syncStatusColumn, notEq('deleted'));

function conditionsWithoutDeleted(conditions) {
  return conditions.map(queryWithoutDeletedImpl);
}

function queryWithoutDeletedImpl(clause) {
  if ('and' === clause.type) {
    return {
      type: 'and',
      conditions: conditionsWithoutDeleted(clause.conditions)
    };
  } else if ('or' === clause.type) {
    return {
      type: 'or',
      conditions: conditionsWithoutDeleted(clause.conditions)
    };
  } else if ('on' === clause.type) {
    var onClause = clause;
    return {
      type: 'on',
      table: onClause.table,
      conditions: conditionsWithoutDeleted(onClause.conditions).concat(whereNotDeleted)
    };
  }

  return clause;
}

function queryWithoutDeleted(query) {
  var {
    where: whereConditions
  } = query;
  var newQuery = (0, _extends2.default)({}, query, {
    where: conditionsWithoutDeleted(whereConditions).concat(whereNotDeleted)
  });

  if ('production' !== process.env.NODE_ENV) {
    (0, _deepFreeze.default)(newQuery);
  }

  return newQuery;
}