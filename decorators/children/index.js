"use strict";

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _makeDecorator = _interopRequireDefault(require("../../utils/common/makeDecorator"));

var _logError = _interopRequireDefault(require("../../utils/common/logError"));

var _invariant = _interopRequireDefault(require("../../utils/common/invariant"));

var Q = _interopRequireWildcard(require("../../QueryDescription"));

// Defines a model property that queries records that *belong_to* this model
// Pass name of the table with desired records. (The model defining a @children property must
// have a has_many association defined with this table)
//
// Example: a Task has_many Comments, so it may define:
//   @children('comment') comments: Query<Comment>
var children = (0, _makeDecorator.default)(function (childTable) {
  return function () {
    return {
      get: function get() {
        // Use cached Query if possible
        this._childrenQueryCache = this._childrenQueryCache || {};
        var cachedQuery = this._childrenQueryCache[childTable];

        if (cachedQuery) {
          return cachedQuery;
        } // Cache new Query


        var model = this.asModel;
        var childCollection = model.collections.get(childTable);
        var association = model.constructor.associations[childTable];
        (0, _invariant.default)(association && 'has_many' === association.type, "@children decorator used for a table that's not has_many");
        var query = childCollection.query(Q.where(association.foreignKey, model.id));
        this._childrenQueryCache[childTable] = query;
        return query;
      },
      set: function set() {
        (0, _logError.default)('Setter called on a @children-marked property');
      }
    };
  };
});
var _default = children;
exports.default = _default;