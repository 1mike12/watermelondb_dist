"use strict";

exports.__esModule = true;
exports.default = exports.jsonDecorator = void 0;

var _common = require("../common");

// Defines a model property that's (de)serialized to and from JSON using custom sanitizer function.
//
// Pass the database column name as first argument, and sanitizer function as second.
//
// Stored value will be parsed to JSON if possible, and passed to sanitizer as argument, or
// undefined will be passed on parsing error. Field value will be result of sanitizer call.
//
// Value assigned to field will be passed to sanitizer and its results will be stored as stringified
// value.
//
// Examples:
//   @json('contact_info', jsonValue => jasonValue || {}) contactInfo: ContactInfo
var parseJSON = function (value) {
  // fast path
  if (null === value || value === undefined || '' === value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch (_) {
    return undefined;
  }
};

var defaultOptions = {
  memo: false
};

var jsonDecorator = function (rawFieldName, sanitizer, options = defaultOptions) {
  return function (target, key, descriptor) {
    (0, _common.ensureDecoratorUsedProperly)(rawFieldName, target, key, descriptor);
    return {
      configurable: true,
      enumerable: true,
      get: function get() {
        var rawValue = this.asModel._getRaw(rawFieldName);

        if (options.memo) {
          // Use cached value if possible
          this._jsonDecoratorCache = this._jsonDecoratorCache || {};
          var cachedEntry = this._jsonDecoratorCache[rawFieldName];

          if (cachedEntry && cachedEntry[0] === rawValue) {
            return cachedEntry[1];
          }
        }

        var parsedValue = parseJSON(rawValue);
        var sanitized = sanitizer(parsedValue, this);

        if (options.memo) {
          this._jsonDecoratorCache[rawFieldName] = [rawValue, sanitized];
        }

        return sanitized;
      },
      set: function set(json) {
        var sanitizedValue = sanitizer(json, this);
        var stringifiedValue = null != sanitizedValue ? JSON.stringify(sanitizedValue) : null;

        this.asModel._setRaw(rawFieldName, stringifiedValue);
      }
    };
  };
};

exports.jsonDecorator = jsonDecorator;
var _default = jsonDecorator;
exports.default = _default;