"use strict";

exports.__esModule = true;
exports.onLowMemory = onLowMemory;
exports._triggerOnLowMemory = _triggerOnLowMemory;
var lowMemoryCallbacks = [];

function onLowMemory(callback) {
  lowMemoryCallbacks.push(callback);
} // TODO: Not currently hooked up to anything


function _triggerOnLowMemory() {
  lowMemoryCallbacks.forEach(function (callback) {
    return callback();
  });
}