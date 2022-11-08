"use strict";

exports.__esModule = true;
exports.default = allPromisesObj;

function allPromisesObj(promisesObj) {
  return new Promise(function (resolve, reject) {
    var keys = Object.keys(promisesObj);
    var len = keys.length;
    Promise.all(Object.values(promisesObj)).then(function (result) {
      var resultObj = {};

      for (var i = 0; i < len; i++) {
        resultObj[keys[i]] = result[i];
      }

      resolve(resultObj);
    }, reject);
  });
}